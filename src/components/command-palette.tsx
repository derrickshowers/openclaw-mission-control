"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Modal,
  ModalContent,
  ModalBody,
  Listbox,
  ListboxItem,
  Kbd,
} from "@heroui/react";
import {
  Search,
  LayoutDashboard,
  CheckSquare,
  Activity,
  FolderKanban,
  Users,
  Brain,
  BookOpen,
  BarChart3,
  Plus,
} from "lucide-react";

const items = [
  { id: "dashboard", label: "Today", href: "/", icon: LayoutDashboard },
  { id: "projects", label: "Projects", href: "/projects", icon: FolderKanban },
  { id: "tasks", label: "Team", href: "/tasks", icon: CheckSquare },
  { id: "team", label: "Agents", href: "/team", icon: Users },
  { id: "memory", label: "Memory", href: "/memory", icon: Brain },
  { id: "time-logging", label: "Time Logging", href: "/time", icon: BarChart3 },
  { id: "docs", label: "Docs", href: "/docs", icon: BookOpen },
  { id: "activity", label: "Activity", href: "/activity", icon: Activity },
  { id: "create-task", label: "Create Task", href: "/tasks?action=new", icon: Plus },
];

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filteredItems = items.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase())
  );

  const handleAction = (href: string) => {
    router.push(href);
    setIsOpen(false);
    setQuery("");
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      hideCloseButton
      backdrop="blur"
      placement="top"
      size="xl"
      className="mt-20 border border-divider bg-content1/80 backdrop-blur-xl"
    >
      <ModalContent>
        <ModalBody className="p-0">
          <div className="flex items-center border-b border-divider px-4 py-3">
            <Search size={18} className="text-foreground-400" />
            <input
              autoFocus
              placeholder="Search or jump to..."
              className="flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-foreground-400"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && filteredItems.length > 0) {
                  handleAction(filteredItems[0].href);
                }
                if (e.key === "Escape") {
                  setIsOpen(false);
                }
              }}
            />
            <Kbd keys={["command"]}>K</Kbd>
          </div>
          <div className="max-h-[300px] overflow-y-auto p-2">
            {filteredItems.length > 0 ? (
              <Listbox
                aria-label="Commands"
                onAction={(key) => {
                  const item = items.find((i) => i.id === key);
                  if (item) handleAction(item.href);
                }}
              >
                {filteredItems.map((item) => (
                  <ListboxItem
                    key={item.id}
                    startContent={<item.icon size={16} strokeWidth={1.5} />}
                    className="rounded-lg data-[hover=true]:bg-default-100"
                  >
                    {item.label}
                  </ListboxItem>
                ))}
              </Listbox>
            ) : (
              <div className="px-4 py-8 text-center text-sm text-foreground-400">
                No results found for &quot;{query}&quot;
              </div>
            )}
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
