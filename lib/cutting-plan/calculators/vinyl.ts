import type {
  RoomInput,
  MaterialInput,
  CuttingPlanOptions,
  RoomLayout,
  Drop,
  Seam,
  Polygon,
} from "../types";
import {
  polygonArea,
  polygonBoundingBox,
  rectangleToPolygon,
  clipRectToPolygonArea,
} from "../geometry/polygon";

const DEFAULT_SEAM_OVERLAP_MM = 25;
const DEFAULT_SCRIBE_ALLOWANCE_MM = 50;

interface VinylLayoutInput {
  room: RoomInput;
  material: MaterialInput;
  options?: CuttingPlanOptions;
}

/**
 * Calculate vinyl sheet layout for a single room.
 * Similar to carpet but with seam overlap, weld lines, and scribe allowance.
 */
export function calculateVinylLayout(input: VinylLayoutInput): RoomLayout {
  const { room, material, options } = input;
  const seamOverlap = options?.seam_overlap_mm ?? DEFAULT_SEAM_OVERLAP_MM;
  const scribeAllowance = options?.scribe_allowance_mm ?? DEFAULT_SCRIBE_ALLOWANCE_MM;

  // Resolve room polygon
  const resolved_walls = resolveWalls(room);
  const bbox = polygonBoundingBox(resolved_walls);
  const roomAreaMm2 = polygonArea(resolved_walls);

  const rollWidthMm = material.width_m * 1000;

  // Vinyl: lay along longest dimension to minimise seams
  const pileDeg = room.pile_direction ?? (bbox.width_mm >= bbox.height_mm ? 0 : 90);
  const isRotated = pileDeg === 90;

  // Effective dimensions — scribe allowance adds to cut length (not room dimension)
  const layWidth = isRotated ? bbox.height_mm : bbox.width_mm;
  const layLength = isRotated ? bbox.width_mm : bbox.height_mm;

  // Calculate drops — account for seam overlap between adjacent drops
  const numFullDrops = Math.floor(layWidth / rollWidthMm);
  const coveredWidth = numFullDrops * rollWidthMm - (numFullDrops > 0 ? (numFullDrops - 1) * seamOverlap : 0);
  const remainder = layWidth - coveredWidth;
  const hasPartialDrop = remainder > 0;
  const totalDrops = numFullDrops + (hasPartialDrop ? 1 : 0);

  // Recalculate with overlap: each subsequent drop overlaps by seamOverlap
  // Actual number of drops needed
  let dropsNeeded: number;
  if (rollWidthMm >= layWidth) {
    dropsNeeded = 1;
  } else {
    // Each drop after the first covers (rollWidth - seamOverlap) of new width
    const effectiveWidth = rollWidthMm - seamOverlap;
    dropsNeeded = 1 + Math.ceil((layWidth - rollWidthMm) / effectiveWidth);
  }

  // Build drops with scribe allowance on cut length
  const drops: Drop[] = [];
  let currentOffset = 0;

  for (let i = 0; i < dropsNeeded; i++) {
    const isLast = i === dropsNeeded - 1;
    let dropWidth: number;

    if (dropsNeeded === 1) {
      dropWidth = rollWidthMm;
    } else if (isLast) {
      // Last drop: remaining width + overlap
      dropWidth = layWidth - currentOffset + seamOverlap;
      if (dropWidth > rollWidthMm) dropWidth = rollWidthMm;
    } else {
      dropWidth = rollWidthMm;
    }

    // Cut length includes scribe allowance on both ends
    const cutLength = layLength + scribeAllowance * 2;

    let x_mm: number, y_mm: number, w_mm: number, h_mm: number;
    if (isRotated) {
      x_mm = bbox.min_x;
      y_mm = bbox.min_y + currentOffset;
      w_mm = cutLength;
      h_mm = dropWidth;
    } else {
      x_mm = bbox.min_x + currentOffset;
      y_mm = bbox.min_y;
      w_mm = dropWidth;
      h_mm = cutLength;
    }

    const clippedArea = clipRectToPolygonArea(x_mm, y_mm, w_mm, h_mm, resolved_walls);

    drops.push({
      index: i + 1,
      x_mm,
      y_mm,
      width_mm: w_mm,
      length_mm: h_mm,
      is_offcut: isLast && dropsNeeded > 1,
      clipped_area_mm2: clippedArea,
    });

    // Next drop starts (rollWidth - seamOverlap) after this one
    if (!isLast) {
      currentOffset += rollWidthMm - seamOverlap;
    }
  }

  // Seams at overlap positions (for weld line marking)
  const seams: Seam[] = [];
  for (let i = 0; i < dropsNeeded - 1; i++) {
    const seamPos = (i + 1) * rollWidthMm - i * seamOverlap;
    if (isRotated) {
      seams.push({
        x_mm: bbox.min_x,
        y_start_mm: bbox.min_y + seamPos,
        y_end_mm: bbox.min_y + seamPos,
        near_door: false,
      });
    } else {
      seams.push({
        x_mm: bbox.min_x + seamPos,
        y_start_mm: bbox.min_y,
        y_end_mm: bbox.min_y + layLength,
        near_door: false,
      });
    }
  }

  // Material totals — includes scribe allowance and overlap waste
  const totalMaterialMm2 = drops.reduce(
    (sum, d) => sum + d.width_mm * d.length_mm,
    0
  );
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
    waste_percent: round1(totalMaterialM2 > 0 ? (wasteM2 / totalMaterialM2) * 100 : 0),
  };
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
