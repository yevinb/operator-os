import Link from "next/link";
import { ArrowRight, Megaphone, Headphones, Calendar, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LiveCommandDemo } from "@/components/LiveCommandDemo";
import { PricingSection } from "@/components/PricingSection";
import { NexaLogo } from "@/components/NexaLogo";

export default function Home() {
  return (
    <div className="min-h-screen bg-void hero-glow">
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <NexaLogo variant="compact" priority />
          <div className="hidden md:flex items-center gap-8 text-sm text-text-2">
            <a href="#demo" className="hover:text-gold transition-colors font-medium">Preview</a>
            <a href="#capabilities" className="hover:text-text transition-colors">Capabilities</a>
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

      <section className="pt-28 pb-8 px-6 text-center">
        <div className="max-w-5xl mx-auto">
          <div className="flex justify-center mb-8">
            <NexaLogo variant="full" href="/" priority />
          </div>
          <p className="inline-block px-4 py-1.5 rounded-full bg-gold/10 border border-gold/30 text-gold text-sm font-bold mb-6">
            AI COO — REAL API EXECUTION
          </p>
          <h1 className="text-5xl md:text-8xl font-black tracking-tight mb-6 leading-[0.95]">
            <span className="gradient-text">Your AI</span>
            <br />
            Chief Operating Officer
          </h1>
          <p className="text-xl md:text-2xl text-text-2 max-w-2xl mx-auto mb-4">
            Type a command. Nexa runs it against{" "}
            <span className="text-white font-semibold">your real tools</span> — Stripe, Slack, Gmail, HubSpot, n8n, and more.
          </p>
        </div>
      </section>

      <section id="demo" className="py-12 px-6">
        <LiveCommandDemo />
      </section>

      <section id="capabilities" className="py-20 px-6 border-t border-white/10">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-black text-center mb-4">
            What your AI COO <span className="gradient-gold">actually does</span>
          </h2>
          <p className="text-center text-text-2 text-lg mb-12 max-w-xl mx-auto">
            Connect your integrations. Commands execute on live APIs — or show exactly what to connect next.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {[
              { icon: Megaphone, title: "Marketing", desc: "Meta & Google Ads status, Slack updates, n8n workflows" },
              { icon: Headphones, title: "Customers", desc: "Gmail sends, HubSpot CRM, support via n8n" },
              { icon: Calendar, title: "Operations", desc: "Google Calendar events, Notion logs, Slack alerts" },
              { icon: BarChart3, title: "Finance", desc: "Live Stripe balance, QuickBooks sync, real reports" },
            ].map((item) => (
              <div key={item.title} className="card-premium rounded-2xl p-6">
                <item.icon className="text-gold mb-4" size={28} />
                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-text-2">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="card-premium rounded-2xl p-8">
            <h3 className="text-xl font-bold mb-6">12 integrations — verified on connect</h3>
            <div className="grid md:grid-cols-2 gap-4 text-text-2">
              {[
                "Stripe — live revenue & customer count",
                "Slack — post command updates to your channel",
                "Gmail & Calendar — send emails, book meetings",
                "HubSpot — CRM contacts & pipeline data",
                "Notion — create pages in your database",
                "n8n — trigger any workflow you build",
                "Meta & Google Ads — account verification",
                "QuickBooks, LinkedIn, MCP — finance, hiring, custom tools",
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
              { n: "1", t: "Sign up & connect", d: "Link Stripe, Slack, Gmail, or n8n in under 2 minutes." },
              { n: "2", t: "You command", d: '"Post to Slack" or "Check Stripe balance" — one sentence.' },
              { n: "3", t: "Live execution", d: "Green = ran on API. Yellow = connect the tool shown to unlock it." },
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
          Run your company.<br />
          <span className="gradient-gold">On real APIs.</span>
        </h2>
        <p className="text-text-2 mb-8 text-lg">Free to start. Connect integrations. Pay when billing launches.</p>
        <Link href="/signup">
          <Button size="lg" className="bg-gold text-black font-bold text-lg px-12 py-4 h-auto hover:brightness-110">
            Create free account
            <ArrowRight size={20} />
          </Button>
        </Link>
      </section>

      <footer className="py-8 text-center text-text-3 text-sm border-t border-white/10">
        Nexa · AI Chief Operating Officer · Kuwait → Global
      </footer>
    </div>
  );
}
