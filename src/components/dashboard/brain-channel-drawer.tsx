"use client";

import { useEffect, useState } from "react";
import { Button, Spinner, Textarea } from "@heroui/react";
import { ExternalLink, X } from "lucide-react";
import { api, type BrainChannelDetail } from "@/lib/api";
import { timeAgo } from "@/lib/dates";

interface BrainChannelDrawerProps {
  channelId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (channel: BrainChannelDetail) => void;
}

export function BrainChannelDrawer({ channelId, isOpen, onClose, onSaved }: BrainChannelDrawerProps) {
  const [channel, setChannel] = useState<BrainChannelDetail | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !channelId) return;

    setLoading(true);
    setError(null);
    api
      .getBrainChannel(channelId)
      .then((data) => {
        setChannel(data);
        setDraft(data.body_markdown || "");
      })
      .catch((err: any) => {
        setError(err?.message || "Failed to load brain channel.");
      })
      .finally(() => setLoading(false));
  }, [isOpen, channelId]);

  if (!isOpen || !channelId) return null;

  const handleSave = async () => {
    if (!channel) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateBrainChannel(channel.id, draft.trim() ? draft : null);
      setChannel(updated);
      setDraft(updated.body_markdown || "");
      onSaved?.(updated);
    } catch (err: any) {
      setError(err?.message || "Failed to save brain channel.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-[100dvh] w-full max-w-2xl flex-col border-l border-zinc-200 bg-white dark:border-white/10 dark:bg-[#080808] shadow-none">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-white/10">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {channel?.title || "Brain Channel"}
            </h2>
            <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-500">
              Notion content editor
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-sm border border-transparent p-1.5 text-zinc-600 hover:border-zinc-200 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:border-white/10 dark:hover:bg-white/5 dark:hover:text-zinc-200"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-3 text-[11px] text-zinc-500 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate">{channel?.type || "Untyped"}</span>
            {channel?.last_edited_at && <span>• Synced {timeAgo(channel.last_edited_at)}</span>}
          </div>
          {channel?.source_url && (
            <a
              href={channel.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-sm border border-zinc-200 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
            >
              Open in Notion
              <ExternalLink size={12} />
            </a>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Spinner size="sm" />
            </div>
          ) : (
            <div className="space-y-4">
              {error && (
                <div className="rounded-sm border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-300">
                  {error}
                </div>
              )}
              <Textarea
                aria-label="Brain channel content"
                minRows={18}
                value={draft}
                onValueChange={setDraft}
                placeholder="Add notes..."
                variant="flat"
                classNames={{
                  inputWrapper:
                    "rounded-sm border border-zinc-200 bg-zinc-100 px-2 py-2 shadow-none dark:border-white/10 dark:bg-white/5",
                  input: "text-sm leading-relaxed text-zinc-800 dark:text-zinc-200",
                }}
              />
              <p className="text-[11px] text-zinc-500">
                Markdown-style content is supported. This updates the Notion page body directly.
              </p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-zinc-200 px-5 py-4 dark:border-white/10">
          <Button
            size="sm"
            variant="flat"
            className="rounded-sm border border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300"
            onPress={onClose}
          >
            Close
          </Button>
          <Button
            size="sm"
            color="primary"
            className="rounded-sm"
            onPress={handleSave}
            isLoading={saving}
            isDisabled={loading}
          >
            Save content
          </Button>
        </div>
      </div>
    </>
  );
}
