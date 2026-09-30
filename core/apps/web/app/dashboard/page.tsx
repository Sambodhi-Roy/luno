"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Compass, DoorOpen, Link2, Pencil, Plus, RefreshCw, Settings, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import { Suspense, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { AvatarPicker } from "@/components/AvatarPicker";
import { useConfirm } from "@/components/ConfirmDialog";
import { copyText } from "@/components/CopyField";
import { CreateSpaceDialog } from "@/components/CreateSpaceDialog";
import { MeFallback } from "@/components/PageStates";
import { SpaceCard, SpaceCardSkeleton } from "@/components/SpaceCard";
import { SpaceSettingsDialog } from "@/components/SpaceSettingsDialog";
import { Button, EmptyState, Menu, MenuItem, MenuSeparator } from "@/components/ui";
import { api, friendlyError } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { inviteUrl } from "@/lib/navigation";
import type { OtherSpaceSummary, OwnedSpaceSummary } from "@/lib/types";
import { useMe } from "@/lib/useMe";

const TABS = [
  { id: "mine", label: "Your spaces", path: "/space/all" },
  { id: "joined", label: "Joined", path: "/space/joined" },
  { id: "explore", label: "Explore", path: "/space/public" },
] as const;

type Tab = (typeof TABS)[number]["id"];
type Lists = { mine: OwnedSpaceSummary[] | null; joined: OtherSpaceSummary[] | null; explore: OtherSpaceSummary[] | null };

const isTab = (value: string | null): value is Tab => TABS.some((t) => t.id === value);

// useSearchParams needs a Suspense boundary on a statically rendered page
export default function DashboardPage() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}

