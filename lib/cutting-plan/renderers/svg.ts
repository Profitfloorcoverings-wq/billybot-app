import type {
  CuttingPlanResult,
  RoomLayout,
  FlooringType,
  MaterialInput,
} from "../types";
import {
  polygonBoundingBox,
  polygonWallSegments,
  insetPolygon,
} from "../geometry/polygon";
import {
  COLOURS,
  mmToSvg,
  renderPolygonOutline,
  renderClipPath,
  renderDrop,
  renderSeamLine,
  renderWallDimension,
  renderDirectionArrow,
  renderGripperPerimeter,
  renderCovePerimeter,
  renderCornerWeld,
  renderDoor,
  renderArrowheadDef,
  renderTile,
  escapeXml,
} from "./svg-helpers";

const MARGIN = 80;
const ROOM_GAP = 40;
const LINE_H = 18;

interface RenderOptions {
  title?: string;
  showGripper?: boolean;
  gripperGapMm?: number;
}

/**
 * Render a complete cutting plan SVG from calculated room layouts.
 */
export function renderCuttingPlanSvg(
  result: CuttingPlanResult,
  options?: RenderOptions
): string {
  const { rooms, material, flooring_type, totals } = result;
  const showGripper = options?.showGripper ?? flooring_type === "carpet";
  const gripperGapMm = options?.gripperGapMm ?? 6;
  const hasCove = rooms.some((r) => r.coved);

  // Calculate room SVG metrics
  const layouts = rooms;
  let totalWidth = 0;
  let roomsHeight = 0;

  const roomMetrics = layouts.map((layout) => {
    const bbox = polygonBoundingBox(layout.resolved_walls);
    const maxDim = Math.max(bbox.width_mm, bbox.height_mm);
    const scale = maxDim > 0 ? 500 / maxDim : 1;
    const svgW = mmToSvg(bbox.width_mm, scale);
    const svgH = mmToSvg(bbox.height_mm, scale);
    return { bbox, scale, svgW, svgH };
  });

  roomMetrics.forEach((m) => {
    totalWidth = Math.max(totalWidth, m.svgW);
    roomsHeight += m.svgH + ROOM_GAP;
  });

  // Build legend content to calculate exact height needed
  const legendLines = buildLegendLines(result);
  const keyLines = buildKeyLines(flooring_type, showGripper, hasCove);
  const totalLegendLines = legendLines.length + 1 + keyLines.length; // +1 for "Key:" header
  const legendPadding = 12;
  const legendHeight = totalLegendLines * LINE_H + legendPadding * 2 + 8;

  const svgWidth = totalWidth + MARGIN * 2;
  const titleHeight = 40;
  const svgHeight = roomsHeight + MARGIN * 2 + legendHeight + titleHeight + 20;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}" style="font-family: Inter, Arial, sans-serif; background: white;">`;

  svg += renderArrowheadDef();

  // Title
  const title = options?.title ?? `${capitalize(flooring_type)} Cutting Plan`;
  svg += `<text x="${svgWidth / 2}" y="30" text-anchor="middle" font-size="22" font-weight="bold" fill="#000000">${escapeXml(title)}</text>`;

  // Render each room
  let currentY = MARGIN + titleHeight;

  layouts.forEach((layout, roomIdx) => {
    const { bbox, scale, svgW, svgH } = roomMetrics[roomIdx];
    const offsetX = MARGIN - mmToSvg(bbox.min_x, scale);
    const offsetY = currentY - mmToSvg(bbox.min_y, scale);

    // Room name
    svg += `<text x="${MARGIN}" y="${currentY - 10}" font-size="15" font-weight="600" fill="${COLOURS.label}">${escapeXml(layout.room.name)}</text>`;

    // Clip path
    const clipId = `room-clip-${roomIdx}`;
    svg += renderClipPath(clipId, layout.resolved_walls, scale, offsetX, offsetY);

    // Room outline (background)
    svg += renderPolygonOutline(layout.resolved_walls, scale, offsetX, offsetY);

    // Drops (clipped) — roll goods
    if (layout.drops && layout.drops.length > 0) {
      svg += `<g clip-path="url(#${clipId})">`;
      layout.drops.forEach((drop, i) => {
        svg += renderDrop(drop, scale, offsetX, offsetY, i % 2 === 0);
      });
      svg += `</g>`;
    }

    // Tiles (clipped) — plank/tile goods
    if (layout.tiles && layout.tiles.length > 0) {
      svg += `<g clip-path="url(#${clipId})">`;
      layout.tiles.forEach((tile) => {
        svg += renderTile(tile, scale, offsetX, offsetY);
      });
      svg += `</g>`;
    }

    // Seams (clipped)
    if (layout.seams && layout.seams.length > 0) {
      svg += `<g clip-path="url(#${clipId})">`;
      layout.seams.forEach((seam) => {
        svg += renderSeamLine(seam, scale, offsetX, offsetY);
      });
      svg += `</g>`;
    }

    // Room outline (on top)
    svg += `<polygon points="${layout.resolved_walls
      .map((p) => `${mmToSvg(p.x_mm, scale) + offsetX},${mmToSvg(p.y_mm, scale) + offsetY}`)
      .join(" ")}" fill="none" stroke="${COLOURS.wall}" stroke-width="3" stroke-linejoin="round"/>`;

    // Gripper perimeter (carpet)
    if (showGripper) {
      const inset = insetPolygon(layout.resolved_walls, gripperGapMm);
      if (inset.length >= 3) {
        svg += renderGripperPerimeter(inset, scale, offsetX, offsetY);
      }
    }

    // Coved skirtings (vinyl) — hatched strip inside walls
    if (layout.coved) {
      svg += renderCovePerimeter(layout.resolved_walls, 100, scale, offsetX, offsetY);
    }

    // Corner welds
    if (layout.corner_welds && layout.corner_welds.length > 0) {
      for (const weld of layout.corner_welds) {
        svg += renderCornerWeld(weld, scale, offsetX, offsetY);
      }
    }

    // Wall dimensions
    const wallSegs = polygonWallSegments(layout.resolved_walls);
    wallSegs.forEach((seg) => {
      svg += renderWallDimension(seg, scale, offsetX, offsetY, true);
    });

    // Doors — handle both legacy (wall_index + offset) and new (position_mm/wall_segment) formats
    if (layout.room.doors && layout.room.doors.length > 0) {
      for (const door of layout.room.doors) {
        const widthMm = door.width_mm ?? (door.width_m ? door.width_m * 1000 : 830);

        // New format: wall_segment [startIdx, endIdx]
        if (door.wall_segment && door.wall_segment.length === 2) {
          const [si, ei] = door.wall_segment;
          if (si >= 0 && si < wallSegs.length) {
            const wall = wallSegs[si];
            // Position along wall — if we have position_mm as Point, project onto wall
            const pos = door.position_mm;
            let posMm = wall.length_mm / 2; // default: middle of wall
            if (pos && typeof pos === "object") {
              const px = "x_mm" in pos ? (pos as { x_mm: number }).x_mm : (pos as { x: number }).x;
              const py = "x_mm" in pos ? (pos as { y_mm: number }).y_mm : (pos as { y: number }).y;
              // Project point onto wall segment
              const dx = wall.end.x_mm - wall.start.x_mm;
              const dy = wall.end.y_mm - wall.start.y_mm;
              const len2 = dx * dx + dy * dy;
              if (len2 > 0) {
                const t = Math.max(0, Math.min(1, ((px - wall.start.x_mm) * dx + (py - wall.start.y_mm) * dy) / len2));
                posMm = t * wall.length_mm;
              }
            }
            svg += renderDoor(wall.start, wall.end, posMm, widthMm, scale, offsetX, offsetY);
            continue;
          }
        }

        // Legacy format: wall_index + position_mm as number
        if (door.wall_index != null && typeof door.position_mm === "number") {
          const wallIdx = door.wall_index;
          if (wallIdx >= 0 && wallIdx < wallSegs.length) {
            const wall = wallSegs[wallIdx];
            svg += renderDoor(wall.start, wall.end, door.position_mm, widthMm, scale, offsetX, offsetY);
          }
        }
      }
    }

    // Direction arrow
    // Carpet: "PILE DIRECTION" runs down the drop length
    // Vinyl: "LAY DIRECTION" runs down the drop length (all drops same direction)
    const dirLabel = flooring_type === "carpet" ? "PILE DIRECTION" : "LAY DIRECTION";
    const centreX = mmToSvg((bbox.min_x + bbox.max_x) / 2, scale) + offsetX;
    const centreY = mmToSvg(bbox.min_y, scale) + offsetY - 35;
    // Direction is along the drop length (perpendicular to lay width)
    const dirDeg = layout.pile_direction_deg === 90 ? 0 : 90;
    svg += renderDirectionArrow(centreX, centreY, dirDeg, scale, dirLabel);

    currentY += svgH + ROOM_GAP;
  });

  // ── Legend box with all info + key ──
  const legendY = currentY + 10;
  const legendX = MARGIN;
  const legendW = totalWidth;

  svg += `<rect x="${legendX}" y="${legendY}" width="${legendW}" height="${legendHeight}" rx="6" fill="${COLOURS.legend}" stroke="${COLOURS.legendBorder}" stroke-width="1"/>`;

  let lineY = legendY + legendPadding + 14;

  // Info lines
  for (const line of legendLines) {
    svg += `<text x="${legendX + legendPadding}" y="${lineY}" font-size="12" fill="${COLOURS.label}">${escapeXml(line)}</text>`;
    lineY += LINE_H;
  }

  // Key header
  lineY += 4;
  svg += `<text x="${legendX + legendPadding}" y="${lineY}" font-size="12" font-weight="bold" fill="${COLOURS.label}">Key:</text>`;
  lineY += LINE_H;

  // Key items with inline markers
  for (const key of keyLines) {
    svg += renderKeyItem(legendX + legendPadding, lineY, key);
    lineY += LINE_H;
  }

  svg += `</svg>`;
  return svg;
}

