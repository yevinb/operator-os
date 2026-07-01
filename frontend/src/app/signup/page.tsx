"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { signup } from "@/lib/auth";
import { getApiUrl } from "@/lib/api";
import { NexaLogo } from "@/components/NexaLogo";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

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
    if (!email.trim() || !name.trim() || !company.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    if (password.trim().length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await signup(email, name, company, password);
      router.push("/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <NexaLogo variant="full" href="/" />
        </div>

        <div className="p-8 rounded-2xl bg-surface border border-border">
          <h1 className="text-2xl font-bold mb-1">Start your AI COO</h1>
          <p className="text-text-2 text-sm mb-6">Creates a real account on our server</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl bg-void border border-border text-text outline-none focus:border-accent"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Work email"
              required
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl bg-void border border-border text-text outline-none focus:border-accent"
            />
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Company name"
              required
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl bg-void border border-border text-text outline-none focus:border-accent"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 6 chars)"
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl bg-void border border-border text-text outline-none focus:border-accent"
            />
            {error && <p className="text-danger text-sm">{error}</p>}
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "Creating account…" : "Create account"}
              {!loading && <ArrowRight size={16} />}
            </Button>
            <Button type="button" variant="secondary" className="w-full" size="lg" disabled={googleLoading} onClick={handleGoogle}>
              {googleLoading ? "Redirecting…" : "Continue with Google"}
            </Button>
          </form>

          <p className="text-center text-sm text-text-3 mt-6">
            Have an account?{" "}
            <Link href="/login" className="text-accent hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
