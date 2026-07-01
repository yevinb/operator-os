"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { Plan, User } from "@/lib/types";
import { login, setSession, setToken, restoreOnboardingIfKnown } from "@/lib/auth";
import { getApiUrl } from "@/lib/api";
import { NexaLogo } from "@/components/NexaLogo";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid-bg flex items-center justify-center text-text-2">Loading…</div>}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const token = search.get("google_token");
    const oauthError = search.get("error");
    if (oauthError) {
      setError("Google sign-in failed. Please try again.");
      return;
    }
    if (!token) return;
    (async () => {
      try {
        setToken(token);
        const me = await fetch(`${getApiUrl()}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!me.ok) throw new Error("Google session invalid");
        const raw = await me.json();
        let session: User = {
          id: String(raw.id),
          email: String(raw.email),
          name: String(raw.name),
          company: String(raw.company),
          plan: (raw.plan || "starter") as Plan,
          onboarded: Boolean(raw.onboarded),
          createdAt: new Date().toISOString(),
          industry: String(raw.industry || ""),
          goal: String(raw.goal || ""),
          market: String(raw.market || ""),
          niche_mode: String(raw.niche_mode || "general"),
        };
        setSession(session);
        session = await restoreOnboardingIfKnown(session);
        router.replace(session.onboarded ? "/dashboard" : "/onboarding");
      } catch {
        setError("Google sign-in failed. Please try again.");
      }
    })();
  }, [search, router]);

  const handleGoogle = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/v1/auth/google/start`);
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.detail || "Google sign-in unavailable");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in unavailable");
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Enter your email");
      return;
    }
    if (!password) {
      setError("Enter your password");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const user = await login(email, password);
      const session = await restoreOnboardingIfKnown(user);
      router.push(session.onboarded ? "/dashboard" : "/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <NexaLogo variant="full" href="/" />
        </div>

        <div className="p-8 rounded-2xl bg-surface border border-border">
          <h1 className="text-2xl font-bold mb-1">Welcome back</h1>
          <p className="text-text-2 text-sm mb-6">Sign in to your AI COO</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-text-2 block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl bg-void border border-border text-text outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-sm text-text-2 block mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl bg-void border border-border text-text outline-none focus:border-accent"
              />
            </div>
            {error && <p className="text-danger text-sm">{error}</p>}
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
              {!loading && <ArrowRight size={16} />}
            </Button>
            <Button type="button" variant="secondary" className="w-full" size="lg" disabled={googleLoading} onClick={handleGoogle}>
              {googleLoading ? "Redirecting…" : "Sign in with Google"}
            </Button>
          </form>

          <p className="text-center text-sm text-text-3 mt-6">
            No account?{" "}
            <Link href="/signup" className="text-accent hover:underline">
              Start free trial
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
