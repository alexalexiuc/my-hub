import Link from 'next/link';

const sections = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/oauth-clients', label: 'OAuth Clients' },
  { href: '/mcp-control', label: 'MCP Control' },
  { href: '/data-explorer', label: 'Data Explorer' },
];

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-8 text-3xl font-bold">my-hub admin</h1>
      <nav className="grid grid-cols-2 gap-4">
        {sections.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition"
          >
            <span className="text-lg font-medium">{label}</span>
          </Link>
        ))}
      </nav>
    </main>
  );
}
