"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, friendlyError } from "./api";
import type { Me } from "./types";

function loginUrl() {
  const here = window.location.pathname + window.location.search;
  return here === "/" ? "/login" : `/login?next=${encodeURIComponent(here)}`;
}

export type MeStatus = "loading" | "ready" | "signed-out" | "error";

/**
 * Client-side auth guard: loads the signed-in user and sends them to /login when the cookie is missing or
 * expired. `status` is "error" when the API couldn't be reached, so pages can offer a retry instead of
 * loading forever.
 */
export function useMe({ redirectToLogin = true } = {}) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [status, setStatus] = useState<MeStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  // Bumping this re-runs the fetch (e.g. after the avatar changes, or Retry)
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;

    api<Me>("/user/me")
      .then((user) => {
        if (!active) return;
        setMe(user);
        setError(null);
        setStatus("ready");
      })
      .catch((e) => {
        if (!active) return;
        setMe(null);
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          setStatus("signed-out");
          // Come back here after signing in (e.g. an invite link opened while signed out)
          if (redirectToLogin) router.replace(loginUrl());
        } else {
          setError(friendlyError(e));
          setStatus("error");
        }
      });

    return () => {
      active = false;
    };
  }, [redirectToLogin, router, version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const retry = useCallback(() => {
    setStatus("loading");
    setVersion((v) => v + 1);
  }, []);

  return { me, status, loading: status === "loading", error, refresh, retry };
}
