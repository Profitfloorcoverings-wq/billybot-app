import { redirect } from "next/navigation";

import { createServerClient } from "@/utils/supabase/server";

export default async function PostOnboardPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: clientProfile } = await supabase
    .from("clients")
    .select("is_onboarded, terms_accepted")
    .eq("id", user.id)
    .maybeSingle();

  const isOnboarded = clientProfile?.is_onboarded ?? false;
  const hasAcceptedTerms = clientProfile?.terms_accepted ?? false;

  if (!isOnboarded) {
    redirect("/account/setup");
  }

  if (!hasAcceptedTerms) {
    redirect("/account/accept-terms");
  }

  redirect("/chat");
}
