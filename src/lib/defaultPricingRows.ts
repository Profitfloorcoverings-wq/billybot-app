export type DefaultPricingRow = {
  product_name: string;
  uom: "m2" | "m" | "each" | "roll" | "cut" | "na";
  roll_price: number | null;
  cut_price: number | null;
  m2_price: number | null;
  price: number;
  price_per_m: number | null;
  price_source: "mid_range";
};

type PricingFieldDefinition = {
  label: string;
  column: string;
};

// Markup fields are intentionally excluded from defaults.
const pricingFieldDefinitions: PricingFieldDefinition[] = [
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
  { label: "Minimum job charge", column: "small_job_charge" },
  { label: "Day rate per fitter", column: "day_rate_per_fitter" },
];

function deriveUom(column: string): DefaultPricingRow["uom"] {
  if (column.includes("_m2")) {
    return "m2";
  }

  if (column.includes("_m") && !column.includes("_m2")) {
    return "m";
  }

  if (column.includes("_each")) {
    return "each";
  }

  return "na";
}

export const defaultPricingRows: DefaultPricingRow[] = pricingFieldDefinitions.map(
  ({ label, column }) => {
    const uom = deriveUom(column);

    return {
      product_name: label,
      uom,
      roll_price: uom === "roll" ? 1 : null,
      cut_price: uom === "cut" ? 1 : null,
      m2_price: uom === "m2" ? 1 : null,
      price: 1,
      price_per_m: uom === "m" ? 1 : null,
      price_source: "mid_range",
    };
  }
);
