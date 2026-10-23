"use client";

import { ChevronDown, Send } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import type { ChatEntry, ChatScope } from "@repo/protocol";
import { CHAT_MAX_LENGTH, CHAT_RADIUS } from "@repo/protocol/rules";
import { Button, IconButton } from "../ui";

const TABS: { scope: ChatScope; label: string }[] = [
  { scope: "nearby", label: "Nearby" },
  { scope: "space", label: "Everyone" },
];

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

/**
 * Chat over the game, bottom left: Nearby (people within CHAT_RADIUS tiles, never saved) and Everyone (the whole
 * space, saved for a while). Opened and closed from the dock's chat button, which shows the unread count.
 */
export function ChatPanel({
  open,
  onOpenChange,
  messages,
  hasOlder,
  loadingOlder,
  onLoadOlder,
  nearbyCount,
  meId,
  inputRef,
  onSend,
  onTypingChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: Record<ChatScope, ChatEntry[]>;
  // Everyone tab: whether older saved messages can be loaded
  hasOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  nearbyCount: number;
  meId: string;
  inputRef: RefObject<HTMLInputElement | null>;
  // Resolves false when the message couldn't be sent (not connected)
  onSend: (text: string, scope: ChatScope) => boolean;
  // The text box got or lost focus: the game stops reading the keyboard while you type
  onTypingChange: (typing: boolean) => void;
}) {
  const [scope, setScope] = useState<ChatScope>("nearby");
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLOListElement>(null);
  const shown = messages[scope];
  const newest = shown.at(-1)?.id;

  // Follow new messages, unless an older page was just added at the top
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [newest, scope, open]);

  // Stays mounted while closed, so a half-typed message survives
  if (!open) return null;

  function submit(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    if (onSend(text, scope)) setDraft("");
  }

  return (
    <section aria-label="Chat" className="float-panel pointer-events-auto flex h-80 w-80 max-w-full flex-col overflow-hidden">
      <header className="flex items-center gap-4 border-b border-border px-4 pt-2">
        <div role="tablist" aria-label="Who hears you" className="flex flex-1 gap-4">
          {TABS.map((t) => (
            <button
              key={t.scope}
              role="tab"
              aria-selected={scope === t.scope}
              onClick={() => setScope(t.scope)}
              className="tab"
            >
              {t.label}
            </button>
          ))}
        </div>
        <IconButton icon={ChevronDown} label="Hide chat" onClick={() => onOpenChange(false)} className="mb-1" />
      </header>

      <ol ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-3" aria-live="polite">
        {scope === "space" && hasOlder && (
          <li className="flex justify-center">
            <Button variant="ghost" busy={loadingOlder} onClick={onLoadOlder} className="btn-sm">
              Load earlier messages
            </Button>
          </li>
        )}
        {shown.length === 0 && (
          <li className="py-6 text-center text-sm text-copy-lighter">
            {scope === "nearby"
              ? `Walk up to someone and say hi. Only people within ${CHAT_RADIUS} tiles see these, and they aren't saved.`
              : "Messages here reach everyone in the space."}
          </li>
        )}
        {shown.map((m) => (
          <li key={m.id} className="text-sm leading-snug break-words">
            <span className={`font-semibold ${m.userId === meId ? "text-primary-light" : "text-copy"}`}>
              {m.username}
            </span>{" "}
            <time dateTime={m.at} className="text-xs text-copy-lighter">
              {timeFormat.format(new Date(m.at))}
            </time>
            <p className="text-copy-light">{m.text}</p>
          </li>
        ))}
      </ol>

      <form onSubmit={submit} className="border-t border-border p-2">
        {scope === "nearby" && (
          <p className="px-1 pb-1.5 text-xs text-copy-lighter">
            {nearbyCount === 0
              ? "Nobody is close enough to hear you"
              : `${nearbyCount} ${nearbyCount === 1 ? "person" : "people"} can hear you`}
          </p>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => onTypingChange(true)}
            onBlur={() => onTypingChange(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") e.currentTarget.blur();
            }}
            maxLength={CHAT_MAX_LENGTH}
            placeholder={scope === "nearby" ? "Message people nearby" : "Message everyone"}
            aria-label="Message"
            className="field"
          />
          <IconButton icon={Send} label="Send" type="submit" disabled={!draft.trim()} className="shrink-0" />
        </div>
      </form>
    </section>
  );
}
