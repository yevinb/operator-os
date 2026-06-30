"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Zap, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getSession, updateUser } from "@/lib/auth";
import { saveBusinessProfile } from "@/lib/business-context";
import { apiFetch, hasApiConfigured } from "@/lib/api";
import { DEFAULT_INTEGRATIONS } from "@/lib/store";

const STEPS = [
  { title: "What does your business do?" },
  { title: "What's your #1 goal right now?", options: ["Grow revenue", "Cut costs", "Hire team", "Automate operations", "Expand globally"] },
  { title: "Where do you operate?" },
  { title: "Connect your tools" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);
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
      onboarded: true,
    });
    saveBusinessProfile({ company, industry, goal, market, connectedIntegrations: connected });

    if (await hasApiConfigured()) {
      for (const id of connected) {
        try {
          await apiFetch(`/api/v1/integrations/${id}/connect`, {
            method: "POST",
            body: JSON.stringify({ api_key: "" }),
          });
        } catch {
          // non-key integrations
        }
      }
    }

    setSaving(false);
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <Zap size={20} className="text-white" />
          </div>
          <span className="text-xl font-bold">Teach your AI COO about your business</span>
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
            <p className="text-sm text-text-2 mb-6">The AI uses this to tailor every command to your company.</p>
          )}

          {step === 0 && (
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
                placeholder="Industry (e.g. E-commerce, SaaS, Agency)"
                className="w-full px-4 py-3 rounded-xl bg-void border border-border text-text outline-none focus:border-accent"
              />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-2">
              {STEPS[1].options!.map((opt) => (
                <button
                  key={opt}
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

          {step === 2 && (
            <input
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              placeholder="Market (e.g. Kuwait, GCC, Global)"
              className="w-full px-4 py-3 rounded-xl bg-void border border-border text-text outline-none focus:border-accent"
            />
          )}

          {step === 3 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              <p className="text-sm text-text-2 mb-4">Connect tools in Integrations after setup. Select what you use:</p>
              {DEFAULT_INTEGRATIONS.slice(0, 8).map((int) => (
                <button
                  key={int.id}
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
              disabled={(step === 0 && (!company || !industry)) || (step === 1 && !goal) || (step === 2 && !market) || saving}
              onClick={() => (step < STEPS.length - 1 ? setStep(step + 1) : finish())}
            >
              {saving ? "Saving…" : step < STEPS.length - 1 ? "Continue" : "Launch Nexa"}
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
