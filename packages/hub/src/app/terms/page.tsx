import { PageHeader } from '@/components/PageHeader';

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 space-y-8">
      <PageHeader title="Terms of Use" backHref="/" backLabel="← Home" />

      <div className="prose prose-invert prose-zinc max-w-none space-y-6 text-sm text-zinc-300 leading-relaxed">
        <p className="text-zinc-400">Last updated: March 2026</p>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">1. What this is</h2>
          <p>
            my-hub is a private, open-source personal platform. It is not a commercial product. It is built and
            maintained as a personal project and shared with friends and family.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">2. Access</h2>
          <p>
            Access is invite-only. By using this platform, you agree to use it in good faith and not to abuse, overload,
            or attempt to compromise the service or other users' data.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">3. Your data</h2>
          <p>
            You own your data. We store only what is necessary for the features you use (meals, todos, measurements,
            etc.). You can request deletion of your data at any time by contacting us.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">4. No warranty</h2>
          <p>
            This platform is provided &ldquo;as is&rdquo; without warranty of any kind. We do our best to keep it
            running and your data safe, but we make no guarantees about uptime, data preservation, or fitness for any
            particular purpose.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">5. Changes</h2>
          <p>
            These terms may be updated occasionally. Continued use of the platform after changes constitutes acceptance
            of the new terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">6. Open source</h2>
          <p>
            The source code is publicly available at{' '}
            <a
              href="https://github.com/alexalexiuc/my-hub"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:underline"
            >
              github.com/alexalexiuc/my-hub
            </a>
            . Contributions and feedback are welcome.
          </p>
        </section>
      </div>
    </main>
  );
}
