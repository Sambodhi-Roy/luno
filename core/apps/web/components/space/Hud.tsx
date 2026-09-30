"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Keyboard, LogIn, RefreshCw, Share2, ShieldX, SearchX, MonitorSmartphone, X, type LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { ConnectionStatus } from "@/game";
import { inviteUrl, spaceUrl } from "@/lib/navigation";
import type { SpaceDetail } from "@/lib/types";
import { CopyField } from "../CopyField";
import { LogoMark } from "../Logo";
import { VisibilityBadge } from "../VisibilityPicker";
import { Button, IconButton, Popover } from "../ui";

/* ---------- Top-left: back, space name, connection ---------- */

export function SpaceTitle({ space, status, online }: { space: SpaceDetail; status: ConnectionStatus; online: number }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Link href="/dashboard" aria-label="Back to dashboard" title="Back to dashboard" className="hud-button">
        <ArrowLeft className="size-4.5" />
      </Link>
      <div className="float-panel flex min-w-0 items-center gap-3 rounded-full py-1.5 pr-2 pl-4">
        <span className="truncate text-sm font-semibold">{space.name}</span>
        <span className="hidden sm:inline-flex">
          <VisibilityBadge visibility={space.visibility} />
        </span>
        <StatusPill status={status} online={online} />
      </div>
    </div>
  );
}

function StatusPill({ status, online }: { status: ConnectionStatus; online: number }) {
  if (status.state === "connected") {
    return (
      <span className="badge shrink-0 text-copy" title={`${online} ${online === 1 ? "person" : "people"} here`}>
        <span className="relative flex size-2">
          <span className="status-dot-ping bg-success" />
          <span className="status-dot bg-success" />
        </span>
        <span className="tabular-nums">{online}</span> online
      </span>
    );
  }
  if (status.state === "closed") {
    return (
      <span className="badge shrink-0 text-error">
        <span className="status-dot bg-error" />
        Offline
      </span>
    );
  }
  return (
    <span className="badge shrink-0">
      <span className="status-dot animate-pulse bg-warning" />
      {status.state === "connecting" ? "Connecting" : "Reconnecting"}
    </span>
  );
}

/* ---------- Top-right: share ---------- */

export function ShareButton({ space, isOwner }: { space: SpaceDetail; isOwner: boolean }) {
  // The owner shares the invite link (works for private spaces); anyone can share a public space's own address
  const link = isOwner && space.inviteCode ? inviteUrl(space.inviteCode) : space.visibility === "Public" ? spaceUrl(space.id) : null;

  return (
    <Popover
      trigger={(open, toggle) => (
        <button onClick={toggle} aria-expanded={open} className="btn-primary h-10">
          <Share2 className="size-4" />
          <span className="hidden sm:inline">Share</span>
        </button>
      )}
    >
      <p className="font-semibold">Invite people</p>
      {link ? (
        <>
          <p className="mt-1 mb-3 text-sm text-copy-lighter">
            {isOwner
              ? "Anyone with this link can join, even while the space is private."
              : "This space is public: anyone signed in can use this link."}
          </p>
          <CopyField value={link} />
        </>
      ) : (
        <p className="mt-1 text-sm text-copy-lighter">
          This space is private. Ask its owner for an invite link to bring someone in.
        </p>
      )}
    </Popover>
  );
}

/* ---------- Controls help ---------- */

const HINT_KEY = "luno:controls-hint-dismissed";

/** Whether the first-visit controls card was dismissed. Browser storage can be unavailable, so it may be unknown. */
function readHintDismissed() {
  try {
    return localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}

/** Shows the controls card on a first visit; the dock's keyboard button toggles it after that. */
export function useControlsHint() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Read after mount: localStorage doesn't exist during the server render
    const timer = setTimeout(() => setOpen(!readHintDismissed()), 0);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      // Not remembered; it'll show again next visit
    }
  };

  return { open, toggle: () => (open ? dismiss() : setOpen(true)), dismiss };
}

