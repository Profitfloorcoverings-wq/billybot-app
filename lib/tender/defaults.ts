import type { TenderAccessory } from "@/types/tender";

/**
 * Maps flooring_type values (from AreasPanel/TenderSpec) to pricing_settings column prefixes.
 * e.g. "safety_vinyl" → { lab: "lab_safety_m2", mat: "mat_safety_m2" }
 */
export const FLOORING_TO_PRICING_KEY: Record<string, { lab: string; mat: string }> = {
  carpet: { lab: "lab_domestic_carpet_m2", mat: "mat_domestic_carpet_m2" },
  domestic_carpet: { lab: "lab_domestic_carpet_m2", mat: "mat_domestic_carpet_m2" },
  commercial_carpet: { lab: "lab_commercial_carpet_m2", mat: "mat_commercial_carpet_m2" },
  carpet_tiles: { lab: "lab_carpet_tiles_m2", mat: "mat_carpet_tiles_m2" },
  safety_vinyl: { lab: "lab_safety_m2", mat: "mat_safety_m2" },
  smooth_vinyl: { lab: "lab_domestic_vinyl_m2", mat: "mat_domestic_vinyl_m2" },
  lvt_tiles: { lab: "lab_lvt_m2", mat: "mat_lvt_m2" },
  lvt: { lab: "lab_lvt_m2", mat: "mat_lvt_m2" },
  whiterock: { lab: "lab_wall_cladding_m2", mat: "mat_wall_cladding_m2" },
  wall_cladding: { lab: "lab_wall_cladding_m2", mat: "mat_wall_cladding_m2" },
  matting: { lab: "lab_matting_m2", mat: "mat_matting_m2" },
  laminate: { lab: "lab_lvt_m2", mat: "mat_lvt_m2" },
  engineered: { lab: "lab_lvt_m2", mat: "mat_lvt_m2" },
  wood: { lab: "lab_lvt_m2", mat: "mat_lvt_m2" },
  tiles: { lab: "lab_ceramic_tiles_m2", mat: "mat_ceramic_tiles_m2" },
  rubber: { lab: "lab_safety_m2", mat: "mat_safety_m2" },
  resin: { lab: "lab_safety_m2", mat: "mat_safety_m2" },
};

export const DEFAULT_WASTAGE_PCT: Record<string, number> = {
  carpet: 10,
  domestic_carpet: 10,
  commercial_carpet: 10,
  carpet_tiles: 5,
  safety_vinyl: 10,
  smooth_vinyl: 10,
  lvt_tiles: 7,
  lvt: 7,
  whiterock: 10,
  wall_cladding: 10,
  matting: 5,
  laminate: 10,
  engineered: 10,
  wood: 10,
  tiles: 10,
  rubber: 10,
  resin: 5,
};

export const DEFAULT_PREP_COSTS: Record<string, { adhesive: number; primer: number; smoothing: number }> = {
  carpet: { adhesive: 0, primer: 0, smoothing: 0 },
  carpet_tiles: { adhesive: 1.5, primer: 0, smoothing: 0 },
  safety_vinyl: { adhesive: 2.0, primer: 1.5, smoothing: 2.5 },
  smooth_vinyl: { adhesive: 2.0, primer: 1.5, smoothing: 2.5 },
  lvt_tiles: { adhesive: 2.0, primer: 1.5, smoothing: 2.5 },
  lvt: { adhesive: 2.0, primer: 1.5, smoothing: 2.5 },
  whiterock: { adhesive: 3.0, primer: 0, smoothing: 0 },
  matting: { adhesive: 1.5, primer: 0, smoothing: 0 },
  laminate: { adhesive: 0, primer: 0, smoothing: 0 },
  engineered: { adhesive: 2.0, primer: 0, smoothing: 0 },
  wood: { adhesive: 0, primer: 0, smoothing: 0 },
  tiles: { adhesive: 3.0, primer: 1.0, smoothing: 0 },
  rubber: { adhesive: 2.5, primer: 1.5, smoothing: 2.5 },
  resin: { adhesive: 0, primer: 2.0, smoothing: 3.0 },
};

export const ACCESSORY_PRESETS: Omit<TenderAccessory, "id">[] = [
  { description: "Aluminium threshold strips", unit: "nr", quantity: 0, unit_price: 12 },
  { description: "Cove formers", unit: "lm", quantity: 0, unit_price: 2.5 },
  { description: "Gripper rod", unit: "lm", quantity: 0, unit_price: 1.8 },
  { description: "Underlay", unit: "m2", quantity: 0, unit_price: 3.5 },
  { description: "Stair nosings", unit: "nr", quantity: 0, unit_price: 18 },
  { description: "Skirting / capping", unit: "lm", quantity: 0, unit_price: 4.5 },
  { description: "Door bars (flat)", unit: "nr", quantity: 0, unit_price: 8 },
  { description: "Weld rod", unit: "lm", quantity: 0, unit_price: 1.2 },
];

export const ACCESSORY_UNITS = [
  { value: "lm", label: "lm" },
  { value: "nr", label: "nr" },
  { value: "m2", label: "m²" },
  { value: "flat", label: "flat" },
] as const;
