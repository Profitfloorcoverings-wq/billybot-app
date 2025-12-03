import Link from "next/link";

const highlights = [
  {
    title: "Instant AI replies",
    desc: "Send a customer update and get a job-ready response back in seconds.",
  },
  {
    title: "Quotes, invoices, sheets",
    desc: "As soon as paperwork is saved in Supabase, it drops straight into chat.",
  },
  {
    title: "Built for the trades",
    desc: "Field-ready design with bold contrast and quick-access actions.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--bg1)] text-[var(--text)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-6 py-20">
        <header className="grid gap-10 rounded-3xl border border-[var(--line)] bg-[rgba(13,19,35,0.9)] p-10 shadow-[0_30px_90px_rgba(0,0,0,0.35)] lg:grid-cols-2 lg:items-center">
          <div className="space-y-5">
            <p className="inline-flex items-center gap-2 rounded-full bg-[rgba(37,99,235,0.14)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
              BillyBot™ • Flooring Trade AI
            </p>
            <h1 className="text-4xl font-black leading-tight text-white sm:text-5xl">
              Quotes, invoices, and job chat that keep crews moving
            </h1>
            <p className="text-lg text-[var(--muted)]">
              BillyBot listens to your site notes, fires them to n8n, and shows the AI reply instantly. When your workflows create quotes or paperwork, the links appear in chat automatically.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/chat"
                className="inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-[var(--brand1)] to-[var(--brand2)] px-6 py-3 text-base font-semibold text-white shadow-[0_16px_30px_rgba(37,99,235,0.55)] transition hover:shadow-[0_20px_40px_rgba(59,130,246,0.55)]"
              >
                Open chat
                <span aria-hidden className="text-lg">→</span>
              </Link>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[rgba(255,255,255,0.04)] px-5 py-3 text-sm text-[var(--muted)]">
                Live Supabase updates • n8n friendly
              </span>
            </div>
          </div>

          <div className="relative mt-6 lg:mt-0">
            <div className="rounded-3xl border border-[var(--line)] bg-[rgba(9,12,20,0.95)] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
              <div className="mb-4 flex items-center justify-between text-xs text-[var(--muted)]">
                <span>Field crew ↔ BillyBot</span>
                <span className="inline-flex items-center gap-2 rounded-full bg-[rgba(52,211,153,0.14)] px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                  Live
                </span>
              </div>
              <div className="space-y-3 text-sm">
                <div className="chat-bubble chat-bubble-user">
                  <div className="chat-badge chat-badge-user">You</div>
                  Crew finished hallway demo. Need updated quote and cleanup list.
                </div>
                <div className="chat-bubble chat-bubble-bot">
                  <div className="chat-badge">BillyBot</div>
                  <p className="text-[var(--text)]">
                    Got it. Drafting revised quote now and sending cleanup checklist to the team.
                  </p>
                </div>
                <div className="chat-bubble chat-bubble-bot">
                  <div className="chat-badge">BillyBot</div>
                  <a className="mt-1 inline-flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[rgba(37,99,235,0.12)] px-4 py-3 text-[var(--text)]" href="#">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--brand1)] text-white">PDF</span>
                    <span className="font-semibold">Quote Q-248 ready — tap to open</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-3">
          {highlights.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-[var(--line)] bg-[rgba(12,18,32,0.9)] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.32)]"
            >
              <p className="text-sm uppercase tracking-[0.22em] text-[var(--muted)]">{item.title}</p>
              <p className="mt-3 text-base text-[var(--text)]">{item.desc}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
