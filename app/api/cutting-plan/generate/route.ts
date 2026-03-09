import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resvg } from "@resvg/resvg-js";
import path from "path";
import fs from "fs";
import { getUserFromRequest } from "@/utils/supabase/auth";
import { calculateCarpetLayout } from "@/lib/cutting-plan/calculators/carpet";
import { calculateVinylLayout } from "@/lib/cutting-plan/calculators/vinyl";
import { calculatePlankLayout } from "@/lib/cutting-plan/calculators/plank";
import {
  calculateAccessories,
  mergeAccessories,
} from "@/lib/cutting-plan/calculators/accessories";
import { renderCuttingPlanSvg } from "@/lib/cutting-plan/renderers/svg";
import type {
  CuttingPlanRequest,
  CuttingPlanResult,
  CuttingPlanTotals,
  RoomLayout,
  RoomInput,
  FlooringType,
  Accessory,
} from "@/lib/cutting-plan/types";

export const maxDuration = 30;

/**
 * POST /api/cutting-plan/generate
 *
 * Auth: getUserFromRequest() (cookies/Bearer) OR X-BillyBot-Secret (N8N)
 * Body: CuttingPlanRequest
 * Returns: { svg, png_base64, summary, summary_text, accessories }
 */
export async function POST(request: Request) {
  try {
    // Auth: user session OR N8N shared secret
    let clientId: string | null = null;

    const n8nSecret =
      request.headers.get("X-BillyBot-Secret") ||
      request.headers.get("x-billybot-secret") ||
      request.headers.get("x-n8n-secret");

    if (n8nSecret && n8nSecret === process.env.N8N_SHARED_SECRET) {
      // N8N auth — client_id must be in body
    } else {
      const user = await getUserFromRequest(request);
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      clientId = user.id;
    }

    const body: CuttingPlanRequest = await request.json();

    // If N8N auth, use client_id from body
    if (!clientId) {
      clientId = body.client_id;
    }

    if (!clientId) {
      return NextResponse.json(
        { error: "client_id is required" },
        { status: 400 }
      );
    }

    if (!body.rooms || body.rooms.length === 0) {
      return NextResponse.json(
        { error: "At least one room is required" },
        { status: 400 }
      );
    }

    if (!body.material) {
      return NextResponse.json(
        { error: "material is required" },
        { status: 400 }
      );
    }

    // Step 4: Multi-room pile direction consistency
    // Propagate pile direction through connected rooms via doorways
    const rooms = propagatePileDirection(body.rooms, body.flooring_type);

    // Calculate layouts per room
    const roomLayouts: RoomLayout[] = [];
    const allRoomAccessories: Accessory[][] = [];

    for (const room of rooms) {
      const layout = calculateRoom(room, body);

      // Step 3: Calculate accessories per room
      const accessories = calculateAccessories(
        room,
        layout.resolved_walls,
        body.flooring_type,
        layout.coved
      );
      layout.accessories = accessories;
      allRoomAccessories.push(accessories);

      roomLayouts.push(layout);
    }

    // Compute totals
    const totals = computeTotals(roomLayouts);
    const combinedAccessories = mergeAccessories(allRoomAccessories);

    // Roll length (for roll goods)
    let rollLengthM: number | undefined;
    if (body.material.format === "roll") {
      const totalMaterialMm2 = totals.total_material_m2 * 1_000_000;
      const rollWidthMm = body.material.width_m * 1000;
      rollLengthM =
        Math.round((totalMaterialMm2 / rollWidthMm / 1000) * 100) / 100;
    }

    // Build result
    const result: CuttingPlanResult = {
      rooms: roomLayouts,
      material: body.material,
      flooring_type: body.flooring_type,
      totals,
      roll_length_required_m: rollLengthM,
      accessories: combinedAccessories,
      svg: "",
      summary_text: "",
    };

    // Generate SVG
    result.svg = renderCuttingPlanSvg(result, {
      showGripper: body.flooring_type === "carpet",
      gripperGapMm: body.options?.gripper_gap_mm ?? 6,
    });

    // Build summary text
    result.summary_text = buildSummaryText(result);

    // SVG → PNG
    const fontPath = path.join(
      process.cwd(),
      "lib/cutting-plan/fonts/Inter-Regular.ttf"
    );
    const fontFiles = fs.existsSync(fontPath) ? [fontPath] : [];

    const resvg = new Resvg(result.svg, {
      fitTo: { mode: "width", value: 1200 },
      font: {
        loadSystemFonts: true,
        fontFiles,
        defaultFontFamily: "Inter",
      },
    });
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();
    const pngBase64 = Buffer.from(pngBuffer).toString("base64");

    // Save to Supabase Storage + job_files if job_id provided
    let savedFileUrl: string | null = null;
    if (body.job_id) {
      savedFileUrl = await saveToStorage(
        clientId,
        body.job_id,
        pngBuffer,
        result.summary_text
      );
    }

    return NextResponse.json({
      svg: result.svg,
      png_base64: pngBase64,
      summary: {
        rooms: roomLayouts.map((r) => ({
          name: r.room.name,
          area_m2: r.room_area_m2,
          material_m2: r.total_material_m2,
          waste_m2: r.waste_m2,
          waste_percent: r.waste_percent,
          drops: r.drops?.length ?? 0,
          seams: r.seams?.length ?? 0,
          tiles: r.tiles?.length ?? 0,
        })),
        totals,
        roll_length_required_m: rollLengthM,
        accessories: combinedAccessories,
      },
      summary_text: result.summary_text,
      file_url: savedFileUrl,
    });
  } catch (error) {
    console.error("[cutting-plan/generate]", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Step 4: Multi-room pile direction consistency.
 *
 * When rooms connect via doorways, the pile/lay direction must match
 * through the connecting doorway — otherwise the join looks terrible.
 *
 * Algorithm:
 * 1. Build adjacency graph from doors' connects_to fields
 * 2. Find the "anchor" room (has exterior door, or the largest room)
 * 3. BFS from anchor — once a room's direction is set, propagate to neighbors
 */
function propagatePileDirection(
  rooms: RoomInput[],
  flooringType: FlooringType
): RoomInput[] {
  if (rooms.length <= 1) return rooms;

  // Build name → index map
  const nameToIdx = new Map<string, number>();
  rooms.forEach((r, i) => nameToIdx.set(r.name.toLowerCase(), i));

  // Build adjacency: which rooms connect to which
  const adjacency: Map<number, Set<number>> = new Map();
  for (let i = 0; i < rooms.length; i++) {
    adjacency.set(i, new Set());
  }

  for (let i = 0; i < rooms.length; i++) {
    const room = rooms[i];
    if (!room.doors) continue;
    for (const door of room.doors) {
      if (!door.connects_to) continue;
      const targetIdx = nameToIdx.get(door.connects_to.toLowerCase());
      if (targetIdx != null && targetIdx !== i) {
        adjacency.get(i)!.add(targetIdx);
        adjacency.get(targetIdx)!.add(i);
      }
    }
  }

  // Find anchor room: prefer room with exterior door, else largest room
  let anchorIdx = 0;
  let anchorHasExterior = false;
  let largestArea = 0;

  for (let i = 0; i < rooms.length; i++) {
    const room = rooms[i];
    const hasExterior = room.doors?.some((d) => {
      const ct = (d.connects_to || "").toLowerCase();
      return ct === "exterior" || ct === "outside";
    });
    const area =
      room.area_m2 ??
      (room.bounding_box
        ? room.bounding_box.w_m * room.bounding_box.l_m
        : 0);

    if (hasExterior && !anchorHasExterior) {
      anchorIdx = i;
      anchorHasExterior = true;
      largestArea = area;
    } else if (!anchorHasExterior && area > largestArea) {
      anchorIdx = i;
      largestArea = area;
    }
  }

  // If anchor room already has a pile_direction set, use it
  // Otherwise let the calculator decide (it will be set on the first pass)
  // We only force consistency on rooms that DON'T already have pile_direction set
  const anchorRoom = rooms[anchorIdx];

  // BFS from anchor
  const visited = new Set<number>();
  const queue: number[] = [anchorIdx];
  visited.add(anchorIdx);

  // Clone rooms so we can modify pile_direction
  const result = rooms.map((r) => ({ ...r }));

  // The anchor's direction (if set) propagates; if not, we let it be auto-calculated
  // After the anchor is calculated, we can read its pile_direction_deg from the layout
  // But we don't have layouts yet — we're just setting up inputs.
  // So: if the anchor has a pile_direction, propagate it. Otherwise, skip propagation
  // (each room gets auto-calculated, which is fine for the first iteration)
  const anchorDir = anchorRoom.pile_direction;

  if (anchorDir != null) {
    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = adjacency.get(current) || new Set();

      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);

        // Propagate pile direction if the neighbor doesn't have one set
        if (result[neighbor].pile_direction == null) {
          result[neighbor].pile_direction = anchorDir;
        }

        queue.push(neighbor);
      }
    }
  } else {
    // No explicit anchor direction — use a two-pass approach:
    // Set all connected rooms to the same "auto" direction by finding
    // what the anchor WOULD choose, then forcing that on neighbors.
    // We do this by checking if rooms are connected — if so, they should
    // share a direction. We flag them with a special marker and let
    // the first room's auto-calculated direction be used for all.

    // Simple approach: if rooms are connected, give them all the same
    // main_light_source (if the anchor has one) so they auto-calculate the same way
    if (anchorRoom.main_light_source) {
      while (queue.length > 0) {
        const current = queue.shift()!;
        const neighbors = adjacency.get(current) || new Set();

        for (const neighbor of neighbors) {
          if (visited.has(neighbor)) continue;
          visited.add(neighbor);

          if (
            result[neighbor].pile_direction == null &&
            !result[neighbor].main_light_source
          ) {
            result[neighbor].main_light_source =
              anchorRoom.main_light_source;
          }

          queue.push(neighbor);
        }
      }
    }
  }

  return result;
}

