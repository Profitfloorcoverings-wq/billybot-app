import { redirect } from "next/navigation";

import { createServerClient } from "@/utils/supabase/server";

export default async function Home() {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getSession();

  if (data.session) {
    redirect("/chat");
  }

  redirect("/auth/login");
}
