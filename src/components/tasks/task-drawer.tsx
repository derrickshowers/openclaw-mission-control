"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useSSE } from "@/hooks/use-sse";
import { Button, Input, Textarea, Select, SelectItem, Chip, Card, CardBody, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/react";
import { MentionTextarea } from "@/components/shared/mention-textarea";
import { X, Trash2, Send, Paperclip, ImagePlus, XCircle, Folder } from "lucide-react";
import { api } from "@/lib/api";
import type { Task, TaskComment, TaskAttachment, Project } from "@/lib/api";
import { formatLocal, parseUTC } from "@/lib/dates";
import { KNOWN_AGENT_IDS, resolveAgentAvatarUrl } from "@/lib/agents";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const COLUMNS = [
  { id: "backlog", label: "Backlog" },
  { id: "in_progress", label: "In Progress" },
  { id: "blocked", label: "Blocked" },
  { id: "done", label: "Done" },
];

const AGENTS = [...KNOWN_AGENT_IDS];

const statusColors: Record<string, "default" | "primary" | "danger" | "success"> = {
  backlog: "default",
  in_progress: "primary",
  blocked: "danger",
  done: "success",
};

const sortCommentsDesc = (items: TaskComment[]) =>
  [...items].sort(
    (a, b) => parseUTC(b.created_at).getTime() - parseUTC(a.created_at).getTime()
  );

// Helper to process text nodes and highlight @mentions
const processChildrenForMentions = (children: any): any => {
  if (!children) return children;
  
  const processNode = (child: any, index: number): any => {
    if (typeof child === 'string') {
      // Split on @mentions and wrap them
      const parts = child.split(/(@\w+)/g);
      return parts.map((part: string, i: number) =>
        /^@\w+$/.test(part) ? (
          <span key={`${index}-${i}`} className="inline-block rounded px-1 py-0.5 bg-primary-500/15 text-primary-600 dark:text-primary-400 font-medium text-xs">
            {part}
          </span>
        ) : (
          part
        )
      );
    }
    return child;
  };

  if (Array.isArray(children)) {
    return children.map((child, i) => processNode(child, i));
  }
  
  return processNode(children, 0);
};

interface TaskDrawerProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (task: Task) => void;
}

