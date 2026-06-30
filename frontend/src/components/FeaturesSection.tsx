import { Megaphone, Headphones, BarChart3, Users, Zap, MessageSquare } from "lucide-react";

const FEATURES = [
  {
    icon: Megaphone,
    title: "Runs marketing",
    desc: "Creates ads, launches campaigns, writes newsletters, and optimizes spend — without you touching a dashboard.",
  },
  {
    icon: Headphones,
    title: "Handles customers",
    desc: "Replies to emails, resolves tickets, sends onboarding sequences, and flags churn risk automatically.",
  },
  {
    icon: BarChart3,
    title: "Tracks everything",
    desc: "Monitors revenue, conversions, and KPIs. Generates executive reports and predicts cash flow.",
  },
  {
    icon: Users,
    title: "Manages people",
    desc: "Screens candidates, schedules interviews, reviews team performance, and updates org charts.",
  },
  {
    icon: MessageSquare,
    title: "Answers Slack",
    desc: "Responds in your voice across Slack, email, and customer channels. Always on, always aligned.",
  },
  {
    icon: Zap,
    title: "Improves itself",
    desc: "Learns from every action, A/B tests outcomes, and compounds performance over time.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 px-6 border-t border-border">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">One command. Entire company.</h2>
          <p className="text-text-2 max-w-xl mx-auto">
            A CEO says &ldquo;Run my company.&rdquo; OperatorOS checks revenue, manages projects,
            negotiates vendors, and creates reports — autonomously.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="p-6 rounded-2xl bg-surface border border-border hover:border-accent/20 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                <f.icon size={20} className="text-accent" />
              </div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-text-2 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
