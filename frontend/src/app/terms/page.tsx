import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-void text-text px-6 py-12 max-w-2xl mx-auto">
      <Link href="/" className="text-accent text-sm hover:underline">
        ← Nexa
      </Link>
      <h1 className="text-3xl font-bold mt-6 mb-4">Terms of Service</h1>
      <p className="text-text-2 text-sm mb-6">Last updated: July 2026</p>

      <div className="space-y-4 text-text-2 text-sm leading-relaxed">
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your use of Nexa Brain and related services
          operated by Yevin Bollegala (&quot;we&quot;, &quot;us&quot;) at yevinb.github.io/operator-os.
        </p>
        <h2 className="text-lg font-semibold text-text pt-2">Service</h2>
        <p>
          Nexa provides an AI business operating system including daily learning, marketing agents,
          integrations, and automated execution. You are responsible for how you use AI-generated
          content and actions in your business.
        </p>
        <h2 className="text-lg font-semibold text-text pt-2">Accounts</h2>
        <p>
          You must provide accurate information and keep your credentials secure. You are responsible
          for activity under your account.
        </p>
        <h2 className="text-lg font-semibold text-text pt-2">Integrations</h2>
        <p>
          When you connect third-party services (Google, Stripe, Meta, etc.), you authorize Nexa to
          access those services on your behalf according to the permissions you grant. You must comply
          with each provider&apos;s terms.
        </p>
        <h2 className="text-lg font-semibold text-text pt-2">Acceptable use</h2>
        <p>
          Do not use Nexa for spam, illegal activity, harassment, or violating others&apos; rights. We may
          suspend accounts that abuse the service.
        </p>
        <h2 className="text-lg font-semibold text-text pt-2">Disclaimer</h2>
        <p>
          Nexa is provided &quot;as is&quot;. AI outputs may be inaccurate. Verify important business,
          legal, and financial decisions before acting.
        </p>
        <h2 className="text-lg font-semibold text-text pt-2">Contact</h2>
        <p>
          Yevin Bollegala —{" "}
          <a href="mailto:yevin.bollegala@gmail.com" className="text-accent hover:underline">
            yevin.bollegala@gmail.com
          </a>
        </p>
      </div>
    </div>
  );
}
