import type {
  RoomInput,
  FlooringType,
  Polygon,
  Accessory,
  DoorInput,
} from "../types";
import { polygonPerimeter, polygonArea } from "../geometry/polygon";
import { resolveDoorPosition } from "./doors";

/**
 * Calculate accessory quantities for a room.
 *
 * - Gripper rod (carpet): perimeter minus doorway widths
 * - Underlay (carpet): room area
 * - Door bars: one per internal door (connects to another room)
 * - Threshold strips: one per exterior door
 * - Adhesive (vinyl full-stick, LVT): area ÷ 5m² per tub
 * - Expansion beading (laminate/LVT): perimeter minus doorways
 */
export function calculateAccessories(
  room: RoomInput,
  resolvedWalls: Polygon,
  flooringType: FlooringType,
  coved?: boolean
): Accessory[] {
  const accessories: Accessory[] = [];
  const perimeterMm = polygonPerimeter(resolvedWalls);
  const areaMm2 = polygonArea(resolvedWalls);
  const areaM2 = areaMm2 / 1_000_000;
  const doors = room.doors || [];

  // Total doorway width to subtract from perimeter
  const totalDoorWidthMm = doors.reduce((sum, d) => {
    const w = d.width_mm ?? (d.width_m ? d.width_m * 1000 : 830);
    return sum + w;
  }, 0);

  // Perimeter minus doorways (for gripper/beading)
  const netPerimeterMm = Math.max(0, perimeterMm - totalDoorWidthMm);
  const netPerimeterLm = round2(netPerimeterMm / 1000);

  // Count door types
  const internalDoors = doors.filter((d) => {
    const ct = (d.connects_to || "").toLowerCase();
    return ct && ct !== "exterior" && ct !== "outside";
  });
  const exteriorDoors = doors.filter((d) => {
    const ct = (d.connects_to || "").toLowerCase();
    return ct === "exterior" || ct === "outside";
  });
  // Doors with no connects_to — assume internal
  const unknownDoors = doors.filter((d) => !d.connects_to);
  const totalInternalDoors = internalDoors.length + unknownDoors.length;
  const totalExteriorDoors = exteriorDoors.length;

  switch (flooringType) {
    case "carpet": {
      // Gripper rod: sold in 2.4m lengths (standard UK)
      if (!coved) {
        const gripperLengths = Math.ceil(netPerimeterLm / 2.4);
        accessories.push({
          type: "gripper_rod",
          description: `Gripper rod (${netPerimeterLm}m perimeter)`,
          quantity: gripperLengths,
          unit: "lengths (2.4m)",
        });
      }

      // Underlay: room area + 5% overlap
      accessories.push({
        type: "underlay",
        description: "Carpet underlay",
        quantity: round2(areaM2 * 1.05),
        unit: "m²",
      });

      // Door bars
      if (totalInternalDoors > 0) {
        accessories.push({
          type: "door_bar",
          description: "Door bars (carpet-to-carpet or carpet-to-hard)",
          quantity: totalInternalDoors,
          unit: "units",
        });
      }

      // Threshold strips for exterior doors
      if (totalExteriorDoors > 0) {
        accessories.push({
          type: "threshold_strip",
          description: "Threshold strips (exterior doors)",
          quantity: totalExteriorDoors,
          unit: "units",
        });
      }
      break;
    }

    case "vinyl": {
      // Adhesive: full-stick vinyl, ~5m² per tub
      accessories.push({
        type: "adhesive",
        description: "Vinyl adhesive (5m² coverage per tub)",
        quantity: Math.ceil(areaM2 / 5),
        unit: "tubs",
      });

      // Weld rod (if seams present — calculated separately in vinyl.ts)
      // Door bars
      if (totalInternalDoors > 0) {
        accessories.push({
          type: "door_bar",
          description: "Door bars (vinyl transition)",
          quantity: totalInternalDoors,
          unit: "units",
        });
      }

      if (totalExteriorDoors > 0) {
        accessories.push({
          type: "threshold_strip",
          description: "Threshold strips (exterior doors)",
          quantity: totalExteriorDoors,
          unit: "units",
        });
      }
      break;
    }

    case "lvt":
    case "laminate":
    case "wood":
    case "engineered": {
      // Expansion beading: perimeter minus doorways
      const beadingLengths = Math.ceil(netPerimeterLm / 2.4);
      accessories.push({
        type: "expansion_beading",
        description: `Expansion beading/scotia (${netPerimeterLm}m perimeter)`,
        quantity: beadingLengths,
        unit: "lengths (2.4m)",
      });

      // Underlay for laminate/engineered (not click LVT which is usually direct-stick or self-underlay)
      if (flooringType === "laminate" || flooringType === "engineered") {
        accessories.push({
          type: "underlay",
          description: "Laminate/engineered underlay",
          quantity: round2(areaM2 * 1.05),
          unit: "m²",
        });
      }

      // Adhesive for LVT (if glue-down — assume yes for now)
      if (flooringType === "lvt") {
        accessories.push({
          type: "adhesive",
          description: "LVT adhesive (5m² coverage per tub)",
          quantity: Math.ceil(areaM2 / 5),
          unit: "tubs",
        });
      }

      // Door bars
      if (totalInternalDoors > 0) {
        accessories.push({
          type: "door_bar",
          description: "Door bars (T-bar or ramp profile)",
          quantity: totalInternalDoors,
          unit: "units",
        });
      }

      if (totalExteriorDoors > 0) {
        accessories.push({
          type: "threshold_strip",
          description: "Threshold strips (exterior doors)",
          quantity: totalExteriorDoors,
          unit: "units",
        });
      }
      break;
    }
  }

  return accessories;
}

/**
 * Merge accessory lists across multiple rooms — combine quantities by type.
 */
export function mergeAccessories(roomAccessories: Accessory[][]): Accessory[] {
  const merged = new Map<string, Accessory>();

  for (const list of roomAccessories) {
    for (const acc of list) {
      const existing = merged.get(acc.type);
      if (existing) {
        existing.quantity += acc.quantity;
        // Update description to show combined total
        existing.description = acc.description;
      } else {
        merged.set(acc.type, { ...acc });
      }
    }
  }

  return Array.from(merged.values());
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
