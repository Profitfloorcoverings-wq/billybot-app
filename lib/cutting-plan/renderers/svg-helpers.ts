import type { Point, WallSegment, Drop, Seam, Polygon, CornerWeld } from "../types";

// ── Colours ──
export const COLOURS = {
  wall: "#1e3a5f",
  wallFill: "#ffffff",
  drop1: "#e8f0fe",
  drop2: "#d1e4fd",
  seam: "#ff6b6b",
  seamWarning: "#ff0000",
  gripper: "#94a3b8",
  door: "#f97316",
  pileArrow: "#1e3a5f",
  dimension: "#475569",
  dimensionLine: "#94a3b8",
  waste: "#fef3c7",
  label: "#0f172a",
  legend: "#f8fafc",
  legendBorder: "#e2e8f0",
  cove: "#a78bfa",
  coveStroke: "#7c3aed",
  weldInternal: "#059669",
  weldExternal: "#dc2626",
} as const;

// ── Scale helper ──
export function mmToSvg(mm: number, scale: number): number {
  return mm * scale;
}

// ── SVG element builders ──

export function renderPolygonOutline(
  walls: Polygon,
  scale: number,
  offsetX: number,
  offsetY: number
): string {
  const points = walls
    .map((p) => `${mmToSvg(p.x_mm, scale) + offsetX},${mmToSvg(p.y_mm, scale) + offsetY}`)
    .join(" ");
  return `<polygon points="${points}" fill="${COLOURS.wallFill}" stroke="${COLOURS.wall}" stroke-width="3" stroke-linejoin="round"/>`;
}

export function renderClipPath(
  id: string,
  walls: Polygon,
  scale: number,
  offsetX: number,
  offsetY: number
): string {
  const points = walls
    .map((p) => `${mmToSvg(p.x_mm, scale) + offsetX},${mmToSvg(p.y_mm, scale) + offsetY}`)
    .join(" ");
  return `<clipPath id="${id}"><polygon points="${points}"/></clipPath>`;
}

export function renderDrop(
  drop: Drop,
  scale: number,
  offsetX: number,
  offsetY: number,
  isEven: boolean
): string {
  const x = mmToSvg(drop.x_mm, scale) + offsetX;
  const y = mmToSvg(drop.y_mm, scale) + offsetY;
  const w = mmToSvg(drop.width_mm, scale);
  const h = mmToSvg(drop.length_mm, scale);
  const fill = isEven ? COLOURS.drop1 : COLOURS.drop2;

  const rect = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="none"/>`;

  // Skip label if drop is too narrow to fit text
  const minLabelWidth = 60;
  if (w < minLabelWidth && h < minLabelWidth) return rect;

  // Drop label centred
  const cx = x + w / 2;
  const cy = y + h / 2;
  const label = `Drop ${drop.index}`;
  const dims = `${(drop.width_mm / 1000).toFixed(2)}m × ${(drop.length_mm / 1000).toFixed(2)}m`;

  // Rotate text 90° if drop is taller than wide and narrow
  const rotate = w < 80 && h > w;
  const transform = rotate ? ` transform="rotate(-90,${cx},${cy})"` : "";

  const text = `<text x="${cx}" y="${cy - 8}" text-anchor="middle" font-size="14" font-weight="bold" fill="${COLOURS.label}"${transform}>${label}</text>`;
  const dimText = w > 100
    ? `<text x="${cx}" y="${cy + 10}" text-anchor="middle" font-size="11" fill="${COLOURS.dimension}"${transform}>${dims}</text>`
    : "";

  return rect + text + dimText;
}

export function renderSeamLine(
  seam: Seam,
  scale: number,
  offsetX: number,
  offsetY: number
): string {
  const x = mmToSvg(seam.x_mm, scale) + offsetX;
  const y1 = mmToSvg(seam.y_start_mm, scale) + offsetY;
  const y2 = mmToSvg(seam.y_end_mm, scale) + offsetY;
  const colour = seam.near_door ? COLOURS.seamWarning : COLOURS.seam;
  return `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${colour}" stroke-width="2" stroke-dasharray="8,4"/>`;
}

