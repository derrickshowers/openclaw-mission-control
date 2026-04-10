"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { LayoutDashboard, CheckSquare, FolderKanban, Users, Brain, Activity, Umbrella, BookOpen, CalendarDays, Inbox } from "lucide-react";
import { Avatar, Skeleton } from "@heroui/react";
import type { LucideIcon } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const navItems: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/", label: "Today", Icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", Icon: Inbox },
  { href: "/projects", label: "Projects", Icon: FolderKanban },
  { href: "/tasks", label: "Team", Icon: CheckSquare },
  { href: "/team", label: "Agents", Icon: Users },
  { href: "/memory", label: "Memory", Icon: Brain },
  { href: "/calendar", label: "Calendar", Icon: CalendarDays },
  { href: "/docs", label: "Docs", Icon: BookOpen },
  { href: "/activity", label: "Activity", Icon: Activity },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const userName = session?.user?.name || "User";
  const userImage = session?.user?.image || undefined;

  return (
    <aside className="m-3 flex h-[calc(100vh-1.5rem)] w-sidebar flex-col rounded-2xl border border-divider bg-content1/50 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
      {/* Logo */}
      <div className="flex h-14 items-center justify-between border-b border-divider px-4">
        <span className="flex items-center gap-2">
          <Umbrella size={16} strokeWidth={1.5} />
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-wide">RAINCHECK</span>
            <span className="text-[10px] text-foreground-400 tracking-wider">MISSION CONTROL</span>
          </span>
        </span>
        <ThemeToggle />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3">
        <ul className="space-y-0.5">
          {navItems.map(({ href, label, Icon }) => {
            const isActive =
              href === "/"
                ? pathname === "/"
                : pathname.startsWith(href);

            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-default-100 text-foreground"
                      : "text-foreground-400 hover:bg-default-50 hover:text-foreground"
                  }`}
                >
                  <Icon size={20} strokeWidth={1.5} className="flex-shrink-0" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer - Dynamic User */}
      <div className="border-t border-divider px-4 py-3">
        {status === "loading" ? (
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-3 w-20 rounded" />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Avatar
              src={userImage}
              name={userName}
              size="sm"
              className="h-6 w-6 text-[10px]"
              classNames={{
                base: "bg-gray-100 dark:bg-[#1A1A1A]",
                name: "text-gray-600 dark:text-[#CCCCCC]"
              }}
            />
            <span className="text-xs text-foreground-400">{userName}</span>
          </div>
        )}
      </div>
    </aside>
  );
}
