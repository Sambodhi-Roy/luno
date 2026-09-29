import type { Visibility } from "@/lib/types";
import { Label } from "./ui";

const OPTIONS: { value: Visibility; title: string; description: string }[] = [
  { value: "Private", title: "Private", description: "Only people you send the invite link to can join." },
  { value: "Public", title: "Public", description: "Listed in Explore. Anyone signed in can join." },
];

export function VisibilityPicker({ value, onChange }: { value: Visibility; onChange: (value: Visibility) => void }) {
  return (
    <div>
      <Label>Who can join</Label>
      <div className="grid grid-cols-2 gap-3">
        {OPTIONS.map((option) => (
          <button
            type="button"
            key={option.value}
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className="option-tile p-3"
          >
            <p className="text-sm font-medium">{option.title}</p>
            <p className="text-xs text-copy-lighter">{option.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
