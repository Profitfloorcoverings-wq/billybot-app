export type TenderFormat =
  | "full_boq"
  | "overall_m2"
  | "schedule_drawings"
  | "drawings_only"
  | "site_measure"
  | "framework";

export const TENDER_FORMAT_LABELS: Record<TenderFormat, string> = {
  full_boq: "Full BOQ (room-by-room m²)",
  overall_m2: "BOQ (overall m² per type)",
  schedule_drawings: "Schedule of Finishes + Drawings",
  drawings_only: "Drawings Only",
  site_measure: "Spec Only — Site Measure Required",
  framework: "Framework (pre-agreed rates)",
};

export type TenderSpec = {
  id: string;
  flooring_type: string;
  nbs_code: string | null;
  product: string;
  adhesive: string | null;
  primer_dpm: string | null;
  smoothing_compound: string | null;
  installation_method: string | null;
  notes: string | null;
};

export type TenderAccessory = {
  id: string;
  description: string;
  unit: "lm" | "nr" | "m2" | "flat";
  quantity: number;
  unit_price: number;
};

export type TenderPricingLine = {
  flooring_type: string;
  total_m2: number;
  wastage_pct: number;
  adjusted_m2: number;
  material_cost_m2: number;
  adhesive_cost_m2: number;
  primer_cost_m2: number;
  smoothing_cost_m2: number;
  labour_cost_m2: number;
  line_total: number;
};

export type TenderMetadata = {
  format: TenderFormat;
  tender_ref: string | null;
  project_name: string | null;
  client_org: string | null;
  deadline: string | null;
  specs: TenderSpec[];
  accessories: TenderAccessory[];
  pricing_lines: TenderPricingLine[];
  prelims_type: "percentage" | "lump_sum";
  prelims_value: number;
  ohp_percent: number;
  notes: string | null;
};

export function emptyTenderMetadata(): TenderMetadata {
  return {
    format: "schedule_drawings",
    tender_ref: null,
    project_name: null,
    client_org: null,
    deadline: null,
    specs: [],
    accessories: [],
    pricing_lines: [],
    prelims_type: "percentage",
    prelims_value: 0,
    ohp_percent: 30,
    notes: null,
  };
}

export function computeAdjustedM2(m2: number, wastagePct: number): number {
  return Math.ceil(m2 * (1 + wastagePct / 100) * 100) / 100;
}

export function computeLineTotal(line: TenderPricingLine): number {
  const costPerM2 =
    line.material_cost_m2 +
    line.adhesive_cost_m2 +
    line.primer_cost_m2 +
    line.smoothing_cost_m2 +
    line.labour_cost_m2;
  return Math.round(line.adjusted_m2 * costPerM2 * 100) / 100;
}
