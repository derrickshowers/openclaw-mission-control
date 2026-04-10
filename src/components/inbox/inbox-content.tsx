"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Chip,
  DatePicker,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
} from "@heroui/react";
import { MessageSquare, NotebookPen, X } from "lucide-react";
import { api, type BeeInsight } from "@/lib/api";
import { timeAgo } from "@/lib/dates";
import { nextFridayDateKey, toCalendarDateValue, toDateInputValue, toIsoDateFromCalendar, toLocalDateKey } from "@/lib/today-dashboard";

const BEE_SOURCE_LABELS: Record<BeeInsight["source_type"], string> = {
  conversation: "conversation",
  daily_summary: "daily summary",
  journal: "journal",
  bee_todo: "bee todo",
};

const beeCardClass =
  "flex flex-col gap-2 rounded-md border border-zinc-200 bg-white p-3 transition-colors hover:border-zinc-300 dark:border-white/10 dark:bg-[#111] dark:hover:border-white/20";

function buildBeeInsightDescription(insight: BeeInsight, notes: string) {
  const sections: string[] = [];
  const trimmedNotes = notes.trim();
  if (trimmedNotes) {
    sections.push(trimmedNotes, "");
  }

  sections.push(`Bee source: ${BEE_SOURCE_LABELS[insight.source_type]}`);
  if (insight.alarm_at) {
    sections.push(`Bee reminder: ${formatScheduledLabel(insight.alarm_at)}`);
  }

  sections.push("", "Evidence:", insight.evidence);
  return sections.join("\n");
}

