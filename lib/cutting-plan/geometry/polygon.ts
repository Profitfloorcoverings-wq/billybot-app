import type { Point, Polygon, BoundingBox, WallSegment } from "../types";

/**
 * Shoelace formula — returns area in mm².
 * Works for any simple (non-self-intersecting) polygon.
 */
export function polygonArea(walls: Polygon): number {
  const n = walls.length;
  if (n < 3) return 0;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += walls[i].x_mm * walls[j].y_mm;
    area -= walls[j].x_mm * walls[i].y_mm;
  }
  return Math.abs(area) / 2;
}

export function polygonBoundingBox(walls: Polygon): BoundingBox {
  let min_x = Infinity,
    min_y = Infinity,
    max_x = -Infinity,
    max_y = -Infinity;
  for (const p of walls) {
    if (p.x_mm < min_x) min_x = p.x_mm;
    if (p.y_mm < min_y) min_y = p.y_mm;
    if (p.x_mm > max_x) max_x = p.x_mm;
    if (p.y_mm > max_y) max_y = p.y_mm;
  }
  return {
    min_x,
    min_y,
    max_x,
    max_y,
    width_mm: max_x - min_x,
    height_mm: max_y - min_y,
  };
}

export function polygonCentroid(walls: Polygon): Point {
  const n = walls.length;
  if (n === 0) return { x_mm: 0, y_mm: 0 };
  let cx = 0,
    cy = 0,
    a = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const cross =
      walls[i].x_mm * walls[j].y_mm - walls[j].x_mm * walls[i].y_mm;
    cx += (walls[i].x_mm + walls[j].x_mm) * cross;
    cy += (walls[i].y_mm + walls[j].y_mm) * cross;
    a += cross;
  }
  a /= 2;
  if (Math.abs(a) < 1e-10) {
    // Degenerate polygon — return average
    const sx = walls.reduce((s, p) => s + p.x_mm, 0) / n;
    const sy = walls.reduce((s, p) => s + p.y_mm, 0) / n;
    return { x_mm: sx, y_mm: sy };
  }
  cx /= 6 * a;
  cy /= 6 * a;
  return { x_mm: cx, y_mm: cy };
}

/**
 * Ray-casting algorithm — returns true if point is inside the polygon.
 */