export function renderWallDimension(
  seg: WallSegment,
  scale: number,
  offsetX: number,
  offsetY: number,
  outside: boolean
): string {
  const lengthM = (seg.length_mm / 1000).toFixed(2);
  const mx = mmToSvg((seg.start.x_mm + seg.end.x_mm) / 2, scale) + offsetX;
  const my = mmToSvg((seg.start.y_mm + seg.end.y_mm) / 2, scale) + offsetY;

  // Determine offset direction for label placement outside room
  const dx = seg.end.x_mm - seg.start.x_mm;
  const dy = seg.end.y_mm - seg.start.y_mm;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return "";

  // Normal vector (pointing outward for clockwise polygon)
  const nx = -dy / len;
  const ny = dx / len;
  const offset = outside ? 20 : -20;

  const lx = mx + nx * offset;
  const ly = my + ny * offset;

  // Dimension line endpoints
  const sx = mmToSvg(seg.start.x_mm, scale) + offsetX;
  const sy = mmToSvg(seg.start.y_mm, scale) + offsetY;
  const ex = mmToSvg(seg.end.x_mm, scale) + offsetX;
  const ey = mmToSvg(seg.end.y_mm, scale) + offsetY;

  const line = `<line x1="${sx + nx * offset * 0.6}" y1="${sy + ny * offset * 0.6}" x2="${ex + nx * offset * 0.6}" y2="${ey + ny * offset * 0.6}" stroke="${COLOURS.dimensionLine}" stroke-width="1"/>`;

  // End ticks
  const tickLen = 6;
  const tick1 = `<line x1="${sx + nx * (offset * 0.6 - tickLen)}" y1="${sy + ny * (offset * 0.6 - tickLen)}" x2="${sx + nx * (offset * 0.6 + tickLen)}" y2="${sy + ny * (offset * 0.6 + tickLen)}" stroke="${COLOURS.dimensionLine}" stroke-width="1"/>`;
  const tick2 = `<line x1="${ex + nx * (offset * 0.6 - tickLen)}" y1="${ey + ny * (offset * 0.6 - tickLen)}" x2="${ex + nx * (offset * 0.6 + tickLen)}" y2="${ey + ny * (offset * 0.6 + tickLen)}" stroke="${COLOURS.dimensionLine}" stroke-width="1"/>`;

  // Rotation for angled walls
  const angleDeg = (Math.atan2(ey - sy, ex - sx) * 180) / Math.PI;
  const textRotate = angleDeg > 90 || angleDeg < -90 ? angleDeg + 180 : angleDeg;

  const text = `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" font-size="12" font-weight="600" fill="${COLOURS.dimension}" transform="rotate(${textRotate},${lx},${ly})">${lengthM}m</text>`;

  return line + tick1 + tick2 + text;
}

export function renderDirectionArrow(
  cx: number,
  cy: number,
  direction_deg: number,
  scale: number,
  labelText: string
): string {
  const arrowLen = 40;
  const rad = (direction_deg * Math.PI) / 180;
  const dx = Math.cos(rad) * arrowLen;
  const dy = Math.sin(rad) * arrowLen;

  const x1 = cx - dx;
  const y1 = cy - dy;
  const x2 = cx + dx;
  const y2 = cy + dy;

  const line = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${COLOURS.pileArrow}" stroke-width="3" marker-end="url(#arrowhead)"/>`;
  const label = `<text x="${cx}" y="${cy - 20}" text-anchor="middle" font-size="11" font-weight="bold" fill="${COLOURS.pileArrow}">${escapeXml(labelText)}</text>`;

  return line + label;
}

export function renderCovePerimeter(
  walls: Polygon,
  coveHeightMm: number,
  scale: number,
  offsetX: number,
  offsetY: number
): string {
  // Draw a coloured strip along the inside of each wall representing the cove
  let svg = "";
  const stripWidth = mmToSvg(coveHeightMm, scale);

  for (let i = 0; i < walls.length; i++) {
    const p1 = walls[i];
    const p2 = walls[(i + 1) % walls.length];

    const x1 = mmToSvg(p1.x_mm, scale) + offsetX;
    const y1 = mmToSvg(p1.y_mm, scale) + offsetY;
    const x2 = mmToSvg(p2.x_mm, scale) + offsetX;
    const y2 = mmToSvg(p2.y_mm, scale) + offsetY;

    // Wall direction
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) continue;

    // Inward normal (for clockwise polygon)
    const nx = dy / len;
    const ny = -dx / len;

    // Draw strip as a polygon (wall edge + inward offset)
    const ix1 = x1 + nx * stripWidth;
    const iy1 = y1 + ny * stripWidth;
    const ix2 = x2 + nx * stripWidth;
    const iy2 = y2 + ny * stripWidth;

    svg += `<polygon points="${x1},${y1} ${x2},${y2} ${ix2},${iy2} ${ix1},${iy1}" fill="${COLOURS.cove}" opacity="0.3" stroke="${COLOURS.coveStroke}" stroke-width="0.5"/>`;
  }

  return svg;
}

