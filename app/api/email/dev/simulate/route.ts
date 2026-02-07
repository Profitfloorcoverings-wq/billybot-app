export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const provider = request.nextUrl.searchParams.get("provider");

  if (provider === "google") {
    return NextResponse.json({
      message: {
        data: Buffer.from(
          JSON.stringify({
            emailAddress: "example@gmail.com",
            historyId: "123456",
          })
        ).toString("base64"),
      },
    });
  }

  if (provider === "microsoft") {
    return NextResponse.json({
      value: [
        {
          subscriptionId: "subscription-id",
          clientState: "MICROSOFT_WEBHOOK_VALIDATION_TOKEN",
          resourceData: { id: "message-id" },
        },
      ],
    });
  }

  return NextResponse.json({
    message: "Specify provider=google or provider=microsoft",
  });
}
