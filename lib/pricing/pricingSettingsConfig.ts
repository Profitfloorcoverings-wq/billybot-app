export type ServiceOption = { label: string; column: string };
export type MarkupOption = {
  label: string;
  valueColumn: string;
  typeColumn: string;
};
export type NumericField = { label: string; column: string };

export const SERVICE_OPTIONS: ServiceOption[] = [
  { label: "Domestic carpets", column: "service_domestic_carpet" },
  { label: "Commercial carpets", column: "service_commercial_carpet" },
  { label: "Carpet tiles", column: "service_carpet_tiles" },
  { label: "LVT", column: "service_lvt" },
  { label: "Domestic vinyl", column: "service_domestic_vinyl" },
  { label: "Safety / commercial vinyl", column: "service_commercial_vinyl" },
  { label: "Altro Whiterock (wall cladding)", column: "service_wall_cladding" },
];

export const SERVICE_REGISTRY: Record<
  string,
  { markups: string[]; materials: string[]; labour: string[] }
> = {
  service_domestic_carpet: {
    markups: ["markup_domestic_carpet_value"],
    materials: ["mat_domestic_carpet_m2"],
    labour: ["lab_domestic_carpet_m2"],
  },
  service_commercial_carpet: {
    markups: ["markup_commercial_carpet_value"],
    materials: ["mat_commercial_carpet_m2"],
    labour: ["lab_commercial_carpet_m2"],
  },
  service_carpet_tiles: {
    markups: ["markup_carpet_tiles_value"],
    materials: [],
    labour: [],
  },
  service_lvt: {
    markups: ["markup_lvt_value"],
    materials: ["mat_lvt_m2"],
    labour: ["lab_lvt_m2"],
  },
  service_domestic_vinyl: {
    markups: ["markup_domestic_vinyl_value"],
    materials: ["mat_domestic_vinyl_m2"],
    labour: ["lab_domestic_vinyl_m2"],
  },
  service_commercial_vinyl: {
    markups: ["markup_commercial_vinyl_value"],
    materials: ["mat_commercial_vinyl_m2", "mat_safety_m2"],
    labour: ["lab_commercial_vinyl_m2", "lab_safety_m2"],
  },
  service_wall_cladding: {
    markups: ["markup_wall_cladding_value"],
    materials: ["mat_wall_cladding_m2"],
    labour: ["lab_wall_cladding_m2"],
  },
};

export const MARKUP_OPTIONS: MarkupOption[] = [
  {
    label: "Domestic carpet markup",
    valueColumn: "markup_domestic_carpet_value",
    typeColumn: "markup_domestic_carpet_type",
  },
  {
    label: "Commercial carpet markup",
    valueColumn: "markup_commercial_carpet_value",
    typeColumn: "markup_commercial_carpet_type",
  },
  {
    label: "Carpet tiles markup",
    valueColumn: "markup_carpet_tiles_value",
    typeColumn: "markup_carpet_tiles_type",
  },
  {
    label: "LVT markup",
    valueColumn: "markup_lvt_value",
    typeColumn: "markup_lvt_type",
  },
  {
    label: "Domestic vinyl markup",
    valueColumn: "markup_domestic_vinyl_value",
    typeColumn: "markup_domestic_vinyl_type",
  },
  {
    label: "Safety vinyl markup",
    valueColumn: "markup_commercial_vinyl_value",
    typeColumn: "markup_commercial_vinyl_type",
  },
  {
    label: "Whiterock markup",
    valueColumn: "markup_wall_cladding_value",
    typeColumn: "markup_wall_cladding_type",
  },
];

export const MATERIAL_PRICE_FIELDS: NumericField[] = [
  { label: "LVT material price per m²", column: "mat_lvt_m2" },
  { label: "Ceramic tiles material price per m²", column: "mat_ceramic_tiles_m2" },
  {
    label: "Domestic carpet material price per m²",
    column: "mat_domestic_carpet_m2",
  },
  {
    label: "Commercial carpet material price per m²",
    column: "mat_commercial_carpet_m2",
  },
  { label: "Safety flooring material price per m²", column: "mat_safety_m2" },
  { label: "Domestic vinyl material price per m²", column: "mat_domestic_vinyl_m2" },
  { label: "Commercial vinyl material price per m²", column: "mat_commercial_vinyl_m2" },
  { label: "Wall cladding material price per m²", column: "mat_wall_cladding_m2" },
  { label: "Adhesive per m²", column: "mat_adhesive_m2" },
  { label: "Uplift existing flooring per m²", column: "mat_uplift_m2" },
  { label: "Latex per m²", column: "mat_latex_m2" },
  { label: "Ply board per m²", column: "mat_ply_m2" },
  { label: "Coved skirting per metre", column: "mat_coved_m2" },
  { label: "Matting per m²", column: "mat_matting_m2" },
  { label: "Standard door bars (each)", column: "mat_door_bars_each" },
  { label: "Nosings per metre", column: "mat_nosings_m" },
  { label: "Underlay per m²", column: "mat_underlay" },
  { label: "Gripper per metre", column: "mat_gripper" },
  { label: "Waste disposal per m²", column: "waste_disposal" },
  { label: "Furniture removal (per room)", column: "furniture_removal" },
];

export const LABOUR_PRICE_FIELDS: NumericField[] = [
  { label: "Domestic carpet labour per m²", column: "lab_domestic_carpet_m2" },
  { label: "Commercial carpet labour per m²", column: "lab_commercial_carpet_m2" },
  { label: "LVT labour per m²", column: "lab_lvt_m2" },
  { label: "Ceramic tile labour per m²", column: "lab_ceramic_tiles_m2" },
  { label: "Safety flooring labour per m²", column: "lab_safety_m2" },
  { label: "Domestic vinyl labour per m²", column: "lab_domestic_vinyl_m2" },
  { label: "Commercial vinyl labour per m²", column: "lab_commercial_vinyl_m2" },
  { label: "Wall cladding labour per m²", column: "lab_wall_cladding_m2" },
  { label: "Coved skirting per metre", column: "lab_coved_m" },
  { label: "Ply boarding per m²", column: "lab_ply_m2" },
  { label: "Latex per m²", column: "lab_latex_m2" },
  { label: "Door bars (each)", column: "lab_door_bars_each" },
  { label: "Nosings per metre", column: "lab_nosings_m" },
  { label: "Matting per m²", column: "lab_matting_m2" },
  { label: "Uplift per m²", column: "lab_uplift_m2" },
  { label: "Gripper per metre", column: "lab_gripper_m" },
];

export const EXTRAS_MATERIAL_COLUMNS = new Set([
  "mat_adhesive_m2",
  "mat_uplift_m2",
  "mat_latex_m2",
  "mat_ply_m2",
  "mat_coved_m2",
  "mat_matting_m2",
  "mat_door_bars_each",
  "mat_nosings_m",
  "mat_underlay",
  "mat_gripper",
  "waste_disposal",
  "furniture_removal",
]);

export const EXTRAS_LABOUR_COLUMNS = new Set([
  "lab_coved_m",
  "lab_ply_m2",
  "lab_latex_m2",
  "lab_door_bars_each",
  "lab_nosings_m",
  "lab_matting_m2",
  "lab_uplift_m2",
  "lab_gripper_m",
]);

export const SMALL_JOB_FIELDS: NumericField[] = [
  { label: "Minimum job charge", column: "small_job_charge" },
  { label: "Day rate per fitter", column: "day_rate_per_fitter" },
];

export const BREAKPOINT_DEFAULT = "[]";
