"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { Plan, User } from "@/lib/types";
import { login, persistAuth, getRememberMe, setRememberMe, restoreOnboardingIfKnown, markEmailOnboarded, validateSession } from "@/lib/auth";
import { initApiConfig, getApiUrlSync } from "@/lib/api-config";
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
  const [keepSignedIn, setKeepSignedIn] = useState(true);

  useEffect(() => {
    setKeepSignedIn(getRememberMe());
  }, []);

  useEffect(() => {
    const token = search.get("google_token");
    const oauthError = search.get("error");
    if (oauthError) {
      setError("Google sign-in failed. Please try again.");
      return;
    }
    if (token) {
      (async () => {
        try {
          await initApiConfig();
          const remember =
            search.get("remember") !== "0" && getRememberMe();
          setRememberMe(remember);
          const me = await fetch(`${getApiUrlSync()}/api/v1/auth/me`, {
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
          markEmailOnboarded(session.email);
          persistAuth(token, session, remember);
          session = await restoreOnboardingIfKnown(session);
          router.replace("/dashboard");
        } catch {
          setError("Google sign-in failed. Please try again.");
        }
      })();
      return;
    }

    // Already signed in — skip login screen
    (async () => {
      const session = await validateSession();
      if (session) router.replace("/dashboard");
    })();
  }, [search, router]);

  const handleGoogle = async () => {
    setError("");
    setGoogleLoading(true);
    setRememberMe(keepSignedIn);
    try {
      await initApiConfig();
      const rememberParam = keepSignedIn ? "1" : "0";
      const res = await fetch(
        `${getApiUrlSync()}/api/v1/auth/google/start?remember=${rememberParam}`
      );
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
      const user = await login(email, password, keepSignedIn);
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
          <p className="text-text-2 text-sm mb-6">Sign in with Google or email. You&apos;ll stay signed in on this device.</p>

          <label className="flex items-center gap-2 text-sm text-text-2 cursor-pointer select-none mb-4">
            <input
              type="checkbox"
              checked={keepSignedIn}
              onChange={(e) => setKeepSignedIn(e.target.checked)}
              className="rounded border-border accent-accent"
            />
            Keep me signed in
          </label>

          <Button
            type="button"
            variant="secondary"
            className="w-full mb-4"
            size="lg"
            disabled={googleLoading}
            onClick={handleGoogle}
          >
            {googleLoading ? "Redirecting…" : "Sign in with Google"}
          </Button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-surface px-2 text-text-3">or with email</span>
            </div>
          </div>

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
