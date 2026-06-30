import Link from "next/link";
import { ArrowRight, Zap, Megaphone, Headphones, Calendar, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LiveCommandDemo } from "@/components/LiveCommandDemo";
import { PricingSection } from "@/components/PricingSection";

export default function Home() {
  return (
    <div className="min-h-screen bg-void hero-glow">
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold to-amber-600 flex items-center justify-center">
              <Zap size={18} className="text-black" />
            </div>
            <span className="font-bold text-lg">OperatorOS</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-text-2">
            <a href="#demo" className="hover:text-gold transition-colors font-medium">Live Demo</a>
            <a href="#capabilities" className="hover:text-text transition-colors">Capabilities</a>
            <a href="#pricing" className="hover:text-text transition-colors">Pricing</a>
          </div>
          <Link href="/signup">
            <Button size="sm" className="bg-gold text-black hover:brightness-110 font-bold">
              Start free
              <ArrowRight size={14} />
            </Button>
          </Link>
        </div>
      </nav>

      <section className="pt-28 pb-8 px-6 text-center">
        <div className="max-w-5xl mx-auto">
          <p className="inline-block px-4 py-1.5 rounded-full bg-gold/10 border border-gold/30 text-gold text-sm font-bold mb-6">
            NOT A CHATBOT — AN AUTONOMOUS EMPLOYEE
          </p>
          <h1 className="text-5xl md:text-8xl font-black tracking-tight mb-6 leading-[0.95]">
            <span className="gradient-text">Your AI</span>
            <br />
            Chief Operating Officer
          </h1>
          <p className="text-xl md:text-2xl text-text-2 max-w-2xl mx-auto mb-4">
            You type <span className="text-white font-semibold">&ldquo;Increase sales.&rdquo;</span>
            <br />It creates ads, launches campaigns, replies to customers — autonomously.
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
            Not another AI wrapper. A system that runs operations while you focus on strategy.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {[
              { icon: Megaphone, title: "Marketing", desc: "Ads, campaigns, newsletters, social posts" },
              { icon: Headphones, title: "Customers", desc: "Replies, support tickets, onboarding flows" },
              { icon: Calendar, title: "Operations", desc: "Meetings, calendar, vendor management" },
              { icon: BarChart3, title: "Finance", desc: "Revenue reports, cash flow, executive dashboards" },
            ].map((item) => (
              <div key={item.title} className="card-premium rounded-2xl p-6">
                <item.icon className="text-gold mb-4" size={28} />
                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-text-2">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="card-premium rounded-2xl p-8">
            <h3 className="text-xl font-bold mb-6">Full autonomous operations</h3>
            <div className="grid md:grid-cols-2 gap-4 text-text-2">
              {[
                "Creates & launches ad campaigns on Google + Meta",
                "Replies to customers & resolves support tickets",
                "Books meetings & manages your calendar",
                "Writes newsletters to thousands of subscribers",
                "Hires people — posts jobs, screens, schedules interviews",
                "Checks revenue, cash flow, manages vendors",
                "Answers Slack & generates executive reports",
                "Gets smarter every month you use it",
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
              { n: "1", t: "You command", d: 'Type "Grow my business." One sentence. Full company.' },
              { n: "2", t: "AI executes", d: "Autonomous actions run instantly — ads, emails, reports, hiring." },
              { n: "3", t: "Business runs", d: "Operations keep moving 24/7. You review results, not busywork." },
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
          <span className="gradient-gold">Not your inbox.</span>
        </h2>
        <p className="text-text-2 mb-8 text-lg">Deploy your AI COO in minutes.</p>
        <Link href="/signup">
          <Button size="lg" className="bg-gold text-black font-bold text-lg px-12 py-4 h-auto hover:brightness-110">
            Launch OperatorOS — Free
            <ArrowRight size={20} />
          </Button>
        </Link>
      </section>

      <footer className="py-8 text-center text-text-3 text-sm border-t border-white/10">
        OperatorOS · AI Chief Operating Officer · Kuwait → Global
      </footer>
    </div>
  );
}