export function renderCornerWeld(
  weld: CornerWeld,
  scale: number,
  offsetX: number,
  offsetY: number
): string {
  const x = mmToSvg(weld.position.x_mm, scale) + offsetX;
  const y = mmToSvg(weld.position.y_mm, scale) + offsetY;

  if (weld.type === "internal") {
    // Small green diamond marker
    const s = 6;
    return `<polygon points="${x},${y - s} ${x + s},${y} ${x},${y + s} ${x - s},${y}" fill="${COLOURS.weldInternal}" opacity="0.8"/>`;
  } else {
    // Red square marker for external corner patch
    const s = 7;
    return `<rect x="${x - s}" y="${y - s}" width="${s * 2}" height="${s * 2}" fill="${COLOURS.weldExternal}" opacity="0.8" rx="2"/>` +
      `<text x="${x}" y="${y + 3}" text-anchor="middle" font-size="8" font-weight="bold" fill="white">P</text>`;
  }
}

export function renderGripperPerimeter(
  walls: Polygon,
  scale: number,
  offsetX: number,
  offsetY: number
): string {
  const points = walls
    .map((p) => `${mmToSvg(p.x_mm, scale) + offsetX},${mmToSvg(p.y_mm, scale) + offsetY}`)
    .join(" ");
  return `<polygon points="${points}" fill="none" stroke="${COLOURS.gripper}" stroke-width="1.5" stroke-dasharray="6,3" opacity="0.7"/>`;
}

export function renderLegend(
  x: number,
  y: number,
  width: number,
  lines: string[]
): string {
  const lineHeight = 18;
  const padding = 12;
  const height = lines.length * lineHeight + padding * 2;

  let svg = `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="6" fill="${COLOURS.legend}" stroke="${COLOURS.legendBorder}" stroke-width="1"/>`;

  lines.forEach((line, i) => {
    svg += `<text x="${x + padding}" y="${y + padding + 14 + i * lineHeight}" font-size="12" fill="${COLOURS.label}">${escapeXml(line)}</text>`;
  });

  return svg;
}

export function renderDropLabel(
  x: number,
  y: number,
  label: string
): string {
  return `<text x="${x}" y="${y}" text-anchor="middle" font-size="14" font-weight="bold" fill="${COLOURS.label}">${escapeXml(label)}</text>`;
}

export function renderDoor(
  wallStart: Point,
  wallEnd: Point,
  positionMm: number,
  widthMm: number,
  scale: number,
  offsetX: number,
  offsetY: number
): string {
  // Position along the wall
  const dx = wallEnd.x_mm - wallStart.x_mm;
  const dy = wallEnd.y_mm - wallStart.y_mm;
  const wallLen = Math.sqrt(dx * dx + dy * dy);
  if (wallLen < 1) return "";

  const ux = dx / wallLen;
  const uy = dy / wallLen;
  // Normal pointing inward (for clockwise polygon, inward is to the right)
  const nx = -uy;
  const ny = ux;

  // Door hinge point
  const hx = wallStart.x_mm + ux * positionMm;
  const hy = wallStart.y_mm + uy * positionMm;

  const sx = mmToSvg(hx, scale) + offsetX;
  const sy = mmToSvg(hy, scale) + offsetY;
  const r = mmToSvg(widthMm, scale);

  // Door swing arc (quarter circle inward)
  // Arc from along-wall direction to inward-normal direction
  const endAlongX = sx + ux * r;
  const endAlongY = sy + uy * r;
  const endNormalX = sx + nx * r;
  const endNormalY = sy + ny * r;

  // Door opening gap on wall
  const gapEndX = sx + ux * mmToSvg(widthMm, scale);
  const gapEndY = sy + uy * mmToSvg(widthMm, scale);
  const wallGap = `<line x1="${sx}" y1="${sy}" x2="${gapEndX}" y2="${gapEndY}" stroke="${COLOURS.door}" stroke-width="4"/>`;

  // Quarter-circle arc
  const arc = `<path d="M ${endAlongX} ${endAlongY} A ${r} ${r} 0 0 1 ${endNormalX} ${endNormalY}" fill="none" stroke="${COLOURS.door}" stroke-width="1.5" stroke-dasharray="4,3"/>`;

  // Small hinge dot
  const hinge = `<circle cx="${sx}" cy="${sy}" r="3" fill="${COLOURS.door}"/>`;

  return wallGap + arc + hinge;
}

export function renderArrowheadDef(): string {
  return `<defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="${COLOURS.pileArrow}"/></marker></defs>`;
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
