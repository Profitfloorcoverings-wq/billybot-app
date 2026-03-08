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

const DEFAULT_GRIPPER_GAP_MM = 6;

interface CarpetLayoutInput {
  room: RoomInput;
  material: MaterialInput;
  options?: CuttingPlanOptions;
}

/**
 * Calculate carpet drop layout for a single room.
 * Works with any room polygon shape.
 */
export function calculateCarpetLayout(input: CarpetLayoutInput): RoomLayout {
  const { room, material, options } = input;
  const gripperGap = options?.gripper_gap_mm ?? DEFAULT_GRIPPER_GAP_MM;

  // Resolve room polygon
  const resolved_walls = resolveWalls(room);
  const bbox = polygonBoundingBox(resolved_walls);
  const roomAreaMm2 = polygonArea(resolved_walls);

  const rollWidthMm = material.width_m * 1000;

  // Smart orientation: try both directions, pick the one with fewer drops/less waste
  // 0 = drops laid across width (drop length = height)
  // 90 = drops laid across height (drop length = width)
  let pileDeg: number;
  if (room.pile_direction != null) {
    pileDeg = room.pile_direction;
  } else {
    const drops0 = Math.ceil(bbox.width_mm / rollWidthMm);
    const drops90 = Math.ceil(bbox.height_mm / rollWidthMm);
    const waste0 = drops0 * rollWidthMm * bbox.height_mm - roomAreaMm2;
    const waste90 = drops90 * rollWidthMm * bbox.width_mm - roomAreaMm2;

    if (drops0 <= drops90) {
      pileDeg = waste0 <= waste90 ? 0 : (drops0 < drops90 ? 0 : 90);
    } else {
      pileDeg = waste90 <= waste0 ? 90 : (drops90 < drops0 ? 90 : 0);
    }
  }

  const isRotated = pileDeg === 90;
  const layWidth = isRotated ? bbox.height_mm : bbox.width_mm;
  const layLength = isRotated ? bbox.width_mm : bbox.height_mm;

  // Calculate number of drops
  const numFullDrops = Math.floor(layWidth / rollWidthMm);
  const remainder = layWidth - numFullDrops * rollWidthMm;
  const hasPartialDrop = remainder > 0;
  const totalDrops = numFullDrops + (hasPartialDrop ? 1 : 0);

  // Check if rotating would eliminate a narrow strip
  const narrowStripWarning = hasPartialDrop && remainder < 300;

  // Build drops
  const drops: Drop[] = [];
  for (let i = 0; i < totalDrops; i++) {
    const dropWidth = i === totalDrops - 1 && hasPartialDrop ? remainder : rollWidthMm;
    const isOffcut = i === totalDrops - 1 && hasPartialDrop;

    // Position in room coordinates
    let x_mm: number, y_mm: number, w_mm: number, h_mm: number;
    if (isRotated) {
      x_mm = bbox.min_x;
      y_mm = bbox.min_y + i * rollWidthMm;
      w_mm = layLength;
      h_mm = dropWidth;
    } else {
      x_mm = bbox.min_x + i * rollWidthMm;
      y_mm = bbox.min_y;
      w_mm = dropWidth;
      h_mm = layLength;
    }

    // Calculate clipped area (intersection with room polygon)
    const clippedArea = clipRectToPolygonArea(x_mm, y_mm, w_mm, h_mm, resolved_walls);

    drops.push({
      index: i + 1,
      x_mm,
      y_mm,
      width_mm: w_mm,
      length_mm: h_mm,
      is_offcut: isOffcut,
      clipped_area_mm2: clippedArea,
    });
  }

  // Build seams (at boundaries between drops)
  const seams: Seam[] = [];
  for (let i = 0; i < totalDrops - 1; i++) {
    const drop = drops[i];
    let seamX: number, seamYStart: number, seamYEnd: number;

    if (isRotated) {
      // Horizontal seam
      seamX = drop.x_mm;
      seamYStart = drop.y_mm + drop.length_mm;
      seamYEnd = seamYStart;
      // For rotated, seam is horizontal — store as x_mm = start, y positions
      seams.push({
        x_mm: drop.x_mm,
        y_start_mm: drop.y_mm + drop.length_mm,
        y_end_mm: drop.y_mm + drop.length_mm,
        near_door: isDoorNearSeam(room.doors, drop.y_mm + drop.length_mm, isRotated),
      });
    } else {
      seamX = drop.x_mm + drop.width_mm;
      seamYStart = bbox.min_y;
      seamYEnd = bbox.min_y + layLength;
      seams.push({
        x_mm: seamX,
        y_start_mm: seamYStart,
        y_end_mm: seamYEnd,
        near_door: isDoorNearSeam(room.doors, seamX, isRotated),
      });
    }
  }

  // Material totals
  const totalMaterialMm2 = drops.reduce(
    (sum, d) => sum + d.width_mm * d.length_mm,
    0
  );
  const wasteMm2 = totalMaterialMm2 - roomAreaMm2;
  const additionalWaste = options?.waste_percent
    ? (roomAreaMm2 * options.waste_percent) / 100
    : 0;

  const roomAreaM2 = roomAreaMm2 / 1_000_000;
  const totalMaterialM2 = (totalMaterialMm2 + additionalWaste) / 1_000_000;
  const wasteM2 = (wasteMm2 + additionalWaste) / 1_000_000;

  return {
    room,
    resolved_walls,
    drops,
    seams,
    pile_direction_deg: pileDeg,
    room_area_m2: round2(roomAreaM2),
    total_material_m2: round2(totalMaterialM2),
    waste_m2: round2(wasteM2),
    waste_percent: round1(roomAreaM2 > 0 ? (wasteM2 / totalMaterialM2) * 100 : 0),
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

function isDoorNearSeam(
  doors: RoomInput["doors"],
  seamPosition: number,
  isRotated: boolean
): boolean {
  if (!doors || doors.length === 0) return false;
  // Simple heuristic: check if any door is within 300mm of seam
  // In a full implementation, we'd project door position onto the seam axis
  return false; // Will be enhanced when door positions are available
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
