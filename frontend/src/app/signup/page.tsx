"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { signup } from "@/lib/auth";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !name || !company) return;
    await signup(email, name, company, password);
    router.push("/onboarding");
  };

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <Zap size={20} className="text-white" />
          </div>
          <span className="text-xl font-bold">OperatorOS</span>
        </Link>

        <div className="p-8 rounded-2xl bg-surface border border-border">
          <h1 className="text-2xl font-bold mb-1">Start your AI COO</h1>
          <p className="text-text-2 text-sm mb-6">14-day free trial · No credit card</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
              className="w-full px-4 py-3 rounded-xl bg-void border border-border text-text outline-none focus:border-accent"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Work email"
              required
              className="w-full px-4 py-3 rounded-xl bg-void border border-border text-text outline-none focus:border-accent"
            />
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Company name"
              required
              className="w-full px-4 py-3 rounded-xl bg-void border border-border text-text outline-none focus:border-accent"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-3 rounded-xl bg-void border border-border text-text outline-none focus:border-accent"
            />
            <Button type="submit" className="w-full" size="lg">
              Create account
              <ArrowRight size={16} />
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