interface KeyItem {
  type: "seam" | "gripper" | "cove" | "weld-internal" | "weld-external" | "door";
  label: string;
}

function buildKeyLines(
  flooringType: FlooringType,
  showGripper: boolean,
  hasCove: boolean
): KeyItem[] {
  const keys: KeyItem[] = [];

  keys.push({
    type: "seam",
    label: flooringType === "vinyl" ? "Weld seam (butt joint)" : "Seam/join line",
  });

  if (showGripper) {
    keys.push({ type: "gripper", label: "Gripper rod perimeter" });
  }

  keys.push({ type: "door", label: "Doorway" });

  if (hasCove) {
    keys.push({ type: "cove", label: "Coved skirting (100mm up wall)" });
    keys.push({ type: "weld-internal", label: "Internal corner weld (100mm)" });
    keys.push({ type: "weld-external", label: "External corner — 200mm patch + welds" });
  }

  return keys;
}

function renderKeyItem(x: number, y: number, key: KeyItem): string {
  const markerX = x + 14;
  const textX = x + 36;
  let marker = "";

  switch (key.type) {
    case "seam":
      marker = `<line x1="${x}" y1="${y - 4}" x2="${x + 28}" y2="${y - 4}" stroke="${COLOURS.seam}" stroke-width="2" stroke-dasharray="8,4"/>`;
      break;
    case "gripper":
      marker = `<line x1="${x}" y1="${y - 4}" x2="${x + 28}" y2="${y - 4}" stroke="${COLOURS.gripper}" stroke-width="1.5" stroke-dasharray="6,3" opacity="0.7"/>`;
      break;
    case "door":
      marker = `<line x1="${x}" y1="${y - 4}" x2="${x + 20}" y2="${y - 4}" stroke="${COLOURS.door}" stroke-width="4"/>`;
      marker += `<circle cx="${x}" cy="${y - 4}" r="3" fill="${COLOURS.door}"/>`;
      break;
    case "cove":
      marker = `<rect x="${x}" y="${y - 9}" width="28" height="10" fill="${COLOURS.cove}" opacity="0.35" stroke="${COLOURS.coveStroke}" stroke-width="1"/>`;
      break;
    case "weld-internal": {
      const ix = markerX;
      marker = `<polygon points="${ix},${y - 9} ${ix + 6},${y - 4} ${ix},${y + 1} ${ix - 6},${y - 4}" fill="${COLOURS.weldInternal}" opacity="0.9"/>`;
      break;
    }
    case "weld-external": {
      const ex = markerX;
      marker = `<rect x="${ex - 7}" y="${y - 10}" width="14" height="14" fill="${COLOURS.weldExternal}" opacity="0.9" rx="2"/>`;
      marker += `<text x="${ex}" y="${y - 1}" text-anchor="middle" font-size="9" font-weight="bold" fill="white">P</text>`;
      break;
    }
  }

  const text = `<text x="${textX}" y="${y}" font-size="11" fill="${COLOURS.dimension}">${escapeXml(key.label)}</text>`;
  return marker + text;
}

