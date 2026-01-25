import { headers } from "next/headers";
import { redirect } from "next/navigation";
import QrCode from "@/components/QrCode";
import { isIOS } from "@/utils/device";

const SMART_LINK_URL = "https://app.billybot.ai/get-the-app";

export default async function GetTheAppPage() {
  const h = await headers();
  const userAgent = h.get("user-agent") ?? "";
  const iosAppUrl = process.env.NEXT_PUBLIC_IOS_APP_URL ?? "";

  if (isIOS(userAgent) && iosAppUrl) {
    redirect(iosAppUrl);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--page-bg)] px-6 py-16 text-white">
      <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[rgba(8,12,20,0.9)] p-8 text-center shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
        <h1 className="text-2xl font-semibold">BillyBot for iPhone</h1>
        <a
          href={iosAppUrl}
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition hover:bg-gray-100"
        >
          Open in App Store
        </a>
        <div className="mt-6 flex justify-center">
          <QrCode value={SMART_LINK_URL} size={140} />
        </div>
      </div>
    </div>
  );
}
