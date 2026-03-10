"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button, Input } from "@heroui/react";
import { Folder, FileText, Search, ArrowLeft, X, Pencil, Save } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const DEFAULT_SOURCES = ["frank", "tom", "michael", "joanna", "shared"];

interface FileEntry {
  name: string;
  type: "file" | "directory";
  path: string;
}

export function MemoryBrowser() {
  const [sources, setSources] = useState<string[]>(DEFAULT_SOURCES);
  const [selectedAgent, setSelectedAgent] = useState(DEFAULT_SOURCES[0]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [currentDir, setCurrentDir] = useState("");
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const isReadOnlySource = selectedAgent === "shared";

  const loadFiles = useCallback(async (agent: string, dir: string = "") => {
    setLoading(true);
    try {
      const params = dir ? `?dir=${encodeURIComponent(dir)}` : "";
      const res = await fetch(`/api/mc/memory/${agent}${params}`);
      const data = await res.json();
      setFiles(Array.isArray(data) ? data : []);
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFile = useCallback(async (agent: string, path: string) => {
    setLoading(true);
    setEditing(false);
    setDirty(false);
    try {
      const res = await fetch(`/api/mc/memory/${agent}/${path}`);
      const data = await res.json();
      setFileContent(data.content || "");
      setCurrentFile(path);
      setSearchResults(null);
    } catch {
      setFileContent("Error loading file");
    } finally {
      setLoading(false);
    }
  }, []);

  const search = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/mc/memory/search?q=${encodeURIComponent(searchQuery)}&agent=${selectedAgent}`
      );
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
      setFileContent(null);
    } catch {
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedAgent]);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setSearchResults(null);
  }, []);

  const enterEditMode = useCallback(() => {
    if (fileContent === null) return;
    setEditContent(fileContent);
    setEditing(true);
    setDirty(false);
    setTimeout(() => editorRef.current?.focus(), 50);
  }, [fileContent]);

  const cancelEdit = useCallback(() => {
    if (dirty && !confirm("Discard unsaved changes?")) return;
    setEditing(false);
    setDirty(false);
  }, [dirty]);

  const saveEdit = useCallback(async () => {
    if (!currentFile) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/mc/memory/${selectedAgent}/${currentFile}`, {
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
  }, [selectedAgent, currentFile, editContent]);

  useEffect(() => {
    const loadSources = async () => {
      try {
        const res = await fetch("/api/mc/memory");
        const data = await res.json();
        const nextSources = Object.keys(data || {});
        if (nextSources.length > 0) {
          setSources(nextSources);
          setSelectedAgent((prev) => (nextSources.includes(prev) ? prev : nextSources[0]));
        }
      } catch {
        setSources(DEFAULT_SOURCES);
      }
    };

    loadSources();
  }, []);

  useEffect(() => {
    loadFiles(selectedAgent, currentDir);
  }, [selectedAgent, currentDir, loadFiles]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

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
        if (!editing && fileContent !== null && !isReadOnlySource) enterEditMode();
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
  }, [editing, fileContent, enterEditMode, saveEdit, cancelEdit, isReadOnlySource]);

  return (
    <div className="mx-auto flex h-full max-w-[1200px] gap-4">
      <div className="w-64 flex-shrink-0 overflow-y-auto rounded border border-[#222222] bg-[#0A0A0A]">
        <div className="border-b border-[#222222] p-2">
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-[#777777]">Source</label>
          <select
            value={selectedAgent}
            onChange={(e) => {
              const source = e.target.value;
              if (editing && dirty && !confirm("Discard unsaved changes?")) return;
              setSelectedAgent(source);
              setCurrentDir("");
              setFileContent(null);
              setCurrentFile("");
              setSearchResults(null);
              setEditing(false);
              setDirty(false);
            }}
            className="h-8 w-full rounded border border-[#222222] bg-[#080808] px-2 text-xs text-[#CCCCCC] outline-none focus:border-[#333333]"
          >
            {sources.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </div>

        <div className="border-b border-[#222222] p-2">
          <Input
            size="sm"
            placeholder="Search..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            onKeyDown={(e) => e.key === "Enter" && search()}
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

        {currentDir && (
          <div className="border-b border-[#222222] px-3 py-1.5">
            <button
              onClick={() => {
                const parent = currentDir.split("/").slice(0, -1).join("/");
                setCurrentDir(parent);
              }}
              className="flex items-center gap-1 text-xs text-[#888888] hover:text-white"
            >
              <ArrowLeft size={12} strokeWidth={1.5} /> {currentDir || "root"}
            </button>
          </div>
        )}

        <div className="p-1">
          {files.map((file) => (
            <button
              key={file.path}
              onClick={() => {
                if (editing && dirty && !confirm("Discard unsaved changes?")) return;
                if (file.type === "directory") {
                  setCurrentDir(file.path);
                } else {
                  loadFile(selectedAgent, file.path);
                }
              }}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-[#1A1A1A] ${
                currentFile === file.path ? "bg-[#1A1A1A] text-white" : "text-[#CCCCCC]"
              }`}
            >
              <span className="text-muted-foreground">
                {file.type === "directory" ? <Folder size={14} strokeWidth={1.5} /> : <FileText size={14} strokeWidth={1.5} />}
              </span>
              {file.name}
            </button>
          ))}
          {files.length === 0 && !loading && (
            <p className="py-4 text-center text-xs text-[#555555]">Empty</p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto rounded border border-[#222222] bg-[#0A0A0A] p-4">
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
            {searchResults.map((result, i) => (
              <button
                key={i}
                onClick={() => {
                  if (editing && dirty && !confirm("Discard unsaved changes?")) return;
                  setSelectedAgent(result.agent);
                  loadFile(result.agent, result.path);
                }}
                className="block w-full rounded border border-[#222222] bg-[#121212] p-3 text-left hover:bg-[#1A1A1A]"
              >
                <p className="text-xs font-mono text-[#888888]">
                  {result.agent}/{result.path}
                </p>
                <p className="mt-1 text-sm text-[#CCCCCC]">
                  ...{result.snippet}...
                </p>
              </button>
            ))}
          </div>
        ) : fileContent !== null ? (
          <div className="px-8 py-12">
            <div className="mx-auto max-w-3xl">
              <div className="mb-6 flex items-center justify-between border-b border-[#222222] pb-3">
                <span className="text-xs font-mono text-[#888888]">{selectedAgent}/{currentFile}</span>
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
                    <>
                      {!isReadOnlySource && (
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
                      <Button
                        size="sm"
                        variant="flat"
                        className="h-7 text-xs border border-[#222222] bg-[#080808]"
                        onPress={() => {
                          if (editing && dirty && !confirm("Discard unsaved changes?")) return;
                          setFileContent(null);
                          setCurrentFile("");
                          setEditing(false);
                          setDirty(false);
                        }}
                      >
                        Close
                      </Button>
                    </>
                  )}
                </div>
              </div>

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
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-[#555555]">
              Select a file to view
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
