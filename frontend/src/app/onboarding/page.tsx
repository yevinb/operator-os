"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getSession, updateUser } from "@/lib/auth";
import { saveBusinessProfile } from "@/lib/business-context";
import { apiFetch, hasApiConfigured, setNicheMode } from "@/lib/api";
import { DEFAULT_INTEGRATIONS } from "@/lib/store";
import { NexaLogo } from "@/components/NexaLogo";

const NICHES = [
  { id: "agency", emoji: "🏢", label: "Agency", desc: "Clients, retainers, campaigns" },
  { id: "coach", emoji: "🎯", label: "Coach", desc: "Calls, cohorts, nurture" },
  { id: "ecommerce", emoji: "🛒", label: "E-commerce", desc: "Sales, ads, retention" },
  { id: "real_estate", emoji: "🏠", label: "Real Estate", desc: "Listings, leads, viewings" },
  { id: "general", emoji: "⚡", label: "General", desc: "Any business" },
];

const STEPS = [
  { title: "Pick your Nexa mode" },
  { title: "What does your business do?" },
  { title: "What's your #1 goal right now?", options: ["Grow revenue", "Cut costs", "Hire team", "Automate operations", "Expand globally"] },
  { title: "Where do you operate?" },
  { title: "Connect your tools" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);
  const [nicheMode, setNicheModeLocal] = useState("general");
  const [company, setCompany] = useState("");
  const [industry, setIndustry] = useState("");
  const [goal, setGoal] = useState("");
  const [market, setMarket] = useState("");
  const [connected, setConnected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session) router.replace("/signup");
    else {
      setCompany(session.company);
      setIndustry(session.industry || "");
      setGoal(session.goal || "");
      setMarket(session.market || "");
      setNicheModeLocal(session.niche_mode || "general");
      setReady(true);
    }
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center text-text-2">
        Loading…
      </div>
    );
  }

  const finish = async () => {
    setSaving(true);
    await updateUser({
      company,
      industry,
      goal,
      market,
      niche_mode: nicheMode,
      onboarded: true,
    });
    saveBusinessProfile({ company, industry, goal, market, niche_mode: nicheMode, connectedIntegrations: connected });

    if (await hasApiConfigured()) {
      try {
        await setNicheMode(nicheMode);
      } catch { /* ok */ }
      for (const id of connected) {
        try {
          await apiFetch(`/api/v1/integrations/${id}/connect`, {
            method: "POST",
            body: JSON.stringify({ api_key: "" }),
          });
        } catch { /* non-key integrations */ }
      }
    }

    setSaving(false);
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center mb-8">
          <NexaLogo variant="compact" href={false} className="mb-4" />
          <span className="text-lg font-bold text-center">Nexa runs your business — 60 second setup</span>
        </div>

        <div className="flex gap-2 mb-8 justify-center">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${i <= step ? "w-10 bg-accent" : "w-6 bg-surface-3"}`}
            />
          ))}
        </div>

        <div className="p-8 rounded-2xl bg-surface border border-border">
          <h2 className="text-xl font-bold mb-2">{STEPS[step].title}</h2>

          {step === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-text-2 mb-4">Each mode includes workflows, prompts, and automation tailored to your niche.</p>
              {NICHES.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => { setNicheModeLocal(n.id); setIndustry(n.label); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left ${
                    nicheMode === n.id ? "border-accent bg-accent/10" : "border-border hover:border-accent/30"
                  }`}
                >
                  <span className="text-2xl">{n.emoji}</span>
                  <div>
                    <p className="font-medium">{n.label}</p>
                    <p className="text-xs text-text-3">{n.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Company name"
                className="w-full px-4 py-3 rounded-xl bg-void border border-border text-text outline-none focus:border-accent"
              />
              <input
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="Industry detail (optional)"
                className="w-full px-4 py-3 rounded-xl bg-void border border-border text-text outline-none focus:border-accent"
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2">
              {STEPS[2].options!.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setGoal(opt)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                    goal === opt ? "border-accent bg-accent/10 text-accent" : "border-border hover:border-accent/30"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {step === 3 && (
            <input
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              placeholder="Market (e.g. UK, GCC, Global)"
              className="w-full px-4 py-3 rounded-xl bg-void border border-border text-text outline-none focus:border-accent"
            />
          )}

          {step === 4 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              <p className="text-sm text-text-2 mb-4">Select tools you use — connect keys in Integrations after launch.</p>
              {DEFAULT_INTEGRATIONS.slice(0, 8).map((int) => (
                <button
                  key={int.id}
                  type="button"
                  onClick={() =>
                    setConnected((c) =>
                      c.includes(int.id) ? c.filter((x) => x !== int.id) : [...c, int.id]
                    )
                  }
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                    connected.includes(int.id) ? "border-success bg-success/10" : "border-border hover:border-accent/30"
                  }`}
                >
                  <span className="text-xl">{int.icon}</span>
                  <div className="text-left flex-1">
                    <p className="text-sm font-medium">{int.name}</p>
                    <p className="text-xs text-text-3">{int.description}</p>
                  </div>
                  {connected.includes(int.id) && <Check size={16} className="text-success" />}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-3 mt-8">
            {step > 0 && (
              <Button variant="secondary" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            <Button
              className="flex-1"
              disabled={(step === 0 && !nicheMode) || (step === 1 && !company) || (step === 2 && !goal) || (step === 3 && !market) || saving}
              onClick={() => (step < STEPS.length - 1 ? setStep(step + 1) : finish())}
            >
              {saving ? "Launching…" : step < STEPS.length - 1 ? "Continue" : "Launch Nexa"}
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