function calculateRoom(
  room: CuttingPlanRequest["rooms"][0],
  req: CuttingPlanRequest
): RoomLayout {
  switch (req.flooring_type) {
    case "carpet":
      return calculateCarpetLayout({
        room,
        material: req.material,
        options: req.options,
      });

    case "vinyl":
      return calculateVinylLayout({
        room,
        material: req.material,
        options: req.options,
      });

    case "lvt":
    case "laminate":
    case "wood":
    case "engineered":
      return calculatePlankLayout({
        room,
        material: req.material,
        options: req.options,
      });

    default:
      return calculateCarpetLayout({
        room,
        material: req.material,
        options: req.options,
      });
  }
}

function computeTotals(layouts: RoomLayout[]): CuttingPlanTotals {
  const totalRoom = layouts.reduce((s, l) => s + l.room_area_m2, 0);
  const totalMaterial = layouts.reduce((s, l) => s + l.total_material_m2, 0);
  const totalWaste = layouts.reduce((s, l) => s + l.waste_m2, 0);
  return {
    total_room_area_m2: Math.round(totalRoom * 100) / 100,
    total_material_m2: Math.round(totalMaterial * 100) / 100,
    total_waste_m2: Math.round(totalWaste * 100) / 100,
    overall_waste_percent:
      totalMaterial > 0
        ? Math.round(((totalWaste / totalMaterial) * 100) * 10) / 10
        : 0,
  };
}

