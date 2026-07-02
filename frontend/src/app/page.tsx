import Link from "next/link";
import { ArrowRight, Bell, Brain, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PricingSection } from "@/components/PricingSection";
import { NexaLogo } from "@/components/NexaLogo";

export default function Home() {
  return (
    <div className="min-h-screen bg-void hero-glow">
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <NexaLogo variant="compact" priority />
          <div className="hidden md:flex items-center gap-8 text-sm text-text-2">
            <a href="#how" className="hover:text-text transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-text transition-colors">Pricing</a>
          </div>
          <Link href="/signup">
            <Button size="sm" className="bg-gold text-black hover:brightness-110 font-bold">
              Sign up free
              <ArrowRight size={14} />
            </Button>
          </Link>
        </div>
      </nav>

      <section className="pt-32 pb-8 px-6 text-center">
        <div className="max-w-5xl mx-auto">
          <div className="flex justify-center mb-8">
            <NexaLogo variant="full" href="/" priority />
          </div>
          <p className="inline-block px-4 py-1.5 rounded-full bg-gold/10 border border-gold/30 text-gold text-sm font-bold mb-6">
            Introducing Brain
          </p>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-[0.95]">
            <span className="gradient-text">Learns your business</span>
            <br />
            every single day.
          </h1>
          <p className="text-xl md:text-2xl text-text-2 max-w-2xl mx-auto mb-8">
            So your marketing team can make <span className="text-white font-semibold">better decisions</span> — without more dashboards, agencies, or headcount.
          </p>
          <Link href="/signup">
            <Button size="lg" className="bg-gold text-black font-bold text-lg px-10">
              Get your Brain — free
              <ArrowRight size={18} />
            </Button>
          </Link>
        </div>
      </section>

      <section id="how" className="py-12 px-6 border-t border-white/10">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-4">
          {[
            { icon: Brain, title: "Connect your tools", desc: "Shopify, Stripe, Gmail, Meta — plug in what you already use." },
            { icon: Zap, title: "Brain learns daily", desc: "Your ads, sales, and customers unified into one clear picture." },
            { icon: Bell, title: "One decision a day", desc: "What to scale, pause, or test — no data dumps, no guesswork." },
          ].map((item) => (
            <div key={item.title} className="card-premium rounded-2xl p-5 text-left">
              <item.icon className="text-gold mb-3" size={24} />
              <h3 className="font-bold mb-1">{item.title}</h3>
              <p className="text-sm text-text-2">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-20 px-6 border-t border-white/10 bg-surface/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">How Brain works</h2>
          <p className="text-text-2 mb-12 max-w-lg mx-auto">Three steps. No technical setup. Built for store owners and small teams.</p>
          <div className="grid md:grid-cols-3 gap-8 text-left">
            {[
              { n: "1", t: "Connect", d: "Link Shopify, Stripe, or Gmail in one click." },
              { n: "2", t: "Learn", d: "Brain studies your business every day — ads, orders, customers." },
              { n: "3", t: "Decide", d: "Get one clear marketing decision each morning." },
            ].map((s) => (
              <div key={s.n} className="card-premium rounded-2xl p-6">
                <span className="text-4xl font-black text-gold/40">{s.n}</span>
                <h3 className="text-lg font-bold mt-2 mb-2">{s.t}</h3>
                <p className="text-text-2 text-sm">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PricingSection />

      <section className="py-24 px-6 text-center border-t border-white/10">
        <h2 className="text-4xl font-black mb-4">
          Better marketing decisions.<br />
          <span className="gradient-gold">Every single day.</span>
        </h2>
        <p className="text-text-2 mb-8 text-lg">Free during beta. Connect your store and get your first decision tomorrow.</p>
        <Link href="/signup">
          <Button size="lg" className="bg-gold text-black font-bold text-lg px-12 py-4 h-auto hover:brightness-110">
            Create free account
            <ArrowRight size={20} />
          </Button>
        </Link>
      </section>

      <footer className="py-10 px-6 text-center text-text-3 text-sm border-t border-white/10 space-y-2">
        <p className="text-text-2">Brain — learns your business every day</p>
        <p>
          <Link href="/privacy" className="text-gold hover:underline">Privacy Policy</Link>
          {" · "}
          <Link href="/terms" className="text-gold hover:underline">Terms of Service</Link>
        </p>
      </footer>
    </div>
  );
}
