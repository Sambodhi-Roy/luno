import { Globe, Lock, type LucideIcon } from "lucide-react";
import type { Visibility } from "@/lib/types";
import { Label } from "./ui";

const OPTIONS: { value: Visibility; icon: LucideIcon; title: string; description: string }[] = [
  { value: "Private", icon: Lock, title: "Private", description: "Only people with the invite link can join." },
  { value: "Public", icon: Globe, title: "Public", description: "Listed in Explore. Anyone signed in can join." },
];

export function VisibilityPicker({ value, onChange }: { value: Visibility; onChange: (value: Visibility) => void }) {
  return (
    <div>
      <Label>Who can join</Label>
      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map(({ value: option, icon: Icon, title, description }) => (
          <button
            type="button"
            key={option}
            onClick={() => onChange(option)}
            aria-pressed={value === option}
            className="option-tile flex gap-3 p-3"
          >
            <Icon className="mt-0.5 size-4 shrink-0 text-primary-light" />
            <span>
              <span className="block text-sm font-semibold">{title}</span>
              <span className="block text-xs text-copy-lighter">{description}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Lock / globe tag for a space's visibility. */
export function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  const Icon = visibility === "Private" ? Lock : Globe;
  return (
    <span className="badge-overlay">
      <Icon className="size-3" />
      {visibility}
    </span>
  );
}
