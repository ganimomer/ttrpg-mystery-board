import { useCallback, useEffect, useState } from "react";
import type { Me } from "@board/shared";
import { api, ApiError } from "../api";
import { initActivityAuth, isEmbedded } from "../discord/activity";

export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // Inside Discord, complete the Embedded SDK auth (which sets our token)
      // before asking who we are. In a normal browser this is skipped.
      if (isEmbedded()) await initActivityAuth();
      setMe(await api.me());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setMe(null);
      else setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { me, loading, refresh, setMe };
}
