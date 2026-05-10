"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem } from "@heroui/react";
import { Folder, FileText, Search, ArrowLeft, X, Pencil, Save } from "lucide-react";
import { MarkdownViewer } from "@/components/shared/markdown-viewer";
import { TEAM_AGENT_IDS } from "@/lib/agents";

const DEFAULT_SOURCES = [...TEAM_AGENT_IDS, "shared"];

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
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [alertModal, setAlertModal] = useState<{ title: string; message: string } | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const isReadOnlySource = false;

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

  const withDiscardGuard = useCallback(
    (next: () => void) => {
      if (editing && dirty) {
        setConfirmModal({
          title: "Discard unsaved changes?",
          message: "You have unsaved edits. Discard them and continue?",
          onConfirm: () => {
            setEditing(false);
            setDirty(false);
            next();
          },
        });
        return;
      }
      next();
    },
    [editing, dirty]
  );

  const enterEditMode = useCallback(() => {
    if (fileContent === null) return;
    setEditContent(fileContent);
    setEditing(true);
    setDirty(false);
    setTimeout(() => editorRef.current?.focus(), 50);
  }, [fileContent]);

  const cancelEdit = useCallback(() => {
    withDiscardGuard(() => {
      setEditing(false);
      setDirty(false);
    });
  }, [withDiscardGuard]);

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
      setAlertModal({ title: "Save failed", message: "Failed to save. Please try again." });
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
    <>
      <div className="mx-auto flex h-full max-w-[1200px] gap-4">
      <div className="w-64 flex-shrink-0 overflow-y-auto rounded border border-divider bg-white dark:bg-[#0A0A0A]">
        <div className="border-b border-divider p-2">
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-foreground-400">Source</label>
          <Select
            size="sm"
            selectedKeys={[selectedAgent]}
            onChange={(e) => {
              const source = e.target.value;
              if (!source) return;
              withDiscardGuard(() => {
                setSelectedAgent(source);
                setCurrentDir("");
                setFileContent(null);
                setCurrentFile("");
                setSearchResults(null);
                setEditing(false);
                setDirty(false);
              });
            }}
            variant="bordered"
            classNames={{
              trigger: "border-divider bg-white dark:bg-[#080808] min-h-8 h-8",
              value: "text-xs text-foreground-600 dark:text-[#CCCCCC]",
            }}
            aria-label="Select source"
          >
            {sources.map((source) => (
              <SelectItem key={source} textValue={source} className="text-xs">
                {source}
              </SelectItem>
            ))}
          </Select>
        </div>

        <div className="border-b border-divider p-2">
          <Input
            size="sm"
            placeholder="Search..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            onKeyDown={(e) => e.key === "Enter" && search()}
            variant="bordered"
            classNames={{ inputWrapper: "border-divider bg-white dark:bg-[#080808] h-7 min-h-7" }}
            startContent={<Search size={12} strokeWidth={1.5} className="text-foreground-400" />}
            endContent={
              searchQuery ? (
                <button onClick={clearSearch} className="text-foreground-400 hover:text-foreground">
                  <X size={12} strokeWidth={1.5} />
                </button>
              ) : null
            }
          />
        </div>

        {currentDir && (
          <div className="border-b border-divider px-3 py-1.5">
            <button
              onClick={() => {
                const parent = currentDir.split("/").slice(0, -1).join("/");
                setCurrentDir(parent);
              }}
              className="flex items-center gap-1 text-xs text-foreground-400 hover:text-foreground"
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
                withDiscardGuard(() => {
                  if (file.type === "directory") {
                    setCurrentDir(file.path);
                  } else {
                    loadFile(selectedAgent, file.path);
                  }
                });
              }}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-gray-100 dark:hover:bg-[#1A1A1A] ${
                currentFile === file.path ? "bg-gray-100 dark:bg-[#1A1A1A] text-foreground dark:text-white" : "text-foreground-600 dark:text-[#CCCCCC]"
              }`}
            >
              <span className="text-muted-foreground">
                {file.type === "directory" ? <Folder size={14} strokeWidth={1.5} /> : <FileText size={14} strokeWidth={1.5} />}
              </span>
              {file.name}
            </button>
          ))}
          {files.length === 0 && !loading && (
            <p className="py-4 text-center text-xs text-foreground-300">Empty</p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto rounded border border-divider bg-white dark:bg-[#0A0A0A] p-4">
        {loading ? (
          <div className="space-y-2">
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-4 w-1/2" />
            <div className="skeleton h-4 w-5/6" />
          </div>
        ) : searchResults ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-foreground-400">
                {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for &quot;{searchQuery}&quot;
              </p>
              <button onClick={clearSearch} className="text-xs text-foreground-400 hover:text-foreground">
                Clear search
              </button>
            </div>
            {searchResults.map((result, i) => (
              <button
                key={i}
                onClick={() => {
                  withDiscardGuard(() => {
                    setSelectedAgent(result.agent);
                    loadFile(result.agent, result.path);
                  });
                }}
                className="block w-full rounded border border-divider bg-gray-50 dark:bg-[#121212] p-3 text-left hover:bg-gray-100 dark:hover:bg-[#1A1A1A] transition-colors"
              >
                <p className="text-xs font-mono text-foreground-400">
                  {result.agent}/{result.path}
                </p>
                <p className="mt-1 text-sm text-foreground-600 dark:text-[#CCCCCC]">
                  ...{result.snippet}...
                </p>
              </button>
            ))}
          </div>
        ) : fileContent !== null ? (
          <div className="px-8 py-12">
            <div className="mx-auto max-w-3xl">
              <div className="mb-6 flex items-center justify-between border-b border-divider pb-3">
                <span className="text-xs font-mono text-foreground-400">{selectedAgent}/{currentFile}</span>
                <div className="flex items-center gap-2">
                  {editing ? (
                    <>
                      <Button
                        size="sm"
                        variant="light"
                        onPress={cancelEdit}
                        className="h-7 text-xs text-foreground-400 hover:text-foreground"
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
                          className="h-7 text-xs border-divider text-foreground-400 hover:text-foreground"
                        >
                          Edit
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="flat"
                        className="h-7 text-xs border border-divider bg-gray-50 dark:bg-[#080808]"
                        onPress={() => {
                          withDiscardGuard(() => {
                            setFileContent(null);
                            setCurrentFile("");
                            setEditing(false);
                            setDirty(false);
                          });
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
                  className="w-full min-h-[60vh] resize-y rounded-md border border-divider bg-gray-50 dark:bg-[#080808] p-4 font-mono text-sm text-foreground dark:text-[#CCCCCC] leading-relaxed outline-none focus:border-foreground-300 transition-colors"
                  spellCheck={false}
                />
              ) : (
                <MarkdownViewer content={fileContent} />
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-foreground-300">
              Select a file to view
            </p>
          </div>
        )}
      </div>
      </div>

      <Modal
        isOpen={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        className="bg-white dark:bg-[#121212] text-foreground dark:text-white"
      >
        <ModalContent>
          <ModalHeader className="border-b border-divider text-sm">{confirmModal?.title}</ModalHeader>
          <ModalBody className="py-4">
            <p className="text-sm text-foreground-600 dark:text-[#CCCCCC]">{confirmModal?.message}</p>
          </ModalBody>
          <ModalFooter className="border-t border-divider">
            <Button size="sm" variant="flat" onPress={() => setConfirmModal(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              color="danger"
              onPress={() => {
                confirmModal?.onConfirm();
                setConfirmModal(null);
              }}
            >
              Discard
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={!!alertModal}
        onClose={() => setAlertModal(null)}
        className="bg-white dark:bg-[#121212] text-foreground dark:text-white"
      >
        <ModalContent>
          <ModalHeader className="border-b border-divider text-sm">{alertModal?.title}</ModalHeader>
          <ModalBody className="py-4">
            <p className="text-sm text-foreground-600 dark:text-[#CCCCCC]">{alertModal?.message}</p>
          </ModalBody>
          <ModalFooter className="border-t border-divider">
            <Button size="sm" color="primary" onPress={() => setAlertModal(null)}>
              OK
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
