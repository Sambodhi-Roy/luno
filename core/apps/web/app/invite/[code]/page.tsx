"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, ErrorText } from "@/components/ui";
import { api } from "@/lib/api";
import type { InvitePreview } from "@/lib/types";
import { useMe } from "@/lib/useMe";

// Landing page for a shared invite link. Signed-out visitors are sent to log in and brought back here.
export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { me } = useMe();
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!me) return;
    api<InvitePreview>(`/space/invite/${code}`).then(setInvite, (e) =>
      setError(e instanceof Error ? e.message : "Could not load this invite")
    );
  }, [me, code]);

  async function join() {
    setJoining(true);
    setError(null);
    try {
      const res = await api<{ spaceId: string }>(`/space/invite/${code}`, { method: "POST" });
      router.push(`/space/${res.spaceId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join this space");
      setJoining(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm space-y-4 p-8">
        <Link href="/dashboard" className="text-sm font-semibold text-primary">
          luno
        </Link>

        {!invite && !error && <p className="text-copy-lighter">Loading invite…</p>}

        {invite && (
          <>
            {invite.thumbnail && (
              // eslint-disable-next-line @next/next/no-img-element -- pixel-art thumbnail served from /public
              <img src={invite.thumbnail} alt="" className="pixelated aspect-video w-full rounded-xl object-cover" />
            )}
            <div>
              <p className="text-sm text-copy-lighter">
                {invite.isOwner ? "This is your space" : `${invite.ownerUsername} invited you to`}
              </p>
              <h1 className="text-2xl font-semibold">{invite.name}</h1>
            </div>
            {invite.isOwner ? (
              <Link href={`/space/${invite.spaceId}`} className="btn-primary block text-center">
                Enter space
              </Link>
            ) : (
              <Button onClick={join} disabled={joining} className="w-full">
                {joining ? "Joining…" : "Join space"}
              </Button>
            )}
          </>
        )}

        <ErrorText>{error}</ErrorText>
        {error && !invite && (
          <Link href="/dashboard" className="text-sm text-primary hover:underline">
            Back to dashboard
          </Link>
        )}
      </div>
    </main>
  );
}
