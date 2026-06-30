"use client";

import { useState } from "react";
import { getSession, updateUser } from "@/lib/auth";
import { Button } from "@/components/ui/Button";

export default function SettingsPage() {
  const user = getSession();
  const [name, setName] = useState(user?.name ?? "");
  const [company, setCompany] = useState(user?.company ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [industry, setIndustry] = useState(user?.industry ?? "");
  const [goal, setGoal] = useState(user?.goal ?? "");
  const [market, setMarket] = useState(user?.market ?? "");
  const [saved, setSaved] = useState(false);

  if (!user) return null;

  const save = async () => {
    await updateUser({ name, company, email, industry, goal, market });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Settings</h1>
      <p className="text-text-2 text-sm mb-8">Your AI COO uses this profile for every command.</p>

      {saved && (
        <div className="mb-4 p-3 rounded-xl bg-success/10 text-success text-sm">Settings saved.</div>
      )}

      <div className="space-y-6">
        <section className="p-6 rounded-2xl bg-surface border border-border space-y-4">
          <h2 className="font-semibold">Profile</h2>
          <div>
            <label className="text-sm text-text-2 block mb-1">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-void border border-border text-text outline-none focus:border-accent" />
          </div>
          <div>
            <label className="text-sm text-text-2 block mb-1">Company</label>
            <input value={company} onChange={(e) => setCompany(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-void border border-border text-text outline-none focus:border-accent" />
          </div>
          <div>
            <label className="text-sm text-text-2 block mb-1">Industry</label>
            <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Marketing agency, E-commerce" className="w-full px-4 py-3 rounded-xl bg-void border border-border text-text outline-none focus:border-accent" />
          </div>
          <div>
            <label className="text-sm text-text-2 block mb-1">Primary goal</label>
            <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. Grow revenue" className="w-full px-4 py-3 rounded-xl bg-void border border-border text-text outline-none focus:border-accent" />
          </div>
          <div>
            <label className="text-sm text-text-2 block mb-1">Market</label>
            <input value={market} onChange={(e) => setMarket(e.target.value)} placeholder="e.g. Kuwait, GCC" className="w-full px-4 py-3 rounded-xl bg-void border border-border text-text outline-none focus:border-accent" />
          </div>
          <div>
            <label className="text-sm text-text-2 block mb-1">Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-void border border-border text-text outline-none focus:border-accent" />
          </div>
          <Button onClick={save}>Save changes</Button>
        </section>
      </div>
    </div>
  );
}
