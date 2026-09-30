import Link from "next/link";

/** The moon mark on its own (same drawing as app/icon.svg). */
export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={className}>
      <rect width="64" height="64" rx="16" className="fill-primary" />
      <path d="M40.5 14a19 19 0 1 0 9.5 31.4A16 16 0 0 1 40.5 14Z" className="fill-primary-content" />
      <circle cx="46" cy="20" r="3" className="fill-primary-content" />
    </svg>
  );
}

/** Mark plus wordmark. Pass `href` to make it a link (usually home or the dashboard). */
export function Logo({ href }: { href?: string }) {
  const content = (
    <span className="flex items-center gap-2">
      <LogoMark />
      <span className="heading-display text-xl">luno</span>
    </span>
  );
  return href ? (
    <Link href={href} aria-label="Luno home" className="rounded-lg">
      {content}
    </Link>
  ) : (
    content
  );
}
