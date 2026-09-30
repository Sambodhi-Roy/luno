"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LayoutGrid, LogOut, Shield, Shirt } from "lucide-react";
import type { ReactNode } from "react";
import { api } from "@/lib/api";
import type { Me } from "@/lib/types";
import { AvatarBadge } from "./AvatarSprite";
import { Logo } from "./Logo";
import { Menu, MenuItem, MenuSeparator } from "./ui";

const NAV = [
  { href: "/dashboard", label: "Spaces", icon: LayoutGrid, adminOnly: false },
  { href: "/admin", label: "Admin", icon: Shield, adminOnly: true },
];

/**
 * Top bar for the signed-in pages (dashboard, admin): logo, section links, page actions, and the account menu.
 * `onChangeAvatar` adds a "Change avatar" item to the menu.
 */
export function AppHeader({ me, actions, onChangeAvatar }: { me: Me; actions?: ReactNode; onChangeAvatar?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const links = NAV.filter((item) => !item.adminOnly || me.role === "Admin");

  async function signOut() {
    await api("/user/signout", { method: "POST" }).catch(() => {});
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-foreground">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Logo href="/dashboard" />

        {links.length > 1 && (
          <nav className="hidden items-center gap-1 sm:flex">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={pathname === href ? "page" : undefined}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                  pathname === href ? "bg-raised text-copy" : "text-copy-lighter hover:text-copy"
                }`}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-3">
          {actions}
          <Menu
            label="Account menu"
            trigger={
              <span className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 transition-colors hover:bg-raised">
                <AvatarBadge imageUrl={me.avatar?.imageUrl ?? null} />
                <span className="hidden max-w-32 truncate text-sm font-semibold sm:inline">{me.username}</span>
                <ChevronDown className="size-4 text-copy-lighter" />
              </span>
            }
          >
            <div className="px-3 py-2">
              <p className="truncate text-sm font-semibold">{me.username}</p>
              <p className="text-xs text-copy-lighter">{me.role === "Admin" ? "Admin" : "Member"}</p>
            </div>
            <MenuSeparator />
            {onChangeAvatar && (
              <MenuItem icon={Shirt} onClick={onChangeAvatar}>
                Change avatar
              </MenuItem>
            )}
            {/* Section links live here on phones, where the nav is hidden */}
            {links.length > 1 &&
              links.map(({ href, label, icon }) => (
                <MenuItem key={href} icon={icon} className="sm:hidden" onClick={() => router.push(href)}>
                  {label}
                </MenuItem>
              ))}
            <MenuSeparator />
            <MenuItem icon={LogOut} onClick={signOut}>
              Sign out
            </MenuItem>
          </Menu>
        </div>
      </div>
    </header>
  );
}
