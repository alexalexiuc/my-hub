import { PageHeader } from '@/components/PageHeader';

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 space-y-8">
      <PageHeader title="Privacy Policy" backHref="/" backLabel="← Home" />

      <div className="prose prose-invert prose-zinc max-w-none space-y-6 text-sm text-zinc-300 leading-relaxed">
        <p className="text-zinc-400">Last updated: March 2026</p>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">1. Who we are</h2>
          <p>
            my-hub is a private, non-commercial, open-source platform maintained by an individual developer. It is not
            operated by a company. The source code is available at{' '}
            <a
              href="https://github.com/alexalexiuc/my-hub"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:underline"
            >
              github.com/alexalexiuc/my-hub
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">2. What data we collect</h2>
          <p>We collect and store only what you actively provide:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Account information (name, email) for authentication</li>
            <li>Data you enter in the apps (meals, todos, measurements, etc.)</li>
            <li>API request logs (method, path, timestamps) for debugging and auditing</li>
          </ul>
          <p>
            We do <strong>not</strong> use cookies for tracking, analytics, or advertising. We do not share your data
            with third parties.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">3. Why we process your data</h2>
          <p>Your data is processed solely to provide the platform features you use. Legal basis under GDPR:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Consent</strong> — you choose to sign up and enter your data
            </li>
            <li>
              <strong>Legitimate interest</strong> — API logs for security and debugging
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">4. Where data is stored</h2>
          <p>
            Your data is stored in a PostgreSQL database on a server located in Europe. Data is transmitted over HTTPS.
            We do not transfer data outside of the EU.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">5. Data retention</h2>
          <p>
            Your data is kept as long as your account exists. API request logs are automatically deleted after 30 days.
            You can request full deletion of your account and data at any time.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">6. Your rights (GDPR)</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Access</strong> — request a copy of your data
            </li>
            <li>
              <strong>Rectification</strong> — correct inaccurate data
            </li>
            <li>
              <strong>Erasure</strong> — request deletion of your data
            </li>
            <li>
              <strong>Portability</strong> — receive your data in a machine-readable format
            </li>
            <li>
              <strong>Withdraw consent</strong> — stop using the platform at any time
            </li>
          </ul>
          <p>
            To exercise any of these rights, contact us via the{' '}
            <a href="/contact" className="text-indigo-400 hover:underline">
              contact page
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">7. Third-party services</h2>
          <p>
            If you sign in with Google, Google provides us with your name and email as part of the OAuth flow. We do not
            access any other Google data. Please refer to{' '}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:underline"
            >
              Google's Privacy Policy
            </a>{' '}
            for details on their data handling.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">8. Changes</h2>
          <p>
            This policy may be updated occasionally. We will note the date of the last update at the top of this page.
          </p>
        </section>
      </div>
    </main>
  );
}
