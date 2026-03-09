"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@heroui/react";
import { Folder, FileText, Search, ChevronRight, ChevronDown, X } from "lucide-react";
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

  // Load tree on mount
  useEffect(() => {
    async function loadTree() {
      try {
        const res = await fetch("/api/mc/docs/tree");
        const data = await res.json();
        if (Array.isArray(data)) {
          setTree(data);
          // Expand all directories by default
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
    loadTree();
  }, []);

  const loadFile = useCallback(async (filePath: string) => {
    setLoading(true);
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
      if (next.has(dirPath)) {
        next.delete(dirPath);
      } else {
        next.add(dirPath);
      }
      return next;
    });
  };

  function renderTree(nodes: DocNode[], depth: number = 0) {
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
              <div>{renderTree(node.children, depth + 1)}</div>
            )}
          </div>
        );
      }

      return (
        <button
          key={node.path}
          onClick={() => loadFile(node.path)}
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

  return (
    <div className="mx-auto flex h-full max-w-[1400px] gap-4">
      {/* Left: File Tree */}
      <div className="w-64 flex-shrink-0 overflow-y-auto rounded border border-[#222222] bg-[#0A0A0A]">
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

        {/* Tree */}
        <div className="p-1">
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

      {/* Right: Content Pane */}
      <div className="flex-1 overflow-y-auto rounded border border-[#222222] bg-[#0A0A0A] p-6">
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
              <button
                onClick={clearSearch}
                className="text-xs text-[#888888] hover:text-white"
              >
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
          <div className="px-8 py-12">
            <div className="mx-auto max-w-3xl">
              <div className="mb-6 flex items-center justify-between border-b border-[#222222] pb-3">
                <span className="text-xs font-mono text-[#888888]">{selectedFile}</span>
              </div>
              <article className="prose prose-invert prose-sm max-w-none leading-relaxed prose-p:text-[#D4D4D8] prose-p:mb-4 prose-headings:text-white prose-h1:text-2xl prose-h1:font-semibold prose-h1:mb-4 prose-h2:text-lg prose-h2:font-semibold prose-h2:mb-3 prose-h3:text-sm prose-h3:font-bold prose-h3:mb-2 prose-strong:text-white prose-a:text-[#8b5cf6] prose-a:no-underline hover:prose-a:underline prose-code:text-[#CCCCCC] prose-code:bg-[#1a1a1a] prose-code:border prose-code:border-[#333333] prose-code:px-1 prose-code:py-0.5 prose-code:rounded-sm prose-code:text-xs prose-code:font-mono prose-pre:bg-[#111111] prose-pre:border prose-pre:border-[#333333] prose-pre:rounded-md prose-pre:p-4 prose-pre:text-xs prose-table:border-collapse prose-th:border prose-th:border-[#333333] prose-th:bg-[#111111] prose-th:px-3 prose-th:py-1.5 prose-th:text-left prose-th:text-xs prose-th:font-medium prose-td:border prose-td:border-[#333333] prose-td:px-3 prose-td:py-1.5 prose-td:text-xs prose-blockquote:border-l-2 prose-blockquote:border-[#555555] prose-blockquote:text-[#888888] prose-blockquote:italic prose-li:text-[#D4D4D8]">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{fileContent}</ReactMarkdown>
              </article>
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
