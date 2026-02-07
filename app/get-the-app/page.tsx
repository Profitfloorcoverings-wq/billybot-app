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
      <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[rgba(6,10,20,0.85)] p-6 text-center shadow-[0_14px_38px_rgba(0,0,0,0.35)]">
        <h1 className="text-lg font-semibold text-white">Get the iPhone app</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Install BillyBot on your iPhone.
        </p>
        {iosAppUrl ? (
          <a
            href={iosAppUrl}
            className="mt-4 inline-flex items-center justify-center rounded-full bg-[var(--brand1)] px-5 py-2 text-sm font-semibold text-white shadow-[0_0_16px_rgba(37,99,235,0.5)] transition hover:brightness-110"
          >
            Open the iPhone app
          </a>
        ) : (
          <p className="mt-4 text-xs text-[var(--muted)]">
            The iOS app link is not available yet.
          </p>
        )}
      </div>
    </div>
  );
}
