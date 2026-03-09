import type {
  RoomInput,
  MaterialInput,
  CuttingPlanOptions,
  RoomLayout,
  Drop,
  Seam,
  Polygon,
  Point,
  DoorInput,
  BoundingBox,
} from "../types";
import {
  polygonArea,
  polygonBoundingBox,
  rectangleToPolygon,
  clipRectToPolygonArea,
} from "../geometry/polygon";
import { resolveDoorPosition, isDoorNearSeam } from "./doors";

const DEFAULT_GRIPPER_GAP_MM = 6;

interface CarpetLayoutInput {
  room: RoomInput;
  material: MaterialInput;
  options?: CuttingPlanOptions;
}

/**
 * Calculate carpet drop layout for a single room.
 * Includes seam repositioning to avoid placing seams near doorways.
 */
export function calculateCarpetLayout(input: CarpetLayoutInput): RoomLayout {
  const { room, material, options } = input;

  // Resolve room polygon
  const resolved_walls = resolveWalls(room);
  const bbox = polygonBoundingBox(resolved_walls);
  const roomAreaMm2 = polygonArea(resolved_walls);

  const rollWidthMm = material.width_m * 1000;
  const patternRepeatMm = material.pattern_repeat_m
    ? material.pattern_repeat_m * 1000
    : 0;

  // Smart orientation considering light direction, doors, and waste
  const pileDeg = inferPileDirection(room, bbox, rollWidthMm, roomAreaMm2);

  // Build initial layout with zero offset
  let bestLayout = buildDropLayout(
    room,
    resolved_walls,
    bbox,
    roomAreaMm2,
    rollWidthMm,
    patternRepeatMm,
    pileDeg,
    0,
    options
  );

  // Step 5: Seam repositioning — if any seam is near a door, try shifted offsets
  const doorAdjacentCount = bestLayout.seams
    ? bestLayout.seams.filter((s) => s.near_door).length
    : 0;

  if (doorAdjacentCount > 0 && room.doors && room.doors.length > 0) {
    // Try several offsets — shifting where drops start within the room
    const offsets = [
      rollWidthMm / 4,
      rollWidthMm / 2,
      rollWidthMm * 0.75,
      rollWidthMm / 3,
      rollWidthMm * 0.67,
    ];

    let bestDoorCount = doorAdjacentCount;

    for (const offset of offsets) {
      const trial = buildDropLayout(
        room,
        resolved_walls,
        bbox,
        roomAreaMm2,
        rollWidthMm,
        patternRepeatMm,
        pileDeg,
        offset,
        options
      );

      const trialDoorCount = trial.seams
        ? trial.seams.filter((s) => s.near_door).length
        : 0;

      if (trialDoorCount < bestDoorCount) {
        bestLayout = trial;
        bestDoorCount = trialDoorCount;
        if (trialDoorCount === 0) break; // Perfect — no seams near doors
      }
    }
  }

  return bestLayout;
}

/**
 * Build a drop layout with a given starting offset.
 * The offset shifts where the first seam falls, allowing the optimizer
 * to try different positions to avoid door-adjacent seams.
 */
