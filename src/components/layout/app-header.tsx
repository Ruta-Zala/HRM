"use client";

import { LogOut, Search } from "lucide-react";
import { useAuth } from "@/contexts/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileDrawer } from "@/components/layout/app-sidebar";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";


const roleLabel: Record<string, string> = {
  super_admin: "Super Admin",
  hr: "HR",
  employee: "Employee",
};

export function AppHeader() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-ex-border bg-ex-elevated/90 px-4 backdrop-blur-md lg:px-6">
      <div className="flex items-center gap-2 lg:hidden">
        <MobileDrawer />
      </div>
      {/* <div className="relative hidden max-w-md flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ex-muted" />
        <Input placeholder="Search people, leave, tasks…" className="pl-9" />
      </div> */}
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />

        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium leading-tight text-ex-primary">{user?.name}</p>
          <p className="text-xs text-ex-muted">{user?.department}</p>
        </div>
        <Badge variant="accent" className="hidden capitalize sm:inline-flex">
          {user?.role ? roleLabel[user.role] ?? user.role : ""}
        </Badge>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => void logout()}>
          <LogOut className="size-4" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
