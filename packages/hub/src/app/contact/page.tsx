import PageHeader from '@/components/page-header';

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 space-y-8">
      <PageHeader title="Contact" backHref="/" backLabel="← Home" />

      <div className="space-y-6">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
          <h2 className="text-lg font-semibold">Get in touch</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            my-hub is a private, open-source project. If you have questions, feedback, or need to request data deletion,
            you can reach out through any of the channels below.
          </p>

          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-indigo-400"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4l3 3" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium">GitHub Issues</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Best for bug reports, feature requests, and general feedback
                </p>
                <a
                  href="https://github.com/alexalexiuc/my-hub/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-indigo-400 hover:underline mt-1 inline-block"
                >
                  github.com/alexalexiuc/my-hub/issues
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-indigo-400"
                >
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-xs text-zinc-500 mt-0.5">For private inquiries or data deletion requests</p>
                <a
                  href="mailto:a.alex.alexiuc@gmail.com"
                  className="text-sm text-indigo-400 hover:underline mt-1 inline-block"
                >
                  a.alex.alexiuc@gmail.com
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-3">
          <h2 className="text-lg font-semibold">Data requests</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Under GDPR, you have the right to access, correct, or delete your personal data. To make a request, email us
            with the subject line &ldquo;Data Request&rdquo; and include the email address associated with your account.
            We will respond within 30 days.
          </p>
        </div>
      </div>
    </main>
  );
}
