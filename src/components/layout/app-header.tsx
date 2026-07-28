"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bell, LogOut, User } from "lucide-react";
import { useAuth } from "@/contexts/auth-provider";
import { useNotificationsOptional } from "@/contexts/notifications-provider";
import { PunchInStatusFlag } from "@/components/attendance/punch-in-status-flag";
import { UnreadBadge } from "@/components/notifications/unread-badge";
import { Badge } from "@/components/ui/badge";
import { MobileDrawer } from "@/components/layout/app-sidebar";
import { Button } from "@/components/ui/button";
import { ROLES } from "@/app/consts/common";
import { resolveProfileImageSrc, sheetRowToForm } from "@/lib/employee";

const roleLabel: Record<string, string> = {
  [ROLES.SUPER_ADMIN]: "Super Administrator",
  [ROLES.HR_MANAGER]: "HR Manager",
  [ROLES.EMPLOYEE]: "Employee",
};

function HeaderProfileAvatar({ userName }: { userName?: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch("/api/employee/me", { credentials: "include", cache: "no-store" });
        const data = (await res.json()) as {
          success?: boolean;
          headers?: string[];
          row?: string[];
        };
        if (cancelled || !data.success || !data.headers || !data.row) return;

        const form = sheetRowToForm(data.headers, data.row);
        if (!cancelled) setSrc(resolveProfileImageSrc(form.profileImage));
      } catch {
        if (!cancelled) setSrc(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Link
      href="/employee/profile"
      className="border-ex-border bg-ex-elevated hover:bg-ex-surface relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border shadow-sm transition"
      aria-label={userName ? `${userName} profile` : "Your profile"}
      title="Your profile"
    >
      {src ? (
        <Image
          src={src}
          alt={userName ? `${userName} profile` : "Profile"}
          width={40}
          height={40}
          unoptimized
          className="size-full object-cover"
        />
      ) : (
        <User className="text-ex-muted size-5" />
      )}
    </Link>
  );
}

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
        <HeaderProfileAvatar userName={user?.name} />

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
