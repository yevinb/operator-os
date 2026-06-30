"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Zap, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getSession, updateUser } from "@/lib/auth";
import { DEFAULT_INTEGRATIONS } from "@/lib/store";

const STEPS = [
  {
    title: "What does your business do?",
    fields: ["company", "industry"] as const,
  },
  {
    title: "What's your #1 goal right now?",
    options: ["Grow revenue", "Cut costs", "Hire team", "Automate operations", "Expand globally"],
  },
  {
    title: "Connect your tools",
    subtitle: "OperatorOS works better with integrations. Connect now or later.",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);
  const [industry, setIndustry] = useState("");
  const [goal, setGoal] = useState("");
  const [connected, setConnected] = useState<string[]>([]);

  useEffect(() => {
    if (!getSession()) router.replace("/signup");
    else setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center text-text-2">
        Loading…
      </div>
    );
  }

  const user = getSession()!;

  const finish = () => {
    updateUser({ onboarded: true, company: user.company });
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <Zap size={20} className="text-white" />
          </div>
          <span className="text-xl font-bold">Setup your AI COO</span>
        </div>

        <div className="flex gap-2 mb-8 justify-center">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i <= step ? "w-12 bg-accent" : "w-8 bg-surface-3"
              }`}
            />
          ))}
        </div>

        <div className="p-8 rounded-2xl bg-surface border border-border">
          <h2 className="text-xl font-bold mb-6">{STEPS[step].title}</h2>

          {step === 0 && (
            <div className="space-y-4">
              <input
                defaultValue={user.company}
                onChange={(e) => updateUser({ company: e.target.value })}
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
                    goal === opt
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border hover:border-accent/30"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {DEFAULT_INTEGRATIONS.slice(0, 6).map((int) => (
                <button
                  key={int.id}
                  onClick={() =>
                    setConnected((c) =>
                      c.includes(int.id) ? c.filter((x) => x !== int.id) : [...c, int.id]
                    )
                  }
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                    connected.includes(int.id)
                      ? "border-success bg-success/10"
                      : "border-border hover:border-accent/30"
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
              <p className="text-xs text-text-3 text-center pt-2">
                More integrations available in dashboard
              </p>
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
              onClick={() => (step < STEPS.length - 1 ? setStep(step + 1) : finish())}
              disabled={step === 1 && !goal}
            >
              {step < STEPS.length - 1 ? "Continue" : "Launch OperatorOS"}
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
