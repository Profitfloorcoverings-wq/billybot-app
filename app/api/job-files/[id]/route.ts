import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserFromCookies } from "@/utils/supabase/auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromCookies();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    // Fetch the file record to get storage path
    const { data: file } = await supabaseAdmin
      .from("job_files")
      .select("id, storage_path, client_id")
      .eq("id", id)
      .eq("client_id", user.id)
      .maybeSingle();

    if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });

    // Delete from storage
    const { error: storageError } = await supabaseAdmin.storage
      .from("job_files")
      .remove([file.storage_path]);

    if (storageError) {
      console.error("[job-files storage delete]", storageError);
    }

    // Delete DB record
    const { error: dbError } = await supabaseAdmin
      .from("job_files")
      .delete()
      .eq("id", id)
      .eq("client_id", user.id);

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[job-files DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
