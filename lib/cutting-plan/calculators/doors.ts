import type { DoorInput, Point, Polygon } from "../types";

const DOOR_SEAM_THRESHOLD_MM = 300;

/**
 * Extract a door's centre position as a Point, handling all input formats:
 * - {x_mm, y_mm} from structured vision AI
 * - {x, y} from simplified vision AI
 * - wall_segment [start, end] indices → midpoint of wall segment
 * - wall_index + position_mm (number) → offset along wall
 */
export function resolveDoorPosition(
  door: DoorInput,
  walls: Polygon
): Point | null {
  const pos = door.position_mm;

  // Format 1: Point with x_mm, y_mm
  if (pos && typeof pos === "object" && "x_mm" in pos) {
    return pos as Point;
  }

  // Format 2: {x, y} shorthand from vision AI
  if (pos && typeof pos === "object" && "x" in pos && "y" in pos) {
    const p = pos as { x: number; y: number };
    return { x_mm: p.x, y_mm: p.y };
  }

  // Format 3: wall_segment [startIdx, endIdx] → midpoint
  if (
    door.wall_segment &&
    door.wall_segment.length === 2 &&
    walls.length > 0
  ) {
    const [si, ei] = door.wall_segment;
    if (si >= 0 && si < walls.length && ei >= 0 && ei < walls.length) {
      return {
        x_mm: (walls[si].x_mm + walls[ei].x_mm) / 2,
        y_mm: (walls[si].y_mm + walls[ei].y_mm) / 2,
      };
    }
  }

  // Format 4: wall_index + position_mm as number (legacy)
  if (
    door.wall_index != null &&
    typeof pos === "number" &&
    walls.length > 0
  ) {
    const idx = door.wall_index;
    if (idx >= 0 && idx < walls.length) {
      const start = walls[idx];
      const end = walls[(idx + 1) % walls.length];
      const dx = end.x_mm - start.x_mm;
      const dy = end.y_mm - start.y_mm;
      const wallLen = Math.sqrt(dx * dx + dy * dy);
      if (wallLen > 0) {
        const t = pos / wallLen;
        return {
          x_mm: start.x_mm + t * dx,
          y_mm: start.y_mm + t * dy,
        };
      }
    }
  }

  return null;
}

/**
 * Check if any door is within 300mm of a seam position.
 * For vertical seams: check door x vs seam x.
 * For horizontal seams: check door y vs seam y.
 */
export function isDoorNearSeam(
  doors: DoorInput[] | undefined,
  walls: Polygon,
  seamPosition: number,
  isRotated: boolean
): boolean {
  if (!doors || doors.length === 0) return false;

  for (const door of doors) {
    const pos = resolveDoorPosition(door, walls);
    if (!pos) continue;

    const doorAxisPos = isRotated ? pos.y_mm : pos.x_mm;
    if (Math.abs(doorAxisPos - seamPosition) < DOOR_SEAM_THRESHOLD_MM) {
      return true;
    }
  }

  return false;
}
