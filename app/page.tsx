import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--bg1)] text-[var(--text)]">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-24 text-center">
        <h1 className="text-4xl font-black text-white sm:text-5xl">Chat with BillyBot</h1>
        <p className="text-lg text-[var(--muted)]">Open chat to get started.</p>
        <Link
          href="/chat"
          className="inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-[var(--brand1)] to-[var(--brand2)] px-7 py-3 text-base font-semibold text-white shadow-[0_16px_30px_rgba(37,99,235,0.55)] transition hover:shadow-[0_20px_40px_rgba(59,130,246,0.55)]"
        >
          Open chat
          <span aria-hidden className="text-lg">
            →
          </span>
        </Link>
      </div>
    </div>
  );
}
