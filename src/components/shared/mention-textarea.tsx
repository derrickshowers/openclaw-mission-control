"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Textarea } from "@heroui/react";

const MENTIONABLE_USERS = [
  { name: "derrick", role: "Owner" },
  { name: "frank", role: "Orchestrator" },
  { name: "tom", role: "Lead Architect" },
  { name: "michael", role: "Full Stack Engineer" },
  { name: "joanna", role: "UX Designer" },
];

interface MentionTextareaProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  classNames?: Record<string, string>;
}

export function MentionTextarea({
  value,
  onValueChange,
  placeholder,
  onKeyDown,
  classNames,
}: MentionTextareaProps) {
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filteredUsers = MENTIONABLE_USERS.filter((u) =>
    u.name.toLowerCase().startsWith(mentionFilter.toLowerCase())
  );

  const handleChange = useCallback(
    (newValue: string) => {
      onValueChange(newValue);

      // Find the textarea element to get cursor position
      const textarea = containerRef.current?.querySelector("textarea");
      if (!textarea) return;

      // Use setTimeout to get the updated selectionStart after React re-render
      setTimeout(() => {
        const cursorPos = textarea.selectionStart;
        const textBeforeCursor = newValue.slice(0, cursorPos);

        // Check if we're in a mention context: find last @ that isn't preceded by a word char
        const atMatch = textBeforeCursor.match(/(^|[\s])@(\w*)$/);

        if (atMatch) {
          const filter = atMatch[2];
          setMentionFilter(filter);
          setMentionStart(cursorPos - filter.length - 1); // position of @
          setShowMentions(true);
          setSelectedIndex(0);
        } else {
          setShowMentions(false);
        }
      }, 0);
    },
    [onValueChange]
  );

  const insertMention = useCallback(
    (username: string) => {
      if (mentionStart < 0) return;

      const textarea = containerRef.current?.querySelector("textarea");
      const cursorPos = textarea?.selectionStart || value.length;

      const before = value.slice(0, mentionStart);
      const after = value.slice(cursorPos);
      const newValue = `${before}@${username} ${after}`;

      onValueChange(newValue);
      setShowMentions(false);
      setMentionStart(-1);

      // Restore focus and cursor position
      setTimeout(() => {
        textarea?.focus();
        const newCursorPos = mentionStart + username.length + 2; // @ + name + space
        textarea?.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    },
    [mentionStart, value, onValueChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (showMentions && filteredUsers.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((i) => (i + 1) % filteredUsers.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((i) => (i - 1 + filteredUsers.length) % filteredUsers.length);
          return;
        }
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          insertMention(filteredUsers[selectedIndex].name);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setShowMentions(false);
          return;
        }
        if (e.key === "Tab") {
          e.preventDefault();
          insertMention(filteredUsers[selectedIndex].name);
          return;
        }
      }

      // Pass through to parent handler
      onKeyDown?.(e);
    },
    [showMentions, filteredUsers, selectedIndex, insertMention, onKeyDown]
  );

  // Close on click outside
  useEffect(() => {
    if (!showMentions) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowMentions(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMentions]);

  return (
    <div ref={containerRef} className="relative flex-1">
      <Textarea
        value={value}
        onValueChange={handleChange}
        variant="bordered"
        size="sm"
        minRows={1}
        maxRows={4}
        placeholder={placeholder || "Add a comment..."}
        classNames={classNames}
        onKeyDown={handleKeyDown}
      />

      {/* Mention dropdown */}
      {showMentions && filteredUsers.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 w-56 rounded border border-[#333333] bg-[#121212] py-1 shadow-lg z-50">
          {filteredUsers.map((user, i) => (
            <button
              key={user.name}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                i === selectedIndex
                  ? "bg-[#1A1A1A] text-white"
                  : "text-[#CCCCCC] hover:bg-[#1A1A1A]"
              }`}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent textarea blur
                insertMention(user.name);
              }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <span className="font-medium capitalize">{user.name}</span>
              <span className="text-[#555555]">{user.role}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
