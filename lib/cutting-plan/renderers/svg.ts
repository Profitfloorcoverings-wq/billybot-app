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
  renderLegend,
  renderArrowheadDef,
  escapeXml,
} from "./svg-helpers";

const MARGIN = 80;
const LEGEND_HEIGHT = 180;
const ROOM_GAP = 40;

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

  // Calculate total SVG dimensions
  // For now: single room (Phase 1). Multi-room in Phase 4.
  const layouts = rooms;
  let totalWidth = 0;
  let maxHeight = 0;

  const roomMetrics = layouts.map((layout) => {
    const bbox = polygonBoundingBox(layout.resolved_walls);
    // Scale: fit largest dimension to ~600px
    const maxDim = Math.max(bbox.width_mm, bbox.height_mm);
    const scale = maxDim > 0 ? 500 / maxDim : 1;
    const svgW = mmToSvg(bbox.width_mm, scale);
    const svgH = mmToSvg(bbox.height_mm, scale);
    return { bbox, scale, svgW, svgH };
  });

  roomMetrics.forEach((m) => {
    totalWidth = Math.max(totalWidth, m.svgW);
    maxHeight += m.svgH + ROOM_GAP;
  });

  const svgWidth = totalWidth + MARGIN * 2;
  const titleHeight = 40;
  const svgHeight = maxHeight + MARGIN * 2 + LEGEND_HEIGHT + titleHeight;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}" style="font-family: Inter, Arial, sans-serif; background: white;">`;

  // Arrow marker def
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

    // Clip path for room polygon
    const clipId = `room-clip-${roomIdx}`;
    svg += renderClipPath(clipId, layout.resolved_walls, scale, offsetX, offsetY);

    // Room outline (background)
    svg += renderPolygonOutline(layout.resolved_walls, scale, offsetX, offsetY);

    // Drops (clipped to room polygon)
    if (layout.drops && layout.drops.length > 0) {
      svg += `<g clip-path="url(#${clipId})">`;
      layout.drops.forEach((drop, i) => {
        svg += renderDrop(drop, scale, offsetX, offsetY, i % 2 === 0);
      });
      svg += `</g>`;
    }

    // Seams (on top, also clipped)
    if (layout.seams && layout.seams.length > 0) {
      svg += `<g clip-path="url(#${clipId})">`;
      layout.seams.forEach((seam) => {
        svg += renderSeamLine(seam, scale, offsetX, offsetY);
      });
      svg += `</g>`;
    }

    // Room outline (on top of drops)
    svg += `<polygon points="${layout.resolved_walls
      .map((p) => `${mmToSvg(p.x_mm, scale) + offsetX},${mmToSvg(p.y_mm, scale) + offsetY}`)
      .join(" ")}" fill="none" stroke="${COLOURS.wall}" stroke-width="3" stroke-linejoin="round"/>`;

    // Gripper perimeter (carpet only)
    if (showGripper) {
      const inset = insetPolygon(layout.resolved_walls, gripperGapMm);
      if (inset.length >= 3) {
        svg += renderGripperPerimeter(inset, scale, offsetX, offsetY);
      }
    }

    // Coved skirtings perimeter strip (vinyl)
    if (layout.coved) {
      const coveH = options?.gripperGapMm ?? 100; // reuse option or default
      svg += renderCovePerimeter(layout.resolved_walls, 100, scale, offsetX, offsetY);
    }

    // Corner welds (coved vinyl)
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

    // Doors
    if (layout.room.doors && layout.room.doors.length > 0) {
      const wallSegsForDoors = polygonWallSegments(layout.resolved_walls);
      for (const door of layout.room.doors) {
        const wallIdx = door.wall_index;
        if (wallIdx >= 0 && wallIdx < wallSegsForDoors.length) {
          const wall = wallSegsForDoors[wallIdx];
          svg += renderDoor(
            wall.start,
            wall.end,
            door.position_mm,
            door.width_mm,
            scale,
            offsetX,
            offsetY
          );
        }
      }
    }

    // Direction arrow — carpet = "PILE DIRECTION", vinyl = "LAY DIRECTION"
    const dirLabel = flooring_type === "carpet" ? "PILE DIRECTION" : "LAY DIRECTION";
    const centreX = mmToSvg((bbox.min_x + bbox.max_x) / 2, scale) + offsetX;
    const centreY = mmToSvg(bbox.min_y, scale) + offsetY - 35;
    svg += renderDirectionArrow(centreX, centreY, layout.pile_direction_deg, scale, dirLabel);

    currentY += svgH + ROOM_GAP;
  });

  // Legend
  const legendY = currentY + 10;
  const legendLines = buildLegendLines(result);
  svg += renderLegend(MARGIN, legendY, totalWidth, legendLines);

  // Seam legend indicator
  const seamLabel = flooring_type === "vinyl" ? "Weld seam" : "Seam/join line";
  const seamLegendY = legendY + legendLines.length * 18 + 36;
  svg += `<line x1="${MARGIN + 12}" y1="${seamLegendY}" x2="${MARGIN + 40}" y2="${seamLegendY}" stroke="${COLOURS.seam}" stroke-width="2" stroke-dasharray="8,4"/>`;
  svg += `<text x="${MARGIN + 50}" y="${seamLegendY + 4}" font-size="11" fill="${COLOURS.dimension}">${seamLabel}</text>`;

  if (showGripper) {
    svg += `<line x1="${MARGIN + 180}" y1="${seamLegendY}" x2="${MARGIN + 208}" y2="${seamLegendY}" stroke="${COLOURS.gripper}" stroke-width="1.5" stroke-dasharray="6,3" opacity="0.7"/>`;
    svg += `<text x="${MARGIN + 218}" y="${seamLegendY + 4}" font-size="11" fill="${COLOURS.dimension}">Gripper rod perimeter</text>`;
  }

  // Cove legend indicators
  const hasCove = rooms.some((r) => r.coved);
  if (hasCove) {
    const coveLegendY = seamLegendY + 20;
    svg += `<rect x="${MARGIN + 12}" y="${coveLegendY - 5}" width="28" height="10" fill="${COLOURS.cove}" opacity="0.3" stroke="${COLOURS.coveStroke}" stroke-width="0.5"/>`;
    svg += `<text x="${MARGIN + 50}" y="${coveLegendY + 4}" font-size="11" fill="${COLOURS.dimension}">Coved skirting (100mm up wall)</text>`;

    const weldLegendY = coveLegendY + 18;
    // Internal weld marker
    const ix = MARGIN + 26;
    svg += `<polygon points="${ix},${weldLegendY - 5} ${ix + 5},${weldLegendY} ${ix},${weldLegendY + 5} ${ix - 5},${weldLegendY}" fill="${COLOURS.weldInternal}" opacity="0.8"/>`;
    svg += `<text x="${MARGIN + 50}" y="${weldLegendY + 4}" font-size="11" fill="${COLOURS.dimension}">Internal corner weld (100mm)</text>`;

    const extLegendY = weldLegendY + 18;
    // External weld marker
    const ex = MARGIN + 26;
    svg += `<rect x="${ex - 6}" y="${extLegendY - 6}" width="12" height="12" fill="${COLOURS.weldExternal}" opacity="0.8" rx="2"/>`;
    svg += `<text x="${ex}" y="${extLegendY + 3}" text-anchor="middle" font-size="8" font-weight="bold" fill="white">P</text>`;
    svg += `<text x="${MARGIN + 50}" y="${extLegendY + 4}" font-size="11" fill="${COLOURS.dimension}">External corner patch (200mm + welds)</text>`;
  }

  svg += `</svg>`;
  return svg;
}

function buildLegendLines(result: CuttingPlanResult): string[] {
  const { material, totals, rooms, flooring_type } = result;
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

  // Coved skirtings info
  if (rooms.length > 0 && rooms[0].coved && rooms[0].corner_welds) {
    const welds = rooms[0].corner_welds;
    const internal = welds.filter((w) => w.type === "internal").length;
    const external = welds.filter((w) => w.type === "external").length;
    lines.push(`Coved skirtings: Yes`);
    if (internal > 0) lines.push(`  Internal corners: ${internal} (100mm weld each)`);
    if (external > 0) lines.push(`  External corners: ${external} (200mm patch + welds)`);
    const totalWeld = welds.reduce((s, w) => s + w.weld_length_mm, 0);
    lines.push(`  Total weld: ${(totalWeld / 1000).toFixed(1)}m`);
  }

  return lines;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}
