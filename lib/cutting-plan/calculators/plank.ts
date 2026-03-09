import type {
  RoomInput,
  MaterialInput,
  CuttingPlanOptions,
  RoomLayout,
  TilePlacement,
  Polygon,
  BoundingBox,
  Point,
  DoorInput,
} from "../types";
import {
  polygonArea,
  polygonBoundingBox,
  rectangleToPolygon,
  clipRectToPolygonArea,
} from "../geometry/polygon";

const DEFAULT_EXPANSION_GAP_MM = 10;
const DEFAULT_STAGGER_MIN_MM = 300;
const DEFAULT_PLANK_WIDTH_MM = 180;
const DEFAULT_PLANK_LENGTH_MM = 1220;

interface PlankLayoutInput {
  room: RoomInput;
  material: MaterialInput;
  options?: CuttingPlanOptions;
}

/**
 * Calculate LVT / laminate / engineered wood plank layout for a single room.
 *
 * Planks are laid in rows along the lay direction:
 * - Each row offset (staggered) from the previous by at least stagger_min_mm
 * - Expansion gap around all walls
 * - First/last row may be cut to width
 * - First/last plank in each row cut to length
 * - Waste comes from: end cuts, width cuts, stagger offcuts
 */
export function calculatePlankLayout(input: PlankLayoutInput): RoomLayout {
  const { room, material, options } = input;
  const expansionGap = options?.expansion_gap_mm ?? DEFAULT_EXPANSION_GAP_MM;
  const staggerMin = options?.stagger_min_mm ?? DEFAULT_STAGGER_MIN_MM;

  // Resolve room polygon
  const resolved_walls = resolveWalls(room);
  const bbox = polygonBoundingBox(resolved_walls);
  const roomAreaMm2 = polygonArea(resolved_walls);

  // Plank dimensions (from material or defaults)
  const plankWidthMm = material.width_m
    ? material.width_m * 1000
    : DEFAULT_PLANK_WIDTH_MM;
  const plankLengthMm = material.length_m
    ? material.length_m * 1000
    : DEFAULT_PLANK_LENGTH_MM;

  // Determine lay direction
  const layDeg = inferLayDirection(room, bbox);
  const isRotated = layDeg === 90;

  // Effective room dimensions after expansion gap
  const effWidth = (isRotated ? bbox.height_mm : bbox.width_mm) - expansionGap * 2;
  const effLength = (isRotated ? bbox.width_mm : bbox.height_mm) - expansionGap * 2;

  if (effWidth <= 0 || effLength <= 0) {
    return emptyLayout(room, resolved_walls, roomAreaMm2, layDeg);
  }

  // Number of rows across the width
  const numFullRows = Math.floor(effWidth / plankWidthMm);
  const remainderWidth = effWidth - numFullRows * plankWidthMm;

  // Balance first and last row widths (trade practice: avoid a narrow strip)
  let firstRowWidth: number;
  let lastRowWidth: number;
  if (remainderWidth > 0) {
    if (remainderWidth < plankWidthMm / 3) {
      // Narrow remainder — split evenly between first and last row
      const combined = plankWidthMm + remainderWidth;
      firstRowWidth = Math.ceil(combined / 2);
      lastRowWidth = combined - firstRowWidth;
    } else {
      firstRowWidth = plankWidthMm;
      lastRowWidth = remainderWidth;
    }
  } else {
    firstRowWidth = plankWidthMm;
    lastRowWidth = plankWidthMm;
  }

  const totalRows =
    remainderWidth > 0 ? numFullRows + 1 : numFullRows;

  // Build tile placements
  const tiles: TilePlacement[] = [];
  let staggerOffset = 0;

  for (let row = 0; row < totalRows; row++) {
    const isFirstRow = row === 0;
    const isLastRow = row === totalRows - 1;

    // Row width
    let rowWidth: number;
    if (isFirstRow && remainderWidth > 0 && remainderWidth < plankWidthMm / 3) {
      rowWidth = firstRowWidth;
    } else if (isLastRow && remainderWidth > 0) {
      rowWidth = lastRowWidth;
    } else {
      rowWidth = plankWidthMm;
    }

    // Row Y position (in effective space, then offset by expansion gap)
    const rowOffset = isFirstRow
      ? 0
      : firstRowWidth +
        (row - 1) * plankWidthMm -
        (remainderWidth > 0 && remainderWidth < plankWidthMm / 3
          ? plankWidthMm - firstRowWidth
          : 0);

    // Stagger pattern: 1/3 offset is standard for LVT/laminate
    if (row === 0) {
      staggerOffset = 0;
    } else {
      staggerOffset = (staggerOffset + plankLengthMm / 3) % plankLengthMm;
      if (staggerOffset < staggerMin) {
        staggerOffset = staggerMin;
      }
    }

    // Lay planks along the row
    let xPos = -staggerOffset; // Start before room edge for stagger
    let col = 0;

    while (xPos < effLength) {
      const plankStart = Math.max(0, xPos);
      const plankEnd = Math.min(effLength, xPos + plankLengthMm);
      const visibleLength = plankEnd - plankStart;

      if (visibleLength <= 0) {
        xPos += plankLengthMm;
        col++;
        continue;
      }

      const isCut =
        visibleLength < plankLengthMm - 1 || rowWidth < plankWidthMm - 1;

      // Convert to room coordinates
      let tileX: number, tileY: number, tileW: number, tileH: number;
      if (isRotated) {
        tileX = bbox.min_x + expansionGap + plankStart;
        tileY = bbox.min_y + expansionGap + rowOffset;
        tileW = visibleLength;
        tileH = rowWidth;
      } else {
        tileX = bbox.min_x + expansionGap + rowOffset;
        tileY = bbox.min_y + expansionGap + plankStart;
        tileW = rowWidth;
        tileH = visibleLength;
      }

      // Check if this plank intersects the room polygon
      const clippedArea = clipRectToPolygonArea(
        tileX,
        tileY,
        tileW,
        tileH,
        resolved_walls
      );

      if (clippedArea > 0) {
        tiles.push({
          row,
          col,
          x_mm: tileX,
          y_mm: tileY,
          width_mm: tileW,
          height_mm: tileH,
          is_cut: isCut,
          stagger_mm: staggerOffset,
        });
      }

      xPos += plankLengthMm;
      col++;
    }
  }

  // Material totals — for plank goods, count planks per row.
  // End-of-row offcuts are reused as next row's stagger start (trade practice),
  // so material = planks consumed per row, not per visible tile.
  let totalPlanksNeeded = 0;
  const rowLengths = new Map<number, number>();

  for (const tile of tiles) {
    const len = isRotated ? tile.width_mm : tile.height_mm;
    const current = rowLengths.get(tile.row) ?? 0;
    rowLengths.set(tile.row, current + len);
  }

  for (const [, rowLen] of rowLengths) {
    totalPlanksNeeded += Math.ceil(rowLen / plankLengthMm);
  }

  const totalPlanksMm2 = totalPlanksNeeded * plankWidthMm * plankLengthMm;

  // Add waste % for unusable offcuts, edge trim, breakage
  const wastePercent = options?.waste_percent ?? 5;
  const roomAreaM2 = roomAreaMm2 / 1_000_000;
  const rawMaterialM2 = totalPlanksMm2 / 1_000_000;
  const totalMaterialM2 = rawMaterialM2 * (1 + wastePercent / 100);
  const wasteM2 = totalMaterialM2 - roomAreaM2;

  return {
    room,
    resolved_walls,
    tiles,
    pile_direction_deg: layDeg,
    room_area_m2: round2(roomAreaM2),
    total_material_m2: round2(totalMaterialM2),
    waste_m2: round2(Math.max(wasteM2, 0)),
    waste_percent: round1(
      totalMaterialM2 > 0
        ? (Math.max(wasteM2, 0) / totalMaterialM2) * 100
        : 0
    ),
  };
}

