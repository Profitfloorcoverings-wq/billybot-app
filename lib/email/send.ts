import "server-only";

const GMAIL_SEND_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";

export type GmailReplyPayload = {
  accessToken: string;
  toEmail: string;
  subject: string;
  body: string;
  threadId: string;
};

export type GmailComposePayload = {
  accessToken: string;
  fromName: string;
  toEmail: string;
  subject: string;
  body: string;
  html?: string;
  replyTo?: string;
  attachments?: Attachment[];
};

export type MicrosoftReplyPayload = {
  accessToken: string;
  mailbox: string;
  messageId: string;
  body: string;
};

export type MicrosoftComposePayload = {
  accessToken: string;
  mailbox: string;
  toEmail: string;
  subject: string;
  body: string;
  html?: string;
  attachments?: Attachment[];
};

export type Attachment = {
  filename: string;
  contentType: string;
  contentBase64: string;
};

export type ProviderSendResult = {
  providerMessageId: string | null;
  providerThreadId: string | null;
  providerResult: Record<string, unknown>;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlEncodeBytes(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function buildPlainTextEmail(toEmail: string, subject: string, body: string) {
  return [
    `To: ${toEmail}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    body,
  ].join("\r\n");
}

function buildMimeMessage(opts: {
  fromName: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  body: string;
  html?: string;
  replyTo?: string;
  attachments?: Attachment[];
}) {
  const mixedBoundary = `----bb_mixed_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const altBoundary = `----bb_alt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const hasAttachments = opts.attachments && opts.attachments.length > 0;
  const hasHtml = !!opts.html;

  const lines: string[] = [
    `From: ${opts.fromName} <${opts.fromEmail}>`,
    `To: ${opts.toEmail}`,
    `Subject: ${opts.subject}`,
    "MIME-Version: 1.0",
  ];

  if (opts.replyTo) {
    lines.push(`Reply-To: ${opts.replyTo}`);
  }

  if (hasAttachments) {
    lines.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`, "");

    if (hasHtml) {
      lines.push(`--${mixedBoundary}`, `Content-Type: multipart/alternative; boundary="${altBoundary}"`, "");
      lines.push(`--${altBoundary}`, 'Content-Type: text/plain; charset="UTF-8"', "", opts.body);
      lines.push(`--${altBoundary}`, 'Content-Type: text/html; charset="UTF-8"', "", opts.html!);
      lines.push(`--${altBoundary}--`);
    } else {
      lines.push(`--${mixedBoundary}`, 'Content-Type: text/plain; charset="UTF-8"', "", opts.body);
    }

    for (const att of opts.attachments!) {
      lines.push(
        `--${mixedBoundary}`,
        `Content-Type: ${att.contentType}; name="${att.filename}"`,
        "Content-Transfer-Encoding: base64",
        `Content-Disposition: attachment; filename="${att.filename}"`,
        "",
        att.contentBase64
      );
    }
    lines.push(`--${mixedBoundary}--`);
  } else if (hasHtml) {
    lines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`, "");
    lines.push(`--${altBoundary}`, 'Content-Type: text/plain; charset="UTF-8"', "", opts.body);
    lines.push(`--${altBoundary}`, 'Content-Type: text/html; charset="UTF-8"', "", opts.html!);
    lines.push(`--${altBoundary}--`);
  } else {
    lines.push('Content-Type: text/plain; charset="UTF-8"', "", opts.body);
  }

  return lines.join("\r\n");
}

export async function sendGmailReply(
  payload: GmailReplyPayload
): Promise<ProviderSendResult> {
  const raw = base64UrlEncode(
    buildPlainTextEmail(payload.toEmail, payload.subject, payload.body)
  );

  const response = await fetch(GMAIL_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${payload.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw, threadId: payload.threadId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gmail send failed (${response.status}): ${errorText || "unknown error"}`
    );
  }

  const data = (await response.json()) as {
    id?: string;
    threadId?: string;
  };

  return {
    providerMessageId: data.id ?? null,
    providerThreadId: data.threadId ?? payload.threadId,
    providerResult: {
      id: data.id ?? null,
      threadId: data.threadId ?? null,
    },
  };
}

export async function sendGmailCompose(
  payload: GmailComposePayload
): Promise<ProviderSendResult> {
  const mime = buildMimeMessage({
    fromName: payload.fromName,
    fromEmail: "me",
    toEmail: payload.toEmail,
    subject: payload.subject,
    body: payload.body,
    html: payload.html,
    replyTo: payload.replyTo,
    attachments: payload.attachments,
  });

  const raw = base64UrlEncodeBytes(Buffer.from(mime, "utf8"));

  const response = await fetch(GMAIL_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${payload.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gmail send failed (${response.status}): ${errorText || "unknown error"}`
    );
  }

  const data = (await response.json()) as { id?: string; threadId?: string };

  return {
    providerMessageId: data.id ?? null,
    providerThreadId: data.threadId ?? null,
    providerResult: { id: data.id ?? null, threadId: data.threadId ?? null },
  };
}

export async function sendMicrosoftReply(
  payload: MicrosoftReplyPayload
): Promise<ProviderSendResult> {
  const response = await fetch(
    `${GRAPH_BASE_URL}/users/${payload.mailbox}/messages/${payload.messageId}/reply`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${payload.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ comment: payload.body }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Microsoft reply failed (${response.status}): ${
        errorText || "unknown error"
      }`
    );
  }

  return {
    providerMessageId: null,
    providerThreadId: null,
    providerResult: {
      status: response.status,
    },
  };
}

export async function sendMicrosoftCompose(
  payload: MicrosoftComposePayload
): Promise<ProviderSendResult> {
  const useHtml = !!payload.html;
  const msgBody: Record<string, unknown> = {
    message: {
      subject: payload.subject,
      body: {
        contentType: useHtml ? "HTML" : "Text",
        content: useHtml ? payload.html : payload.body,
      },
      toRecipients: [
        { emailAddress: { address: payload.toEmail } },
      ],
      attachments:
        payload.attachments?.map((att) => ({
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: att.filename,
          contentType: att.contentType,
          contentBytes: att.contentBase64,
        })) ?? [],
    },
    saveToSentItems: true,
  };

  const response = await fetch(
    `${GRAPH_BASE_URL}/users/${payload.mailbox}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${payload.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(msgBody),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Microsoft send failed (${response.status}): ${errorText || "unknown error"}`
    );
  }

  return {
    providerMessageId: null,
    providerThreadId: null,
    providerResult: { status: response.status },
  };
}
