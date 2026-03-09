"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { LayoutDashboard, CheckSquare, Users, Brain, Activity, Umbrella, BookOpen } from "lucide-react";
import { Avatar, Skeleton } from "@heroui/react";
import type { LucideIcon } from "lucide-react";

const navItems: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", Icon: CheckSquare },
  { href: "/team", label: "Team", Icon: Users },
  { href: "/memory", label: "Memory", Icon: Brain },
  { href: "/docs", label: "Docs", Icon: BookOpen },
  { href: "/activity", label: "Activity", Icon: Activity },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const userName = session?.user?.name || "User";
  const userImage = session?.user?.image || undefined;

  return (
    <aside className="flex h-screen w-sidebar flex-col border-r border-[#222222] bg-[#080808]">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-[#222222] px-4">
        <span className="flex items-center gap-2">
          <Umbrella size={16} strokeWidth={1.5} />
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-wide">RAINCHECK</span>
            <span className="text-[10px] text-[#888888] tracking-wider">MISSION CONTROL</span>
          </span>
        </span>
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
                      ? "bg-[#1A1A1A] text-white"
                      : "text-[#888888] hover:bg-[#121212] hover:text-white"
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
      <div className="border-t border-[#222222] px-4 py-3">
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
            />
            <span className="text-xs text-[#888888]">{userName}</span>
          </div>
        )}
      </div>
    </aside>
  );
}