/**
 * Determine optimal lay direction for planks:
 * 1. Explicit override
 * 2. Towards main light source (standard practice — planks run towards window)
 * 3. Along longest room dimension (reduces cuts)
 */
function inferLayDirection(room: RoomInput, bbox: BoundingBox): number {
  if (room.pile_direction != null) return room.pile_direction;

  // Light direction: planks should run TOWARDS the main light source
  if (room.main_light_source) {
    const src = room.main_light_source.toLowerCase();
    if (
      ["north", "south", "front", "back", "top", "bottom"].some((d) =>
        src.includes(d)
      )
    ) {
      return 0; // Planks run top-to-bottom (towards N/S light)
    }
    if (
      ["east", "west", "left", "right"].some((d) => src.includes(d))
    ) {
      return 90; // Planks run left-to-right (towards E/W light)
    }
  }

  // Default: along longest dimension
  return bbox.width_mm >= bbox.height_mm ? 90 : 0;
}

function emptyLayout(
  room: RoomInput,
  walls: Polygon,
  areaMm2: number,
  dirDeg: number
): RoomLayout {
  return {
    room,
    resolved_walls: walls,
    tiles: [],
    pile_direction_deg: dirDeg,
    room_area_m2: round2(areaMm2 / 1_000_000),
    total_material_m2: 0,
    waste_m2: 0,
    waste_percent: 0,
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
