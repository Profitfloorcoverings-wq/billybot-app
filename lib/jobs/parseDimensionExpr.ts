/**
 * Parses natural dimension expressions into m2 values.
 *
 * Supported formats:
 *   "5x3m"              → 15.00
 *   "4.2x3.8"           → 15.96
 *   "5x3m minus 1m2"    → 14.00
 *   "L-shape: 5x3 + 2x1.5" → 18.00
 *   "3.5m x 4m - 0.5x0.8"  → 13.60
 *   "12m2"              → 12.00
 *   "12.5"              → 12.50 (bare number treated as m2)
 */

type ParseSuccess = { ok: true; m2: number; breakdown: string };
type ParseError = { ok: false; error: string };
export type ParseResult = ParseSuccess | ParseError;

// Matches WxL patterns: "5x3", "4.2 x 3.8", "5x3m", "3.5m x 4m"
const RECT_PATTERN = /(\d+(?:\.\d+)?)\s*m?\s*[x×]\s*(\d+(?:\.\d+)?)\s*m?/i;

// Matches bare m2 values: "12m2", "12.5m²", "12.5 m2", "12.5 sq m"
const M2_PATTERN = /(\d+(?:\.\d+)?)\s*(?:m[²2]|sq\s*m)/i;

// Matches bare number (fallback): "12.5"
const BARE_NUMBER = /^(\d+(?:\.\d+)?)$/;

function parseSegment(segment: string): { m2: number; label: string } | null {
  const trimmed = segment.trim();
  if (!trimmed) return null;

  // Try WxL first
  const rectMatch = trimmed.match(RECT_PATTERN);
  if (rectMatch) {
    const w = parseFloat(rectMatch[1]);
    const l = parseFloat(rectMatch[2]);
    const m2 = w * l;
    return { m2, label: `${w} x ${l} = ${m2.toFixed(2)}m\u00B2` };
  }

  // Try explicit m2
  const m2Match = trimmed.match(M2_PATTERN);
  if (m2Match) {
    const m2 = parseFloat(m2Match[1]);
    return { m2, label: `${m2.toFixed(2)}m\u00B2` };
  }

  // Try bare number
  const bareMatch = trimmed.match(BARE_NUMBER);
  if (bareMatch) {
    const m2 = parseFloat(bareMatch[1]);
    return { m2, label: `${m2.toFixed(2)}m\u00B2` };
  }

  return null;
}

export function parseDimensionExpr(expr: string): ParseResult {
  if (!expr || !expr.trim()) {
    return { ok: false, error: "Empty expression" };
  }

  const cleaned = expr
    .trim()
    // Remove descriptive prefixes like "L-shape:", "kitchen:"
    .replace(/^[a-zA-Z][a-zA-Z\s-]*:\s*/i, "")
    // Normalise "minus" to "-"
    .replace(/\bminus\b/gi, "-")
    // Remove parenthetical comments like "(alcove)", "(pillar)"
    .replace(/\([^)]*\)/g, "")
    // Remove "for alcove" style suffixes after subtraction
    .replace(/\bfor\s+\w+/gi, "");

  // Split on + and - while keeping the operator
  const parts: Array<{ sign: 1 | -1; text: string }> = [];
  let current = "";
  let sign: 1 | -1 = 1;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if ((ch === "+" || ch === "-") && i > 0) {
      // Don't split on minus within a number like "3.5" — check if previous non-space is a digit
      const prevNonSpace = cleaned.slice(0, i).trimEnd();
      const lastChar = prevNonSpace[prevNonSpace.length - 1];
      // If last char is a digit or 'm', this is an operator
      if (lastChar && /[\dm²2]/.test(lastChar)) {
        parts.push({ sign, text: current.trim() });
        sign = ch === "+" ? 1 : -1;
        current = "";
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) {
    parts.push({ sign, text: current.trim() });
  }

  // Filter out empty parts
  const validParts = parts.filter((p) => p.text);

  if (!validParts.length) {
    return { ok: false, error: "No dimensions found" };
  }

  let total = 0;
  const breakdownParts: string[] = [];
  let hasAtLeastOneParsed = false;

  for (const part of validParts) {
    const result = parseSegment(part.text);
    if (!result) continue;

    hasAtLeastOneParsed = true;
    const value = part.sign * result.m2;
    total += value;
    breakdownParts.push(`${part.sign === -1 ? "- " : breakdownParts.length > 0 ? "+ " : ""}${result.label}`);
  }

  if (!hasAtLeastOneParsed) {
    return { ok: false, error: "Could not parse dimensions" };
  }

  // Round to 2 decimal places
  const m2 = Math.round(total * 100) / 100;

  if (m2 <= 0) {
    return { ok: false, error: "Area must be positive" };
  }

  const breakdown = breakdownParts.length > 1
    ? `${breakdownParts.join(" ")} = ${m2.toFixed(2)}m\u00B2`
    : breakdownParts[0];

  return { ok: true, m2, breakdown };
}
