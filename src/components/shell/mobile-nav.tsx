"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  Activity,
  FolderKanban,
  Menu,
  Users,
  Brain,
  BookOpen,
  CalendarDays,
  Inbox,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const primaryItems: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/", label: "Today", Icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", Icon: Inbox },
  { href: "/tasks", label: "Team", Icon: CheckSquare },
];

const moreItems: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/activity", label: "Activity", Icon: Activity },
  { href: "/projects", label: "Projects", Icon: FolderKanban },
  { href: "/team", label: "Agents", Icon: Users },
  { href: "/memory", label: "Memory", Icon: Brain },
  { href: "/calendar", label: "Calendar", Icon: CalendarDays },
  { href: "/docs", label: "Docs", Icon: BookOpen },
];

export function MobileNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Check if current page is in the "more" section
  const isMoreActive = moreItems.some((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
  );

  return (
    <>
      {/* Bottom Sheet Overlay */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 dark:bg-black/60"
            onClick={() => setMenuOpen(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-lg border-t border-divider bg-white dark:bg-[#121212] pb-safe shadow-2xl">
            {/* Handle */}
            <div className="flex justify-center py-2">
              <div className="h-1 w-8 rounded-full bg-foreground-200 dark:bg-[#333333]" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-2">
              <span className="text-xs font-medium text-foreground-400 uppercase tracking-wider">
                More
              </span>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <button
                  onClick={() => setMenuOpen(false)}
                  className="text-foreground-400 hover:text-foreground p-1"
                >
                  <X size={16} strokeWidth={1.5} />
                </button>
              </div>
            </div>

            {/* Menu Items */}
            <nav className="px-2 pb-4">
              {moreItems.map(({ href, label, Icon }) => {
                const isActive =
                  href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(href);

                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors ${
                      isActive
                        ? "bg-gray-100 dark:bg-[#1A1A1A] text-foreground dark:text-white"
                        : "text-foreground-600 dark:text-[#CCCCCC] hover:bg-gray-100 dark:hover:bg-[#1A1A1A]"
                    }`}
                  >
                    <Icon size={18} strokeWidth={1.5} className="flex-shrink-0" />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </>
      )}

      {/* Bottom Nav Bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-divider bg-white dark:bg-[#080808] pb-safe shadow-[0_-1px_10px_rgba(0,0,0,0.05)] dark:shadow-none">
        <div className="flex items-center justify-around py-1.5">
          {primaryItems.map(({ href, label, Icon }) => {
            const isActive =
              href === "/"
                ? pathname === "/"
                : pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] ${
                  isActive ? "text-foreground dark:text-white" : "text-foreground-400"
                }`}
              >
                <Icon size={20} strokeWidth={1.5} />
                {label}
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setMenuOpen(true)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] ${
              isMoreActive || menuOpen ? "text-foreground dark:text-white" : "text-foreground-400"
            }`}
          >
            <Menu size={20} strokeWidth={1.5} />
            More
          </button>
        </div>
      </nav>
    </>
  );
}
