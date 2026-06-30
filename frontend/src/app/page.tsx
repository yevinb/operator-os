import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PricingSection } from "@/components/PricingSection";
import { FeaturesSection } from "@/components/FeaturesSection";
import { ValuationSection } from "@/components/ValuationSection";
import { SiriHero } from "@/components/SiriHero";

export default function Home() {
  return (
    <div className="min-h-screen grid-bg">
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border bg-void/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <span className="font-semibold text-text">OperatorOS</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-text-2">
            <a href="#vision" className="hover:text-text transition-colors">$30M path</a>
            <a href="#features" className="hover:text-text transition-colors">Features</a>
            <a href="#pricing" className="hover:text-text transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">
                Start free trial
                <ArrowRight size={14} />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-12 px-6">
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
            Say what you need — just like Siri. OperatorOS runs your business:
            ads, customers, reports, hiring, and more.
          </p>

          <p className="text-sm text-text-3 mb-8">
            500 customers × $500/mo = $30M company. Start with one command.
          </p>

          <Link href="/signup">
            <Button size="lg" className="text-base">
              Start free trial
              <ArrowRight size={18} />
            </Button>
          </Link>
        </div>
      </section>

      <ValuationSection />

      <section id="siri" className="pb-20 px-6">
        <SiriHero />
      </section>

      <section id="how" className="py-20 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">How it works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "You speak",
                desc: 'Tap the orb and say: "Grow my business." Like Siri — one voice, full company control.',
              },
              {
                step: "02",
                title: "AI executes",
                desc: "OperatorOS creates ads, replies to customers, books meetings — then speaks back what it's doing.",
              },
              {
                step: "03",
                title: "Business compounds",
                desc: "It learns from results, improves itself, and compounds value every month.",
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

      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            Stop building tools.<br />Start running a company.
          </h2>
          <p className="text-text-2 mb-8">
            One voice. One command. Your entire business — operated by AI.
          </p>
          <Link href="/signup">
            <Button size="lg">
              Launch OperatorOS
              <ArrowRight size={18} />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="py-8 px-6 border-t border-border text-center text-sm text-text-3">
        <p>OperatorOS — Build a company, not an app.</p>
      </footer>
    </div>
  );
}