export function pointInPolygon(point: Point, walls: Polygon): boolean {
  const { x_mm: px, y_mm: py } = point;
  const n = walls.length;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = walls[i].x_mm,
      yi = walls[i].y_mm;
    const xj = walls[j].x_mm,
      yj = walls[j].y_mm;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function polygonWallSegments(walls: Polygon): WallSegment[] {
  const segments: WallSegment[] = [];
  const n = walls.length;
  for (let i = 0; i < n; i++) {
    const start = walls[i];
    const end = walls[(i + 1) % n];
    const dx = end.x_mm - start.x_mm;
    const dy = end.y_mm - start.y_mm;
    const length_mm = Math.sqrt(dx * dx + dy * dy);
    const angle_deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    segments.push({ start, end, length_mm, angle_deg });
  }
  return segments;
}

export function polygonPerimeter(walls: Polygon): number {
  return polygonWallSegments(walls).reduce((sum, s) => sum + s.length_mm, 0);
}

/**
 * Convert a bounding box (w_m × l_m) to a 4-vertex rectangle polygon.
 * Origin at (0, 0), clockwise.
 */
export function rectangleToPolygon(w_m: number, l_m: number): Polygon {
  const w = w_m * 1000;
  const l = l_m * 1000;
  return [
    { x_mm: 0, y_mm: 0 },
    { x_mm: w, y_mm: 0 },
    { x_mm: w, y_mm: l },
    { x_mm: 0, y_mm: l },
  ];
}

/**
 * Compute the intersection area of an axis-aligned rectangle with a polygon.
 *
 * Uses Sutherland-Hodgman: clips the room polygon (subject, can be concave)
 * against the rectangle (clip, always convex). SH requires the CLIP polygon
 * to be convex — so the rectangle must be the clip, not the room.
 */
export function clipRectToPolygonArea(
  rect_x: number,
  rect_y: number,
  rect_w: number,
  rect_h: number,
  walls: Polygon
): number {
  // Subject = room polygon (may be concave — L-shapes, T-shapes, etc.)
  let subject: Point[] = walls.map((p) => ({ ...p }));

  // Clip = rectangle (always convex) — SH requires convex clip polygon
  const clip: Point[] = [
    { x_mm: rect_x, y_mm: rect_y },
    { x_mm: rect_x + rect_w, y_mm: rect_y },
    { x_mm: rect_x + rect_w, y_mm: rect_y + rect_h },
    { x_mm: rect_x, y_mm: rect_y + rect_h },
  ];

  // Determine winding of the clip rectangle (always CCW for our construction)
  const clipArea = rawSignedArea(clip);
  const clipCCW = clipArea > 0;

  const n = clip.length;

  for (let i = 0; i < n; i++) {
    if (subject.length === 0) return 0;

    const edgeStart = clip[i];
    const edgeEnd = clip[(i + 1) % n];
    const output: Point[] = [];

    for (let j = 0; j < subject.length; j++) {
      const current = subject[j];
      const prev = subject[(j + subject.length - 1) % subject.length];

      const currInside = clipCCW
        ? isInside(current, edgeStart, edgeEnd)
        : isInsideCW(current, edgeStart, edgeEnd);
      const prevInside = clipCCW
        ? isInside(prev, edgeStart, edgeEnd)
        : isInsideCW(prev, edgeStart, edgeEnd);

      if (currInside) {
        if (!prevInside) {
          const inter = lineIntersection(prev, current, edgeStart, edgeEnd);
          if (inter) output.push(inter);
        }
        output.push(current);
      } else if (prevInside) {
        const inter = lineIntersection(prev, current, edgeStart, edgeEnd);
        if (inter) output.push(inter);
      }
    }

    subject = output;
  }

  if (subject.length < 3) return 0;
  return polygonArea(subject);
}

/** Signed area (positive = CCW, negative = CW) */
function rawSignedArea(poly: Point[]): number {
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    area += poly[i].x_mm * poly[j].y_mm;
    area -= poly[j].x_mm * poly[i].y_mm;
  }
  return area / 2;
}

/** Check if point is on the inside (left side) of edge from a to b — for CCW polygons */
function isInside(point: Point, a: Point, b: Point): boolean {
  return (
    (b.x_mm - a.x_mm) * (point.y_mm - a.y_mm) -
      (b.y_mm - a.y_mm) * (point.x_mm - a.x_mm) >=
    0
  );
}

/** Check if point is on the inside (right side) of edge from a to b — for CW polygons */
function isInsideCW(point: Point, a: Point, b: Point): boolean {
  return (
    (b.x_mm - a.x_mm) * (point.y_mm - a.y_mm) -
      (b.y_mm - a.y_mm) * (point.x_mm - a.x_mm) <=
    0
  );
}

/** Line segment intersection */
function lineIntersection(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point
): Point | null {
  const x1 = p1.x_mm,
    y1 = p1.y_mm,
    x2 = p2.x_mm,
    y2 = p2.y_mm;
  const x3 = p3.x_mm,
    y3 = p3.y_mm,
    x4 = p4.x_mm,
    y4 = p4.y_mm;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-10) return null;

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;

  return {
    x_mm: x1 + t * (x2 - x1),
    y_mm: y1 + t * (y2 - y1),
  };
}

/**
 * Find the extent of a polygon within a horizontal band (y range).
 * Returns the min/max x of the polygon clipped to the band.
 */