function buildLegendLines(result: CuttingPlanResult): string[] {
  const { material, totals, rooms, flooring_type, accessories } = result;
  const lines: string[] = [];

  if (material.product_name) {
    lines.push(`Material: ${material.product_name}`);
  }

  if (material.format === "roll") {
    lines.push(`Roll width: ${material.width_m}m`);
    if (result.roll_length_required_m) {
      lines.push(`Roll length required: ${result.roll_length_required_m}m`);
    }
  }

  lines.push(`Room area: ${totals.total_room_area_m2} m²`);
  lines.push(`Material required: ${totals.total_material_m2} m²`);
  lines.push(`Waste: ${totals.total_waste_m2} m² (${totals.overall_waste_percent}%)`);

  if (rooms.length > 0 && rooms[0].drops) {
    lines.push(`Drops: ${rooms[0].drops.length}`);
    if (rooms[0].seams && rooms[0].seams.length > 0) {
      const seamLabel = flooring_type === "vinyl" ? "Weld seams" : "Seams";
      lines.push(`${seamLabel}: ${rooms[0].seams.length}`);
    }
  }

  if (rooms.length > 0 && rooms[0].tiles) {
    const totalTiles = rooms.reduce((s, r) => s + (r.tiles?.length ?? 0), 0);
    const cutTiles = rooms.reduce(
      (s, r) => s + (r.tiles?.filter((t) => t.is_cut).length ?? 0),
      0
    );
    lines.push(`Planks/tiles: ${totalTiles} (${cutTiles} cut)`);
  }

  if (rooms.length > 0 && rooms[0].coved && rooms[0].corner_welds) {
    const welds = rooms[0].corner_welds;
    const internal = welds.filter((w) => w.type === "internal").length;
    const external = welds.filter((w) => w.type === "external").length;
    lines.push(`Coved skirtings: Yes`);
    if (internal > 0) lines.push(`  Internal corners: ${internal}`);
    if (external > 0) lines.push(`  External corners: ${external}`);
    const totalWeld = welds.reduce((s, w) => s + w.weld_length_mm, 0);
    lines.push(`  Total corner weld: ${(totalWeld / 1000).toFixed(1)}m`);
  }

  // Accessories
  if (accessories && accessories.length > 0) {
    lines.push("");
    lines.push("Accessories needed:");
    for (const acc of accessories) {
      lines.push(`  ${acc.quantity} ${acc.unit} — ${acc.description}`);
    }
  }

  return lines;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}
