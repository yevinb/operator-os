import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PricingSection } from "@/components/PricingSection";
import { FeaturesSection } from "@/components/FeaturesSection";

function HeroDemo() {
  return (
    <div className="mt-12 p-6 rounded-2xl bg-surface/60 border border-border backdrop-blur-sm max-w-2xl mx-auto">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-accent">CEO</span>
        </div>
        <div className="px-4 py-2 rounded-2xl rounded-tl-sm bg-surface-2 text-text text-sm">
          Increase sales.
        </div>
      </div>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0">
          <Zap size={14} className="text-white" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-accent/10 border border-accent/20 text-sm text-text">
            <span className="text-accent font-medium">OperatorOS</span> is executing 7 autonomous actions...
          </div>
          <div className="space-y-1.5 pl-2">
            {[
              "Creating 3 ad variants",
              "Launching Meta campaigns",
              "Following up 47 warm leads",
              "A/B testing landing page",
            ].map((action) => (
              <div key={action} className="flex items-center gap-2 text-xs text-text-2">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                {action}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen grid-bg">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border bg-void/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <span className="font-semibold text-text">OperatorOS</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-text-2">
            <a href="#features" className="hover:text-text transition-colors">Features</a>
            <a href="#pricing" className="hover:text-text transition-colors">Pricing</a>
            <a href="#how" className="hover:text-text transition-colors">How it works</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href="/dashboard">
              <Button size="sm">
                Start free trial
                <ArrowRight size={14} />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-sm mb-8">
            <Zap size={14} />
            Not a chatbot. An autonomous employee.
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            <span className="gradient-text">Your AI Chief</span>
            <br />
            Operating Officer
          </h1>

          <p className="text-xl text-text-2 max-w-2xl mx-auto mb-4 leading-relaxed">
            Say what you need. OperatorOS runs your business — ads, customers, reports, hiring, and more.
            One voice command. Full company execution.
          </p>

          <p className="text-sm text-text-3 mb-10">
            Trusted by founders who refuse to build another AI wrapper.
          </p>

          <Link href="/dashboard">
            <Button size="lg" className="text-base">
              Open Command Center
              <ArrowRight size={18} />
            </Button>
          </Link>

          <HeroDemo />
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-20 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            How it works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "You command",
                desc: 'Type or speak: "Grow my business." Like Siri, but for your entire company.',
              },
              {
                step: "02",
                title: "AI executes",
                desc: "OperatorOS creates ads, replies to customers, books meetings, and tracks conversions — autonomously.",
              },
              {
                step: "03",
                title: "Business compounds",
                desc: "It learns from results, improves itself, and compounds value every month you pay.",
              },
            ].map((item) => (
              <div key={item.step} className="p-6 rounded-2xl bg-surface border border-border">
                <span className="text-accent font-mono text-sm">{item.step}</span>
                <h3 className="text-lg font-semibold mt-2 mb-2">{item.title}</h3>
                <p className="text-text-2 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FeaturesSection />
      <PricingSection />

      {/* CTA */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            Stop building tools.<br />Start running a company.
          </h2>
          <p className="text-text-2 mb-8">
            10,000 customers × $500/month = $5M/month. The product is the engine. Phase 1 starts now.
          </p>
          <Link href="/dashboard">
            <Button size="lg">
              Launch OperatorOS
              <ArrowRight size={18} />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border text-center text-sm text-text-3">
        <p>OperatorOS — Build a company, not an app.</p>
      </footer>
    </div>
  );
}
