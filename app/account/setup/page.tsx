"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/utils/supabase/client";

type ClientProfile = {
  business_name: string;
  contact_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  postcode: string;
  country: string;
};

const EMPTY_PROFILE: ClientProfile = {
  business_name: "",
  contact_name: "",
  phone: "",
  address_line1: "",
  address_line2: "",
  city: "",
  postcode: "",
  country: "",
};

export default function AccountSetupPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<ClientProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    async function loadUser() {
      setLoading(true);
      setError(null);

      try {
        const { data, error: userError } = await supabase.auth.getUser();

        if (userError || !data?.user) {
          setNeedsLogin(true);
          return;
        }

        setNeedsLogin(false);
        setEmail(data.user.email ?? "");

        const { error: ensureClientError } = await supabase
          .from("clients")
          .upsert({ id: data.user.id });

        if (ensureClientError) {
          throw ensureClientError;
        }

        const { data: clientData, error: clientError } = await supabase
          .from("clients")
          .select(
            "business_name, contact_name, phone, address_line1, address_line2, city, postcode, country, is_onboarded"
          )
          .eq("id", data.user.id)
          .maybeSingle();

        if (clientError) {
          throw clientError;
        }

        if (clientData) {
          setProfile({ ...EMPTY_PROFILE, ...clientData });
        }
      } catch (err) {
        setError(
          err && typeof err === "object" && "message" in err
            ? String((err as { message?: string }).message)
            : "Unable to load your account"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadUser();
  }, [supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const { data, error: userError } = await supabase.auth.getUser();

      if (userError || !data?.user) {
        setNeedsLogin(true);
        setError("Please sign in to save your profile.");
        return;
      }

      const { error: upsertError } = await supabase.from("clients").upsert({
        id: data.user.id,
        ...profile,
      });

      if (upsertError) {
        throw upsertError;
      }

      router.push("/account/accept-terms");
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Unable to save your profile"
      );
    } finally {
      setSaving(false);
    }
  }

  function updateField(key: keyof ClientProfile, value: string) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  if (needsLogin) {
    return (
      <div className="min-h-screen bg-[var(--bg1)] text-[var(--text)] px-4 py-12 flex items-center justify-center">
        <div className="w-full max-w-2xl">
          <div className="card stack gap-4">
            <h1 className="section-title">Set up your business profile</h1>
            <p className="section-subtitle">Please sign in to continue.</p>
            <button type="button" className="btn btn-primary" onClick={() => router.push("/auth/login")}>
              Go to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg1)] text-[var(--text)] px-4 py-12 flex items-center justify-center">
      <div className="w-full max-w-3xl">
        <div className="card stack gap-6">
          <div className="stack gap-1">
            <h1 className="section-title">Set up your business profile</h1>
            <p className="section-subtitle">
              Complete these details to start using the app.
            </p>
          </div>

          {error ? (
            <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/50 rounded-lg p-3">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="stack gap-4">
            <div className="field-group">
              <label className="field-label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                className="input-fluid"
                value={email}
                disabled
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="field-group">
                <label className="field-label" htmlFor="business_name">
                  Business name
                </label>
                <input
                  id="business_name"
                  className="input-fluid"
                  value={profile.business_name}
                  onChange={(e) => updateField("business_name", e.target.value)}
                  required
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="contact_name">
                  Contact name
                </label>
                <input
                  id="contact_name"
                  className="input-fluid"
                  value={profile.contact_name}
                  onChange={(e) => updateField("contact_name", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="field-group">
                <label className="field-label" htmlFor="phone">
                  Phone
                </label>
                <input
                  id="phone"
                  className="input-fluid"
                  value={profile.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  required
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="country">
                  Country
                </label>
                <input
                  id="country"
                  className="input-fluid"
                  value={profile.country}
                  onChange={(e) => updateField("country", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="address_line1">
                Address line 1
              </label>
              <input
                id="address_line1"
                className="input-fluid"
                value={profile.address_line1}
                onChange={(e) => updateField("address_line1", e.target.value)}
                required
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="address_line2">
                Address line 2
              </label>
              <input
                id="address_line2"
                className="input-fluid"
                value={profile.address_line2}
                onChange={(e) => updateField("address_line2", e.target.value)}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="field-group">
                <label className="field-label" htmlFor="city">
                  City
                </label>
                <input
                  id="city"
                  className="input-fluid"
                  value={profile.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  required
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="postcode">
                  Postcode
                </label>
                <input
                  id="postcode"
                  className="input-fluid"
                  value={profile.postcode}
                  onChange={(e) => updateField("postcode", e.target.value)}
                  required
                />
              </div>

            </div>

            <button type="submit" className="btn btn-primary" disabled={saving || loading}>
              {saving ? "Saving..." : "Save and continue"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
