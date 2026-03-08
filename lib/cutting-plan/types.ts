// ── Geometry primitives ──

export interface Point {
  x_mm: number;
  y_mm: number;
}

/** Ordered array of wall vertices (clockwise). Minimum 3 points. */
export type Polygon = Point[];

export interface BoundingBox {
  min_x: number;
  min_y: number;
  max_x: number;
  max_y: number;
  width_mm: number;
  height_mm: number;
}

export interface WallSegment {
  start: Point;
  end: Point;
  length_mm: number;
  angle_deg: number;
}

// ── Input types ──

export interface DoorInput {
  /** Position along the wall (mm from wall start) */
  wall_index: number;
  position_mm: number;
  width_mm: number;
}

export interface RoomInput {
  name: string;
  /** Room outline as polygon vertices. If absent, auto-generated from bounding_box. */
  walls?: Polygon;
  /** Fallback for legacy ai_analysis data without walls */
  bounding_box?: { w_m: number; l_m: number };
  doors?: DoorInput[];
  /** Override pile/lay direction in degrees (0 = left-to-right, 90 = top-to-bottom) */
  pile_direction?: number;
}

export type FlooringType =
  | "carpet"
  | "vinyl"
  | "lvt"
  | "laminate"
  | "wood"
  | "engineered"
  | "carpet_tiles";

export type MaterialFormat = "roll" | "tile" | "plank";

export interface MaterialInput {
  format: MaterialFormat;
  /** Roll/tile/plank width in metres */
  width_m: number;
  /** Roll/plank length in metres (rolls: typically 25-30m) */
  length_m?: number;
  /** Pattern repeat in metres */
  pattern_repeat_m?: number;
  /** Product name for display */
  product_name?: string;
}

export interface CuttingPlanOptions {
  /** Gripper rod gap from wall (carpet). Default 6mm. */
  gripper_gap_mm?: number;
  /** Expansion gap from wall (laminate/LVT). Default 10mm. */
  expansion_gap_mm?: number;
  /** Additional waste % to add. Default 0. */
  waste_percent?: number;
  /** Seam overlap for double-cutting (vinyl). Default 25mm. */
  seam_overlap_mm?: number;
  /** Scribe allowance at walls (vinyl). Default 50mm. */
  scribe_allowance_mm?: number;
}

export interface CuttingPlanRequest {
  job_id?: string;
  client_id: string;
  rooms: RoomInput[];
  flooring_type: FlooringType;
  material: MaterialInput;
  options?: CuttingPlanOptions;
}

// ── Output types ──

export interface Drop {
  index: number;
  /** Left edge position in mm from room origin */
  x_mm: number;
  /** Top edge position in mm */
  y_mm: number;
  /** Full width of this drop (roll width or remainder) */
  width_mm: number;
  /** Full length of this drop */
  length_mm: number;
  /** True if this is a partial-width drop */
  is_offcut: boolean;
  /** Actual material area after polygon clipping (mm²) */
  clipped_area_mm2: number;
}

export interface Seam {
  /** X position of seam line */
  x_mm: number;
  y_start_mm: number;
  y_end_mm: number;
  /** True if seam falls within 300mm of a door */
  near_door: boolean;
}

export interface TilePlacement {
  row: number;
  col: number;
  x_mm: number;
  y_mm: number;
  width_mm: number;
  height_mm: number;
  is_cut: boolean;
  /** Stagger offset applied (mm) */
  stagger_mm: number;
}

export interface RoomLayout {
  room: RoomInput;
  /** Resolved polygon (from walls or bounding_box fallback) */
  resolved_walls: Polygon;
  drops?: Drop[];
  tiles?: TilePlacement[];
  seams?: Seam[];
  pile_direction_deg: number;
  /** Room area from polygon (m²) */
  room_area_m2: number;
  /** Total material area including waste (m²) */
  total_material_m2: number;
  /** Waste area (m²) */
  waste_m2: number;
  /** Waste as percentage */
  waste_percent: number;
}

export interface CuttingPlanTotals {
  total_room_area_m2: number;
  total_material_m2: number;
  total_waste_m2: number;
  overall_waste_percent: number;
}

export interface CuttingPlanResult {
  rooms: RoomLayout[];
  material: MaterialInput;
  flooring_type: FlooringType;
  totals: CuttingPlanTotals;
  /** For roll goods: total linear metres of roll needed */
  roll_length_required_m?: number;
  /** SVG string */
  svg: string;
  /** Human-readable summary */
  summary_text: string;
}
