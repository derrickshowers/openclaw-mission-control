"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const MENTIONABLE_USERS = [
  { name: "Derrick", role: "Owner" },
  { name: "Frank", role: "Orchestrator" },
  { name: "Tom", role: "Lead Architect" },
  { name: "Michael", role: "Full Stack Engineer" },
  { name: "Joanna", role: "UX Designer" },
];

interface MentionTextareaProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  classNames?: Record<string, string>;
}

/** Extract plain text from the contentEditable div, converting mention spans to @Name */
function extractText(el: HTMLElement): string {
  let text = "";
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || "";
    } else if (node instanceof HTMLElement) {
      if (node.dataset.mention) {
        text += `@${node.dataset.mention}`;
      } else if (node.tagName === "BR") {
        text += "\n";
      } else {
        text += extractText(node);
      }
    }
  }
  return text;
}

/** Create a mention span element */
function createMentionSpan(name: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.contentEditable = "false";
  span.dataset.mention = name;
  span.className =
    "inline-block rounded px-1 py-0.5 bg-[#8b5cf6]/15 text-[#8b5cf6] font-medium text-xs cursor-default select-all";
  span.textContent = `@${name}`;
  return span;
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
  const editorRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Track if we're currently syncing to avoid loops
  const isSyncing = useRef(false);
  // Track the @ position in the DOM for mention insertion
  const mentionAnchor = useRef<{ node: Node; offset: number } | null>(null);

  const filteredUsers = MENTIONABLE_USERS.filter((u) =>
    u.name.toLowerCase().startsWith(mentionFilter.toLowerCase())
  );

  /** Sync external value into the editor (only on mount or when value is cleared externally) */
  useEffect(() => {
    const el = editorRef.current;
    if (!el || isSyncing.current) return;

    // Only sync when the editor is empty and value is empty (after submit)
    // or on initial mount
    if (value === "" && extractText(el) !== "") {
      el.innerHTML = "";
    }
    // On mount, if there's a value, render it (with mentions parsed)
    if (value && el.childNodes.length === 0) {
      const parts = value.split(/(@\w+)/g);
      for (const part of parts) {
        const mentionMatch = part.match(/^@(\w+)$/);
        if (mentionMatch) {
          const userName = MENTIONABLE_USERS.find(
            (u) => u.name.toLowerCase() === mentionMatch[1].toLowerCase()
          );
          if (userName) {
            el.appendChild(createMentionSpan(userName.name));
          } else {
            el.appendChild(document.createTextNode(part));
          }
        } else {
          el.appendChild(document.createTextNode(part));
        }
      }
    }
  }, [value]);

  const syncValue = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    isSyncing.current = true;
    onValueChange(extractText(el));
    requestAnimationFrame(() => {
      isSyncing.current = false;
    });
  }, [onValueChange]);

  /** Check if we're currently typing a mention (text after @) */
  const checkForMentionTrigger = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) {
      setShowMentions(false);
      return;
    }

    const range = sel.getRangeAt(0);
    if (!range.collapsed) {
      setShowMentions(false);
      return;
    }

    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) {
      setShowMentions(false);
      return;
    }

    const text = node.textContent || "";
    const offset = range.startOffset;
    const textBefore = text.slice(0, offset);

    // Find @ trigger: either at start or after whitespace
    const match = textBefore.match(/(^|[\s])@(\w*)$/);
    if (match) {
      const filter = match[2];
      setMentionFilter(filter);
      setSelectedIndex(0);
      setShowMentions(true);
      // Store the anchor point: the @ position
      mentionAnchor.current = {
        node,
        offset: offset - filter.length - 1, // position of @
      };
    } else {
      setShowMentions(false);
      mentionAnchor.current = null;
    }
  }, []);

  const handleInput = useCallback(() => {
    syncValue();
    checkForMentionTrigger();
  }, [syncValue, checkForMentionTrigger]);

  /** Insert a mention at the current @ position */
  const insertMention = useCallback(
    (name: string) => {
      const el = editorRef.current;
      const anchor = mentionAnchor.current;
      if (!el || !anchor) return;

      const textNode = anchor.node as Text;
      const text = textNode.textContent || "";
      const atPos = anchor.offset;

      // Find the end of the current mention text (cursor position)
      const sel = window.getSelection();
      const cursorOffset = sel?.focusNode === textNode ? sel.focusOffset : text.length;

      // Split: [before @] [@mention-text] [after cursor]
      const before = text.slice(0, atPos);
      const after = text.slice(cursorOffset);

      // Create the mention span
      const mentionSpan = createMentionSpan(name);

      // Replace the text node with: before text + mention span + space + after text
      const parent = textNode.parentNode!;
      if (before) {
        parent.insertBefore(document.createTextNode(before), textNode);
      }
      parent.insertBefore(mentionSpan, textNode);

      // Add a space after the mention and the remaining text
      const afterText = document.createTextNode(`\u00A0${after}`);
      parent.insertBefore(afterText, textNode);

      // Remove the original text node
      parent.removeChild(textNode);

      // Place cursor after the space
      const newRange = document.createRange();
      newRange.setStart(afterText, 1);
      newRange.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(newRange);

      setShowMentions(false);
      mentionAnchor.current = null;
      syncValue();
      el.focus();
    },
    [syncValue]
  );

  /** Handle keydown for mention navigation and atomic deletion */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Mention dropdown navigation
      if (showMentions && filteredUsers.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((i) => (i + 1) % filteredUsers.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((i) =>
            (i - 1 + filteredUsers.length) % filteredUsers.length
          );
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          insertMention(filteredUsers[selectedIndex].name);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setShowMentions(false);
          return;
        }
      }

      // Atomic mention deletion: when backspace is pressed and cursor is right after a mention span
      if (e.key === "Backspace") {
        const sel = window.getSelection();
        if (sel && sel.rangeCount && sel.isCollapsed) {
          const range = sel.getRangeAt(0);
          const node = range.startContainer;
          const offset = range.startOffset;

          // Case 1: Cursor in a text node at position 0, previous sibling is a mention
          if (node.nodeType === Node.TEXT_NODE && offset === 0) {
            const prev = node.previousSibling;
            if (prev instanceof HTMLElement && prev.dataset.mention) {
              e.preventDefault();
              prev.remove();
              syncValue();
              return;
            }
          }

          // Case 2: Cursor in the editor div itself, pointing between children
          if (node === editorRef.current && offset > 0) {
            const prev = node.childNodes[offset - 1];
            if (prev instanceof HTMLElement && prev.dataset.mention) {
              e.preventDefault();
              prev.remove();
              syncValue();
              return;
            }
          }
        }
      }

      // Shift+Enter to submit (pass to parent handler)
      if (e.key === "Enter" && !e.shiftKey && !showMentions) {
        // Allow normal Enter for newlines
      }

      onKeyDown?.(e);
    },
    [showMentions, filteredUsers, selectedIndex, insertMention, syncValue, onKeyDown]
  );

  // Close dropdown on click outside
  useEffect(() => {
    if (!showMentions) return;
    const handleClick = (e: MouseEvent) => {
      const container = editorRef.current;
      const dropdown = dropdownRef.current;
      if (
        container &&
        !container.contains(e.target as Node) &&
        dropdown &&
        !dropdown.contains(e.target as Node)
      ) {
        setShowMentions(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMentions]);

  // Handle paste: strip to plain text only
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      document.execCommand("insertText", false, text);
    },
    []
  );

  const isEmpty = value.trim() === "";

  return (
    <div className="relative flex-1">
      <div className="relative">
        {/* Placeholder */}
        {isEmpty && (
          <div className="pointer-events-none absolute inset-0 flex items-center px-3 text-xs text-[#555555]">
            {placeholder || "Add a comment..."}
          </div>
        )}
        {/* ContentEditable editor */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          className={`w-full min-h-[32px] max-h-[96px] overflow-y-auto rounded-lg border border-[#222222] bg-[#080808] px-3 py-1.5 text-xs text-[#CCCCCC] outline-none focus:border-[#333333] transition-colors ${
            classNames?.inputWrapper || ""
          }`}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
        />
      </div>

      {/* Mention dropdown */}
      {showMentions && filteredUsers.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full left-0 mb-1 w-56 rounded border border-[#333333] bg-[#121212] py-1 shadow-lg z-50"
        >
          {filteredUsers.map((user, i) => (
            <button
              key={user.name}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                i === selectedIndex
                  ? "bg-[#1A1A1A] text-white"
                  : "text-[#CCCCCC] hover:bg-[#1A1A1A]"
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(user.name);
              }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <span className="font-medium">{user.name}</span>
              <span className="text-[#555555]">{user.role}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
