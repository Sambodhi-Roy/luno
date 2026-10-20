"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Keyboard, Lock, Pencil, SearchX, Settings, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AvatarPicker } from "@/components/AvatarPicker";
import { AvatarBadge } from "@/components/AvatarSprite";
import { GameCanvas } from "@/components/GameCanvas";
import { DashboardLink, MeFallback } from "@/components/PageStates";
import { ControlsCard, DisconnectDialog, JoinOverlay, ShareButton, SpaceTitle, useControlsHint } from "@/components/space/Hud";
import { SpaceSettingsDialog } from "@/components/SpaceSettingsDialog";
import { FullPageState } from "@/components/ui";
import type { ConnectionStatus, GameController, GameOptions, Person } from "@/game";
import { api, ApiError, friendlyError } from "@/lib/api";
import type { SpaceDetail, Visibility } from "@/lib/types";
import { useMe } from "@/lib/useMe";

// Join and leave notices stop once a space is this busy; they'd be noise
const MAX_PEOPLE_FOR_NOTICES = 15;

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
  // Name, visibility and invite code as changed since loading (live from the owner, or our own settings). Kept
  // apart from `space`, which would recreate the game if replaced.
  const [info, setInfo] = useState<{ name?: string; visibility?: Visibility; inviteCode?: string }>({});
  const [error, setError] = useState<ReturnType<typeof loadError> | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>({ state: "connecting" });
  const [people, setPeople] = useState<Person[]>([]);
  const [progress, setProgress] = useState(0);
  // Stays true after the first successful join, so a later reconnect doesn't bring the loading screen back
  const [joined, setJoined] = useState(false);
  // Bumped to throw the game away and join again (after a disconnect)
  const [session, setSession] = useState(0);
  const [game, setGame] = useState<GameController | null>(null);
  const [showAvatar, setShowAvatar] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const controls = useControlsHint();

  const isOwner = !!space && !!me && space.creatorId === me.id;
  const shown = space ? { ...space, ...info } : null;

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
    if (shown) document.title = `${shown.name} · Luno`;
  }, [shown?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const onStatus = useCallback((next: ConnectionStatus) => {
    setStatus(next);
    if (next.state === "connected") setJoined(true);
  }, []);

  // Quiet notices for arrivals and departures, until the space gets busy
  const onArrival = useCallback((username: string, kind: "joined" | "left", here: number) => {
    if (here <= MAX_PEOPLE_FOR_NOTICES) toast(`${username} ${kind}`, { duration: 2500 });
  }, []);

  const onSpaceUpdated = useCallback((next: { name: string; visibility: Visibility }) => {
    setInfo((prev) => ({ ...prev, ...next }));
  }, []);

  const options = useMemo<GameOptions | null>(
    () =>
      space && me
        ? {
            mode: "play",
            space,
            me,
            onStatus,
            onPresence: setPeople,
            onSpaceUpdated,
            onArrival,
            onLoadProgress: setProgress,
          }
        : null,
    // `session` is a dependency on purpose: bumping it recreates the game, which joins again. Only the user's
    // id matters: a new avatar is swapped in place by the game.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [space, me?.id, onStatus, onSpaceUpdated, onArrival, session]
  );

  // A dialog over the game gets the keyboard; otherwise WASD would walk the player while it's open
  useEffect(() => {
    game?.setKeyboardEnabled(!showAvatar && !showSettings);
  }, [game, showAvatar, showSettings]);

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

      {(!shown || (!joined && !closed)) && (
        <JoinOverlay title={shown ? `Entering ${shown.name}` : "Opening space"} progress={shown ? progress : 0} />
      )}

      {shown && joined && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="pointer-events-auto min-w-0">
              <SpaceTitle space={shown} status={status} people={people} onWalkTo={(id) => game?.walkToPerson(id)} />
            </div>
            <div className="pointer-events-auto flex shrink-0 items-center gap-2">
              {isOwner && (
                <>
                  <button
                    onClick={() => setShowSettings(true)}
                    aria-label="Space settings"
                    title="Space settings"
                    className="hud-button"
                  >
                    <Settings className="size-4.5" />
                  </button>
                  <Link href={`/space/${spaceId}/edit`} aria-label="Edit space" title="Edit space" className="hud-button">
                    <Pencil className="size-4.5" />
                  </Link>
                </>
              )}
              <ShareButton space={shown} isOwner={isOwner} />
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
                onClick={() => game?.zoomBy(-1)}
                aria-label="Zoom out"
                title="Zoom out"
                className="btn-icon size-10 rounded-xl"
              >
                <ZoomOut className="size-5" />
              </button>
              <button onClick={() => game?.zoomBy(1)} aria-label="Zoom in" title="Zoom in" className="btn-icon size-10 rounded-xl">
                <ZoomIn className="size-5" />
              </button>
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
          onSaved={(avatar) => {
            setShowAvatar(false);
            // Swapped in place; everyone else is told by the server
            game?.setMyAvatar(avatar.imageUrl);
            refreshMe();
          }}
        />
      )}

      {showSettings && shown?.inviteCode && (
        <SpaceSettingsDialog
          space={{ id: shown.id, name: shown.name, visibility: shown.visibility, inviteCode: shown.inviteCode }}
          onClose={() => setShowSettings(false)}
          onChanged={(changes) => setInfo((prev) => ({ ...prev, ...changes }))}
        />
      )}
    </main>
  );
}
