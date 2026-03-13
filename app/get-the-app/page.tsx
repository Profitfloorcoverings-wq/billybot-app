import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function GetTheAppPage() {
  const iosAppUrl = process.env.NEXT_PUBLIC_IOS_APP_URL;
  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  const isIOS = /iPad|iPhone|iPod/i.test(ua);

  if (isIOS && iosAppUrl) {
    redirect(iosAppUrl);
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[rgba(6,10,20,0.85)] p-8 text-center shadow-[0_14px_38px_rgba(0,0,0,0.35)]">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[rgba(37,99,235,0.12)] text-3xl">
          &#128241;
        </div>
        <h1 className="text-xl font-bold text-white">You&apos;re all set!</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          Your account is ready. Download the BillyBot app for the best experience — quotes, receipts, job sheets, all from your phone.
        </p>
        {iosAppUrl ? (
          <a
            href={iosAppUrl}
            className="mt-5 inline-flex items-center justify-center rounded-full bg-[var(--brand1)] px-6 py-3 text-sm font-bold text-white shadow-[0_0_16px_rgba(37,99,235,0.5)] transition hover:brightness-110"
          >
            Download for iPhone
          </a>
        ) : (
          <p className="mt-4 text-xs text-[var(--muted)]">
            The iOS app link is not available yet.
          </p>
        )}
        <p className="mt-4 text-xs text-[var(--muted)]">
          Or use BillyBot on desktop at{" "}
          <a href="/chat" className="text-[var(--brand1)] underline">app.billybot.ai</a>
        </p>
      </div>
    </div>
  );
}
