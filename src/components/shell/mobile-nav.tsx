"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CheckSquare, Activity, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const navItems: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/", label: "Home", Icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", Icon: CheckSquare },
  { href: "/activity", label: "Activity", Icon: Activity },
  { href: "/team", label: "Team", Icon: Users },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#222222] bg-[#080808]">
      <div className="flex items-center justify-around py-2">
        {navItems.map(({ href, label, Icon }) => {
          const isActive =
            href === "/"
              ? pathname === "/"
              : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs ${
                isActive ? "text-white" : "text-[#888888]"
              }`}
            >
              <Icon size={20} strokeWidth={1.5} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
