"use client";

import Link from "next/link";
import { Bell, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/auth-provider";
import { useNotificationsOptional } from "@/contexts/notifications-provider";
import { PunchInStatusFlag } from "@/components/attendance/punch-in-status-flag";
import { UnreadBadge } from "@/components/notifications/unread-badge";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileDrawer } from "@/components/layout/app-sidebar";
import { Button } from "@/components/ui/button";
import { ROLES } from "@/app/consts/common";

const roleLabel: Record<string, string> = {
  [ROLES.SUPER_ADMIN]: "Super Administrator",
  [ROLES.HR_MANAGER]: "HR Manager",
  [ROLES.EMPLOYEE]: "Employee",
};

export function AppHeader() {
  const { user, logout } = useAuth();
  const notifications = useNotificationsOptional();
  const unreadCount = notifications?.unreadCount ?? 0;

  return (
    <header className="border-ex-border bg-ex-elevated/90 sticky top-0 z-40 flex h-16 items-center gap-3 border-b px-4 backdrop-blur-md lg:px-6">
      <div className="flex items-center gap-2 lg:hidden">
        <MobileDrawer />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/notifications"
          className="border-ex-border bg-ex-elevated text-ex-primary hover:bg-ex-surface relative inline-flex h-10 w-10 items-center justify-center rounded-lg border shadow-sm transition"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        >
          <Bell className="size-4" />
          {unreadCount > 0 ? (
            <span className="absolute -top-1 -right-1">
              <UnreadBadge count={unreadCount} />
            </span>
          ) : null}
        </Link>
        <PunchInStatusFlag />
        <ThemeToggle />

        <div className="hidden text-right sm:block">
          <p className="text-ex-primary text-sm leading-tight font-medium">{user?.name}</p>
          <p className="text-ex-muted text-xs capitalize">
            {user?.department?.split("_").join(" ")}
          </p>
        </div>
        <Badge variant="accent" className="hidden capitalize sm:inline-flex">
          {user?.role ? (roleLabel[user.role] ?? user.role) : ""}
        </Badge>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => void logout()}>
          <LogOut className="size-4" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