export function TaskDrawer({ task, isOpen, onClose, onUpdate }: TaskDrawerProps) {
  const { data: session } = useSession();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [projects, setProjects] = useState<Project[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      api.getComments(task.id).then((rows) => setComments(sortCommentsDesc(rows))).catch(console.error);
      api.getAttachments(task.id).then(setAttachments).catch(console.error);
      api.getProjects().then(setProjects).catch(console.error);
    }
  }, [isOpen, task.id]);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || "");
  }, [task.title, task.description]);

  // Live updates for comments and attachments
  const drawerEvents = ["comment.created", "attachment.created", "attachment.deleted"];
  const { lastEvent: drawerEvent } = useSSE(drawerEvents);

  useEffect(() => {
    if (!drawerEvent || !isOpen) return;
    const { event, data } = drawerEvent;

    if (event === "comment.created" && data.comment?.task_id === task.id) {
      setComments((prev) => {
        if (prev.some((c) => c.id === data.comment.id)) return prev;
        return sortCommentsDesc([data.comment, ...prev]);
      });
    }

    if (event === "attachment.created" && data.attachment?.task_id === task.id) {
      setAttachments((prev) => {
        if (prev.some((a) => a.id === data.attachment.id)) return prev;
        return [...prev, data.attachment];
      });
    }

    if (event === "attachment.deleted" && data.task_id === task.id) {
      setAttachments((prev) => prev.filter((a) => a.id !== data.id));
    }
  }, [drawerEvent, isOpen, task.id]);

  const postComment = async () => {
    if (!newComment.trim()) return;
    const author = session?.user?.name?.split(" ")[0].toLowerCase() || "unknown";
    setSubmitting(true);
    try {
      const comment = await api.addComment(task.id, author, newComment.trim());
      setComments((prev) => sortCommentsDesc([comment, ...prev]));
      setNewComment("");
    } catch (err) {
      console.error("Failed to post comment:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const saveEdits = async () => {
    try {
      const res = await fetch(`/api/mc/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      const updated = await res.json();
      onUpdate(updated);
      setEditing(false);
    } catch (err) {
      console.error("Failed to save:", err);
    }
  };

  const updateField = async (field: string, value: any) => {
    try {
      const res = await fetch(`/api/mc/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const updated = await res.json();
      onUpdate(updated);
    } catch (err) {
      console.error("Failed to update:", err);
    }
  };

  const deleteTask = async () => {
    try {
      await fetch(`/api/mc/tasks/${task.id}`, { method: "DELETE" });
      onClose();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (uploading) return;
    const allowed = ["image/png", "image/jpeg", "image/gif", "image/webp"];
    if (!allowed.includes(file.type)) {
      setUploadError("Only PNG, JPG, GIF, and WebP images are allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File too large (max 5MB).");
      return;
    }
    setUploading(true);
    try {
      const attachment = await api.uploadAttachment(task.id, file, "derrick");
      setAttachments((prev) => [...prev, attachment]);
    } catch (err: any) {
      console.error("Upload failed:", err);
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      await api.deleteAttachment(attachmentId);
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch (err) {
      console.error("Failed to delete attachment:", err);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    // Kept for backward compatibility on the specific div
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          handleFileUpload(file);
          return;
        }
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 dark:bg-black/60"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 flex h-[100dvh] w-full max-w-md flex-col border-l border-gray-200 dark:border-[#222222] bg-white dark:bg-[#0A0A0A]">
        {/* Header — shrink-0 */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 dark:border-[#222222] px-4 py-3">
          <div className="flex items-center gap-2">
            <Chip size="sm" variant="flat" color={statusColors[task.status]}>
              {task.status.replace("_", " ")}
            </Chip>
            <span className="text-xs text-gray-500 dark:text-[#888888] font-mono">{task.id.slice(0, 8)}</span>
          </div>
          <button onClick={onClose} className="text-gray-500 dark:text-[#888888] hover:text-gray-900 dark:hover:text-white">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {editing ? (
            <>
              <Input
                value={title}
                onValueChange={setTitle}
                variant="bordered"
                size="sm"
                classNames={{ inputWrapper: "border-gray-200 dark:border-[#222222] bg-white dark:bg-[#080808]" }}
              />
              <Textarea
                value={description}
                onValueChange={setDescription}
                variant="bordered"
                size="sm"
                minRows={3}
                classNames={{ inputWrapper: "border-gray-200 dark:border-[#222222] bg-white dark:bg-[#080808]" }}
              />
              <div className="flex gap-2">
                <Button size="sm" color="primary" onPress={saveEdits}>Save</Button>
                <Button size="sm" variant="flat" onPress={() => setEditing(false)}>Cancel</Button>
              </div>
            </>
          ) : (
            <>
              <div>
                <h2
                  className="text-lg font-medium cursor-pointer hover:text-gray-500 dark:hover:text-[#888888]"
                  onClick={() => setEditing(true)}
                >
                  {task.title}
                </h2>
                {task.description && (
                  <p className="mt-2 text-sm text-gray-500 dark:text-[#888888] whitespace-pre-wrap">
                    {task.description}
                  </p>
                )}
                {!task.description && (
                  <p
                    className="mt-2 text-sm text-gray-400 dark:text-[#555555] cursor-pointer hover:text-gray-500 dark:hover:text-[#888888]"
                    onClick={() => setEditing(true)}
                  >
                    Add description...
                  </p>
                )}
              </div>
            </>
          )}

          {/* Attachments */}
          <div
            className={`space-y-3 border-t border-gray-200 dark:border-[#222222] pt-4 ${dragOver ? "ring-1 ring-blue-500/50 rounded-lg" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onPaste={handlePaste}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 dark:text-[#888888] uppercase tracking-wider flex items-center gap-1">
                <Paperclip size={12} strokeWidth={1.5} />
                Attachments
                {attachments.length > 0 && (
                  <span className="text-[10px] text-gray-400 dark:text-[#555555]">({attachments.length})</span>
                )}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                  e.target.value = "";
                }}
              />
              <Button
                size="sm"
                variant="flat"
                isLoading={uploading}
                onPress={() => fileInputRef.current?.click()}
                startContent={!uploading && <ImagePlus size={14} strokeWidth={1.5} />}
                className="h-7 text-xs"
              >
                Attach
              </Button>
            </div>

            {attachments.length === 0 && !dragOver && (
              <p className="text-xs text-gray-400 dark:text-[#555555]">
                No attachments. Drag & drop, paste, or click Attach.
              </p>
            )}

            {dragOver && (
              <div className="flex items-center justify-center rounded-md border border-dashed border-blue-500/50 bg-blue-500/5 py-6">
                <p className="text-xs text-blue-400">Drop image here</p>
              </div>
            )}

            {attachments.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {attachments.map((a) => (
                  <div
                    key={a.id}
                    className="group relative rounded-md border border-gray-200 dark:border-[#222222] bg-gray-50 dark:bg-[#111111] overflow-hidden cursor-pointer"
                    onClick={() => setLightboxUrl(`/api/mc${a.url.replace(/^\/api/, "")}`)}
                  >
                    <img
                      src={`/api/mc${a.url.replace(/^\/api/, "")}`}
                      alt={a.filename}
                      className="w-full h-20 object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
                    <button
                      className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-white hover:text-red-400 bg-black/60 hover:bg-black/80 rounded-full p-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteAttachment(a.id);
                      }}
                    >
                      <X size={12} strokeWidth={2} />
                    </button>
                    <div className="px-1.5 py-1">
                      <p className="text-[10px] text-gray-500 dark:text-[#888888] truncate">{a.filename}</p>
                      <p className="text-[10px] text-gray-400 dark:text-[#555555]">{formatFileSize(a.size)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fields */}
          <div className="space-y-3 border-t border-gray-200 dark:border-[#222222] pt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-[#888888]">Project</span>
              <Select
                items={[{ id: "__none", name: "No project" }, ...projects.map((p) => ({ id: p.id, name: p.name }))]}
                selectedKeys={task.project_id ? [task.project_id] : ["__none"]}
                onSelectionChange={(keys) => {
                  const v = Array.from(keys)[0] as string;
                  if (!v || v === "__none") {
                    updateField("project_id", null);
                    return;
                  }
                  updateField("project_id", v);
                }}
                variant="bordered"
                size="sm"
                className="max-w-[160px]"
                classNames={{ trigger: "border-gray-200 dark:border-[#222222] bg-white dark:bg-[#080808] h-8 min-h-8" }}
                startContent={<Folder size={12} strokeWidth={1.5} className="text-gray-400 dark:text-[#555555]" />}
              >
                {(item) => <SelectItem key={item.id}>{item.name}</SelectItem>}
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-[#888888]">Status</span>
              <Select
                selectedKeys={[task.status]}
                onSelectionChange={(keys) => {
                  const v = Array.from(keys)[0] as string;
                  if (v) updateField("status", v);
                }}
                variant="bordered"
                size="sm"
                className="max-w-[160px]"
                classNames={{ trigger: "border-gray-200 dark:border-[#222222] bg-white dark:bg-[#080808] h-8 min-h-8" }}
              >
                {COLUMNS.map((c) => (
                  <SelectItem key={c.id}>{c.label}</SelectItem>
                ))}
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-[#888888]">Assignee</span>
              <Select
                selectedKeys={task.assignee ? [task.assignee] : []}
                onSelectionChange={(keys) => {
                  const v = Array.from(keys)[0] as string;
                  updateField("assignee", v || null);
                }}
                variant="bordered"
                size="sm"
                placeholder="Unassigned"
                className="max-w-[160px]"
                classNames={{ trigger: "border-gray-200 dark:border-[#222222] bg-white dark:bg-[#080808] h-8 min-h-8 capitalize" }}
              >
                {AGENTS.map((a) => (
                  <SelectItem key={a} className="capitalize">{a}</SelectItem>
                ))}
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-[#888888]">Priority</span>
              <Select
                selectedKeys={[String(task.priority)]}
                onSelectionChange={(keys) => {
                  const v = Array.from(keys)[0] as string;
                  if (v !== undefined) updateField("priority", parseInt(v));
                }}
                variant="bordered"
                size="sm"
                className="max-w-[160px]"
                classNames={{ trigger: "border-gray-200 dark:border-[#222222] bg-white dark:bg-[#080808] h-8 min-h-8" }}
              >
                {[
                  { value: "0", label: "None" },
                  { value: "1", label: "Low" },
                  { value: "2", label: "Medium" },
                  { value: "3", label: "High" },
                  { value: "4", label: "Urgent" },
                ].map((p) => (
                  <SelectItem key={p.value}>{p.label}</SelectItem>
                ))}
              </Select>
            </div>
          </div>

          {/* Metadata */}
          <div className="space-y-2 border-t border-gray-200 dark:border-[#222222] pt-4 text-xs text-gray-400 dark:text-[#555555]">
            <p>Created: {formatLocal(task.created_at)}</p>
            <p>Updated: {formatLocal(task.updated_at)}</p>
            <p>Created by: {task.created_by}</p>
          </div>

          {/* Comments */}
          <div className="space-y-3 border-t border-gray-200 dark:border-[#222222] pt-4">
            <span className="text-xs font-medium text-gray-500 dark:text-[#888888] uppercase tracking-wider">Comments</span>

            {comments.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-[#555555]">No comments yet.</p>
            )}

            <div className="space-y-3 max-h-64 overflow-y-auto">
              {comments.map((c) => (
                <Card key={c.id} className="border border-gray-100 dark:border-[#1a1a1a] bg-gray-50 dark:bg-[#111111]" shadow="none" radius="sm">
                  <CardBody className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-gray-900 dark:text-white capitalize flex items-center gap-1.5">
                        {resolveAgentAvatarUrl(c.author) ? (
                          <img src={resolveAgentAvatarUrl(c.author)!} alt={c.author} className="h-5 w-5 rounded-full object-cover" />
                        ) : null}
                        {c.author}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-[#555555]">
                        {formatLocal(c.created_at)}
                      </span>
                    </div>
                    <div className="comment-markdown text-sm text-gray-700 dark:text-[#EDEDED] leading-[1.5]">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h1: ({ node, ...props }) => (
                            <h1 className="text-[15px] font-semibold mt-4 mb-2 first:mt-0" {...props} />
                          ),
                          h2: ({ node, ...props }) => (
                            <h2 className="text-[14px] font-semibold mt-4 mb-2 first:mt-0" {...props} />
                          ),
                          h3: ({ node, ...props }) => (
                            <h3 className="text-[13px] font-semibold mt-4 mb-2 text-gray-500 dark:text-[#A3A3A3] first:mt-0" {...props} />
                          ),
                          h4: ({ node, ...props }) => (
                            <h4 className="text-[13px] font-semibold mt-4 mb-2 text-gray-500 dark:text-[#A3A3A3] first:mt-0" {...props} />
                          ),
                          h5: ({ node, ...props }) => (
                            <h5 className="text-[13px] font-semibold mt-4 mb-2 text-gray-500 dark:text-[#A3A3A3] first:mt-0" {...props} />
                          ),
                          h6: ({ node, ...props }) => (
                            <h6 className="text-[13px] font-semibold mt-4 mb-2 text-gray-500 dark:text-[#A3A3A3] first:mt-0" {...props} />
                          ),
                          p: ({ node, children, ...props }) => {
                            // Handle @mentions in paragraph text
                            const processedChildren = processChildrenForMentions(children);
                            return <p className="mb-3 last:mb-0" {...props}>{processedChildren}</p>;
                          },
                          code: ({ node, className, ...props }) => {
                            // Inline code if no language class (not in a pre block)
                            const isInline = !className;
                            return isInline ? (
                              <code
                                className="font-mono text-[12px] bg-gray-100 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] rounded px-1 py-0.5 text-gray-700 dark:text-[#EFEFEF]"
                                {...props} 
                              />
                            ) : (
                              <code className={`font-mono text-[12px] leading-[1.4] ${className || ''}`} {...props} />
                            );
                          },
                          pre: ({ node, ...props }) => (
                            <pre 
                              className="font-mono text-[12px] leading-[1.4] bg-gray-50 dark:bg-[#121212] border border-gray-200 dark:border-[#2A2A2A] rounded-md p-3 mt-2 mb-3 overflow-x-auto"
                              {...props} 
                            />
                          ),
                          blockquote: ({ node, ...props }) => (
                            <blockquote 
                              className="border-l-2 border-gray-300 dark:border-[#333333] pl-3 ml-0 text-gray-500 dark:text-[#888888] my-3"
                              {...props} 
                            />
                          ),
                          ul: ({ node, ...props }) => (
                            <ul className="pl-5 space-y-1 my-2" {...props} />
                          ),
                          ol: ({ node, ...props }) => (
                            <ol className="pl-5 space-y-1 my-2" {...props} />
                          ),
                          li: ({ node, children, ...props }) => {
                            const processedChildren = processChildrenForMentions(children);
                            return <li className="my-1" {...props}>{processedChildren}</li>;
                          },
                          a: ({ node, ...props }) => (
                            <a 
                              className="text-gray-700 dark:text-[#EDEDED] underline decoration-gray-300 dark:decoration-[#555555] hover:decoration-gray-700 dark:hover:decoration-white transition-colors"
                              target="_blank"
                              rel="noopener noreferrer"
                              {...props} 
                            />
                          ),
                        }}
                      >
                        {c.content}
                      </ReactMarkdown>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>

          </div>

          {/* Delete */}
          <div className="border-t border-gray-200 dark:border-[#222222] pt-4">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <Button size="sm" color="danger" onPress={deleteTask}>
                  Confirm Delete
                </Button>
                <Button size="sm" variant="flat" onPress={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="flat"
                color="danger"
                onPress={() => setConfirmDelete(true)}
                startContent={<Trash2 size={14} strokeWidth={1.5} />}
              >
                Delete Task
              </Button>
            )}
          </div>
        </div>

        {/* Comment input — pinned footer */}
        <div className="shrink-0 border-t border-gray-200 dark:border-[#222222] bg-white dark:bg-[#080808] p-3 pb-safe">
          <div className="flex gap-2">
            <MentionTextarea
              value={newComment}
              onValueChange={setNewComment}
              placeholder="Add a comment... (type @ to mention)"
              classNames={{ inputWrapper: "border-gray-200 dark:border-[#222222] bg-white dark:bg-[#080808]" }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.shiftKey) {
                  e.preventDefault();
                  postComment();
                }
              }}
            />
            <Button
              isIconOnly
              size="sm"
              color="primary"
              variant="flat"
              isLoading={submitting}
              onPress={postComment}
              isDisabled={!newComment.trim()}
              className="shrink-0 self-end"
            >
              <Send size={14} strokeWidth={1.5} />
            </Button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={!!uploadError}
        onClose={() => setUploadError(null)}
        className="bg-white dark:bg-[#121212] text-gray-900 dark:text-white"
        backdrop="opaque"
        classNames={{
          backdrop: "bg-black/20 dark:bg-black/60"
        }}
      >
        <ModalContent>
          <ModalHeader className="border-b border-gray-200 dark:border-[#222222] text-sm">Upload failed</ModalHeader>
          <ModalBody className="py-4">
            <p className="text-sm text-gray-600 dark:text-[#CCCCCC]">{uploadError}</p>
          </ModalBody>
          <ModalFooter className="border-t border-gray-200 dark:border-[#222222]">
            <Button size="sm" color="primary" onPress={() => setUploadError(null)}>
              OK
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/60 hover:text-white"
            onClick={() => setLightboxUrl(null)}
          >
            <X size={24} strokeWidth={1.5} />
          </button>
          <img
            src={lightboxUrl}
            alt="Attachment preview"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
