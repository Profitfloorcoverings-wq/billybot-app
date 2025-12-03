import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { reply, conversation_id } = body;

    if (!reply || !conversation_id) {
      return NextResponse.json(
        { error: "Missing reply or conversation_id" },
        { status: 400 }
      );
    }

    return NextResponse.json({ status: "ok" });
  } catch (err: unknown) {
    console.error("SYSTEM ROUTE ERROR:", err);
    return NextResponse.json(
      {
        error:
          err && typeof err === "object" && "message" in err
            ? String((err as { message?: string }).message)
            : "Server error",
      },
      { status: 500 }
    );
  }
}
