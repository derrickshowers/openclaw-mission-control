"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/react";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button isIconOnly variant="light" size="sm" className="text-foreground-400">
        <Sun size={18} strokeWidth={1.5} />
      </Button>
    );
  }

  const themes = [
    { key: "light", label: "Light", icon: Sun },
    { key: "dark", label: "Dark", icon: Moon },
    { key: "system", label: "System", icon: Monitor },
  ];

  const CurrentIcon = themes.find((t) => t.key === theme)?.icon || Monitor;

  return (
    <Dropdown placement="bottom-end" classNames={{ content: "min-w-[120px]" }}>
      <DropdownTrigger>
        <Button isIconOnly variant="light" size="sm" className="text-foreground-400 hover:text-foreground">
          <CurrentIcon size={18} strokeWidth={1.5} />
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Theme selection"
        selectedKeys={theme ? [theme] : []}
        selectionMode="single"
        onSelectionChange={(keys) => setTheme(Array.from(keys)[0] as string)}
      >
        {themes.map(({ key, label, icon: Icon }) => (
          <DropdownItem
            key={key}
            startContent={<Icon size={16} strokeWidth={1.5} />}
            className="text-xs"
          >
            {label}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}
