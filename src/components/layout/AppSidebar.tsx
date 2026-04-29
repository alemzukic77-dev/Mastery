"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FileCheck2,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/firebase/auth";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "sidebar:collapsed";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Upload", icon: Upload },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen flex-col border-r bg-background transition-[width] duration-200 md:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <SidebarHeader collapsed={collapsed} onCollapse={() => setCollapsed(true)} />

      {collapsed && (
        <div className="flex justify-center py-2">
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </div>
      )}

      <SidebarNav collapsed={collapsed} />

      <SidebarFooter collapsed={collapsed} />
    </aside>
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <SidebarHeader collapsed={false} />
      <SidebarNav collapsed={false} onNavigate={onNavigate} />
      <SidebarFooter collapsed={false} />
    </div>
  );
}

function SidebarHeader({
  collapsed,
  onCollapse,
}: {
  collapsed: boolean;
  onCollapse?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex h-16 items-center border-b",
        collapsed ? "justify-center px-0" : "justify-between px-4",
      )}
    >
      <Link
        href="/dashboard"
        className="flex items-center gap-2 font-semibold"
        title="Mastery"
      >
        <FileCheck2 className="h-5 w-5 shrink-0" />
        {!collapsed && <span>Mastery</span>}
      </Link>
      {!collapsed && onCollapse && (
        <button
          type="button"
          onClick={onCollapse}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          title="Collapse sidebar"
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function SidebarNav({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav
      className={cn(
        "flex flex-col gap-1 py-3",
        collapsed ? "px-2" : "px-3",
      )}
    >
      {links.map((link) => {
        const Icon = link.icon;
        const active = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            title={collapsed ? link.label : undefined}
            className={cn(
              "inline-flex items-center rounded-md text-sm font-medium transition-colors",
              collapsed
                ? "h-10 w-10 justify-center self-center"
                : "gap-2 px-3 py-2",
              active
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{link.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter({ collapsed }: { collapsed: boolean }) {
  const router = useRouter();
  const { user } = useAuth();

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <div
      className={cn(
        "mt-auto border-t",
        collapsed ? "flex justify-center px-2 py-3" : "px-3 py-3",
      )}
    >
      {collapsed ? (
        <Button
          onClick={handleSignOut}
          variant="outline"
          size="icon"
          title={user?.email ? `Sign out (${user.email})` : "Sign out"}
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          {user && (
            <div className="flex items-center gap-2">
              {user.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.photoURL}
                  alt=""
                  className="h-7 w-7 shrink-0 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {(user.displayName ?? user.email ?? "?")
                    .charAt(0)
                    .toUpperCase()}
                </div>
              )}
              <div className="flex min-w-0 flex-col">
                <span
                  className="truncate text-xs font-medium"
                  title={user.displayName ?? user.email ?? ""}
                >
                  {user.displayName ?? user.email}
                </span>
                {user.displayName && user.email ? (
                  <span
                    className="truncate text-[10px] text-muted-foreground"
                    title={user.email}
                  >
                    {user.email}
                  </span>
                ) : null}
              </div>
            </div>
          )}
          <Button onClick={handleSignOut} variant="outline" size="sm">
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      )}
    </div>
  );
}
