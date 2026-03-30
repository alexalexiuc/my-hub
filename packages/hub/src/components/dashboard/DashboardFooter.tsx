import Link from 'next/link';

export function DashboardFooter() {
  return (
    <footer className="border-t border-zinc-800 bg-zinc-950 py-6 px-4 sm:px-8 mt-12">
      <div className="mx-auto max-w-5xl flex flex-col items-center gap-3">
        <div className="flex gap-6 text-sm text-zinc-500">
          <Link href="/terms" className="hover:text-zinc-300 transition">
            Terms of Use
          </Link>
          <Link href="/privacy" className="hover:text-zinc-300 transition">
            Privacy Policy
          </Link>
          <Link href="/contact" className="hover:text-zinc-300 transition">
            Contact Us
          </Link>
        </div>
        <p className="text-xs text-zinc-600">&copy; 2026 my-hub</p>
      </div>
    </footer>
  );
}
