import { redirect } from "next/navigation";

import { createServerClient } from "@/utils/supabase/server";

export default async function Home() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/chat");
  }

  redirect("/auth/login");
}
