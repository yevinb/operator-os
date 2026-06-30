"use client";

import { useState } from "react";
import { getSession, updateUser } from "@/lib/auth";
import { Button } from "@/components/ui/Button";

export default function SettingsPage() {
  const user = getSession();
  const [name, setName] = useState(user?.name ?? "");
  const [company, setCompany] = useState(user?.company ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [saved, setSaved] = useState(false);

  if (!user) return null;

  const save = () => {
    updateUser({ name, company, email });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Settings</h1>
      <p className="text-text-2 text-sm mb-8">Manage your account and AI preferences.</p>

      {saved && (
        <div className="mb-4 p-3 rounded-xl bg-success/10 text-success text-sm">Settings saved.</div>
      )}

      <div className="space-y-6">
        <section className="p-6 rounded-2xl bg-surface border border-border space-y-4">
          <h2 className="font-semibold">Profile</h2>
          <div>
            <label className="text-sm text-text-2 block mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-void border border-border text-text outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-sm text-text-2 block mb-1">Company</label>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-void border border-border text-text outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-sm text-text-2 block mb-1">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-void border border-border text-text outline-none focus:border-accent"
            />
          </div>
          <Button onClick={save}>Save changes</Button>
        </section>

        <section className="p-6 rounded-2xl bg-surface border border-border">
          <h2 className="font-semibold mb-4">AI Configuration</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-text-2">Primary AI</span>
              <span className="text-text">GPT-4o (auto-fallback Claude, Gemini)</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-text-2">Memory</span>
              <span className="text-text">PostgreSQL + Vector DB</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-text-2">Task queue</span>
              <span className="text-text">Redis</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-text-2">Automation</span>
              <span className="text-text">n8n + MCP + Browser</span>
            </div>
          </div>
        </section>

        <section className="p-6 rounded-2xl bg-surface border border-border">
          <h2 className="font-semibold mb-2">Hosting</h2>
          <p className="text-sm text-text-2">
            Frontend: Vercel · Backend: Railway · CDN: Cloudflare
          </p>
        </section>
      </div>
    </div>
  );
}
