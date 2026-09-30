"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowRight, LinkIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { DashboardLink, MeFallback } from "@/components/PageStates";
import { VisibilityBadge } from "@/components/VisibilityPicker";
import { Button, ErrorText, FullPageState } from "@/components/ui";
import { Logo } from "@/components/Logo";
import { api, ApiError, friendlyError } from "@/lib/api";
import type { InvitePreview } from "@/lib/types";
import { useMe } from "@/lib/useMe";

// Landing page for a shared invite link. Signed-out visitors are sent to log in and brought back here.
export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { me, status, error: meError, retry } = useMe();
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!me) return;
    api<InvitePreview>(`/space/invite/${code}`).then(setInvite, (e) =>
      setLoadError(
        e instanceof ApiError && e.status === 404
          ? "This invite link doesn't work any more. It may have been reset by the space's owner. Ask them for a new one."
          : friendlyError(e)
      )
    );
  }, [me, code]);

  async function join() {
    setJoining(true);
    setJoinError(null);
    try {
      const res = await api<{ spaceId: string }>(`/space/invite/${code}`, { method: "POST" });
      router.push(`/space/${res.spaceId}`);
    } catch (e) {
      setJoinError(friendlyError(e, "Could not join this space"));
      setJoining(false);
    }
  }

  if (!me) return <MeFallback status={status} error={meError} retry={retry} />;

  if (loadError) {
    return (
      <FullPageState icon={LinkIcon} title="Invite link not found" actions={<DashboardLink />}>
        {loadError}
      </FullPageState>
    );
  }

  if (!invite) return <FullPageState>Opening your invite…</FullPageState>;

  // The owner and existing members go straight in; everyone else joins first
  const hasAccess = invite.isOwner || invite.isMember;

  return (
    <main className="bg-dots flex min-h-screen flex-col items-center justify-center gap-8 p-4">
      <Logo href="/dashboard" />
      <div className="card w-full max-w-md overflow-hidden">
        <div className="relative">
          {invite.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element -- pixel-art thumbnail served from /public
            <img src={invite.thumbnail} alt="" className="pixelated aspect-video w-full object-cover" />
          ) : (
            <div className="thumb-fallback aspect-video w-full" />
          )}
          <div className="absolute top-3 left-3">
            <VisibilityBadge visibility={invite.visibility} />
          </div>
        </div>
        <div className="space-y-5 p-6 sm:p-8">
          <div>
            <p className="text-sm text-copy-lighter">
              {invite.isOwner ? (
                "This is your space"
              ) : (
                <>
                  <span className="font-semibold text-copy">{invite.ownerUsername}</span> invited you to
                </>
              )}
            </p>
            <h1 className="heading-display mt-1 text-3xl">{invite.name}</h1>
            {invite.isMember && <p className="mt-1 text-sm text-copy-lighter">You&apos;re already a member.</p>}
          </div>
          {hasAccess ? (
            <Button onClick={() => router.push(`/space/${invite.spaceId}`)} className="btn-lg w-full">
              Enter space
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button onClick={join} busy={joining} className="btn-lg w-full">
              Join {invite.name}
            </Button>
          )}
          <ErrorText>{joinError}</ErrorText>
          <p className="text-center text-xs text-copy-lighter">
            Signed in as <span className="font-semibold text-copy-light">{me.username}</span>
          </p>
        </div>
      </div>
    </main>
  );
}
