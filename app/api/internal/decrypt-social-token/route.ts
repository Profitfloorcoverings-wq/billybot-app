export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { decryptToken } from "@/lib/email/crypto";

export async function POST(request: NextRequest) {
  const internalToken = request.headers.get("x-internal-token");
  const expectedToken = process.env.N8N_SHARED_SECRET || process.env.INTERNAL_JOBS_TOKEN;

  if (!internalToken || internalToken !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    encrypted_token?: string;
    platform?: string;
    page_id?: string;
  };

  if (!body.encrypted_token) {
    return NextResponse.json({ error: "encrypted_token required" }, { status: 400 });
  }

  try {
    const token = decryptToken(body.encrypted_token);
    return NextResponse.json({
      token,
      platform: body.platform ?? null,
      page_id: body.page_id ?? null,
    });
  } catch (err) {
    console.error("[decrypt-social-token]", err);
    return NextResponse.json({ error: "Decryption failed" }, { status: 500 });
  }
}