export function polygonExtentInYBand(
  polygon: Polygon,
  yMin: number,
  yMax: number
): { min_x: number; max_x: number } | null {
  let minX = Infinity;
  let maxX = -Infinity;

  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];

    const edgeYMin = Math.min(p1.y_mm, p2.y_mm);
    const edgeYMax = Math.max(p1.y_mm, p2.y_mm);

    // Skip edges entirely outside the band
    if (edgeYMax < yMin || edgeYMin > yMax) continue;

    // Vertices within the band
    if (p1.y_mm >= yMin && p1.y_mm <= yMax) {
      minX = Math.min(minX, p1.x_mm);
      maxX = Math.max(maxX, p1.x_mm);
    }

    if (Math.abs(p2.y_mm - p1.y_mm) < 0.001) {
      // Horizontal edge — include both x if within band
      if (p1.y_mm >= yMin && p1.y_mm <= yMax) {
        minX = Math.min(minX, p1.x_mm, p2.x_mm);
        maxX = Math.max(maxX, p1.x_mm, p2.x_mm);
      }
    } else {
      // Intersect edge with band boundaries
      for (const yClip of [yMin, yMax]) {
        if (yClip >= edgeYMin && yClip <= edgeYMax) {
          const t = (yClip - p1.y_mm) / (p2.y_mm - p1.y_mm);
          const xAt = p1.x_mm + t * (p2.x_mm - p1.x_mm);
          minX = Math.min(minX, xAt);
          maxX = Math.max(maxX, xAt);
        }
      }
    }
  }

  if (minX === Infinity) return null;
  return { min_x: minX, max_x: maxX };
}

/**
 * Find the extent of a polygon within a vertical band (x range).
 * Returns the min/max y of the polygon clipped to the band.
 */
export function polygonExtentInXBand(
  polygon: Polygon,
  xMin: number,
  xMax: number
): { min_y: number; max_y: number } | null {
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];

    const edgeXMin = Math.min(p1.x_mm, p2.x_mm);
    const edgeXMax = Math.max(p1.x_mm, p2.x_mm);

    if (edgeXMax < xMin || edgeXMin > xMax) continue;

    if (p1.x_mm >= xMin && p1.x_mm <= xMax) {
      minY = Math.min(minY, p1.y_mm);
      maxY = Math.max(maxY, p1.y_mm);
    }

    if (Math.abs(p2.x_mm - p1.x_mm) < 0.001) {
      if (p1.x_mm >= xMin && p1.x_mm <= xMax) {
        minY = Math.min(minY, p1.y_mm, p2.y_mm);
        maxY = Math.max(maxY, p1.y_mm, p2.y_mm);
      }
    } else {
      for (const xClip of [xMin, xMax]) {
        if (xClip >= edgeXMin && xClip <= edgeXMax) {
          const t = (xClip - p1.x_mm) / (p2.x_mm - p1.x_mm);
          const yAt = p1.y_mm + t * (p2.y_mm - p1.y_mm);
          minY = Math.min(minY, yAt);
          maxY = Math.max(maxY, yAt);
        }
      }
    }
  }

  if (minY === Infinity) return null;
  return { min_y: minY, max_y: maxY };
}

/**
 * Inset a polygon by a given distance (mm) for gripper/expansion gap perimeter.
 * Simple approach: move each edge inward by the offset, intersect adjacent edges.
 */
export function insetPolygon(walls: Polygon, offset_mm: number): Polygon {
  const n = walls.length;
  if (n < 3) return walls;

  // Compute inward-offset edges
  const offsetEdges: Array<{ p1: Point; p2: Point }> = [];

  for (let i = 0; i < n; i++) {
    const a = walls[i];
    const b = walls[(i + 1) % n];
    const dx = b.x_mm - a.x_mm;
    const dy = b.y_mm - a.y_mm;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-10) continue;

    // Inward normal (for clockwise polygon: rotate edge direction -90°)
    const nx = dy / len;
    const ny = -dx / len;

    offsetEdges.push({
      p1: { x_mm: a.x_mm + nx * offset_mm, y_mm: a.y_mm + ny * offset_mm },
      p2: { x_mm: b.x_mm + nx * offset_mm, y_mm: b.y_mm + ny * offset_mm },
    });
  }

  // Intersect adjacent offset edges to get new vertices
  const result: Polygon = [];
  for (let i = 0; i < offsetEdges.length; i++) {
    const e1 = offsetEdges[i];
    const e2 = offsetEdges[(i + 1) % offsetEdges.length];
    const inter = lineIntersection(e1.p1, e1.p2, e2.p1, e2.p2);
    if (inter) {
      result.push(inter);
    }
  }

  return result;
}
