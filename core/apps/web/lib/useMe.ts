"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "./api";
import type { Me } from "./types";

// Client-side auth guard: loads the signed-in user and sends them to /login when the cookie is missing or expired
export function useMe({ redirectToLogin = true } = {}) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bumping this re-runs the fetch (e.g. after the avatar changes)
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;

    api<Me>("/user/me")
      .then((user) => {
        if (!active) return;
        setMe(user);
        setError(null);
      })
      .catch((e) => {
        if (!active) return;
        setMe(null);
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          if (redirectToLogin) router.replace("/login");
        } else {
          setError(e instanceof Error ? e.message : "Something went wrong");
        }
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [redirectToLogin, router, version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  return { me, loading, error, refresh };
}
