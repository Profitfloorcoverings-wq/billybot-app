import type {
  RoomInput,
  MaterialInput,
  CuttingPlanOptions,
  RoomLayout,
  Drop,
  Seam,
  Polygon,
  CornerWeld,
} from "../types";
import {
  polygonArea,
  polygonBoundingBox,
  rectangleToPolygon,
  clipRectToPolygonArea,
  polygonWallSegments,
  polygonExtentInYBand,
  polygonExtentInXBand,
} from "../geometry/polygon";
import { isDoorNearSeam } from "./doors";

const DEFAULT_LENGTH_EXCESS_MM = 100;
const DEFAULT_COVE_HEIGHT_MM = 100;

interface VinylLayoutInput {
  room: RoomInput;
  material: MaterialInput;
  options?: CuttingPlanOptions;
}

/**
 * Calculate vinyl sheet layout for a single room.
 *
 * Coved skirtings: the vinyl itself turns up the wall (100mm default).
 * - Edge drops lose floor coverage because part of the roll goes up the side wall.
 *   Drop 1 covers rollWidth − coveHeight of floor (left edge goes up wall).
 *   Last drop: remaining floor + coveHeight up right wall.
 * - ALL drops get coveHeight added to BOTH ends of cut length (turns up end walls).
 * - Filler optimisation (trade practice):
 *   Filler ≤ 500mm → turned 90° (2m widths × filler width), noted on plan.
 *   Filler 500mm–1000mm → order half length, split in two with T-weld.
 */