function Dashboard() {
  const router = useRouter();
  const params = useSearchParams();
  const { me, status, error: meError, retry, refresh: refreshMe } = useMe();
  // The open tab lives in the URL (?tab=joined) so refresh and back keep it
  const tabParam = params.get("tab");
  const tab: Tab = isTab(tabParam) ? tabParam : "mine";
  const [lists, setLists] = useState<Lists>({ mine: null, joined: null, explore: null });
  const [errors, setErrors] = useState<Record<Tab, string | null>>({ mine: null, joined: null, explore: null });
  const [showCreate, setShowCreate] = useState(false);
  const [showAvatar, setShowAvatar] = useState(false);
  const [settingsFor, setSettingsFor] = useState<OwnedSpaceSummary | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const signedIn = me !== null;

  const load = useCallback((which: Tab) => {
    const path = TABS.find((t) => t.id === which)!.path;
    api<{ spaces: OwnedSpaceSummary[] & OtherSpaceSummary[] }>(path).then(
      (res) => {
        setLists((prev) => ({ ...prev, [which]: res.spaces }));
        setErrors((prev) => ({ ...prev, [which]: null }));
      },
      (e) => setErrors((prev) => ({ ...prev, [which]: friendlyError(e, "Could not load these spaces") }))
    );
  }, []);

  // Every tab loads up front so the counts are right; Joined and Explore reload whenever they're opened, since
  // they change without us
  useEffect(() => {
    if (!signedIn) return;
    TABS.forEach((t) => load(t.id));
  }, [signedIn, load]);

  function openTab(next: Tab) {
    router.replace(next === "mine" ? "/dashboard" : `/dashboard?tab=${next}`, { scroll: false });
    if (next !== "mine") load(next);
  }

  function retryTab() {
    setErrors((prev) => ({ ...prev, [tab]: null }));
    setLists((prev) => ({ ...prev, [tab]: null }));
    load(tab);
  }

  function deleteSpace(space: OwnedSpaceSummary) {
    void confirm({
      title: `Delete ${space.name}?`,
      body: "Everyone loses access and its furniture is gone for good. This can't be undone.",
      confirmLabel: "Delete space",
      danger: true,
      onConfirm: async () => {
        await api(`/space/${space.id}`, { method: "DELETE" });
        setLists((prev) => ({ ...prev, mine: prev.mine?.filter((s) => s.id !== space.id) ?? null }));
        toast.success(`Deleted ${space.name}`);
      },
    });
  }

  function leaveSpace(space: OtherSpaceSummary) {
    void confirm({
      title: `Leave ${space.name}?`,
      body:
        space.visibility === "Private"
          ? "It's private, so you'll need a new invite link to get back in."
          : "It's public, so you can find it again in Explore.",
      confirmLabel: "Leave space",
      danger: true,
      onConfirm: async () => {
        await api(`/space/${space.id}/membership`, { method: "DELETE" });
        setLists((prev) => ({ ...prev, joined: prev.joined?.filter((s) => s.id !== space.id) ?? null }));
        toast.success(`Left ${space.name}`);
      },
    });
  }

  if (!me) return <MeFallback status={status} error={meError} retry={retry} />;

  const spaces = lists[tab];
  const error = errors[tab];

  return (
    <div className="min-h-screen">
      <AppHeader
        me={me}
        onChangeAvatar={() => setShowAvatar(true)}
        actions={
          <Button onClick={() => setShowCreate(true)} aria-label="Create space" className="max-sm:px-2.5">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Create space</span>
          </Button>
        }
      />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8">
          <p className="eyebrow">Dashboard</p>
          <h1 className="heading-display mt-1 text-3xl sm:text-4xl">Welcome back, {me.username}</h1>
          <p className="mt-2 text-copy-lighter">Jump into a space, or make a new one for your team.</p>
        </div>

        <div role="tablist" aria-label="Spaces" className="mb-8 flex gap-6 overflow-x-auto border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              role="tab"
              aria-selected={tab === t.id}
              aria-controls="spaces-panel"
              onClick={() => openTab(t.id)}
              className="tab shrink-0"
            >
              {t.label}
              {lists[t.id] && <span className="tab-count">{lists[t.id]!.length}</span>}
            </button>
          ))}
        </div>

        <section id="spaces-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
          {error ? (
            <EmptyState
              icon={TriangleAlert}
              title="Couldn't load these spaces"
              action={
                <Button variant="subtle" onClick={retryTab}>
                  <RefreshCw className="size-4" />
                  Try again
                </Button>
              }
            >
              {error}
            </EmptyState>
          ) : spaces === null ? (
            <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <SpaceCardSkeleton key={i} />
              ))}
            </div>
          ) : spaces.length === 0 ? (
            <TabEmptyState tab={tab} onCreate={() => setShowCreate(true)} onExplore={() => openTab("explore")} />
          ) : (
            <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {tab === "mine" &&
                lists.mine?.map((space) => (
                  <SpaceCard
                    key={space.id}
                    space={space}
                    menu={
                      <Menu label={`Options for ${space.name}`}>
                        <MenuItem icon={Pencil} onClick={() => router.push(`/space/${space.id}/edit`)}>
                          Edit furniture
                        </MenuItem>
                        <MenuItem icon={Settings} onClick={() => setSettingsFor(space)}>
                          Settings
                        </MenuItem>
                        <MenuItem
                          icon={Link2}
                          onClick={() => void copyText(inviteUrl(space.inviteCode), "Invite link copied")}
                        >
                          Copy invite link
                        </MenuItem>
                        <MenuSeparator />
                        <MenuItem icon={Trash2} danger onClick={() => deleteSpace(space)}>
                          Delete space
                        </MenuItem>
                      </Menu>
                    }
                  />
                ))}

              {tab === "joined" &&
                lists.joined?.map((space) => (
                  <SpaceCard
                    key={space.id}
                    space={space}
                    detail={[space.ownerUsername, space.lastVisitedAt && `visited ${timeAgo(space.lastVisitedAt)}`]
                      .filter(Boolean)
                      .join(" · ")}
                    menu={
                      <Menu label={`Options for ${space.name}`}>
                        <MenuItem icon={DoorOpen} danger onClick={() => leaveSpace(space)}>
                          Leave space
                        </MenuItem>
                      </Menu>
                    }
                  />
                ))}

              {tab === "explore" &&
                lists.explore?.map((space) => <SpaceCard key={space.id} space={space} detail={space.ownerUsername} />)}
            </div>
          )}
        </section>
      </main>

      {showCreate && (
        <CreateSpaceDialog
          isAdmin={me.role === "Admin"}
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
            setLists((prev) => ({
              ...prev,
              mine: prev.mine?.map((s) => (s.id === settingsFor.id ? { ...s, ...changes } : s)) ?? null,
            }));
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

      {confirmDialog}
    </div>
  );
}

function TabEmptyState({ tab, onCreate, onExplore }: { tab: Tab; onCreate: () => void; onExplore: () => void }) {
  if (tab === "mine") {
    return (
      <EmptyState
        icon={Sparkles}
        title="Make your first space"
        action={
          <Button onClick={onCreate}>
            <Plus className="size-4" />
            Create space
          </Button>
        }
      >
        Pick a map, arrange the furniture, and send your team the invite link.
      </EmptyState>
    );
  }
  if (tab === "joined") {
    return (
      <EmptyState
        icon={DoorOpen}
        title="No spaces joined yet"
        action={
          <Button variant="subtle" onClick={onExplore}>
            <Compass className="size-4" />
            Browse Explore
          </Button>
        }
      >
        Spaces you join through an invite link or from Explore show up here.
      </EmptyState>
    );
  }
  return (
    <EmptyState
      icon={Compass}
      title="Nothing to explore yet"
      action={
        <Link href="/dashboard" className="btn-subtle">
          Go to your spaces
        </Link>
      }
    >
      Public spaces show up here. Make one of yours public in its settings to list it.
    </EmptyState>
  );
}
