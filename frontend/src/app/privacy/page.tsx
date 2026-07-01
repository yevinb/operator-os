import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-void text-text px-6 py-12 max-w-2xl mx-auto">
      <Link href="/" className="text-accent text-sm hover:underline">
        ← Nexa
      </Link>
      <h1 className="text-3xl font-bold mt-6 mb-4">Privacy Policy</h1>
      <p className="text-text-2 text-sm mb-6">Last updated: July 2026</p>

      <div className="space-y-4 text-text-2 text-sm leading-relaxed">
        <p>
          Nexa (&quot;we&quot;, &quot;our&quot;) is an AI business operating system. This policy explains how we handle
          your data when you use Nexa at yevinb.github.io/operator-os.
        </p>
        <h2 className="text-lg font-semibold text-text pt-2">What we collect</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Account info: name, email, company (from sign-up or Google sign-in)</li>
          <li>Business profile and commands you run in Nexa</li>
          <li>Integration tokens you connect (e.g. Gmail, Stripe) — stored securely on our servers</li>
        </ul>
        <h2 className="text-lg font-semibold text-text pt-2">How we use it</h2>
        <p>
          To operate Nexa: execute your commands, send emails you request, sync with tools you connect, and improve
          your experience. We do not sell your personal data.
        </p>
        <h2 className="text-lg font-semibold text-text pt-2">Google OAuth</h2>
        <p>
          If you sign in with Google or connect Gmail, we use Google APIs per Google&apos;s user data policy. Gmail
          access is used only to send and read email as you instruct Nexa.
        </p>
        <h2 className="text-lg font-semibold text-text pt-2">Contact</h2>
        <p>
          Questions: contact the Nexa team via the email listed on your Google Cloud OAuth consent screen.
        </p>
      </div>
    </div>
  );
}