function buildSummaryText(result: CuttingPlanResult): string {
  const lines: string[] = [];
  const { totals, material, flooring_type, accessories } = result;

  lines.push(
    `${capitalize(flooring_type)} Cutting Plan — ${material.product_name ?? `${material.width_m}m wide roll`}`
  );
  lines.push("");

  for (const room of result.rooms) {
    lines.push(`${room.room.name}:`);
    lines.push(`  Room area: ${room.room_area_m2} m²`);
    lines.push(`  Material: ${room.total_material_m2} m²`);
    lines.push(`  Waste: ${room.waste_m2} m² (${room.waste_percent}%)`);
    if (room.drops) lines.push(`  Drops: ${room.drops.length}`);
    if (room.seams && room.seams.length > 0)
      lines.push(`  Seams: ${room.seams.length}`);
    if (room.tiles) {
      const cutCount = room.tiles.filter((t) => t.is_cut).length;
      lines.push(`  Planks: ${room.tiles.length} (${cutCount} cut)`);
    }
    lines.push("");
  }

  lines.push(`Total room area: ${totals.total_room_area_m2} m²`);
  lines.push(`Total material: ${totals.total_material_m2} m²`);
  lines.push(
    `Total waste: ${totals.total_waste_m2} m² (${totals.overall_waste_percent}%)`
  );

  if (result.roll_length_required_m) {
    lines.push(`Roll length required: ${result.roll_length_required_m}m`);
  }

  // Accessories
  if (accessories.length > 0) {
    lines.push("");
    lines.push("Accessories:");
    for (const acc of accessories) {
      lines.push(`  ${acc.description}: ${acc.quantity} ${acc.unit}`);
    }
  }

  return lines.join("\n");
}

async function saveToStorage(
  clientId: string,
  jobId: string,
  pngBuffer: Uint8Array,
  summaryText: string
): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const fileId = crypto.randomUUID();
  const fileName = `cutting-plan-${Date.now()}.png`;
  const storagePath = `${clientId}/${jobId}/${fileId}-${fileName}`;

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from("job_files")
    .upload(storagePath, pngBuffer, {
      contentType: "image/png",
      upsert: false,
    });

  if (uploadError) {
    console.error("[cutting-plan] Storage upload failed:", uploadError);
    return null;
  }

  // Get signed URL (7 days)
  const { data: signedUrlData } = await supabase.storage
    .from("job_files")
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

  const fileUrl = signedUrlData?.signedUrl ?? null;

  // Insert job_files record
  const { error: insertError } = await supabase.from("job_files").insert({
    id: fileId,
    job_id: jobId,
    client_id: clientId,
    file_name: fileName,
    mime_type: "image/png",
    size_bytes: pngBuffer.length,
    storage_path: storagePath,
    file_category: "cutting_plan",
    ai_analysis: { summary: summaryText },
  });

  if (insertError) {
    console.error("[cutting-plan] job_files insert failed:", insertError);
  }

  return fileUrl;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}
