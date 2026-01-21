"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createClient } from "@/utils/supabase/client";

type ClientFlags = {
  hasEdited: boolean;
  hasUploaded: boolean;
  loading: boolean;
};

type ClientFlagsContextValue = {
  flags: ClientFlags;
  refreshFlags: () => Promise<void>;
};

const ClientFlagsContext = createContext<ClientFlagsContextValue | undefined>(undefined);

export function ClientFlagsProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [flags, setFlags] = useState<ClientFlags>({
    hasEdited: false,
    hasUploaded: false,
    loading: true,
  });

  const refreshFlags = useCallback(async () => {
    setFlags((prev) => ({ ...prev, loading: true }));

    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;

      if (sessionError || !userId) {
        setFlags({ hasEdited: false, hasUploaded: false, loading: false });
        return;
      }

      const { data: clientRow, error: clientError } = await supabase
        .from("clients")
        .select("has_edited_pricing_settings, has_uploaded_price_list")
        .eq("id", userId)
        .maybeSingle();

      if (clientError) {
        throw clientError;
      }

      setFlags({
        hasEdited: clientRow?.has_edited_pricing_settings ?? false,
        hasUploaded: clientRow?.has_uploaded_price_list ?? false,
        loading: false,
      });
    } catch (err) {
      console.error("Failed to load client flags:", err);
      setFlags({ hasEdited: false, hasUploaded: false, loading: false });
    }
  }, [supabase]);

  useEffect(() => {
    void refreshFlags();
  }, [refreshFlags]);

  const value = useMemo(() => ({ flags, refreshFlags }), [flags, refreshFlags]);

  return <ClientFlagsContext.Provider value={value}>{children}</ClientFlagsContext.Provider>;
}

export function useClientFlags() {
  const context = useContext(ClientFlagsContext);

  if (!context) {
    throw new Error("useClientFlags must be used within ClientFlagsProvider");
  }

  return context;
}
