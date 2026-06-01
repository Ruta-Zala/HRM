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
import { filterNav, isNavChildActive, isNavGroupActive, type NavItem } from "@/lib/rbac";
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
    <nav className="flex max-h-[calc(100vh-64px)] flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
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
  const active = isNavGroupActive(pathname, item);

  if (!item.children?.length) {
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
          pathname === item.href
            ? "bg-ex-secondary text-white shadow-sm"
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
        <div className="border-ex-border ml-4 flex flex-col gap-0.5 border-l pl-3">
          {item.children.map((child) => {
            const childActive = isNavChildActive(pathname, child.href, item.href);
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                className={cn(
                  "rounded-md px-2 py-1.5 text-sm transition",
                  childActive
                    ? "bg-ex-secondary/12 text-ex-secondary font-medium"
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
    <aside className="border-ex-border bg-ex-elevated sticky top-0 bottom-0 hidden h-[calc(100vh)] w-64 shrink-0 flex-col border-r lg:flex">
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
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            aria-label="Close menu backdrop"
            onClick={() => setOpen(false)}
          />
          <div className="border-ex-border bg-ex-elevated absolute top-0 left-0 flex min-h-full w-[min(100%,20rem)] flex-col border-r shadow-xl">
            <div className="border-ex-border flex items-center justify-between border-b px-3 py-3">
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
        "border-ex-border flex items-center gap-3 border-b px-4 py-3",
        compact && "border-0 py-2",
      )}
    >
      <div className="bg-ex-bg ring-ex-border relative size-10 shrink-0 overflow-hidden rounded-lg ring-1">
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
        <p className="text-ex-primary truncate text-sm font-semibold">Exhibyte Solutions</p>
        <p className="text-ex-muted truncate text-xs">HRM Admin</p>
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
      className="border-ex-border bg-ex-elevated text-ex-primary hover:bg-ex-surface inline-flex h-10 w-10 items-center justify-center rounded-lg border shadow-sm"
    >
      {children}
    </button>
  );
}
