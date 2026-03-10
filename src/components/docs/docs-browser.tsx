"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button, Input } from "@heroui/react";
import {
  Folder,
  FileText,
  Search,
  ChevronRight,
  ChevronDown,
  X,
  Pencil,
  Save,
  Plus,
  FolderPlus,
  FilePlus,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface DocNode {
  name: string;
  type: "file" | "directory";
  path: string;
  children?: DocNode[];
}

interface SearchResult {
  path: string;
  name: string;
  snippet: string;
  matches: number;
}

export function DocsBrowser() {
  const [tree, setTree] = useState<DocNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [treeLoading, setTreeLoading] = useState(true);
  const [showMobileTree, setShowMobileTree] = useState(false);

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

  // Load tree
  const loadTree = useCallback(async () => {
    try {
      const res = await fetch("/api/mc/docs/tree");
      const data = await res.json();
      if (Array.isArray(data)) {
        setTree(data);
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
  }, []);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const loadFile = useCallback(async (filePath: string) => {
    setLoading(true);
    setEditing(false);
    setDirty(false);
    try {
      const res = await fetch(`/api/mc/docs/read?path=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      setFileContent(data.content || "");
      setSelectedFile(filePath);
      setSearchResults(null);
    } catch {
      setFileContent("Error loading file");
    } finally {
      setLoading(false);
    }
  }, []);

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
      if (!confirm("Discard unsaved changes?")) return;
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
      alert("Failed to save. Please try again.");
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
        alert("Failed to create page.");
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
        alert(data.error || "Failed to create folder.");
        return;
      }
      await loadTree();
    } catch {
      alert("Failed to create folder.");
    } finally {
      setCreatingFolder(false);
      setNewFolderName("");
    }
  }, [getActiveFolder, loadTree]);

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

  function renderTree(nodes: DocNode[], depth: number = 0, isMobile: boolean = false) {
    return nodes.map((node) => {
      const isExpanded = expandedDirs.has(node.path);
      const isSelected = selectedFile === node.path;

      if (node.type === "directory") {
        return (
          <div key={node.path}>
            <button
              onClick={() => toggleDir(node.path)}
              className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs text-[#CCCCCC] transition-colors hover:bg-[#1A1A1A]"
              style={{ paddingLeft: `${8 + depth * 12}px` }}
            >
              {isExpanded ? (
                <ChevronDown size={12} strokeWidth={1.5} className="flex-shrink-0 text-[#888888]" />
              ) : (
                <ChevronRight size={12} strokeWidth={1.5} className="flex-shrink-0 text-[#888888]" />
              )}
              <Folder size={14} strokeWidth={1.5} className="flex-shrink-0 text-[#888888]" />
              <span className="truncate">{node.name}</span>
            </button>
            {isExpanded && node.children && (
              <div>{renderTree(node.children, depth + 1, isMobile)}</div>
            )}
          </div>
        );
      }

      return (
        <button
          key={node.path}
          data-file
          onClick={() => {
            if (editing && dirty) {
              if (!confirm("Discard unsaved changes?")) return;
            }
            loadFile(node.path);
            if (isMobile) setShowMobileTree(false);
          }}
          className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-[#1A1A1A] ${
            isSelected ? "bg-[#1A1A1A] text-white" : "text-[#CCCCCC]"
          }`}
          style={{ paddingLeft: `${20 + depth * 12}px` }}
        >
          <FileText size={14} strokeWidth={1.5} className="flex-shrink-0 text-[#888888]" />
          <span className="truncate">{node.name}</span>
        </button>
      );
    });
  }

  const sidebarHeader = (
    <div className="flex items-center justify-between border-b border-[#222222] px-3 py-2">
      <span className="text-xs font-medium text-[#888888] uppercase tracking-wider">Docs</span>
      <div className="flex items-center gap-1">
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

  return (
    <div className="mx-auto flex h-full max-w-[1400px] gap-4">
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
        <div className="flex-1 overflow-y-auto p-1">
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
            renderTree(tree)
          )}
        </div>
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
                renderTree(tree, 0, true)
              )}
            </div>
          </div>
        </>
      )}

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
                onClick={() => loadFile(result.path)}
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
              {/* Document header */}
              <div className="mb-6 flex items-center justify-between border-b border-[#222222] pb-3">
                <span className="text-xs font-mono text-[#888888]">{selectedFile}</span>
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
    </div>
  );
}
