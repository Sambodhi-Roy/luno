"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AvatarPicker } from "@/components/AvatarPicker";
import { AvatarSprite } from "@/components/AvatarSprite";
import { CreateSpaceDialog } from "@/components/CreateSpaceDialog";
import { SpaceCard } from "@/components/SpaceCard";
import { SpaceSettingsDialog } from "@/components/SpaceSettingsDialog";
import { Button, ErrorText, Menu, MenuItem } from "@/components/ui";
import { api } from "@/lib/api";
import { inviteUrl } from "@/lib/navigation";
import type { OtherSpaceSummary, OwnedSpaceSummary } from "@/lib/types";
import { useMe } from "@/lib/useMe";

// How long a confirmation like "Invite link copied" stays on screen
const NOTICE_MS = 3000;

const TABS = [
  { id: "mine", label: "Your spaces" },
  { id: "joined", label: "Joined" },
  { id: "explore", label: "Explore" },
] as const;

type Tab = (typeof TABS)[number]["id"];

const EMPTY_TEXT: Record<Tab, string> = {
  mine: "You don't have any spaces yet. Create one to get started.",
  joined: "Spaces you join through an invite link or from Explore show up here.",
  explore: "No public spaces yet.",
};

const visitedLabel = (iso: string | null) =>
  iso ? `visited ${new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" })}` : null;

export default function DashboardPage() {
  const router = useRouter();
  const { me, refresh: refreshMe } = useMe();
  const [tab, setTab] = useState<Tab>("mine");
  const [mine, setMine] = useState<OwnedSpaceSummary[] | null>(null);
  const [joined, setJoined] = useState<OtherSpaceSummary[] | null>(null);
  const [explore, setExplore] = useState<OtherSpaceSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAvatar, setShowAvatar] = useState(false);
  const [settingsFor, setSettingsFor] = useState<OwnedSpaceSummary | null>(null);

  const signedIn = me !== null;

  // Each tab loads when it's first opened; Joined and Explore reload on every visit since they change without us
  useEffect(() => {
    if (!signedIn) return;
    const fail = (e: unknown) => setError(e instanceof Error ? e.message : "Could not load spaces");
    if (tab === "mine") {
      api<{ spaces: OwnedSpaceSummary[] }>("/space/all").then((res) => setMine(res.spaces), fail);
    } else if (tab === "joined") {
      api<{ spaces: OtherSpaceSummary[] }>("/space/joined").then((res) => setJoined(res.spaces), fail);
    } else {
      api<{ spaces: OtherSpaceSummary[] }>("/space/public").then((res) => setExplore(res.spaces), fail);
    }
  }, [signedIn, tab]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  async function signOut() {
    await api("/user/signout", { method: "POST" }).catch(() => {});
    router.replace("/login");
  }

  async function deleteSpace(space: OwnedSpaceSummary) {
    if (!confirm(`Delete "${space.name}"? This can't be undone.`)) return;
    try {
      await api(`/space/${space.id}`, { method: "DELETE" });
      setMine((prev) => prev?.filter((s) => s.id !== space.id) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete space");
    }
  }

  async function leaveSpace(space: OtherSpaceSummary) {
    const warning =
      space.visibility === "Private" ? " You'll need a new invite link to get back in." : "";
    if (!confirm(`Leave "${space.name}"?${warning}`)) return;
    try {
      await api(`/space/${space.id}/membership`, { method: "DELETE" });
      setJoined((prev) => prev?.filter((s) => s.id !== space.id) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not leave space");
    }
  }

  async function copyInvite(space: OwnedSpaceSummary) {
    try {
      await navigator.clipboard.writeText(inviteUrl(space.inviteCode));
      setNotice("Invite link copied");
    } catch {
      setError("Could not copy the link. Open Settings to copy it by hand.");
    }
  }

  if (!me) {
    return <main className="flex min-h-screen items-center justify-center text-copy-lighter">Loading…</main>;
  }

  const spaces = { mine, joined, explore }[tab];

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-10 flex items-center justify-between gap-4">
        <span className="text-lg font-semibold text-primary">luno</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAvatar(true)}
            className="hover-tint flex items-center gap-2 rounded-lg px-2 py-1"
            title="Change avatar"
          >
            <AvatarSprite imageUrl={me.avatar?.imageUrl ?? null} size="sm" />
            <span className="text-sm">{me.username}</span>
          </button>
          {me.role === "Admin" && (
            <Link href="/admin" className="btn-ghost">
              Admin
            </Link>
          )}
          <Button variant="ghost" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </header>

      <div className="mb-6 flex items-center justify-between gap-4">
        <div role="tablist" className="flex gap-1">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className="tab">
              {t.label}
            </button>
          ))}
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Create space</Button>
      </div>

      <ErrorText>{error}</ErrorText>

      {spaces === null && !error && <p className="text-copy-lighter">Loading spaces…</p>}

      {spaces?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-copy-lighter">
          {EMPTY_TEXT[tab]}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tab === "mine" &&
          mine?.map((space) => (
            <SpaceCard
              key={space.id}
              space={space}
              detail={`${space.dimensions} tiles`}
              menu={
                <Menu label={`Options for ${space.name}`}>
                  <Link href={`/space/${space.id}/edit`} role="menuitem" className="menu-item">
                    Edit furniture
                  </Link>
                  <MenuItem onClick={() => setSettingsFor(space)}>Settings</MenuItem>
                  <MenuItem onClick={() => copyInvite(space)}>Copy invite link</MenuItem>
                  <MenuItem danger onClick={() => deleteSpace(space)}>
                    Delete
                  </MenuItem>
                </Menu>
              }
            />
          ))}

        {tab === "joined" &&
          joined?.map((space) => (
            <SpaceCard
              key={space.id}
              space={space}
              detail={[`by ${space.ownerUsername}`, visitedLabel(space.lastVisitedAt)].filter(Boolean).join(" · ")}
              menu={
                <Menu label={`Options for ${space.name}`}>
                  <MenuItem danger onClick={() => leaveSpace(space)}>
                    Leave space
                  </MenuItem>
                </Menu>
              }
            />
          ))}

        {tab === "explore" &&
          explore?.map((space) => (
            <SpaceCard key={space.id} space={space} detail={`by ${space.ownerUsername} · ${space.dimensions} tiles`} />
          ))}
      </div>

      {notice && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2">
          <span className="chip">
            <span className="status-dot bg-success" />
            {notice}
          </span>
        </div>
      )}

      {showCreate && (
        <CreateSpaceDialog
          onClose={() => setShowCreate(false)}
          onCreated={(spaceId) => router.push(`/space/${spaceId}`)}
        />
      )}

      {settingsFor && (
        <SpaceSettingsDialog
          space={settingsFor}
          onClose={() => setSettingsFor(null)}
          onChanged={(changes) => {
            setSettingsFor((prev) => (prev ? { ...prev, ...changes } : prev));
            setMine((prev) => prev?.map((s) => (s.id === settingsFor.id ? { ...s, ...changes } : s)) ?? null);
          }}
        />
      )}

      {showAvatar && (
        <AvatarPicker
          currentId={me.avatar?.id ?? null}
          onClose={() => setShowAvatar(false)}
          onSaved={() => {
            setShowAvatar(false);
            refreshMe();
          }}
        />
      )}
    </main>
  );
}
