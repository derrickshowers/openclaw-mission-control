"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import {
  Folder,
  FileText,
  Search,
  ChevronRight,
  ChevronDown,
  X,
  Pencil,
  Save,
  FolderPlus,
  FilePlus,
  MoreHorizontal,
  Trash2,
  ArrowUpDown,
  GripVertical,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CSS } from "@dnd-kit/utilities";

interface DocNode {
  name: string;
  type: "file" | "directory";
  path: string;
  created_at: string;
  updated_at: string;
  children?: DocNode[];
}

interface SearchResult {
  path: string;
  name: string;
  snippet: string;
  matches: number;
}

interface DocNodeItemProps {
  node: DocNode;
  depth: number;
  isMobile: boolean;
  selectedFile: string | null;
  selectedPaths: Set<string>;
  expandedDirs: Set<string>;
  renamingPath: string | null;
  renameValue: string;
  menuOpenForPath: string | null;
  onToggleDir: (path: string) => void;
  onFileClick: (path: string, e: React.MouseEvent<HTMLButtonElement>, isMobile: boolean) => void;
  onStartRename: (path: string, name: string) => void;
  onCancelRename: () => void;
  onSubmitRename: (path: string) => void;
  onRenameValueChange: (val: string) => void;
  onRequestDelete: (path: string, name: string) => void;
  onMenuToggle: (path: string | null) => void;
  skipRenameBlurRef: React.MutableRefObject<boolean>;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  renderTree: (nodes: DocNode[], depth: number, isMobile: boolean) => React.ReactNode;
}

