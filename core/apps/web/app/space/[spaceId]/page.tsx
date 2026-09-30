"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Keyboard, Lock, Pencil, SearchX } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AvatarPicker } from "@/components/AvatarPicker";
import { AvatarBadge } from "@/components/AvatarSprite";
import { GameCanvas } from "@/components/GameCanvas";
import { DashboardLink, MeFallback } from "@/components/PageStates";
import { ControlsCard, DisconnectDialog, JoinOverlay, ShareButton, SpaceTitle, useControlsHint } from "@/components/space/Hud";
import { FullPageState } from "@/components/ui";
import type { ConnectionStatus, GameController, GameOptions } from "@/game";
import { api, ApiError, friendlyError } from "@/lib/api";
import type { SpaceDetail } from "@/lib/types";
import { useMe } from "@/lib/useMe";

function loadError(e: unknown) {
  if (e instanceof ApiError && e.status === 404) {
    return { icon: SearchX, title: "This space doesn't exist", text: "It may have been deleted, or the link is wrong." };
  }
  if (e instanceof ApiError && e.status === 403) {
    return { icon: Lock, title: "This space is private", text: "Ask its owner for an invite link to get in." };
  }
  return { icon: SearchX, title: "Couldn't open this space", text: friendlyError(e) };
}

export default function SpacePage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const { me, status: meStatus, error: meError, retry, refresh: refreshMe } = useMe();
  const [space, setSpace] = useState<SpaceDetail | null>(null);
  const [error, setError] = useState<ReturnType<typeof loadError> | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>({ state: "connecting" });
  const [online, setOnline] = useState(0);
  const [progress, setProgress] = useState(0);
  // Stays true after the first successful join, so a later reconnect doesn't bring the loading screen back
  const [joined, setJoined] = useState(false);
  // Bumped to throw the game away and join again (after a disconnect)
  const [session, setSession] = useState(0);
  const [game, setGame] = useState<GameController | null>(null);
  const [showAvatar, setShowAvatar] = useState(false);
  const controls = useControlsHint();

  const isOwner = !!space && !!me && space.creatorId === me.id;

  useEffect(() => {
    if (!me) return;
    api<SpaceDetail>(`/space/${spaceId}`)
      .then((loaded) => {
        setSpace(loaded);
        // Puts the space on the visitor's dashboard (under Joined). Nothing to show if it fails.
        api(`/space/${spaceId}/visit`, { method: "POST" }).catch(() => {});
      })
      .catch((e) => setError(loadError(e)));
    // Only the id matters: `me` changes when the avatar does, which shouldn't reload the space
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, spaceId]);

  useEffect(() => {
    if (space) document.title = `${space.name} · Luno`;
  }, [space]);

  const onStatus = useCallback((next: ConnectionStatus) => {
    setStatus(next);
    if (next.state === "connected") setJoined(true);
  }, []);

  const options = useMemo<GameOptions | null>(
    () =>
      space && me
        ? { mode: "play", space, me, onStatus, onPresence: setOnline, onLoadProgress: setProgress }
        : null,
    // `session` is a dependency on purpose: bumping it recreates the game, which joins again
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [space, me, onStatus, session]
  );

  // A dialog over the game gets the keyboard; otherwise WASD would walk the player while it's open
  useEffect(() => {
    game?.setKeyboardEnabled(!showAvatar);
  }, [game, showAvatar]);

  function rejoin() {
    setJoined(false);
    setProgress(0);
    setStatus({ state: "connecting" });
    setSession((s) => s + 1);
  }

  if (!me) return <MeFallback status={meStatus} error={meError} retry={retry} />;

  if (error) {
    return (
      <FullPageState icon={error.icon} title={error.title} actions={<DashboardLink />}>
        {error.text}
      </FullPageState>
    );
  }

  const closed = status.state === "closed" ? status : null;

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-background">
      {options && <GameCanvas options={options} onReady={setGame} />}

      {(!space || (!joined && !closed)) && (
        <JoinOverlay title={space ? `Entering ${space.name}` : "Opening space"} progress={space ? progress : 0} />
      )}

      {space && joined && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="pointer-events-auto min-w-0">
              <SpaceTitle space={space} status={status} online={online} />
            </div>
            <div className="pointer-events-auto flex shrink-0 items-center gap-2">
              {isOwner && (
                <Link href={`/space/${spaceId}/edit`} aria-label="Edit furniture" title="Edit furniture" className="hud-button">
                  <Pencil className="size-4.5" />
                </Link>
              )}
              <ShareButton space={space} isOwner={isOwner} />
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            {controls.open && (
              <div className="pointer-events-auto">
                <ControlsCard onClose={controls.dismiss} />
              </div>
            )}
            <div className="dock pointer-events-auto">
              <button
                onClick={() => setShowAvatar(true)}
                title="Change avatar"
                className="flex items-center gap-2.5 rounded-xl py-1 pr-3 pl-1 transition-colors hover:bg-hover"
              >
                <AvatarBadge imageUrl={me.avatar?.imageUrl ?? null} />
                <span className="text-left leading-tight">
                  <span className="block max-w-32 truncate text-sm font-semibold">{me.username}</span>
                  <span className="block text-xs text-copy-lighter">Change avatar</span>
                </span>
              </button>
              <div className="mx-1 h-8 w-px bg-border" />
              <button
                onClick={controls.toggle}
                aria-pressed={controls.open}
                aria-label="Controls"
                title="Controls"
                className="btn-icon size-10 rounded-xl aria-pressed:bg-hover aria-pressed:text-primary-light"
              >
                <Keyboard className="size-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {closed && <DisconnectDialog code={closed.code} onRejoin={rejoin} />}

      {showAvatar && (
        <AvatarPicker
          currentId={me.avatar?.id ?? null}
          onClose={() => setShowAvatar(false)}
          onSaved={() => {
            setShowAvatar(false);
            // New `me` recreates the game, so everyone sees the new character after the rejoin
            setJoined(false);
            setProgress(0);
            refreshMe();
          }}
        />
      )}
    </main>
  );
}
