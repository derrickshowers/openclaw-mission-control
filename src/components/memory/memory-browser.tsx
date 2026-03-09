"use client";

import { useState, useEffect, useCallback } from "react";
import { Button, Input } from "@heroui/react";
import { Folder, FileText, Search, ArrowLeft, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const AGENTS = ["frank", "tom", "michael", "joanna"];

interface FileEntry {
  name: string;
  type: "file" | "directory";
  path: string;
}

export function MemoryBrowser() {
  const [selectedAgent, setSelectedAgent] = useState(AGENTS[0]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [currentDir, setCurrentDir] = useState("");
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    loadFiles(selectedAgent, currentDir);
  }, [selectedAgent, currentDir, loadFiles]);

  return (
    <div className="mx-auto flex h-full max-w-[1200px] gap-4">
      {/* Left: File Tree */}
      <div className="w-64 flex-shrink-0 overflow-y-auto rounded border border-[#222222] bg-[#0A0A0A]">
        {/* Agent Tabs */}
        <div className="flex flex-wrap border-b border-[#222222]">
          {AGENTS.map((agent) => (
            <button
              key={agent}
              onClick={() => {
                setSelectedAgent(agent);
                setCurrentDir("");
                setFileContent(null);
                setSearchResults(null);
              }}
              className={`flex-1 px-2 py-2 text-xs capitalize transition-colors ${
                selectedAgent === agent
                  ? "bg-[#1A1A1A] text-white"
                  : "text-[#888888] hover:text-white"
              }`}
            >
              {agent}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="border-b border-[#222222] p-2">
          <Input
            size="sm"
            placeholder="Search..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            onKeyDown={(e) => e.key === "Enter" && search()}
            variant="bordered"
            classNames={{ inputWrapper: "border-[#222222] bg-[#080808] h-7 min-h-7" }}
          />
        </div>

        {/* Breadcrumb */}
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

        {/* File List */}
        <div className="p-1">
          {files.map((file) => (
            <button
              key={file.path}
              onClick={() => {
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

      {/* Right: Content */}
      <div className="flex-1 overflow-y-auto rounded border border-[#222222] bg-[#0A0A0A] p-4">
        {loading ? (
          <div className="space-y-2">
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-4 w-1/2" />
            <div className="skeleton h-4 w-5/6" />
          </div>
        ) : searchResults ? (
          <div className="space-y-3">
            <p className="text-xs text-[#888888]">
              {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for &quot;{searchQuery}&quot;
            </p>
            {searchResults.map((result, i) => (
              <button
                key={i}
                onClick={() => loadFile(result.agent, result.path)}
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
                <span className="text-xs font-mono text-[#888888]">{currentFile}</span>
                <Button
                  size="sm"
                  variant="flat"
                  className="text-xs border border-[#222222] bg-[#080808]"
                  onPress={() => { setFileContent(null); setCurrentFile(""); }}
                >
                  Close
                </Button>
              </div>
              <article className="prose prose-invert prose-sm max-w-none leading-relaxed prose-p:text-[#D4D4D8] prose-p:mb-4 prose-headings:text-white prose-h1:text-2xl prose-h1:font-semibold prose-h1:mb-4 prose-h2:text-lg prose-h2:font-semibold prose-h2:mb-3 prose-h3:text-sm prose-h3:font-bold prose-h3:mb-2 prose-strong:text-white prose-a:text-[#8b5cf6] prose-a:no-underline hover:prose-a:underline prose-code:text-[#CCCCCC] prose-code:bg-[#1a1a1a] prose-code:border prose-code:border-[#333333] prose-code:px-1 prose-code:py-0.5 prose-code:rounded-sm prose-code:text-xs prose-code:font-mono prose-pre:bg-[#111111] prose-pre:border prose-pre:border-[#333333] prose-pre:rounded-md prose-pre:p-4 prose-pre:text-xs prose-table:border-collapse prose-th:border prose-th:border-[#333333] prose-th:bg-[#111111] prose-th:px-3 prose-th:py-1.5 prose-th:text-left prose-th:text-xs prose-th:font-medium prose-td:border prose-td:border-[#333333] prose-td:px-3 prose-td:py-1.5 prose-td:text-xs prose-blockquote:border-l-2 prose-blockquote:border-[#555555] prose-blockquote:text-[#888888] prose-blockquote:italic prose-li:text-[#D4D4D8]">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{fileContent}</ReactMarkdown>
              </article>
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
