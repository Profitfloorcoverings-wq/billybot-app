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
} from "../geometry/polygon";

const DEFAULT_LENGTH_EXCESS_MM = 100;
const DEFAULT_COVE_HEIGHT_MM = 100;

interface VinylLayoutInput {
  room: RoomInput;
  material: MaterialInput;
  options?: CuttingPlanOptions;
}

/**
 * Calculate vinyl sheet layout for a single room.
 * - Drops butt together (no overlap) — weld groove cut after fitting
 * - 100mm excess on drop lengths
 * - Optional coved skirtings: vinyl goes up walls, corner welds tracked
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
  let pileDeg: number;
  if (room.pile_direction != null) {
    pileDeg = room.pile_direction;
  } else {
    const drops0 = Math.ceil(bbox.width_mm / rollWidthMm);
    const drops90 = Math.ceil(bbox.height_mm / rollWidthMm);
    const waste0 = drops0 * rollWidthMm * bbox.height_mm - roomAreaMm2;
    const waste90 = drops90 * rollWidthMm * bbox.width_mm - roomAreaMm2;

    if (drops0 <= drops90) {
      pileDeg = waste0 <= waste90 ? 0 : drops0 < drops90 ? 0 : 90;
    } else {
      pileDeg = waste90 <= waste0 ? 90 : drops90 < drops0 ? 90 : 0;
    }
  }

  const isRotated = pileDeg === 90;
  const layWidth = isRotated ? bbox.height_mm : bbox.width_mm;
  const layLength = isRotated ? bbox.width_mm : bbox.height_mm;

  // Drops butt together — no overlap
  const dropsNeeded = Math.ceil(layWidth / rollWidthMm);

  // Cut length: room length + excess
  // If coved: also add cove height on both ends (vinyl turns up both walls)
  const coveExtra = coved ? coveHeight * 2 : 0;
  const cutLength = layLength + lengthExcess + coveExtra;

  // Build drops
  const drops: Drop[] = [];
  let currentOffset = 0;

  for (let i = 0; i < dropsNeeded; i++) {
    const isLast = i === dropsNeeded - 1;
    let dropWidth: number;

    if (isLast && dropsNeeded > 1) {
      // Last drop: remaining width
      dropWidth = layWidth - currentOffset;
    } else if (dropsNeeded === 1) {
      // Single drop: full roll width or room width (whichever is larger for material calc)
      dropWidth = Math.max(rollWidthMm, layWidth);
    } else {
      dropWidth = rollWidthMm;
    }

    // If coved, first and last drops also need cove height on side walls
    let actualWidth = dropWidth;
    if (coved) {
      if (i === 0) actualWidth += coveHeight; // first drop goes up left wall
      if (isLast) actualWidth += coveHeight; // last drop goes up right wall
    }

    let x_mm: number, y_mm: number, w_mm: number, h_mm: number;
    if (isRotated) {
      x_mm = bbox.min_x - (coved ? coveHeight : 0);
      y_mm = bbox.min_y + currentOffset - (i === 0 && coved ? coveHeight : 0);
      w_mm = cutLength;
      h_mm = actualWidth;
    } else {
      x_mm = bbox.min_x + currentOffset - (i === 0 && coved ? coveHeight : 0);
      y_mm = bbox.min_y - (coved ? coveHeight : 0);
      w_mm = actualWidth;
      h_mm = cutLength;
    }

    const clippedArea = clipRectToPolygonArea(
      bbox.min_x + currentOffset,
      bbox.min_y,
      dropWidth,
      layLength,
      resolved_walls
    );

    drops.push({
      index: i + 1,
      x_mm: isRotated ? bbox.min_x : bbox.min_x + currentOffset,
      y_mm: isRotated ? bbox.min_y + currentOffset : bbox.min_y,
      width_mm: isRotated ? layLength : dropWidth,
      length_mm: isRotated ? dropWidth : layLength,
      is_offcut: isLast && dropsNeeded > 1,
      clipped_area_mm2: clippedArea,
    });

    currentOffset += rollWidthMm;
  }

  // Weld seam positions (butt joints between drops)
  const seams: Seam[] = [];
  for (let i = 0; i < dropsNeeded - 1; i++) {
    const seamPos = (i + 1) * rollWidthMm;
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

  // Corner welds (coved skirtings only)
  let cornerWelds: CornerWeld[] | undefined;
  if (coved) {
    cornerWelds = calculateCornerWelds(resolved_walls, coveHeight);
  }

  // Material totals
  // Floor material = sum of drop areas (full rectangles)
  const floorMaterialMm2 = drops.reduce(
    (sum, d) => sum + d.width_mm * d.length_mm,
    0
  );

  // If coved, add perimeter cove material
  let coveMaterialMm2 = 0;
  if (coved) {
    const wallSegs = polygonWallSegments(resolved_walls);
    for (const seg of wallSegs) {
      coveMaterialMm2 += seg.length_mm * coveHeight;
    }
  }

  // Excess material (length excess per drop)
  const excessMm2 = drops.length * rollWidthMm * lengthExcess;

  const totalMaterialMm2 = floorMaterialMm2 + excessMm2;
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