function formatScheduledLabel(dateValue: string | null | undefined) {
  if (!dateValue) return "";
  const DATE_ONLY_VALUE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z)?$/;
  
  const parseCalendarDate = (val: string | null | undefined) => {
    if (!val) return null;
    const trimmed = val.trim();
    const dateOnlyMatch = trimmed.match(DATE_ONLY_VALUE_RE);
    if (dateOnlyMatch) {
      return new Date(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3])
      );
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const parsed = parseCalendarDate(dateValue);
  if (!parsed) return "";

  if (DATE_ONLY_VALUE_RE.test(dateValue.trim())) {
    return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function BeeInsightCard({
  insight,
  onAddToNotion,
  onDismiss,
}: {
  insight: BeeInsight;
  onAddToNotion: (insight: BeeInsight) => void;
  onDismiss: (insight: BeeInsight) => Promise<void>;
}) {
  const [dismissing, setDismissing] = useState(false);
  const [exiting, setExiting] = useState(false);

  const handleDismiss = async () => {
    setDismissing(true);
    try {
      await onDismiss(insight);
      setExiting(true);
    } finally {
      setDismissing(false);
    }
  };

  if (exiting) return null;

  const confidenceDot =
    insight.confidence === "high"
      ? "bg-green-500"
      : insight.confidence === "medium"
        ? "bg-yellow-500"
        : "bg-zinc-500";

  const capturedAgo = timeAgo(insight.captured_at);

  return (
    <div className={beeCardClass}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-500 dark:text-gray-500">
            <MessageSquare size={11} />
            {BEE_SOURCE_LABELS[insight.source_type]}
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-500 dark:text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className={`h-[5px] w-[5px] rounded-full ${confidenceDot}`} />
            {insight.confidence}
          </span>
          <span>{capturedAgo}</span>
        </div>
      </div>

      <p className="text-[14px] font-medium leading-tight text-zinc-900 dark:text-gray-200">{insight.title}</p>
      <blockquote className="mt-0.5 border-l-2 border-zinc-200 pl-2 dark:border-white/10">
        <p className="line-clamp-2 text-[13px] italic text-zinc-500 dark:text-gray-400">{insight.evidence}</p>
      </blockquote>
      {insight.alarm_at && (
        <p className="text-[12px] text-zinc-500 dark:text-zinc-400">Suggested due date: {formatScheduledLabel(insight.alarm_at)}</p>
      )}

      <div className="mt-1 flex items-center justify-between border-t border-zinc-100 pt-2 dark:border-white/5">
        <Button
          size="sm"
          variant="flat"
          onPress={() => onAddToNotion(insight)}
          isDisabled={dismissing}
          startContent={<NotebookPen size={12} />}
          className="rounded-sm border border-zinc-200 bg-zinc-100 px-3 text-[12px] font-medium text-zinc-900 dark:border-white/10 dark:bg-white/10 dark:text-white"
        >
          Add to Notion
        </Button>
        <Button
          size="sm"
          variant="light"
          onPress={() => void handleDismiss()}
          isDisabled={dismissing}
          isLoading={dismissing}
          startContent={dismissing ? null : <X size={12} />}
          className="rounded-sm px-2 text-[12px] text-zinc-500 hover:text-rose-500 dark:text-gray-500 dark:hover:text-red-400"
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}

function BeeInsightSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-2 rounded-md border border-zinc-200 bg-white p-3 dark:border-white/5 dark:bg-[#111]">
      <div className="flex items-center justify-between">
        <div className="h-3 w-24 rounded bg-zinc-200 dark:bg-white/5" />
        <div className="h-3 w-16 rounded bg-zinc-200 dark:bg-white/5" />
      </div>
      <div className="h-4 w-3/4 rounded bg-zinc-200 dark:bg-white/5" />
      <div className="space-y-1">
        <div className="h-3 w-full rounded bg-zinc-200 dark:bg-white/5" />
        <div className="h-3 w-2/3 rounded bg-zinc-200 dark:bg-white/5" />
      </div>
      <div className="mt-1 flex items-center justify-between border-t border-zinc-100 pt-2 dark:border-white/5">
        <div className="h-7 w-28 rounded-sm bg-zinc-200 dark:bg-white/5" />
        <div className="h-6 w-16 rounded-sm bg-zinc-200 dark:bg-white/5" />
      </div>
    </div>
  );
}

export function InboxContent() {
  const [beeInsights, setBeeInsights] = useState<BeeInsight[]>([]);
  const [beeInsightsLoading, setBeeInsightsLoading] = useState(true);
  const [selectedBeeInsight, setSelectedBeeInsight] = useState<BeeInsight | null>(null);
  const [beeModalScheduledAt, setBeeModalScheduledAt] = useState<string | null>(toLocalDateKey(new Date()));
  const [beeModalDueAt, setBeeModalDueAt] = useState<string | null>(nextFridayDateKey());
  const [beeModalNotes, setBeeModalNotes] = useState("");
  const [beeSubmitting, setBeeSubmitting] = useState(false);
  const [beeModalError, setBeeModalError] = useState<string | null>(null);

  const refreshBeeInsights = useCallback(async () => {
    try {
      const rows = await api.getBeeInsights({ status: "new" });
      setBeeInsights(rows);
    } catch {
      // non-fatal; leave existing state
    } finally {
      setBeeInsightsLoading(false);
    }
  }, []);

  const closeBeeInsightModal = useCallback(() => {
    setSelectedBeeInsight(null);
    setBeeModalError(null);
    setBeeSubmitting(false);
  }, []);

  const handleAddInsightToNotion = useCallback((insight: BeeInsight) => {
    setSelectedBeeInsight(insight);
    setBeeModalScheduledAt(toLocalDateKey(new Date()));
    setBeeModalDueAt(toDateInputValue(insight.alarm_at, nextFridayDateKey()));
    setBeeModalNotes("");
    setBeeModalError(null);
  }, []);

  const handleConfirmAddInsightToNotion = useCallback(async () => {
    if (!selectedBeeInsight) return;

    setBeeSubmitting(true);
    setBeeModalError(null);
    try {
      const created = await api.createPersonalTask({
        title: selectedBeeInsight.title,
        description: buildBeeInsightDescription(selectedBeeInsight, beeModalNotes),
        scheduled_at: beeModalScheduledAt || null,
        due_at: beeModalDueAt || null,
      });
      await api.updateBeeInsight(selectedBeeInsight.id, {
        status: "accepted",
        notion_page_id: created.id,
      });
      setBeeInsights((prev) => prev.filter((i) => i.id !== selectedBeeInsight.id));
      closeBeeInsightModal();
    } catch (error) {
      setBeeModalError(error instanceof Error ? error.message : "Failed to add Bee insight to Notion.");
      setBeeSubmitting(false);
    }
  }, [beeModalDueAt, beeModalNotes, beeModalScheduledAt, closeBeeInsightModal, selectedBeeInsight]);

  const handleDismissInsight = useCallback(async (insight: BeeInsight) => {
    await api.updateBeeInsight(insight.id, { status: "dismissed" });
    setBeeInsights((prev) => prev.filter((i) => i.id !== insight.id));
  }, []);

  useEffect(() => {
    void refreshBeeInsights();
  }, [refreshBeeInsights]);

  useEffect(() => {
    const handleWindowFocus = () => {
      void refreshBeeInsights();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshBeeInsights();
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshBeeInsights]);

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-5 pb-24">
      <section className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Inbox</h1>
          <p className="mt-1 text-[13px] text-zinc-500">Items that need attention, triage, or processing.</p>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-[11px] font-mono uppercase tracking-[0.14em] text-zinc-500">Bee Insights</h2>
          <p className="mt-1 text-[13px] text-zinc-500">Suggested actions captured from Bee. Add to Notion or dismiss.</p>
        </div>
        <div className="space-y-2">
          {beeInsightsLoading ? (
            <>
              <BeeInsightSkeleton />
              <BeeInsightSkeleton />
            </>
          ) : beeInsights.length === 0 ? (
            <div className="flex items-center justify-center rounded-md border border-dashed border-zinc-200 py-6 dark:border-white/10">
              <p className="text-[13px] italic text-zinc-500 dark:text-gray-500">No new insights from Bee.</p>
            </div>
          ) : (
            beeInsights.map((insight) => (
              <BeeInsightCard
                key={insight.id}
                insight={insight}
                onAddToNotion={handleAddInsightToNotion}
                onDismiss={handleDismissInsight}
              />
            ))
          )}
        </div>
      </section>

      <Modal
        isOpen={!!selectedBeeInsight}
        onClose={closeBeeInsightModal}
        className="bg-white text-foreground dark:bg-[#121212] dark:text-white"
      >
        <ModalContent>
          <ModalHeader className="border-b border-divider text-sm dark:border-white/10">Add Bee insight to Notion</ModalHeader>
          <ModalBody className="space-y-4 py-4">
            {selectedBeeInsight && (
              <>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{selectedBeeInsight.title}</h3>
                    <Chip size="sm" variant="flat" className="h-5 border border-zinc-200 bg-zinc-100 text-[10px] uppercase dark:border-white/10 dark:bg-white/5">
                      {BEE_SOURCE_LABELS[selectedBeeInsight.source_type]}
                    </Chip>
                  </div>
                  <p className="text-[13px] text-zinc-500 dark:text-zinc-400">Review the dates, then create the Notion task with Bee context attached.</p>
                </div>

                <blockquote className="rounded-sm border border-zinc-200 bg-zinc-50 px-3 py-2 text-[13px] text-zinc-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-300">
                  {selectedBeeInsight.evidence}
                </blockquote>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex items-end gap-2">
                    <DatePicker
                      aria-label="Bee scheduled date"
                      label="Scheduled"
                      labelPlacement="outside"
                      granularity="day"
                      hideTimeZone
                      showMonthAndYearPickers
                      value={toCalendarDateValue(beeModalScheduledAt)}
                      onChange={(value) => setBeeModalScheduledAt(toIsoDateFromCalendar(value))}
                      variant="flat"
                      className="flex-1"
                      classNames={{
                        inputWrapper: "rounded-sm border border-zinc-200 bg-zinc-100 shadow-none dark:border-white/10 dark:bg-white/5",
                        input: "font-mono text-sm text-zinc-800 dark:text-zinc-200",
                        selectorButton: "h-7 w-7 min-w-0 rounded-sm border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-300",
                        popoverContent: "border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#0d0d0d]",
                        calendarContent: "bg-white dark:bg-[#0d0d0d]",
                      }}
                    />
                    {beeModalScheduledAt && (
                      <Button
                        size="sm"
                        variant="light"
                        className="h-10 min-w-0 rounded-sm border border-zinc-200 dark:border-white/10 px-2 font-mono text-[10px] text-zinc-600 dark:text-zinc-400"
                        onPress={() => setBeeModalScheduledAt(null)}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-end gap-2">
                      <DatePicker
                        aria-label="Bee due date"
                        label="Due"
                        labelPlacement="outside"
                        granularity="day"
                        hideTimeZone
                        showMonthAndYearPickers
                        value={toCalendarDateValue(beeModalDueAt)}
                        onChange={(value) => setBeeModalDueAt(toIsoDateFromCalendar(value))}
                        variant="flat"
                        className="flex-1"
                        classNames={{
                          inputWrapper: "rounded-sm border border-zinc-200 bg-zinc-100 shadow-none dark:border-white/10 dark:bg-white/5",
                          input: "font-mono text-sm text-zinc-800 dark:text-zinc-200",
                          selectorButton: "h-7 w-7 min-w-0 rounded-sm border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-300",
                          popoverContent: "border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#0d0d0d]",
                          calendarContent: "bg-white dark:bg-[#0d0d0d]",
                        }}
                      />
                      {beeModalDueAt && (
                        <Button
                          size="sm"
                          variant="light"
                          className="h-10 min-w-0 rounded-sm border border-zinc-200 dark:border-white/10 px-2 font-mono text-[10px] text-zinc-600 dark:text-zinc-400"
                          onPress={() => setBeeModalDueAt(null)}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    {selectedBeeInsight.alarm_at && (
                      <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                        Prefilled from Bee reminder: {formatScheduledLabel(selectedBeeInsight.alarm_at)}
                      </p>
                    )}
                  </div>
                </div>

                <Textarea
                  minRows={3}
                  label="Notes"
                  labelPlacement="outside"
                  value={beeModalNotes}
                  onValueChange={setBeeModalNotes}
                  placeholder="Optional: add any framing before it lands in Notion..."
                  variant="flat"
                  classNames={{
                    inputWrapper: "rounded-sm border border-zinc-200 bg-zinc-100 shadow-none dark:border-white/10 dark:bg-white/5",
                  }}
                />

                {beeModalError && (
                  <p className="text-[13px] text-rose-600 dark:text-rose-400">{beeModalError}</p>
                )}
              </>
            )}
          </ModalBody>
          <ModalFooter className="border-t border-divider dark:border-white/10">
            <Button size="sm" variant="flat" onPress={closeBeeInsightModal} isDisabled={beeSubmitting}>
              Cancel
            </Button>
            <Button size="sm" color="primary" onPress={handleConfirmAddInsightToNotion} isLoading={beeSubmitting}>
              Add to Notion
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
