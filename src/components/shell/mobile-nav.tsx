"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  Activity,
  Menu,
  Users,
  Brain,
  BookOpen,
  CalendarDays,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const primaryItems: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/", label: "Home", Icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", Icon: CheckSquare },
  { href: "/activity", label: "Activity", Icon: Activity },
];

const moreItems: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/team", label: "Team", Icon: Users },
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
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setMenuOpen(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-[#333333] bg-[#121212] pb-safe">
            {/* Handle */}
            <div className="flex justify-center py-2">
              <div className="h-1 w-8 rounded-full bg-[#333333]" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-2">
              <span className="text-xs font-medium text-[#888888] uppercase tracking-wider">
                More
              </span>
              <button
                onClick={() => setMenuOpen(false)}
                className="text-[#888888] hover:text-white p-1"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
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
                        ? "bg-[#1A1A1A] text-white"
                        : "text-[#CCCCCC] hover:bg-[#1A1A1A]"
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
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#222222] bg-[#080808] pb-safe">
        <div className="flex items-center justify-around py-2">
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
                  isActive ? "text-white" : "text-[#888888]"
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
              isMoreActive || menuOpen ? "text-white" : "text-[#888888]"
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
