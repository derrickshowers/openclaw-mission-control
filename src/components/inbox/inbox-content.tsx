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
  Select,
  SelectItem,
  Textarea,
} from "@heroui/react";
import { ExternalLink, MessageSquare, NotebookPen, X } from "lucide-react";
import {
  api,
  type BeeInsight,
  type InboxTimeCategoryOption,
  type InboxUncategorizedTimeLog,
  type NotionInboxItem,
  type NotionInboxTriageAction,
} from "@/lib/api";
import { timeAgo } from "@/lib/dates";
import {
  nextFridayDateKey,
  toCalendarDateValue,
  toDateInputValue,
  toIsoDateFromCalendar,
  toLocalDateKey,
} from "@/lib/today-dashboard";

const BEE_SOURCE_LABELS: Record<BeeInsight["source_type"], string> = {
  conversation: "conversation",
  daily_summary: "daily summary",
  journal: "journal",
  bee_todo: "bee todo",
};

const beeCardClass =
  "flex flex-col gap-2 rounded-md border border-zinc-200 bg-white p-3 transition-colors hover:border-zinc-300 dark:border-white/10 dark:bg-[#111] dark:hover:border-white/20";

function formatTimeLogRange(startAt: string | null, endAt: string | null) {
  if (!startAt) return "Unknown time";

  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) return "Unknown time";

  const day = start.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const startTime = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (!endAt) return `${day} · ${startTime}`;

  const end = new Date(endAt);
  if (Number.isNaN(end.getTime())) return `${day} · ${startTime}`;

  const endTime = end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${day} · ${startTime}–${endTime}`;
}

function formatHoursLabel(hours: number) {
  const rounded = Math.round((hours + Number.EPSILON) * 100) / 100;
  return `${rounded}h`;
}

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
      return new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]));
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

function TimeLogSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-3 rounded-md border border-zinc-200 bg-white p-3 dark:border-white/5 dark:bg-[#111] md:flex-row md:items-center md:justify-between">
      <div className="space-y-2">
        <div className="h-4 w-48 rounded bg-zinc-200 dark:bg-white/5" />
        <div className="h-3 w-40 rounded bg-zinc-200 dark:bg-white/5" />
      </div>
      <div className="h-8 w-full rounded bg-zinc-200 dark:bg-white/5 md:w-52" />
    </div>
  );
}

function NotionInboxCard({
  item,
  busyAction,
  onTriage,
}: {
  item: NotionInboxItem;
  busyAction: NotionInboxTriageAction | null;
  onTriage: (id: string, action: NotionInboxTriageAction) => Promise<void>;
}) {
  const disabled = busyAction !== null;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#111] md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 space-y-2">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.title}</h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-zinc-500 dark:text-zinc-400">
          <span>{item.last_edited_at ? `Edited ${timeAgo(item.last_edited_at)}` : "Ready to triage"}</span>
          {item.source_url && (
            <a
              href={item.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Open in Notion
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 md:justify-end">
        <Button
          size="sm"
          variant="flat"
          isDisabled={disabled}
          isLoading={busyAction === "this_week"}
          onPress={() => void onTriage(item.id, "this_week")}
          className="rounded-sm border border-zinc-200 bg-zinc-100 text-[12px] font-medium text-zinc-900 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
        >
          This week
        </Button>
        <Button
          size="sm"
          variant="flat"
          isDisabled={disabled}
          isLoading={busyAction === "next_week"}
          onPress={() => void onTriage(item.id, "next_week")}
          className="rounded-sm border border-zinc-200 bg-zinc-100 text-[12px] font-medium text-zinc-900 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
        >
          Next week
        </Button>
        <Button
          size="sm"
          variant="flat"
          isDisabled={disabled}
          isLoading={busyAction === "no_date"}
          onPress={() => void onTriage(item.id, "no_date")}
          className="rounded-sm border border-zinc-200 bg-zinc-100 text-[12px] font-medium text-zinc-900 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
        >
          No date
        </Button>
      </div>
    </div>
  );
}

function UncategorizedTimeLogCard({
  log,
  categories,
  assigning,
  onAssign,
}: {
  log: InboxUncategorizedTimeLog;
  categories: InboxTimeCategoryOption[];
  assigning: boolean;
  onAssign: (logId: string, categoryId: string) => Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-[#111] md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{log.title}</h3>
          <Chip size="sm" variant="flat" className="h-5 border border-zinc-200 bg-zinc-100 text-[10px] font-medium dark:border-white/10 dark:bg-white/5">
            {formatHoursLabel(log.hours)}
          </Chip>
          {log.legacyCategory && (
            <Chip
              size="sm"
              variant="flat"
              className="h-5 border border-amber-200 bg-amber-50 text-[10px] font-medium text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"
            >
              Legacy: {log.legacyCategory}
            </Chip>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-zinc-500 dark:text-zinc-400">
          <span>{formatTimeLogRange(log.timeStartedAt, log.timeEndedAt)}</span>
          {log.sourceUrl && (
            <a
              href={log.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Open in Notion
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>

      <Select
        aria-label={`Assign time category for ${log.title}`}
        placeholder="Set category"
        disallowEmptySelection
        selectedKeys={[]}
        isDisabled={assigning}
        onSelectionChange={(keys) => {
          const next = Array.from(keys)[0] as string | undefined;
          if (next) {
            void onAssign(log.id, next);
          }
        }}
        size="sm"
        variant="flat"
        className="w-full md:max-w-xs"
        classNames={{
          trigger: "h-9 min-h-9 rounded-sm border border-zinc-200 bg-zinc-100 shadow-none dark:border-white/10 dark:bg-white/5",
          value: "text-sm text-zinc-700 dark:text-zinc-200",
          popoverContent: "border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#0d0d0d]",
        }}
        renderValue={() =>
          assigning ? (
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Saving...</span>
          ) : (
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Set category</span>
          )
        }
      >
        {categories.map((category) => (
          <SelectItem key={category.id} textValue={category.name}>
            {category.name}
          </SelectItem>
        ))}
      </Select>
    </div>
  );
}

export function InboxContent() {
  const [beeInsights, setBeeInsights] = useState<BeeInsight[]>([]);
  const [beeInsightsLoading, setBeeInsightsLoading] = useState(true);
  const [uncategorizedTimeLogs, setUncategorizedTimeLogs] = useState<InboxUncategorizedTimeLog[]>([]);
  const [timeCategoryOptions, setTimeCategoryOptions] = useState<InboxTimeCategoryOption[]>([]);
  const [timeLogsLoading, setTimeLogsLoading] = useState(true);
  const [timeLogsError, setTimeLogsError] = useState<string | null>(null);
  const [assigningLogIds, setAssigningLogIds] = useState<Record<string, boolean>>({});
  const [notionInboxItems, setNotionInboxItems] = useState<NotionInboxItem[]>([]);
  const [notionInboxLoading, setNotionInboxLoading] = useState(true);
  const [notionInboxError, setNotionInboxError] = useState<string | null>(null);
  const [triagingInboxItems, setTriagingInboxItems] = useState<Record<string, NotionInboxTriageAction | null>>({});
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

  const refreshUncategorizedTimeLogs = useCallback(async () => {
    try {
      const response = await api.getInboxUncategorizedTimeLogs();
      setUncategorizedTimeLogs(response.logs);
      setTimeCategoryOptions(response.categories);
      setTimeLogsError(null);
    } catch (error) {
      setTimeLogsError(error instanceof Error ? error.message : "Failed to load uncategorized time logs.");
    } finally {
      setTimeLogsLoading(false);
    }
  }, []);

  const refreshNotionInboxItems = useCallback(async () => {
    try {
      const response = await api.getNotionInboxItems();
      setNotionInboxItems(response.items);
      setNotionInboxError(null);
    } catch (error) {
      setNotionInboxError(error instanceof Error ? error.message : "Failed to load Notion inbox items.");
    } finally {
      setNotionInboxLoading(false);
    }
  }, []);

  const handleAssignTimeCategory = useCallback(async (logId: string, categoryId: string) => {
    setTimeLogsError(null);
    setAssigningLogIds((prev) => ({ ...prev, [logId]: true }));
    try {
      await api.categorizeTimeLog(logId, categoryId);
      setUncategorizedTimeLogs((prev) => prev.filter((log) => log.id !== logId));
    } catch (error) {
      setTimeLogsError(error instanceof Error ? error.message : "Failed to update time category.");
    } finally {
      setAssigningLogIds((prev) => {
        const next = { ...prev };
        delete next[logId];
        return next;
      });
    }
  }, []);

  const handleTriageNotionInboxItem = useCallback(async (id: string, action: NotionInboxTriageAction) => {
    setNotionInboxError(null);
    setTriagingInboxItems((prev) => ({ ...prev, [id]: action }));
    try {
      await api.triageNotionInboxItem(id, action);
      setNotionInboxItems((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      setNotionInboxError(error instanceof Error ? error.message : "Failed to triage Notion inbox item.");
    } finally {
      setTriagingInboxItems((prev) => ({ ...prev, [id]: null }));
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
    void refreshUncategorizedTimeLogs();
    void refreshNotionInboxItems();
  }, [refreshBeeInsights, refreshUncategorizedTimeLogs, refreshNotionInboxItems]);

  useEffect(() => {
    const handleWindowFocus = () => {
      void refreshBeeInsights();
      void refreshUncategorizedTimeLogs();
      void refreshNotionInboxItems();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshBeeInsights();
        void refreshUncategorizedTimeLogs();
        void refreshNotionInboxItems();
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshBeeInsights, refreshUncategorizedTimeLogs, refreshNotionInboxItems]);

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
          <h2 className="text-[11px] font-mono uppercase tracking-[0.14em] text-zinc-500">Time Log Categorization</h2>
          <p className="mt-1 text-[13px] text-zinc-500">Uncategorized time logs from the past 7 days. Assign a Time Category to clear them from inbox.</p>
        </div>
        <div className="space-y-2">
          {timeLogsLoading ? (
            <>
              <TimeLogSkeleton />
              <TimeLogSkeleton />
            </>
          ) : timeLogsError ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-500/20 dark:bg-rose-500/10">
              <p className="text-[13px] text-rose-700 dark:text-rose-300">{timeLogsError}</p>
            </div>
          ) : uncategorizedTimeLogs.length === 0 ? (
            <div className="flex items-center justify-center rounded-md border border-dashed border-zinc-200 py-6 dark:border-white/10">
              <p className="text-[13px] italic text-zinc-500 dark:text-gray-500">No uncategorized time logs from the past 7 days.</p>
            </div>
          ) : (
            uncategorizedTimeLogs.map((log) => (
              <UncategorizedTimeLogCard
                key={log.id}
                log={log}
                categories={timeCategoryOptions}
                assigning={!!assigningLogIds[log.id]}
                onAssign={handleAssignTimeCategory}
              />
            ))
          )}
        </div>

        <div className="space-y-2 border-t border-zinc-200 pt-4 dark:border-white/10">
          <div>
            <h3 className="text-[11px] font-mono uppercase tracking-[0.14em] text-zinc-500">Study Spots Inbox</h3>
            <p className="mt-1 text-[13px] text-zinc-500">Move personal Notion inbox pages into Tasks. This week uses the upcoming Friday, Next week uses the following Friday, and No date leaves the due date empty.</p>
          </div>
          {notionInboxLoading ? (
            <>
              <TimeLogSkeleton />
              <TimeLogSkeleton />
            </>
          ) : notionInboxError ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-500/20 dark:bg-rose-500/10">
              <p className="text-[13px] text-rose-700 dark:text-rose-300">{notionInboxError}</p>
            </div>
          ) : notionInboxItems.length === 0 ? (
            <div className="flex items-center justify-center rounded-md border border-dashed border-zinc-200 py-6 dark:border-white/10">
              <p className="text-[13px] italic text-zinc-500 dark:text-gray-500">No pages waiting in the Study Spots inbox.</p>
            </div>
          ) : (
            notionInboxItems.map((item) => (
              <NotionInboxCard
                key={item.id}
                item={item}
                busyAction={triagingInboxItems[item.id] ?? null}
                onTriage={handleTriageNotionInboxItem}
              />
            ))
          )}
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

                {beeModalError && <p className="text-[13px] text-rose-600 dark:text-rose-400">{beeModalError}</p>}
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
