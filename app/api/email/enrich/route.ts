export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

type EnrichPayload = {
  email_event_id?: string;
};

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.N8N_SECRET;
  if (!expectedSecret) {
    return unauthorized();
  }

  const providedSecret = request.headers.get("x-n8n-secret");
  if (!providedSecret || providedSecret !== expectedSecret) {
    return unauthorized();
  }

  let payload: EnrichPayload;
  try {
    payload = (await request.json()) as EnrichPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const emailEventId = payload?.email_event_id;
  if (!emailEventId) {
    return NextResponse.json(
      { error: "Missing email_event_id" },
      { status: 400 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_APP_URL" },
      { status: 500 }
    );
  }

  const hydrateUrl = new URL(
    "/api/internal/email-events/hydrate",
    baseUrl
  );

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const internalToken = process.env.INTERNAL_JOBS_TOKEN;
  if (internalToken) {
    headers["x-internal-token"] = internalToken;
  }

  const response = await fetch(hydrateUrl.toString(), {
    method: "POST",
    headers,
    body: JSON.stringify({ email_event_id: emailEventId }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    return new NextResponse(errorBody, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        "Content-Type": response.headers.get("Content-Type") ?? "text/plain",
      },
    });
  }

  return NextResponse.json({ ok: true });
}