export function calculateVinylLayout(input: VinylLayoutInput): RoomLayout {
  const { room, material, options } = input;
  const lengthExcess = options?.length_excess_mm ?? DEFAULT_LENGTH_EXCESS_MM;
  const coved = options?.coved ?? false;
  const coveHeight = options?.cove_height_mm ?? DEFAULT_COVE_HEIGHT_MM;

  // Resolve room polygon
  const resolved_walls = resolveWalls(room);
  const bbox = polygonBoundingBox(resolved_walls);
  const roomAreaMm2 = polygonArea(resolved_walls);

  const rollWidthMm = material.width_m * 1000;

  // Smart orientation: try both directions, pick fewer drops
  // When coved, account for cove reducing effective floor coverage
  let pileDeg: number;
  if (room.pile_direction != null) {
    pileDeg = room.pile_direction;
  } else {
    const eff0 = calcDropCount(bbox.width_mm, rollWidthMm, coved ? coveHeight : 0);
    const eff90 = calcDropCount(bbox.height_mm, rollWidthMm, coved ? coveHeight : 0);
    const waste0 = eff0.totalRollWidth * bbox.height_mm - roomAreaMm2;
    const waste90 = eff90.totalRollWidth * bbox.width_mm - roomAreaMm2;

    if (eff0.count <= eff90.count) {
      pileDeg = waste0 <= waste90 ? 0 : eff0.count < eff90.count ? 0 : 90;
    } else {
      pileDeg = waste90 <= waste0 ? 90 : eff90.count < eff0.count ? 90 : 0;
    }
  }

  const isRotated = pileDeg === 90;
  const layWidth = isRotated ? bbox.height_mm : bbox.width_mm;

  // Calculate drops with cove-aware floor coverage
  const dropPlan = calcDropCount(layWidth, rollWidthMm, coved ? coveHeight : 0);

  // Build drops — each gets its own length based on polygon extent
  const drops: Drop[] = [];
  let floorOffset = 0; // tracks floor coverage position

  for (let i = 0; i < dropPlan.count; i++) {
    const isFirst = i === 0;
    const isLast = i === dropPlan.count - 1;

    // Floor coverage width for this drop
    const floorCoverage = dropPlan.floorWidths[i];

    // Find actual polygon extent for this drop's band
    let dropLength: number;
    let dropX: number;
    let dropY: number;

    if (isRotated) {
      const bandYMin = bbox.min_y + floorOffset + (i > 0 ? 1 : 0);
      const bandYMax = bbox.min_y + floorOffset + floorCoverage;
      const extent = polygonExtentInYBand(resolved_walls, bandYMin, bandYMax);
      dropLength = extent ? extent.max_x - extent.min_x : bbox.width_mm;
      dropX = extent ? extent.min_x : bbox.min_x;
      dropY = bbox.min_y + floorOffset;
    } else {
      const bandXMin = bbox.min_x + floorOffset + (i > 0 ? 1 : 0);
      const bandXMax = bbox.min_x + floorOffset + floorCoverage;
      const extent = polygonExtentInXBand(resolved_walls, bandXMin, bandXMax);
      dropLength = extent ? extent.max_y - extent.min_y : bbox.height_mm;
      dropX = bbox.min_x + floorOffset;
      dropY = extent ? extent.min_y : bbox.min_y;
    }

    const clippedArea = clipRectToPolygonArea(
      isRotated ? dropX : bbox.min_x + floorOffset,
      isRotated ? bbox.min_y + floorOffset : dropY,
      isRotated ? dropLength : floorCoverage,
      isRotated ? floorCoverage : dropLength,
      resolved_walls
    );

    // Cut dimensions — what the fitter actually orders/cuts from the roll
    // Vinyl comes in fixed roll widths — you always order full roll width.
    // Length: floor extent + excess + cove on both ends (vinyl turns up end walls)
    const coveLengthExtra = coved ? coveHeight * 2 : 0;
    const fillerWidth = floorCoverage + (coved ? coveHeight : 0);
    let cutWidthMm: number;
    let cutLengthMm: number;

    if (!isLast || floorCoverage >= rollWidthMm) {
      // Full drop — always roll width × cut length
      cutWidthMm = rollWidthMm;
      cutLengthMm = dropLength + lengthExcess + coveLengthExtra;
    } else if (fillerWidth <= 500) {
      // Tiny filler (≤500mm): turn 90° — cut roll width × filler width
      cutWidthMm = rollWidthMm;
      cutLengthMm = fillerWidth;
    } else if (fillerWidth <= 1000) {
      // Medium filler (500mm–1m): order half the length, split with T-weld
      cutWidthMm = rollWidthMm;
      cutLengthMm = Math.ceil((dropLength + lengthExcess + coveLengthExtra) / 2);
    } else {
      // Large filler (>1m): full roll width × full length
      cutWidthMm = rollWidthMm;
      cutLengthMm = dropLength + lengthExcess + coveLengthExtra;
    }

    drops.push({
      index: i + 1,
      x_mm: isRotated ? dropX : bbox.min_x + floorOffset,
      y_mm: isRotated ? bbox.min_y + floorOffset : dropY,
      width_mm: isRotated ? dropLength : floorCoverage,
      length_mm: isRotated ? floorCoverage : dropLength,
      cut_width_mm: isRotated ? cutLengthMm : cutWidthMm,
      cut_length_mm: isRotated ? cutWidthMm : cutLengthMm,
      is_offcut: isLast && floorCoverage < rollWidthMm,
      clipped_area_mm2: clippedArea,
    });

    floorOffset += floorCoverage;
  }

  // Weld seam positions (butt joints between drops)
  const seams: Seam[] = [];
  let seamFloorOffset = 0;
  for (let i = 0; i < dropPlan.count - 1; i++) {
    seamFloorOffset += dropPlan.floorWidths[i];
    if (isRotated) {
      const seamY = bbox.min_y + seamFloorOffset;
      const extent = polygonExtentInYBand(resolved_walls, seamY + 1, seamY + 2);
      const xStart = extent ? extent.min_x : bbox.min_x;
      const xEnd = extent ? extent.max_x : bbox.min_x + bbox.width_mm;
      seams.push({
        x_mm: xStart,
        x_end_mm: xEnd,
        y_start_mm: seamY,
        y_end_mm: seamY,
        near_door: isDoorNearSeam(room.doors, resolved_walls, seamY, true),
      });
    } else {
      const seamX = bbox.min_x + seamFloorOffset;
      const extent = polygonExtentInXBand(resolved_walls, seamX - 1, seamX + 1);
      const yStart = extent ? extent.min_y : bbox.min_y;
      const yEnd = extent ? extent.max_y : bbox.min_y + bbox.height_mm;
      seams.push({
        x_mm: seamX,
        y_start_mm: yStart,
        y_end_mm: yEnd,
        near_door: isDoorNearSeam(room.doors, resolved_walls, seamX, false),
      });
    }
  }

  // Corner welds (coved skirtings only)
  let cornerWelds: CornerWeld[] | undefined;
  if (coved) {
    cornerWelds = calculateCornerWelds(resolved_walls, coveHeight);
  }

  // Material totals — use actual cut dimensions from each drop
  let totalMaterialMm2 = 0;
  for (const drop of drops) {
    const cutW = drop.cut_width_mm ?? (isRotated ? drop.length_mm : drop.width_mm);
    const cutL = drop.cut_length_mm ?? (isRotated ? drop.width_mm : drop.length_mm);
    totalMaterialMm2 += cutW * cutL;
  }

  const wasteMm2 = totalMaterialMm2 - roomAreaMm2;

  const roomAreaM2 = roomAreaMm2 / 1_000_000;
  const totalMaterialM2 = totalMaterialMm2 / 1_000_000;
  const wasteM2 = wasteMm2 / 1_000_000;

  return {
    room,
    resolved_walls,
    drops,
    seams,
    pile_direction_deg: pileDeg,
    room_area_m2: round2(roomAreaM2),
    total_material_m2: round2(totalMaterialM2),
    waste_m2: round2(wasteM2),
    waste_percent: round1(
      totalMaterialM2 > 0 ? (wasteM2 / totalMaterialM2) * 100 : 0
    ),
    coved,
    corner_welds: cornerWelds,
  };
}

