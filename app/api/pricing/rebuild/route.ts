import { NextResponse } from "next/server";

import { rebuildPricingProfile } from "@/lib/pricing/rebuildPricingProfile";

export async function POST(req: Request) {
  try {
    const { profileId } = (await req.json()) as { profileId?: string };

    if (!profileId) {
      return NextResponse.json({ error: "Missing profileId" }, { status: 400 });
    }

    const pricingProfile = await rebuildPricingProfile(profileId);

    if (!pricingProfile || typeof pricingProfile !== "object") {
      throw new Error("Unable to rebuild pricing profile");
    }

    return NextResponse.json({
      success: true,
      profile_json: pricingProfile,
    });
  } catch (err: unknown) {
    console.error("PRICING REBUILD ERROR:", err);
    return NextResponse.json(
      {
        error:
          err && typeof err === "object" && "message" in err
            ? String((err as { message?: string }).message)
            : "Unable to rebuild pricing profile",
      },
      { status: 500 }
    );
  }
}