function DocNodeItem({
  node,
  depth,
  isMobile,
  selectedFile,
  selectedPaths,
  expandedDirs,
  renamingPath,
  renameValue,
  menuOpenForPath,
  onToggleDir,
  onFileClick,
  onStartRename,
  onCancelRename,
  onSubmitRename,
  onRenameValueChange,
  onRequestDelete,
  onMenuToggle,
  skipRenameBlurRef,
  renameInputRef,
  renderTree,
}: DocNodeItemProps) {
  const isExpanded = expandedDirs.has(node.path);
  const isSelected = selectedFile === node.path;
  const isMultiSelected = selectedPaths.has(node.path);
  const isRenaming = renamingPath === node.path;
  const isMenuOpen = menuOpenForPath === node.path;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: node.path,
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: node.path,
    disabled: node.type !== "directory",
  });

  // Auto-expand folder on hover during drag
  useEffect(() => {
    if (isOver && node.type === "directory" && !isExpanded) {
      const timer = setTimeout(() => {
        onToggleDir(node.path);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOver, node.type, isExpanded, onToggleDir, node.path]);

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  } : undefined;

  if (node.type === "directory") {
    return (
      <div key={node.path} ref={setDroppableRef} className={`${isOver ? "bg-[#8b5cf6]/10 ring-1 ring-[#8b5cf6]/30 rounded" : ""}`}>
        <div 
          ref={setNodeRef} 
          style={style}
          className="group relative flex w-full items-center"
        >
          <div
            {...attributes}
            {...listeners}
            className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing p-1 text-[#444444] hover:text-[#888888] absolute left-0 z-10"
            style={{ left: `${depth * 12}px` }}
          >
            <GripVertical size={12} />
          </div>
          <button
            onClick={() => onToggleDir(node.path)}
            className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs text-[#CCCCCC] transition-colors hover:bg-[#1A1A1A] ${isOver ? "bg-[#1A1A1A]" : ""}`}
            style={{ paddingLeft: `${18 + depth * 12}px` }}
          >
            {isExpanded ? (
              <ChevronDown size={12} strokeWidth={1.5} className="flex-shrink-0 text-[#888888]" />
            ) : (
              <ChevronRight size={12} strokeWidth={1.5} className="flex-shrink-0 text-[#888888]" />
            )}
            <Folder size={14} strokeWidth={1.5} className="flex-shrink-0 text-[#888888]" />
            <span className="truncate">{node.name}</span>
          </button>
        </div>
        {isExpanded && node.children && (
          <div>{renderTree(node.children, depth + 1, isMobile)}</div>
        )}
      </div>
    );
  }

  return (
    <div key={node.path} className="group relative" data-file>
      <div
        ref={setNodeRef}
        className={`flex w-full items-center rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-[#1A1A1A] focus-within:bg-[#1A1A1A] ${
          isSelected || isMultiSelected ? "bg-[#1A1A1A] text-white" : "text-[#CCCCCC]"
        }`}
        style={{ ...style, paddingLeft: `${depth * 12}px` }}
      >
        <div
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing p-1 text-[#444444] hover:text-[#888888] flex-shrink-0"
        >
          <GripVertical size={12} />
        </div>
        <button
          onClick={(e) => onFileClick(node.path, e, isMobile)}
          onKeyDown={(e) => {
            if (e.key === "F2") {
              e.preventDefault();
              onStartRename(node.path, node.name);
            }
            if (e.key === "Delete") {
              e.preventDefault();
              onRequestDelete(node.path, node.name);
            }
          }}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded text-left outline-none"
          aria-label={`Open ${node.name}`}
        >
          <FileText size={14} strokeWidth={1.5} className="flex-shrink-0 text-[#888888]" />
          {isRenaming ? (
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => onRenameValueChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSubmitRename(node.path);
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  skipRenameBlurRef.current = true;
                  onCancelRename();
                }
              }}
              onBlur={() => {
                if (skipRenameBlurRef.current) {
                  skipRenameBlurRef.current = false;
                  return;
                }
                onSubmitRename(node.path);
              }}
              className="h-5 flex-1 rounded border border-[#333333] bg-[#080808] px-1.5 font-mono text-[12px] text-[#CCCCCC] outline-none focus:border-[#555555]"
              aria-label="Rename document"
            />
          ) : (
            <span className="truncate">{node.name}</span>
          )}
        </button>

        {!isRenaming && (
          <button
            data-doc-menu-button
            onClick={(e) => {
              e.stopPropagation();
              onMenuToggle(isMenuOpen ? null : node.path);
            }}
            className={`ml-1 rounded p-1 text-[#888888] transition-colors hover:bg-[#1F1F1F] hover:text-white focus:bg-[#1F1F1F] focus:text-white ${
              isMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
            }`}
            aria-label={`Actions for ${node.name}`}
          >
            <MoreHorizontal size={12} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {isMenuOpen && !isRenaming && (
        <div
          data-doc-menu
          className="absolute right-2 z-20 mt-1 w-36 rounded border border-neutral-800 bg-[#080808] p-1 shadow-lg"
        >
          <button
            onClick={() => onStartRename(node.path, node.name)}
            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[12px] text-[#CCCCCC] hover:bg-[#141414]"
          >
            <span>Rename</span>
            <span className="font-mono text-[10px] text-[#666666]">F2</span>
          </button>
          <button
            onClick={() => onRequestDelete(node.path, node.name)}
            className="mt-0.5 flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[12px] text-[#CCCCCC] hover:bg-[#1b1111] hover:text-red-500"
          >
            <span>Delete</span>
            <Trash2 size={12} strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  );
}

function findNodeByPath(nodes: DocNode[], path: string): DocNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const found = findNodeByPath(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

function RootDropTarget({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "root",
  });

  return (
    <div ref={setNodeRef} className={`flex-1 overflow-y-auto p-1 transition-colors ${isOver ? "bg-[#8b5cf6]/10" : ""}`}>
      {children}
    </div>
  );
}

export function DocsBrowser() {
  const [tree, setTree] = useState<DocNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [selectionAnchor, setSelectionAnchor] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [treeLoading, setTreeLoading] = useState(true);
  const [showMobileTree, setShowMobileTree] = useState(false);

  // Sorting state
  const [sortKey, setSortKey] = useState<"name" | "created" | "updated">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const sortTree = useCallback((nodes: DocNode[], key: string, order: string): DocNode[] => {
    const sorted = [...nodes].sort((a, b) => {
      // Directories first
      if (a.type === "directory" && b.type !== "directory") return -1;
      if (a.type !== "directory" && b.type === "directory") return 1;

      let comparison = 0;
      if (key === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (key === "created") {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (key === "updated") {
        comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      }

      return order === "asc" ? comparison : -comparison;
    });

    return sorted.map((node) => {
      if (node.children) {
        return { ...node, children: sortTree(node.children, key, order) };
      }
      return node;
    });
  }, []);

  const sortedTree = sortTree(tree, sortKey, sortOrder);

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Creation state
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingPage, setCreatingPage] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Rename / delete state
  const [menuOpenForPath, setMenuOpenForPath] = useState<string | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const skipRenameBlurRef = useRef(false);
  const [deleteTarget, setDeleteTarget] = useState<{ path: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load tree
  const loadTree = useCallback(async () => {
    try {
      const res = await fetch("/api/mc/docs/tree");
      const data = await res.json();
      if (Array.isArray(data)) {
        setTree(data);
      }
    } catch {
      setTree([]);
    } finally {
      setTreeLoading(false);
    }
  }, []);

  // Drag and drop state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [moveToast, setMoveToast] = useState<{ count: number; undoOps: Array<{ from: string; to: string }> } | null>(null);
  const moveToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragStart = useCallback((event: any) => {
    setActiveId(event.active.id);
  }, []);

  const handleDragEnd = useCallback(async (event: any) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const sourcePath = String(active.id);
    const targetDirPath = over.id === "root" ? "" : String(over.id);

    const candidatePaths = selectedPaths.has(sourcePath) && selectedPaths.size > 1
      ? Array.from(selectedPaths)
      : [sourcePath];

    const pathsToMove = Array.from(new Set(candidatePaths))
      .filter((path) => !(targetDirPath === path || targetDirPath.startsWith(`${path}/`)))
      .sort((a, b) => a.length - b.length);

    if (pathsToMove.length === 0) return;

    const completed: Array<{ from: string; to: string }> = [];

    try {
      for (const oldPath of pathsToMove) {
        const fileName = oldPath.split("/").pop() || "";
        const newPath = targetDirPath ? `${targetDirPath}/${fileName}` : fileName;
        if (oldPath === newPath) continue;

        const res = await fetch("/api/mc/docs/rename", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oldPath, newPath }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Failed to move ${oldPath}`);
        }

        completed.push({ from: oldPath, to: newPath });
      }

      if (completed.length === 0) return;

      if (selectedFile) {
        let mapped = selectedFile;
        for (const op of completed) {
          if (mapped === op.from || mapped.startsWith(`${op.from}/`)) {
            mapped = mapped.replace(op.from, op.to);
          }
        }
        if (mapped !== selectedFile) setSelectedFile(mapped);
      }

      setExpandedDirs((prev) => {
        let next = new Set(prev);
        let changed = false;

        for (const op of completed) {
          const updated = new Set<string>();
          for (const path of next) {
            if (path === op.from) {
              updated.add(op.to);
              changed = true;
            } else if (path.startsWith(`${op.from}/`)) {
              updated.add(path.replace(`${op.from}/`, `${op.to}/`));
              changed = true;
            } else {
              updated.add(path);
            }
          }
          next = updated;
        }

        return changed ? next : prev;
      });

      await loadTree();

      const newSelection = new Set<string>();
      for (const path of pathsToMove) {
        const op = completed.find((entry) => entry.from === path);
        if (op) newSelection.add(op.to);
      }
      if (newSelection.size > 0) {
        setSelectedPaths(newSelection);
        setSelectionAnchor(Array.from(newSelection)[0] || null);
      }

      if (moveToastTimerRef.current) clearTimeout(moveToastTimerRef.current);
      setMoveToast({
        count: completed.length,
        undoOps: completed.map((op) => ({ from: op.to, to: op.from })),
      });
      moveToastTimerRef.current = setTimeout(() => {
        setMoveToast(null);
        moveToastTimerRef.current = null;
      }, 5000);
    } catch (err: any) {
      for (const op of [...completed].reverse()) {
        await fetch("/api/mc/docs/rename", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oldPath: op.to, newPath: op.from }),
        }).catch(() => null);
      }

      setAlertModal({ title: "Move failed", message: err.message || "Failed to move document." });
      await loadTree();
    }
  }, [selectedFile, selectedPaths, loadTree]);

  const undoLastMove = useCallback(async () => {
    if (!moveToast) return;

    const ops = [...moveToast.undoOps];
    setMoveToast(null);
    if (moveToastTimerRef.current) {
      clearTimeout(moveToastTimerRef.current);
      moveToastTimerRef.current = null;
    }

    try {
      for (const op of ops) {
        const res = await fetch("/api/mc/docs/rename", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oldPath: op.from, newPath: op.to }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Undo failed");
        }
      }

      if (selectedFile) {
        let mapped = selectedFile;
        for (const op of ops) {
          if (mapped === op.from || mapped.startsWith(`${op.from}/`)) {
            mapped = mapped.replace(op.from, op.to);
          }
        }
        if (mapped !== selectedFile) setSelectedFile(mapped);
      }

      setSelectedPaths(new Set(ops.map((op) => op.to)));
      setSelectionAnchor(ops[0]?.to || null);
      await loadTree();
    } catch (err: any) {
      setAlertModal({ title: "Undo failed", message: err.message || "Failed to undo move." });
    }
  }, [moveToast, loadTree, selectedFile]);

  useEffect(() => {
    return () => {
      if (moveToastTimerRef.current) {
        clearTimeout(moveToastTimerRef.current);
      }
    };
  }, []);

  // Generic modals
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [alertModal, setAlertModal] = useState<{
    title: string;
    message: string;
  } | null>(null);

  // Initial load
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/api/mc/docs/tree");
        const data = await res.json();
        if (Array.isArray(data)) {
          setTree(data);

          // Initial auto-expand everything
          const dirs = new Set<string>();
          function collectDirs(nodes: DocNode[]) {
            for (const node of nodes) {
              if (node.type === "directory") {
                dirs.add(node.path);
                if (node.children) collectDirs(node.children);
              }
            }
          }
          collectDirs(data);
          setExpandedDirs(dirs);
        }
      } catch {
        setTree([]);
      } finally {
        setTreeLoading(false);
      }
    }
    init();
  }, []);

  const loadFile = useCallback(async (filePath: string) => {
    setLoading(true);
    setEditing(false);
    setDirty(false);
    try {
      const res = await fetch(`/api/mc/docs/read?path=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      setFileContent(data.content || "");
      setSelectedFile(filePath);
      setSelectedPaths(new Set([filePath]));
      setSelectionAnchor(filePath);
      setSearchResults(null);
    } catch {
      setFileContent("Error loading file");
    } finally {
      setLoading(false);
    }
  }, []);

  const openFileWithUnsavedGuard = useCallback((filePath: string, afterOpen?: () => void) => {
    if (editing && dirty) {
      setConfirmModal({
        title: "Discard changes?",
        message: "You have unsaved changes. Are you sure you want to discard them and open another file?",
        onConfirm: () => {
          loadFile(filePath);
          afterOpen?.();
        },
      });
      return;
    }

    loadFile(filePath);
    afterOpen?.();
  }, [editing, dirty, loadFile]);

  const flattenFilePaths = useCallback((nodes: DocNode[]): string[] => {
    const out: string[] = [];
    for (const node of nodes) {
      if (node.type === "file") {
        out.push(node.path);
      }
      if (node.children) {
        out.push(...flattenFilePaths(node.children));
      }
    }
    return out;
  }, []);

  const handleFileClick = useCallback((filePath: string, e: React.MouseEvent<HTMLButtonElement>, isMobile: boolean) => {
    const isMod = e.metaKey || e.ctrlKey;
    const isShift = e.shiftKey;
    const fileOrder = flattenFilePaths(sortedTree);

    if (isShift && selectionAnchor) {
      const anchorIdx = fileOrder.indexOf(selectionAnchor);
      const targetIdx = fileOrder.indexOf(filePath);
      if (anchorIdx >= 0 && targetIdx >= 0) {
        const [start, end] = anchorIdx < targetIdx ? [anchorIdx, targetIdx] : [targetIdx, anchorIdx];
        const range = fileOrder.slice(start, end + 1);
        setSelectedPaths(new Set(range));
        return;
      }
    }

    if (isMod) {
      setSelectedPaths((prev) => {
        const next = new Set(prev);
        if (next.has(filePath)) next.delete(filePath);
        else next.add(filePath);
        return next;
      });
      setSelectionAnchor(filePath);
      return;
    }

    setSelectedPaths(new Set([filePath]));
    setSelectionAnchor(filePath);
    openFileWithUnsavedGuard(filePath, () => {
      if (isMobile) setShowMobileTree(false);
    });
  }, [flattenFilePaths, openFileWithUnsavedGuard, selectionAnchor, sortedTree]);

  const doSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/mc/docs/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
      setFileContent(null);
      setSelectedFile(null);
    } catch {
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults(null);
  };

  const toggleDir = (dirPath: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) next.delete(dirPath);
      else next.add(dirPath);
      return next;
    });
  };

  // Edit mode handlers
  const enterEditMode = useCallback(() => {
    if (fileContent === null) return;
    setEditContent(fileContent);
    setEditing(true);
    setDirty(false);
    setTimeout(() => editorRef.current?.focus(), 50);
  }, [fileContent]);

  const cancelEdit = useCallback(() => {
    if (dirty) {
      setConfirmModal({
        title: "Discard changes?",
        message: "You have unsaved changes. Are you sure you want to discard them?",
        onConfirm: () => {
          setEditing(false);
          setDirty(false);
        }
      });
      return;
    }
    setEditing(false);
    setDirty(false);
  }, [dirty]);

  const saveEdit = useCallback(async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/mc/docs/write?path=${encodeURIComponent(selectedFile)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });
      if (!res.ok) throw new Error("Save failed");
      setFileContent(editContent);
      setEditing(false);
      setDirty(false);
    } catch (err) {
      console.error("Save failed:", err);
      setAlertModal({ title: "Save failed", message: "Failed to save the document. Please try again." });
    } finally {
      setSaving(false);
    }
  }, [selectedFile, editContent]);

  // Creation handlers
  const getActiveFolder = useCallback((): string => {
    if (!selectedFile) return "";
    // If the selected file is in a directory, use that directory
    const parts = selectedFile.split("/");
    if (parts.length > 1) return parts.slice(0, -1).join("/");
    return "";
  }, [selectedFile]);

  const createPage = useCallback(async () => {
    const folder = getActiveFolder();
    const pagePath = folder ? `${folder}/Untitled.md` : "Untitled.md";

    // Find a unique name
    let finalPath = pagePath;
    let counter = 1;
    while (counter < 100) {
      try {
        const res = await fetch("/api/mc/docs/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: finalPath, type: "file" }),
        });
        if (res.ok) break;
        if (res.status === 409) {
          const base = folder ? `${folder}/Untitled ${counter}` : `Untitled ${counter}`;
          finalPath = `${base}.md`;
          counter++;
          continue;
        }
        throw new Error("Create failed");
      } catch {
        setAlertModal({ title: "Creation failed", message: "Failed to create the document." });
        return;
      }
    }

    await loadTree();
    // Navigate to the new page and enter edit mode
    setLoading(true);
    try {
      const res = await fetch(`/api/mc/docs/read?path=${encodeURIComponent(finalPath)}`);
      const data = await res.json();
      setFileContent(data.content || "");
      setSelectedFile(finalPath);
      setSelectedPaths(new Set([finalPath]));
      setSelectionAnchor(finalPath);
      setSearchResults(null);
      setEditContent(data.content || "");
      setEditing(true);
      setDirty(false);
      setTimeout(() => editorRef.current?.focus(), 50);
    } finally {
      setLoading(false);
    }
  }, [getActiveFolder, loadTree]);

  const createFolder = useCallback(async (name: string) => {
    if (!name.trim()) {
      setCreatingFolder(false);
      return;
    }
    const folder = getActiveFolder();
    const folderPath = folder ? `${folder}/${name.trim()}` : name.trim();

    try {
      const res = await fetch("/api/mc/docs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: folderPath, type: "folder" }),
      });
      if (!res.ok) {
        const data = await res.json();
        setAlertModal({ title: "Creation failed", message: data.error || "Failed to create folder." });
        return;
      }
      await loadTree();
    } catch {
      setAlertModal({ title: "Creation failed", message: "Failed to create folder." });
    } finally {
      setCreatingFolder(false);
      setNewFolderName("");
    }
  }, [getActiveFolder, loadTree]);

  const startRename = useCallback((docPath: string, docName: string) => {
    setMenuOpenForPath(null);
    setRenamingPath(docPath);
    setRenameValue(docName);
    setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 30);
  }, []);

  const cancelRename = useCallback(() => {
    setRenamingPath(null);
    setRenameValue("");
  }, []);

  const submitRename = useCallback(async (oldPath: string) => {
    const rawName = renameValue.trim();
    if (!rawName) {
      cancelRename();
      return;
    }

    const oldParts = oldPath.split("/");
    const oldName = oldParts[oldParts.length - 1] || oldPath;
    if (rawName === oldName) {
      cancelRename();
      return;
    }

    const parent = oldParts.length > 1 ? oldParts.slice(0, -1).join("/") : "";
    const newPath = parent ? `${parent}/${rawName}` : rawName;

    try {
      const res = await fetch("/api/mc/docs/rename", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPath, newPath }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to rename document.");
      }

      if (selectedFile === oldPath) {
        setSelectedFile(newPath);
      }
      
      // Update expandedDirs if it was a folder (including all its subfolders)
      setExpandedDirs((prev) => {
        const next = new Set<string>();
        let changed = false;
        for (const path of prev) {
          if (path === oldPath) {
            next.add(newPath);
            changed = true;
          } else if (path.startsWith(`${oldPath}/`)) {
            next.add(path.replace(`${oldPath}/`, `${newPath}/`));
            changed = true;
          } else {
            next.add(path);
          }
        }
        return changed ? next : prev;
      });

      await loadTree();
      cancelRename();
    } catch (err: any) {
      setAlertModal({ title: "Rename failed", message: err?.message || "Failed to rename document." });
    }
  }, [renameValue, selectedFile, loadTree, cancelRename]);

  const requestDelete = useCallback((docPath: string, docName: string) => {
    setMenuOpenForPath(null);
    setDeleteTarget({ path: docPath, name: docName });
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/mc/docs/delete?path=${encodeURIComponent(deleteTarget.path)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete document.");
      }

      if (selectedFile === deleteTarget.path) {
        setSelectedFile(null);
        setSelectedPaths(new Set());
        setSelectionAnchor(null);
        setFileContent(null);
        setEditing(false);
        setDirty(false);
      }
      
      // Remove deleted path (and subfolders) from expandedDirs
      setExpandedDirs((prev) => {
        const next = new Set<string>();
        let changed = false;
        for (const path of prev) {
          if (path === deleteTarget.path || path.startsWith(`${deleteTarget.path}/`)) {
            changed = true;
          } else {
            next.add(path);
          }
        }
        return changed ? next : prev;
      });

      setDeleteTarget(null);
      await loadTree();
    } catch (err: any) {
      setAlertModal({ title: "Delete failed", message: err?.message || "Failed to delete document." });
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, selectedFile, loadTree]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // Don't intercept if in an input/textarea that isn't our editor
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "SELECT" ||
        (target.tagName === "TEXTAREA" && target !== editorRef.current)
      ) {
        return;
      }

      if (mod && e.key === "e") {
        e.preventDefault();
        if (!editing && fileContent !== null) enterEditMode();
      }
      if (mod && e.key === "s" && editing) {
        e.preventDefault();
        saveEdit();
      }
      if (e.key === "Escape" && editing) {
        e.preventDefault();
        cancelEdit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editing, fileContent, enterEditMode, saveEdit, cancelEdit]);

  // Focus folder input when creating
  useEffect(() => {
    if (creatingFolder) {
      setTimeout(() => folderInputRef.current?.focus(), 50);
    }
  }, [creatingFolder]);

  useEffect(() => {
    if (!menuOpenForPath) return;

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-doc-menu]") && !target.closest("[data-doc-menu-button]")) {
        setMenuOpenForPath(null);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menuOpenForPath]);

  function renderTree(nodes: DocNode[], depth: number = 0, isMobile: boolean = false) {
    return nodes.map((node) => (
      <DocNodeItem
        key={node.path}
        node={node}
        depth={depth}
        isMobile={isMobile}
        selectedFile={selectedFile}
        selectedPaths={selectedPaths}
        expandedDirs={expandedDirs}
        renamingPath={renamingPath}
        renameValue={renameValue}
        menuOpenForPath={menuOpenForPath}
        onToggleDir={toggleDir}
        onFileClick={handleFileClick}
        onStartRename={startRename}
        onCancelRename={cancelRename}
        onSubmitRename={submitRename}
        onRenameValueChange={setRenameValue}
        onRequestDelete={requestDelete}
        onMenuToggle={setMenuOpenForPath}
        skipRenameBlurRef={skipRenameBlurRef}
        renameInputRef={renameInputRef}
        renderTree={renderTree}
      />
    ));
  }

  const activeSortLabel = sortKey === "name" ? "Name" : sortKey === "created" ? "Created" : "Updated";

  const sidebarHeader = (
    <div className="flex items-center justify-between border-b border-[#222222] px-3 py-2">
      <span className="text-xs font-medium text-[#888888] uppercase tracking-wider">Docs</span>
      <div className="flex items-center gap-1">
        <Dropdown className="dark bg-[#080808] border border-[#222222]">
          <DropdownTrigger>
            <button
              className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-[#888888] transition-colors hover:bg-[#1A1A1A] hover:text-white"
              title="Sort docs"
            >
              <ArrowUpDown size={12} strokeWidth={1.5} />
              <span>Sort: {activeSortLabel}</span>
            </button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="Sort options"
            variant="flat"
            selectionMode="single"
            selectedKeys={[`${sortKey}-${sortOrder}`]}
            onAction={(key) => {
              const [k, o] = (key as string).split("-");
              setSortKey(k as any);
              setSortOrder(o as any);
            }}
          >
            <DropdownItem key="name-asc" className="text-xs">Name (A-Z)</DropdownItem>
            <DropdownItem key="name-desc" className="text-xs">Name (Z-A)</DropdownItem>
            <DropdownItem key="created-desc" className="text-xs border-t border-[#222222]">Date Created (Newest)</DropdownItem>
            <DropdownItem key="created-asc" className="text-xs">Date Created (Oldest)</DropdownItem>
            <DropdownItem key="updated-desc" className="text-xs border-t border-[#222222]">Date Updated (Newest)</DropdownItem>
            <DropdownItem key="updated-asc" className="text-xs">Date Updated (Oldest)</DropdownItem>
          </DropdownMenu>
        </Dropdown>
        <button
          onClick={createPage}
          className="rounded p-1 text-[#888888] transition-colors hover:bg-[#1A1A1A] hover:text-white"
          title="New page"
        >
          <FilePlus size={14} strokeWidth={1.5} />
        </button>
        <button
          onClick={() => { setCreatingFolder(true); setNewFolderName(""); }}
          className="rounded p-1 text-[#888888] transition-colors hover:bg-[#1A1A1A] hover:text-white"
          title="New folder"
        >
          <FolderPlus size={14} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );

  const folderCreationInput = creatingFolder ? (
    <div className="border-b border-[#222222] px-3 py-2">
      <div className="flex items-center gap-1.5">
        <Folder size={14} strokeWidth={1.5} className="flex-shrink-0 text-[#888888]" />
        <input
          ref={folderInputRef}
          type="text"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") createFolder(newFolderName);
            if (e.key === "Escape") { setCreatingFolder(false); setNewFolderName(""); }
          }}
          onBlur={() => createFolder(newFolderName)}
          placeholder="Folder name..."
          className="flex-1 bg-transparent text-xs text-[#CCCCCC] outline-none placeholder:text-[#555555]"
        />
      </div>
    </div>
  ) : null;

  const activeNode = activeId ? findNodeByPath(sortedTree, activeId) : null;

  return (
    <div className="mx-auto flex h-full max-w-[1400px] gap-4">
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Desktop sidebar */}
        <div className="hidden md:flex md:flex-col w-64 flex-shrink-0 overflow-hidden rounded border border-[#222222] bg-[#0A0A0A]">
          {sidebarHeader}
          {/* Search */}
          <div className="border-b border-[#222222] p-2">
            <Input
              size="sm"
              placeholder="Search docs..."
              value={searchQuery}
              onValueChange={setSearchQuery}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
              variant="bordered"
              classNames={{ inputWrapper: "border-[#222222] bg-[#080808] h-7 min-h-7" }}
              startContent={<Search size={12} strokeWidth={1.5} className="text-[#888888]" />}
              endContent={
                searchQuery ? (
                  <button onClick={clearSearch} className="text-[#888888] hover:text-white">
                    <X size={12} strokeWidth={1.5} />
                  </button>
                ) : null
              }
            />
          </div>
          {folderCreationInput}
          {/* Tree */}
          <RootDropTarget>
            {treeLoading ? (
              <div className="space-y-1 px-2 py-2">
                <div className="skeleton h-4 w-24" />
                <div className="skeleton ml-3 h-4 w-32" />
                <div className="skeleton ml-3 h-4 w-28" />
                <div className="skeleton h-4 w-20" />
                <div className="skeleton ml-3 h-4 w-36" />
                <div className="skeleton ml-3 h-4 w-24" />
              </div>
            ) : tree.length === 0 ? (
              <p className="py-4 text-center text-xs text-[#555555]">No docs found</p>
            ) : (
              renderTree(sortedTree)
            )}
          </RootDropTarget>
        </div>

        {/* Mobile tree overlay */}
        {showMobileTree && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setShowMobileTree(false)}
            />
            <div className="fixed inset-y-0 left-0 z-50 w-72 flex flex-col overflow-hidden border-r border-[#222222] bg-[#0A0A0A] md:hidden">
              <div className="flex items-center justify-between border-b border-[#222222] p-3">
                <span className="text-xs font-medium text-[#888888] uppercase tracking-wider">Browse Docs</span>
                <div className="flex items-center gap-1">
                  <Dropdown className="dark bg-[#080808] border border-[#222222]">
                    <DropdownTrigger>
                      <button
                        className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-[#888888] transition-colors hover:bg-[#1A1A1A] hover:text-white"
                        title="Sort docs"
                      >
                        <ArrowUpDown size={12} strokeWidth={1.5} />
                        <span>Sort: {activeSortLabel}</span>
                      </button>
                    </DropdownTrigger>
                    <DropdownMenu
                      aria-label="Sort options"
                      variant="flat"
                      selectionMode="single"
            selectedKeys={[`${sortKey}-${sortOrder}`]}
            onAction={(key) => {
                        const [k, o] = (key as string).split("-");
                        setSortKey(k as any);
                        setSortOrder(o as any);
                      }}
                    >
                      <DropdownItem key="name-asc" className="text-xs">Name (A-Z)</DropdownItem>
                      <DropdownItem key="name-desc" className="text-xs">Name (Z-A)</DropdownItem>
                      <DropdownItem key="created-desc" className="text-xs border-t border-[#222222]">Date Created (Newest)</DropdownItem>
                      <DropdownItem key="created-asc" className="text-xs">Date Created (Oldest)</DropdownItem>
                      <DropdownItem key="updated-desc" className="text-xs border-t border-[#222222]">Date Updated (Newest)</DropdownItem>
                      <DropdownItem key="updated-asc" className="text-xs">Date Updated (Oldest)</DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                  <button
                    onClick={createPage}
                    className="rounded p-1 text-[#888888] transition-colors hover:bg-[#1A1A1A] hover:text-white"
                    title="New page"
                  >
                    <FilePlus size={14} strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={() => { setCreatingFolder(true); setNewFolderName(""); }}
                    className="rounded p-1 text-[#888888] transition-colors hover:bg-[#1A1A1A] hover:text-white"
                    title="New folder"
                  >
                    <FolderPlus size={14} strokeWidth={1.5} />
                  </button>
                  <button onClick={() => setShowMobileTree(false)} className="rounded p-1 text-[#888888] hover:text-white">
                    <X size={16} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
              <div className="border-b border-[#222222] p-2">
                <Input
                  size="sm"
                  placeholder="Search docs..."
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                  onKeyDown={(e) => e.key === "Enter" && doSearch()}
                  variant="bordered"
                  classNames={{ inputWrapper: "border-[#222222] bg-[#080808] h-7 min-h-7" }}
                  startContent={<Search size={12} strokeWidth={1.5} className="text-[#888888]" />}
                  endContent={
                    searchQuery ? (
                      <button onClick={clearSearch} className="text-[#888888] hover:text-white">
                        <X size={12} strokeWidth={1.5} />
                      </button>
                    ) : null
                  }
                />
              </div>
              {folderCreationInput}
              <div
                className="flex-1 overflow-y-auto p-1"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("[data-file]")) {
                    setShowMobileTree(false);
                  }
                }}
              >
                {treeLoading ? (
                  <div className="space-y-1 px-2 py-2">
                    <div className="skeleton h-4 w-24" />
                    <div className="skeleton ml-3 h-4 w-32" />
                    <div className="skeleton ml-3 h-4 w-28" />
                  </div>
                ) : tree.length === 0 ? (
                  <p className="py-4 text-center text-xs text-[#555555]">No docs found</p>
                ) : (
                  renderTree(sortedTree, 0, true)
                )}
              </div>
            </div>
          </>
        )}

        <DragOverlay dropAnimation={{
          sideEffects: defaultDropAnimationSideEffects({
            styles: {
              active: {
                opacity: "0.5",
              },
            },
          }),
        }}>
          {activeNode ? (
            <div className="flex items-center gap-1.5 rounded bg-[#1A1A1A] px-2 py-1.5 text-xs text-white shadow-xl ring-1 ring-[#8b5cf6]/50">
              {activeNode.type === "directory" ? (
                <Folder size={14} className="text-[#888888]" />
              ) : (
                <FileText size={14} className="text-[#888888]" />
              )}
              <span className="truncate">{activeNode.name}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Content pane */}
      <div className="flex-1 overflow-y-auto rounded border border-[#222222] bg-[#0A0A0A] p-4 md:p-6">
        {/* Mobile browse button */}
        <div className="md:hidden mb-3">
          <button
            onClick={() => setShowMobileTree(true)}
            className="flex items-center gap-2 rounded-lg border border-[#222222] bg-[#121212] px-3 py-2 text-xs text-[#CCCCCC] hover:bg-[#1A1A1A] transition-colors"
          >
            <Folder size={14} strokeWidth={1.5} className="text-[#888888]" />
            Browse Docs
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-4 w-1/2" />
            <div className="skeleton h-4 w-5/6" />
          </div>
        ) : searchResults ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#888888]">
                {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for &quot;{searchQuery}&quot;
              </p>
              <button onClick={clearSearch} className="text-xs text-[#888888] hover:text-white">
                Clear search
              </button>
            </div>
            {searchResults.length === 0 && (
              <p className="py-8 text-center text-sm text-[#555555]">No matches found</p>
            )}
            {searchResults.map((result, i) => (
              <button
                key={i}
                onClick={() => {
                  setSelectedPaths(new Set([result.path]));
                  setSelectionAnchor(result.path);
                  openFileWithUnsavedGuard(result.path);
                }}
                className="block w-full rounded border border-[#222222] bg-[#121212] p-3 text-left transition-colors hover:bg-[#1A1A1A]"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-mono text-[#888888]">{result.path}</p>
                  <span className="text-[10px] text-[#555555]">
                    {result.matches} match{result.matches !== 1 ? "es" : ""}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#CCCCCC] line-clamp-2">{result.snippet}</p>
              </button>
            ))}
          </div>
        ) : fileContent !== null ? (
          <div className="px-4 py-8 md:px-8 md:py-12">
            <div className="mx-auto max-w-[720px]">
              {/* Breadcrumbs */}
              <div className="mb-2 flex items-center gap-1 text-[10px] font-mono text-[#555555]">
                <Folder size={10} strokeWidth={1.5} />
                <span>Root</span>
                {selectedFile?.split("/").slice(0, -1).map((part, i, arr) => (
                  <React.Fragment key={i}>
                    <span>/</span>
                    <span className="truncate max-w-[100px]">{part}</span>
                  </React.Fragment>
                ))}
              </div>

              {/* Document header */}
              <div className="mb-6 flex items-center justify-between border-b border-[#222222] pb-3">
                <h1 className="text-sm font-semibold text-white truncate mr-4">
                  {selectedFile?.split("/").pop()}
                </h1>
                <div className="flex items-center gap-2">
                  {editing ? (
                    <>
                      <Button
                        size="sm"
                        variant="light"
                        onPress={cancelEdit}
                        className="h-7 text-xs text-[#888888] hover:text-white"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        color="primary"
                        onPress={saveEdit}
                        isLoading={saving}
                        startContent={!saving && <Save size={12} strokeWidth={1.5} />}
                        className="h-7 text-xs"
                      >
                        Save
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="bordered"
                      onPress={enterEditMode}
                      startContent={<Pencil size={12} strokeWidth={1.5} />}
                      className="h-7 text-xs border-[#222222] text-[#888888] hover:text-white"
                    >
                      Edit
                    </Button>
                  )}
                </div>
              </div>

              {/* Content: View or Edit */}
              {editing ? (
                <textarea
                  ref={editorRef}
                  value={editContent}
                  onChange={(e) => {
                    setEditContent(e.target.value);
                    setDirty(true);
                  }}
                  className="w-full min-h-[60vh] resize-y rounded-md border border-[#222222] bg-[#080808] p-4 font-mono text-sm text-[#CCCCCC] leading-relaxed outline-none focus:border-[#333333] transition-colors"
                  spellCheck={false}
                />
              ) : (
                <article className="markdown-prose prose prose-invert prose-sm max-w-none prose-p:text-[#D4D4D8] prose-p:text-[13px] prose-p:leading-[1.6] prose-p:mb-4 prose-headings:text-white prose-h1:text-xl prose-h1:font-semibold prose-h1:mt-8 prose-h1:mb-4 prose-h2:text-base prose-h2:font-semibold prose-h2:mt-6 prose-h2:mb-3 prose-h3:text-xs prose-h3:font-bold prose-h3:mt-4 prose-h3:mb-2 prose-strong:text-white prose-a:text-[#8b5cf6] prose-a:no-underline hover:prose-a:underline prose-code:text-[#CCCCCC] prose-code:bg-[#1a1a1a] prose-code:border prose-code:border-[#333333] prose-code:px-1 prose-code:py-0.5 prose-code:rounded-sm prose-code:text-xs prose-code:font-mono prose-pre:bg-[#111111] prose-pre:border prose-pre:border-[#333333] prose-pre:rounded-md prose-pre:p-4 prose-pre:text-xs prose-pre:my-4 prose-ul:my-4 prose-ul:ml-0 prose-ul:pl-5 prose-ul:list-disc prose-ul:space-y-1.5 prose-ol:my-4 prose-ol:ml-0 prose-ol:pl-5 prose-ol:list-decimal prose-ol:space-y-1.5 prose-li:text-[#D4D4D8] prose-li:leading-[1.6] prose-li:my-1 prose-li:pl-1 prose-table:border-collapse prose-table:my-6 prose-table:w-full prose-th:border prose-th:border-[#333333] prose-th:bg-[#111111] prose-th:px-3 prose-th:py-1.5 prose-th:text-left prose-th:text-xs prose-th:font-medium prose-td:border prose-td:border-[#333333] prose-td:px-3 prose-td:py-1.5 prose-td:text-xs prose-blockquote:my-4 prose-blockquote:pl-4 prose-blockquote:py-1 prose-blockquote:border-l-2 prose-blockquote:border-[#555555] prose-blockquote:text-[#888888] prose-blockquote:italic prose-hr:my-8 prose-hr:border-0 prose-hr:border-t prose-hr:border-[#222222]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{fileContent}</ReactMarkdown>
                </article>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <FileText size={32} strokeWidth={1} className="text-[#333333]" />
            <p className="text-sm text-[#555555]">Select a doc to view</p>
            <p className="text-xs text-[#444444]">or search across all docs</p>
          </div>
        )}
      </div>

      {moveToast && (
        <div className="fixed bottom-4 right-4 z-[100] flex items-center gap-3 rounded border border-[#333333] bg-[#0A0A0A] px-3 py-2 text-xs text-[#CCCCCC] shadow-xl">
          <span>
            Moved {moveToast.count} item{moveToast.count === 1 ? "" : "s"}
          </span>
          <button
            onClick={undoLastMove}
            className="rounded px-2 py-0.5 text-[#8b5cf6] hover:bg-[#1A1A1A] hover:text-[#a78bfa]"
          >
            Undo
          </button>
        </div>
      )}

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        className="dark bg-[#080808] text-white border border-neutral-800"
      >
        <ModalContent>
          <ModalHeader className="border-b border-[#222222] text-sm">Delete document?</ModalHeader>
          <ModalBody className="py-4">
            <p className="text-sm text-[#CCCCCC]">
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This cannot be undone.
            </p>
          </ModalBody>
          <ModalFooter className="border-t border-[#222222]">
            <Button
              size="sm"
              variant="flat"
              onPress={() => setDeleteTarget(null)}
              isDisabled={deleting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              color="danger"
              onPress={confirmDelete}
              isLoading={deleting}
            >
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Generic confirmation modal */}
      <Modal
        isOpen={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        className="dark bg-[#080808] text-white border border-neutral-800"
      >
        <ModalContent>
          <ModalHeader className="border-b border-[#222222] text-sm">
            {confirmModal?.title}
          </ModalHeader>
          <ModalBody className="py-4">
            <p className="text-sm text-[#CCCCCC]">{confirmModal?.message}</p>
          </ModalBody>
          <ModalFooter className="border-t border-[#222222]">
            <Button size="sm" variant="flat" onPress={() => setConfirmModal(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              color="primary"
              onPress={() => {
                confirmModal?.onConfirm();
                setConfirmModal(null);
              }}
            >
              Confirm
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Generic alert modal */}
      <Modal
        isOpen={!!alertModal}
        onClose={() => setAlertModal(null)}
        className="dark bg-[#080808] text-white border border-neutral-800"
      >
        <ModalContent>
          <ModalHeader className="border-b border-[#222222] text-sm">
            {alertModal?.title}
          </ModalHeader>
          <ModalBody className="py-4">
            <p className="text-sm text-[#CCCCCC]">{alertModal?.message}</p>
          </ModalBody>
          <ModalFooter className="border-t border-[#222222]">
            <Button size="sm" color="primary" onPress={() => setAlertModal(null)}>
              OK
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