export function ControlsCard({ onClose }: { onClose: () => void }) {
  return (
    <div className="float-panel w-72 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 font-semibold">
          <Keyboard className="size-4 text-primary-light" />
          Controls
        </p>
        <IconButton icon={X} label="Close controls" onClick={onClose} className="-mr-2 size-7" />
      </div>
      <dl className="space-y-2.5 text-sm">
        <ControlRow keys={<Keys labels={["W", "A", "S", "D"]} />}>Walk</ControlRow>
        <ControlRow keys={<Keys labels={["↑", "←", "↓", "→"]} />}>Or arrows</ControlRow>
      </dl>
      <p className="mt-3 text-xs text-copy-lighter">Walk up to people to hang out. Your name tag is the purple one.</p>
    </div>
  );
}

function ControlRow({ keys, children }: { keys: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-copy-light">{children}</dt>
      <dd>{keys}</dd>
    </div>
  );
}

function Keys({ labels }: { labels: string[] }) {
  return (
    <span className="flex gap-1">
      {labels.map((l) => (
        <kbd key={l} className="kbd">
          {l}
        </kbd>
      ))}
    </span>
  );
}

/* ---------- Overlays ---------- */

/** Covers the canvas while the map and characters load, and until we've joined. */
export function JoinOverlay({ title, progress }: { title: string; progress: number }) {
  return (
    <div className="bg-dots absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-background p-6 text-center">
      <LogoMark className="size-14 animate-bounce" />
      <div>
        <p className="heading-display text-2xl">{title}</p>
        <p className="mt-1 text-sm text-copy-lighter">{progress < 1 ? "Loading the map…" : "Finding your spot…"}</p>
      </div>
      <progress className="progress-bar max-w-64" value={progress} max={1} aria-label="Loading" />
    </div>
  );
}

const CLOSE_REASONS: Record<number, { icon: LucideIcon; title: string; text: string; rejoin: boolean; login?: boolean }> = {
  4000: {
    icon: MonitorSmartphone,
    title: "You're in this space somewhere else",
    text: "You opened this space in another tab or window, so this one was disconnected.",
    rejoin: true,
  },
  4001: {
    icon: LogIn,
    title: "Your session has ended",
    text: "Log in again to get back into the space.",
    rejoin: false,
    login: true,
  },
  4003: {
    icon: ShieldX,
    title: "You no longer have access",
    text: "This space is private now. Ask its owner for an invite link to get back in.",
    rejoin: false,
  },
  4004: {
    icon: SearchX,
    title: "This space is gone",
    text: "It may have been deleted by its owner.",
    rejoin: false,
  },
};

/** Explains a disconnect the client won't retry by itself, with a way forward. */
export function DisconnectDialog({ code, onRejoin }: { code: number; onRejoin: () => void }) {
  const router = useRouter();
  const reason = CLOSE_REASONS[code] ?? {
    icon: RefreshCw,
    title: "You've been disconnected",
    text: "The connection to the space was closed.",
    rejoin: true,
  };
  const Icon = reason.icon;

  return (
    <div className="dialog-overlay absolute inset-0 z-30 flex items-center justify-center p-4">
      <div role="alertdialog" aria-labelledby="disconnect-title" className="dialog-panel text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary-light">
          <Icon className="size-6" />
        </div>
        <h2 id="disconnect-title" className="text-xl font-semibold">
          {reason.title}
        </h2>
        <p className="mt-2 text-sm text-copy-lighter">{reason.text}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {reason.rejoin && (
            <Button onClick={onRejoin} autoFocus>
              <RefreshCw className="size-4" />
              Rejoin here
            </Button>
          )}
          {reason.login && (
            <Button onClick={() => router.replace(`/login?next=${encodeURIComponent(location.pathname)}`)} autoFocus>
              Log in
            </Button>
          )}
          <Link href="/dashboard" className={reason.rejoin || reason.login ? "btn-subtle" : "btn-primary"}>
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
