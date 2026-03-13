export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="rounded-2xl border border-gray-200 bg-white p-10 shadow-md text-center">
        <h1 className="mb-6 text-2xl font-bold">Sign in to my-hub</h1>
        <a
          href="/api/auth/signin/github"
          className="inline-block rounded-lg bg-gray-900 px-6 py-3 text-white font-medium hover:bg-gray-700 transition"
        >
          Sign in with GitHub
        </a>
      </div>
    </main>
  );
}
