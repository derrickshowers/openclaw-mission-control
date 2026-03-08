"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard", icon: "◆" },
  { href: "/tasks", label: "Tasks", icon: "☐" },
  { href: "/team", label: "Team", icon: "◎" },
  { href: "/memory", label: "Memory", icon: "◈" },
  { href: "/activity", label: "Activity", icon: "◉" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-sidebar flex-col border-r border-[#222222] bg-[#080808]">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-[#222222] px-4">
        <span className="text-sm font-semibold tracking-wide">
          ☔ MISSION CONTROL
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-[#1A1A1A] text-white"
                      : "text-[#888888] hover:bg-[#121212] hover:text-white"
                  }`}
                >
                  <span className="w-4 text-center text-xs">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-[#222222] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-[#222222]" />
          <span className="text-xs text-[#888888]">Derrick Showers</span>
        </div>
      </div>
    </aside>
  );
}