function buildDropLayout(
  room: RoomInput,
  resolved_walls: Polygon,
  bbox: BoundingBox,
  roomAreaMm2: number,
  rollWidthMm: number,
  patternRepeatMm: number,
  pileDeg: number,
  startOffset: number,
  options?: CuttingPlanOptions
): RoomLayout {
  const isRotated = pileDeg === 90;
  const layWidth = isRotated ? bbox.height_mm : bbox.width_mm;
  const rawLayLength = isRotated ? bbox.width_mm : bbox.height_mm;

  // Pattern repeat: round up drop length to next repeat multiple
  const layLength =
    patternRepeatMm > 0
      ? Math.ceil(rawLayLength / patternRepeatMm) * patternRepeatMm
      : rawLayLength;

  // Build drop widths with offset
  // If offset > 0, the first drop is narrower (offset width),
  // then full-width drops, then the remainder as the last drop.
  const dropWidths: number[] = [];

  if (startOffset > 0 && startOffset < rollWidthMm) {
    // First partial drop (the offset strip)
    dropWidths.push(startOffset);
    let remaining = layWidth - startOffset;
    while (remaining > 0) {
      const w = Math.min(rollWidthMm, remaining);
      dropWidths.push(w);
      remaining -= rollWidthMm;
    }
  } else {
    // Standard: no offset
    let remaining = layWidth;
    while (remaining > 0) {
      const w = Math.min(rollWidthMm, remaining);
      dropWidths.push(w);
      remaining -= rollWidthMm;
    }
  }

  const totalDrops = dropWidths.length;

  // Build drops
  const drops: Drop[] = [];
  let pos = 0;
  for (let i = 0; i < totalDrops; i++) {
    const dropWidth = dropWidths[i];
    const isOffcut = dropWidth < rollWidthMm - 1;

    let x_mm: number, y_mm: number, w_mm: number, h_mm: number;
    if (isRotated) {
      x_mm = bbox.min_x;
      y_mm = bbox.min_y + pos;
      w_mm = layLength;
      h_mm = dropWidth;
    } else {
      x_mm = bbox.min_x + pos;
      y_mm = bbox.min_y;
      w_mm = dropWidth;
      h_mm = layLength;
    }

    const clippedArea = clipRectToPolygonArea(
      x_mm,
      y_mm,
      w_mm,
      h_mm,
      resolved_walls
    );

    drops.push({
      index: i + 1,
      x_mm,
      y_mm,
      width_mm: w_mm,
      length_mm: h_mm,
      cut_width_mm: rollWidthMm,
      cut_length_mm: h_mm,
      is_offcut: isOffcut,
      clipped_area_mm2: clippedArea,
    });

    pos += dropWidth;
  }

  // Build seams (at boundaries between drops)
  const seams: Seam[] = [];
  for (let i = 0; i < totalDrops - 1; i++) {
    const drop = drops[i];

    if (isRotated) {
      const seamY = drop.y_mm + drop.length_mm;
      seams.push({
        x_mm: drop.x_mm,
        x_end_mm: drop.x_mm + drop.width_mm,
        y_start_mm: seamY,
        y_end_mm: seamY,
        near_door: isDoorNearSeam(
          room.doors,
          resolved_walls,
          seamY,
          isRotated
        ),
      });
    } else {
      const seamX = drop.x_mm + drop.width_mm;
      seams.push({
        x_mm: seamX,
        y_start_mm: bbox.min_y,
        y_end_mm: bbox.min_y + layLength,
        near_door: isDoorNearSeam(
          room.doors,
          resolved_walls,
          seamX,
          isRotated
        ),
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
    waste_percent: round1(
      roomAreaM2 > 0 ? (wasteM2 / totalMaterialM2) * 100 : 0
    ),
  };
}

// ── Pile direction inference ──

/**
 * Determine optimal pile direction considering:
 * 1. Explicit override from user/AI
 * 2. Main light source (seams less visible perpendicular to light)
 * 3. Main entrance door (pile towards door is trade standard)
 * 4. Waste optimisation (fallback)
 */
function inferPileDirection(
  room: RoomInput,
  bbox: BoundingBox,
  rollWidthMm: number,
  roomAreaMm2: number
): number {
  // Explicit override always wins
  if (room.pile_direction != null) return room.pile_direction;

  // Light direction: seams should be perpendicular to main light source
  if (room.main_light_source) {
    const src = room.main_light_source.toLowerCase();
    if (
      ["north", "south", "front", "back", "top", "bottom"].some((d) =>
        src.includes(d)
      )
    ) {
      return 0;
    }
    if (
      ["east", "west", "left", "right"].some((d) => src.includes(d))
    ) {
      return 90;
    }
  }

  // Door heuristic: if main door is on a specific wall, orient pile towards it
  if (room.doors && room.doors.length > 0) {
    const mainDoor = room.doors.find((d) => {
      const ct = (d.connects_to || "").toLowerCase();
      return (
        ct.includes("hall") ||
        ct.includes("exterior") ||
        ct.includes("landing") ||
        ct.includes("corridor")
      );
    });

    if (mainDoor) {
      const doorPos = resolveDoorPosition(mainDoor, room.walls || []);
      if (doorPos) {
        const isOnHorizontalWall =
          Math.abs(doorPos.y_mm - bbox.min_y) < 100 ||
          Math.abs(doorPos.y_mm - bbox.max_y) < 100;
        const isOnVerticalWall =
          Math.abs(doorPos.x_mm - bbox.min_x) < 100 ||
          Math.abs(doorPos.x_mm - bbox.max_x) < 100;

        if (isOnHorizontalWall) return 0;
        if (isOnVerticalWall) return 90;
      }
    }
  }

  // Fallback: optimise for waste
  const drops0 = Math.ceil(bbox.width_mm / rollWidthMm);
  const drops90 = Math.ceil(bbox.height_mm / rollWidthMm);
  const waste0 = drops0 * rollWidthMm * bbox.height_mm - roomAreaMm2;
  const waste90 = drops90 * rollWidthMm * bbox.width_mm - roomAreaMm2;

  if (drops0 <= drops90) {
    return waste0 <= waste90 ? 0 : drops0 < drops90 ? 0 : 90;
  } else {
    return waste90 <= waste0 ? 90 : drops90 < drops0 ? 90 : 0;
  }
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
