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
  /** Legacy: wall index (0-based) for position along wall */
  wall_index?: number;
  /** Position: mm offset along wall (legacy) OR {x_mm, y_mm} / {x, y} coordinate (from vision AI) */
  position_mm?: number | Point | { x: number; y: number };
  /** Door width in mm */
  width_mm?: number;
  /** Door width in metres (from vision AI — auto-converted to mm) */
  width_m?: number;
  /** Wall segment vertex indices [start, end] from vision AI */
  wall_segment?: [number, number];
  /** Which room this door connects to */
  connects_to?: string;
  /** Door opening direction */
  opens?: string;
}

export interface WindowInput {
  /** Centre position as {x_mm, y_mm} or {x, y} coordinate */
  position_mm?: Point | { x: number; y: number };
  /** Wall segment vertex indices [start, end] */
  wall_segment?: [number, number];
  /** Window width in metres */
  width_m?: number;
}

export interface ObstacleInput {
  /** e.g. "chimney_breast", "radiator", "hearth", "fitted_furniture" */
  type: string;
  /** Bounding rectangle in room coordinate space (mm) */
  rect_mm?: { x: number; y: number; w: number; h: number };
}

export interface RoomInput {
  name: string;
  /** Room outline as polygon vertices. If absent, auto-generated from bounding_box. */
  walls?: Polygon;
  /** Fallback for legacy ai_analysis data without walls */
  bounding_box?: { w_m: number; l_m: number };
  doors?: DoorInput[];
  windows?: WindowInput[];
  obstacles?: ObstacleInput[];
  /** Override pile/lay direction in degrees (0 = left-to-right, 90 = top-to-bottom) */
  pile_direction?: number;
  /** Primary light source direction (e.g. "north", "front_wall", "east") */
  main_light_source?: string;
  /** Flooring finish for this room (from vision AI) */
  finish?: string;
  /** Room shape description */
  shape?: string;
  /** Pre-calculated area from vision AI */
  area_m2?: number;
  /** Textual features from vision AI */
  features?: string[];
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
  /** Minimum stagger offset between rows (plank). Default 300mm. */
  stagger_min_mm?: number;
  /** Additional waste % to add. Default 0. */
  waste_percent?: number;
  /** Length excess for vinyl drops. Default 100mm. */
  length_excess_mm?: number;
  /** Coved/running cove skirtings — vinyl goes up the wall. */
  coved?: boolean;
  /** Cove height up the wall. Default 100mm. */
  cove_height_mm?: number;
}

export interface CuttingPlanRequest {
  job_id?: string;
  client_id: string;
  rooms: RoomInput[];
  flooring_type: FlooringType;
  material: MaterialInput;
  options?: CuttingPlanOptions;
}

// ── Accessory types ──

export interface Accessory {
  /** e.g. "gripper_rod", "underlay", "door_bar", "threshold_strip", "adhesive", "expansion_beading" */
  type: string;
  description: string;
  quantity: number;
  /** "lm" (linear metres), "m2", "units", "tubs", "rolls" */
  unit: string;
}

// ── Output types ──

export interface Drop {
  index: number;
  /** Left edge position in mm from room origin */
  x_mm: number;
  /** Top edge position in mm */
  y_mm: number;
  /** Floor coverage width (mm) */
  width_mm: number;
  /** Floor coverage length (mm) */
  length_mm: number;
  /** Actual cut width including cove (mm) — for label display */
  cut_width_mm?: number;
  /** Actual cut length including excess + cove (mm) — for label display */
  cut_length_mm?: number;
  /** True if this is a partial-width drop */
  is_offcut: boolean;
  /** Actual material area after polygon clipping (mm²) */
  clipped_area_mm2: number;
}

export interface Seam {
  /** X start position of seam line */
  x_mm: number;
  /** X end position (for horizontal seams; defaults to x_mm for vertical) */
  x_end_mm?: number;
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

export interface CornerWeld {
  type: "internal" | "external";
  position: Point;
  /** Total weld length for this corner (mm) */
  weld_length_mm: number;
  /** External corners have a patch */
  patch_width_mm?: number;
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
  /** Coved skirting: corner welds */
  corner_welds?: CornerWeld[];
  /** Whether this layout uses coved skirtings */
  coved?: boolean;
  /** Accessory quantities (gripper, underlay, door bars, etc.) */
  accessories?: Accessory[];
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
  /** Combined accessories across all rooms */
  accessories: Accessory[];
  /** SVG string */
  svg: string;
  /** Human-readable summary */
  summary_text: string;
}