/**
 * Calculate how many drops are needed and their floor coverage widths.
 *
 * When coved:
 * - First drop: floor coverage = rollWidth − coveHeight (edge goes up left wall)
 * - Middle drops: full rollWidth floor coverage
 * - Last drop: whatever remains (+ coveHeight goes up right wall, cut from roll)
 *
 * When NOT coved:
 * - Standard: ceil(layWidth / rollWidth) drops
 */
function calcDropCount(
  layWidth: number,
  rollWidth: number,
  coveHeight: number
): { count: number; floorWidths: number[]; totalRollWidth: number } {
  if (coveHeight === 0) {
    // Standard (non-coved)
    const count = Math.ceil(layWidth / rollWidth);
    const widths: number[] = [];
    let remaining = layWidth;
    for (let i = 0; i < count; i++) {
      widths.push(Math.min(rollWidth, remaining));
      remaining -= rollWidth;
    }
    return { count, floorWidths: widths, totalRollWidth: count * rollWidth };
  }

  // Coved layout
  const widths: number[] = [];

  // First drop: coveHeight goes up left wall, rest is floor
  const firstFloor = rollWidth - coveHeight;
  widths.push(firstFloor);
  let remaining = layWidth - firstFloor;

  // Middle drops: full roll width on floor
  while (remaining > rollWidth) {
    widths.push(rollWidth);
    remaining -= rollWidth;
  }

  // Last drop: remaining floor + coveHeight up right wall
  // The fitter needs (remaining + coveHeight) from the roll
  if (remaining > 0) {
    widths.push(remaining);
  }

  const count = widths.length;
  // Total roll width used (for waste calculation)
  const totalRollWidth = count * rollWidth;

  return { count, floorWidths: widths, totalRollWidth };
}

/**
 * Calculate corner welds for coved skirtings.
 * Internal corners: 100mm weld
 * External corners: 200mm patch with welds (100mm + 200mm + 100mm = 400mm total weld)
 */
function calculateCornerWelds(
  walls: Polygon,
  coveHeight: number
): CornerWeld[] {
  const welds: CornerWeld[] = [];

  for (let i = 0; i < walls.length; i++) {
    const prev = walls[(i - 1 + walls.length) % walls.length];
    const curr = walls[i];
    const next = walls[(i + 1) % walls.length];

    // Cross product to determine internal vs external corner (for clockwise polygon)
    const dx1 = curr.x_mm - prev.x_mm;
    const dy1 = curr.y_mm - prev.y_mm;
    const dx2 = next.x_mm - curr.x_mm;
    const dy2 = next.y_mm - curr.y_mm;
    const cross = dx1 * dy2 - dy1 * dx2;

    // For clockwise polygon: cross > 0 = internal (concave), cross < 0 = external (convex)
    const isInternal = cross > 0;

    if (isInternal) {
      welds.push({
        type: "internal",
        position: curr,
        weld_length_mm: coveHeight, // 100mm vertical weld
      });
    } else {
      welds.push({
        type: "external",
        position: curr,
        weld_length_mm: coveHeight + coveHeight * 2 + coveHeight, // corner + base + vertical
        patch_width_mm: 200,
      });
    }
  }

  return welds;
}

function resolveWalls(room: RoomInput): Polygon {
  if (room.walls && room.walls.length >= 3) {
    return room.walls;
  }
  if (room.bounding_box) {
    return rectangleToPolygon(room.bounding_box.w_m, room.bounding_box.l_m);
  }
  throw new Error(`Room "${room.name}" has no walls or bounding_box`);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
