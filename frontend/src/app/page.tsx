import Link from "next/link";
import { ArrowRight, Megaphone, Headphones, Calendar, BarChart3, Dices, Target, Bell, FileText, Brain, Bot, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LiveCommandDemo } from "@/components/LiveCommandDemo";
import { PricingSection } from "@/components/PricingSection";
import { NexaLogo } from "@/components/NexaLogo";

export default function Home() {
  return (
    <div className="min-h-screen bg-void hero-glow">
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <NexaLogo variant="compact" priority />
          <div className="hidden md:flex items-center gap-8 text-sm text-text-2">
            <a href="#demo" className="hover:text-gold transition-colors font-medium">Preview</a>
            <a href="#modes" className="hover:text-text transition-colors">Niche modes</a>
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
            ✦ NEXA BRAIN — YOUR SECOND MARKETING BRAIN
          </p>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-[0.95]">
            <span className="gradient-text">Learns your business</span>
            <br />
            every single day.
          </h1>
          <p className="text-xl md:text-2xl text-text-2 max-w-2xl mx-auto mb-4">
            Like Nas Brain — unified marketing data, <span className="text-white font-semibold">13 magic employees</span>, and one morning decision. No dashboards. No agency. No extra headcount.
          </p>
          <p className="text-sm text-text-3 mb-6">
            Daily ads monitoring · AI social content · Customer finder · SEO · UGC · 24/7 autopilot
          </p>
          <Link href="/signup">
            <Button size="lg" className="bg-gold text-black font-bold text-lg px-10">
              Start free — no terminal needed
              <ArrowRight size={18} />
            </Button>
          </Link>
        </div>
      </section>

      <section id="modes" className="py-12 px-6 border-t border-white/10">
        <div className="max-w-5xl mx-auto grid md:grid-cols-4 gap-4">
          {[
            { icon: Brain, title: "Nexa Brain", desc: "Learns your business daily — central intelligence hub" },
            { icon: Bot, title: "13 magic employees", desc: "Ads, social, SEO, UGC, outreach — run 24/7" },
            { icon: Zap, title: "One daily decision", desc: "Scale this, kill that, test here — no data dumps" },
            { icon: Bell, title: "Morning cycle", desc: "Learn → brief → agents execute automatically" },
          ].map((item) => (
            <div key={item.title} className="card-premium rounded-2xl p-5 text-left">
              <item.icon className="text-gold mb-3" size={24} />
              <h3 className="font-bold mb-1">{item.title}</h3>
              <p className="text-sm text-text-2">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="demo" className="py-12 px-6">
        <LiveCommandDemo />
      </section>

      <section id="capabilities" className="py-20 px-6 border-t border-white/10">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-black text-center mb-4">
            What Nexa <span className="gradient-gold">actually does</span>
          </h2>
          <p className="text-center text-text-2 text-lg mb-12 max-w-xl mx-auto">
            Tasks are marked complete only when verified on connected APIs. If setup is missing, Nexa shows exactly what to connect next.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {[
              { icon: Megaphone, title: "Marketing", desc: "Lead gen plans, Meta/Google, Slack, n8n" },
              { icon: Headphones, title: "Customers", desc: "Gmail, HubSpot CRM, nurture sequences" },
              { icon: Calendar, title: "Operations", desc: "Calendar, Notion logs, team alerts" },
              { icon: BarChart3, title: "Finance", desc: "Stripe live data, QuickBooks, reports" },
            ].map((item) => (
              <div key={item.title} className="card-premium rounded-2xl p-6">
                <item.icon className="text-gold mb-4" size={28} />
                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-text-2">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="card-premium rounded-2xl p-8">
            <h3 className="text-xl font-bold mb-6">12 integrations + Nexa engine</h3>
            <div className="grid md:grid-cols-2 gap-4 text-text-2">
              {[
                "Stripe — live revenue & customer count",
                "Slack — post command updates to your channel",
                "Gmail & Calendar — send emails, book meetings",
                "HubSpot — CRM contacts & pipeline data",
                "Notion — create pages in your database",
                "n8n — trigger any workflow you build",
                "Meta & Google Ads — account verification",
                "Verified execution only — no fake completion",
              ].map((t) => (
                <div key={t} className="flex items-start gap-3">
                  <span className="text-gold text-lg">→</span>
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 border-t border-white/10 bg-surface/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-12">How it works</h2>
          <div className="grid md:grid-cols-3 gap-8 text-left">
            {[
              { n: "1", t: "Plug in", d: "Connect Gmail, Stripe, Meta, HubSpot — your existing stack." },
              { n: "2", t: "Build your brain", d: "All marketing data unified in one intelligence hub." },
              { n: "3", t: "Deploy agents", d: "13 AI employees trained on your business and goals." },
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
          Your business,<br />
          <span className="gradient-gold">on autopilot.</span>
        </h2>
        <p className="text-text-2 mb-8 text-lg">Free during beta. Sign up — updates deploy automatically to this site.</p>
        <Link href="/signup">
          <Button size="lg" className="bg-gold text-black font-bold text-lg px-12 py-4 h-auto hover:brightness-110">
            Create free account
            <ArrowRight size={20} />
          </Button>
        </Link>
      </section>

      <footer className="py-10 px-6 text-center text-text-3 text-sm border-t border-white/10 space-y-2">
        <p className="text-text-2">
          Nexa — AI business operating system by{" "}
          <a href="mailto:yevin.bollegala@gmail.com" className="text-gold hover:underline">
            yevin.bollegala@gmail.com
          </a>
        </p>
        <p>
          <Link href="/privacy" className="text-gold hover:underline">Privacy Policy</Link>
          {" · "}
          <Link href="/terms" className="text-gold hover:underline">Terms of Service</Link>
          {" · "}
          <a href="https://yevinb.github.io/operator-os/" className="hover:underline">yevinb.github.io/operator-os</a>
        </p>
      </footer>
    </div>
  );
}
