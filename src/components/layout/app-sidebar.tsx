"use client";

import {
  Bell,
  CalendarDays,
  ChevronDown,
  LayoutDashboard,
  Menu,
  Plug,
  Shield,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { filterNav, type NavItem } from "@/lib/rbac";
import { useAuth } from "@/contexts/auth-provider";

const iconMap = {
  LayoutDashboard,
  Users,
  CalendarDays,
  Bell,
  Plug,
  Shield,
} as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const items = useMemo(() => filterNav(user?.role ?? null), [user?.role]);

  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4 max-h-[calc(100vh-64px)]">
      {items.map((item) => (
        <NavGroup key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}

function NavGroup({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(true);
  const Icon = iconMap[item.icon as keyof typeof iconMap] ?? LayoutDashboard;
  const active =
    pathname === item.href ||
    (item.children?.some((c) => pathname.startsWith(c.href)) ?? false);

  if (!item.children?.length) {
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
          pathname === item.href
            ? "bg-ex-primary text-ex-bg dark:bg-ex-secondary dark:text-white"
            : "text-ex-muted hover:bg-ex-surface hover:text-ex-primary",
        )}
      >
        <Icon className="size-4 shrink-0 opacity-90" />
        {item.label}
      </Link>
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition",
          active
            ? "bg-ex-surface text-ex-primary"
            : "text-ex-muted hover:bg-ex-surface hover:text-ex-primary",
        )}
      >
        <span className="flex items-center gap-3">
          <Icon className="size-4 shrink-0" />
          {item.label}
        </span>
        <ChevronDown className={cn("size-4 transition", open ? "rotate-180" : "")} />
      </button>
      {open ? (
        <div className="ml-4 flex flex-col gap-0.5 border-l border-ex-border pl-3">
          {item.children.map((child) => {
            const childActive = pathname === child.href || pathname.startsWith(`${child.href}/`);
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                className={cn(
                  "rounded-md px-2 py-1.5 text-sm transition",
                  childActive
                    ? "bg-ex-secondary/15 font-medium text-ex-secondary"
                    : "text-ex-muted hover:bg-ex-surface hover:text-ex-primary",
                )}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function AppSidebar() {
  return (
    <aside className="hidden h-[calc(100vh)] w-64 shrink-0 flex-col border-r border-ex-border bg-ex-elevated lg:flex sticky top-0 bottom-0">
      <SidebarBrand />
      <NavLinks />
    </aside>
  );
}

export function MobileDrawer() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ButtonIcon onClick={() => setOpen(true)} label="Open menu">
        <Menu className="size-5" />
      </ButtonIcon>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ex-primary/40 backdrop-blur-sm"
            aria-label="Close menu backdrop"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 flex min-h-full w-[min(100%,20rem)] flex-col border-r border-ex-border bg-ex-elevated shadow-xl">
            <div className="flex items-center justify-between border-b border-ex-border px-3 py-3">
              <SidebarBrand compact />
              <ButtonIcon onClick={() => setOpen(false)} label="Close menu">
                <X className="size-5" />
              </ButtonIcon>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  );
}

function SidebarBrand({ compact }: { compact?: boolean }) {
  return (
    <Link
      href="/dashboard"
      className={cn(
        "flex items-center gap-3 border-b border-ex-border px-4 py-3",
        compact && "border-0 py-2",
      )}
    >
      <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-ex-bg ring-1 ring-ex-border">
        <Image
          src="https://exhibytesolution.com/wp-content/uploads/2023/06/cropped-Exhibyte_Logo_Black_Logo-removebg-preview-1.png"
          alt="Exhibyte Solutions"
          fill
          className="object-contain p-1 dark:invert dark:filter"
          sizes="40px"
          priority
        />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ex-primary">Exhibyte Solutions</p>
        <p className="truncate text-xs text-ex-muted">HRM Admin</p>
      </div>
    </Link>
  );
}

function ButtonIcon({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-ex-border bg-ex-elevated text-ex-primary shadow-sm hover:bg-ex-surface"
    >
      {children}
    </button>
  );
}
