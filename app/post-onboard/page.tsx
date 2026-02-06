import { unstable_noStore } from "next/cache";
import { redirect } from "next/navigation";

import { createServerClient } from "@/utils/supabase/server";

export default async function PostOnboardPage() {
  unstable_noStore();
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: clientProfile } = await supabase
    .from("clients")
    .select(
      "business_name, contact_name, phone, address_line1, city, postcode, country, is_onboarded, terms_accepted"
    )
    .eq("id", user.id)
    .maybeSingle();

  const businessComplete =
    clientProfile?.is_onboarded === true ||
    Boolean(
      clientProfile?.business_name &&
        clientProfile?.contact_name &&
        clientProfile?.phone &&
        clientProfile?.address_line1 &&
        clientProfile?.city &&
        clientProfile?.postcode &&
        clientProfile?.country
    );
  const hasAcceptedTerms = clientProfile?.terms_accepted === true;

  if (!businessComplete) {
    redirect("/account/setup");
  }

  if (!hasAcceptedTerms) {
    redirect("/account/accept-terms");
  }

  redirect("/chat");
}
