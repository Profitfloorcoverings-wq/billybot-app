const ALLOWED_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "hr",
  "li",
  "ol",
  "p",
  "pre",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
]);

function stripDisallowedTags(html: string) {
  return html.replace(/<\/?([a-zA-Z0-9-]+)([^>]*)>/g, (full, tagName) => {
    const normalized = String(tagName || "").toLowerCase();
    if (ALLOWED_TAGS.has(normalized)) {
      return full;
    }
    return "";
  });
}

export function sanitizeEmailHtml(value?: string | null) {
  if (!value) return "";

  try {
    let html = value;
    html = html.replace(
      /<\s*(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
      ""
    );
    html = html.replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?\s*>/gi, "");

    html = stripDisallowedTags(html);

    html = html.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "");
    html = html.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "");
    html = html.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "");

    html = html.replace(
      /(href|src)\s*=\s*"\s*(javascript:|data:text\/html|vbscript:)[^"]*"/gi,
      '$1="#"'
    );
    html = html.replace(
      /(href|src)\s*=\s*'\s*(javascript:|data:text\/html|vbscript:)[^']*'/gi,
      "$1='#'"
    );

    return html.trim();
  } catch {
    return "";
  }
}
