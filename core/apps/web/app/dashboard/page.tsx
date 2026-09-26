"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AvatarPicker } from "@/components/AvatarPicker";
import { AvatarSprite } from "@/components/AvatarSprite";
import { CreateSpaceDialog } from "@/components/CreateSpaceDialog";
import { Button, ErrorText } from "@/components/ui";
import { api } from "@/lib/api";
import type { SpaceSummary } from "@/lib/types";
import { useMe } from "@/lib/useMe";

export default function DashboardPage() {
  const router = useRouter();
  const { me, refresh: refreshMe } = useMe();
  const [spaces, setSpaces] = useState<SpaceSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAvatar, setShowAvatar] = useState(false);

  const signedIn = me !== null;

  useEffect(() => {
    if (!signedIn) return;
    api<{ spaces: SpaceSummary[] }>("/space/all")
      .then((res) => setSpaces(res.spaces))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load spaces"));
  }, [signedIn]);

  async function signOut() {
    await api("/user/signout", { method: "POST" }).catch(() => {});
    router.replace("/login");
  }

  async function deleteSpace(space: SpaceSummary) {
    if (!confirm(`Delete "${space.name}"? This can't be undone.`)) return;
    try {
      await api(`/space/${space.id}`, { method: "DELETE" });
      setSpaces((prev) => prev?.filter((s) => s.id !== space.id) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete space");
    }
  }

  if (!me) {
    return <main className="flex min-h-screen items-center justify-center text-copy-lighter">Loading…</main>;
  }

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
          <Button variant="ghost" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </header>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your spaces</h1>
        <Button onClick={() => setShowCreate(true)}>+ Create space</Button>
      </div>

      <ErrorText>{error}</ErrorText>

      {spaces === null && !error && <p className="text-copy-lighter">Loading spaces…</p>}

      {spaces?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-copy-lighter">
          You don&apos;t have any spaces yet. Create one to get started.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {spaces?.map((space) => (
          <div key={space.id} className="card overflow-hidden">
            <Link href={`/space/${space.id}`} className="block aspect-video bg-background">
              {space.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element -- pixel-art thumbnail served from /public
                <img
                  src={space.thumbnail}
                  alt=""
                  className="pixelated h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-copy-lighter">Empty space</div>
              )}
            </Link>
            <div className="flex items-center justify-between gap-2 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{space.name}</p>
                <p className="text-xs text-copy-lighter">{space.dimensions} tiles</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="danger" onClick={() => deleteSpace(space)} className="px-3">
                  Delete
                </Button>
                <Link
                  href={`/space/${space.id}`}
                  className="btn-primary px-3"
                >
                  Enter
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <CreateSpaceDialog
          onClose={() => setShowCreate(false)}
          onCreated={(spaceId) => router.push(`/space/${spaceId}`)}
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
