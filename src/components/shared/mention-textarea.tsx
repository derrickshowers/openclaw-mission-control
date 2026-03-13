"use client";

import React, { useState, useRef, useCallback } from "react";
import { KNOWN_AGENT_IDS } from "@/lib/agents";

interface MentionTextareaProps {
  value: string;
  onValueChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  classNames?: {
    inputWrapper?: string;
    input?: string;
  };
}

export function MentionTextarea({
  value,
  onValueChange,
  onKeyDown,
  placeholder,
  disabled,
  autoFocus,
  classNames,
}: MentionTextareaProps) {
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPos, setCursorPos] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filteredAgents = KNOWN_AGENT_IDS.filter((agent) =>
    agent.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  const insertMention = useCallback(
    (agent: string) => {
      const before = value.substring(0, cursorPos - mentionFilter.length - 1);
      const after = value.substring(cursorPos);
      const newValue = `${before}@${agent} ${after}`;
      onValueChange(newValue);
      setShowMentions(false);

      // Reset focus and position cursor
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const newPos = before.length + agent.length + 2;
          textareaRef.current.setSelectionRange(newPos, newPos);
        }
      }, 0);
    },
    [value, cursorPos, mentionFilter, onValueChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && filteredAgents.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredAgents.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredAgents.length) % filteredAgents.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (filteredAgents[selectedIndex]) {
          insertMention(filteredAgents[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowMentions(false);
      }
    } else {
      onKeyDown?.(e);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const pos = e.target.selectionStart;
    setCursorPos(pos);
    onValueChange(newValue);

    // Look back for @
    const textBeforeCursor = newValue.substring(0, pos);
    const lastAt = textBeforeCursor.lastIndexOf("@");
    const lastSpace = textBeforeCursor.lastIndexOf(" ");

    if (lastAt !== -1 && lastAt >= lastSpace) {
      const filter = textBeforeCursor.substring(lastAt + 1);
      setMentionFilter(filter);
      setShowMentions(true);
      setSelectedIndex(0);
    } else {
      setShowMentions(false);
    }
  };

  return (
    <div className="relative w-full">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className={`w-full min-h-[36px] max-h-[96px] overflow-y-auto rounded-lg border border-divider bg-white dark:bg-[#080808] px-3 py-2 text-base md:text-sm text-foreground dark:text-[#CCCCCC] outline-none focus:border-foreground-300 transition-colors ${
          classNames?.inputWrapper || ""
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      />

      {showMentions && filteredAgents.length > 0 && (
        <div 
          className="absolute bottom-full left-0 mb-1 w-56 rounded border border-divider bg-white dark:bg-[#121212] py-1 shadow-lg z-50 overflow-hidden"
        >
          {filteredAgents.map((agent, i) => (
            <button
              key={agent}
              onClick={() => insertMention(agent)}
              className={`flex w-full items-center px-3 py-1.5 text-left text-sm transition-colors ${
                i === selectedIndex
                  ? "bg-gray-100 dark:bg-[#1A1A1A] text-foreground dark:text-white"
                  : "text-foreground-500 dark:text-[#CCCCCC] hover:bg-gray-100 dark:hover:bg-[#1A1A1A]"
              }`}
            >
              <span className="capitalize">{agent}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
