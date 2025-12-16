const n8nWebhook = process.env.N8N_WEBHOOK_URL!;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const n8nRes = await fetch(n8nWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const responseBody = await n8nRes.text();

    return new Response(responseBody, {
      status: n8nRes.status,
      statusText: n8nRes.statusText,
      headers: new Headers(n8nRes.headers),
    });
  } catch (err) {
    const message =
      err && typeof err === "object" && "message" in err
        ? String((err as { message?: string }).message)
        : "Server error";

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
