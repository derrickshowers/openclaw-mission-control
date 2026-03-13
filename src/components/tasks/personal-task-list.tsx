"use client";

import { useState, useCallback, useEffect } from "react";
import { 
  Table, 
  TableHeader, 
  TableColumn, 
  TableBody, 
  TableRow, 
  TableCell, 
  Chip, 
  Button,
  Tooltip,
  Spinner,
  Card,
  Tabs,
  Tab
} from "@heroui/react";
import { 
  ExternalLink, 
  RefreshCw, 
  Calendar, 
  AlertCircle,
  Link as LinkIcon,
  CheckCircle2,
  Clock,
  ArrowUpCircle,
  Inbox,
  ArrowUpRight,
  ClipboardCheck
} from "lucide-react";
import { api, type PersonalTask } from "@/lib/api";
import { formatLocal, timeAgo } from "@/lib/dates";
import { PersonalTaskDrawer } from "./personal-task-drawer";
import { useSSE } from "@/hooks/use-sse";

const statusConfig: Record<string, { color: "default" | "primary" | "danger" | "success" | "warning"; icon: any }> = {
  backlog: { color: "default", icon: Clock },
  in_progress: { color: "primary", icon: RefreshCw },
  blocked: { color: "danger", icon: AlertCircle },
  done: { color: "success", icon: CheckCircle2 },
};

const priorityConfig: Record<number, { label: string; color: "default" | "warning" | "danger" }> = {
  0: { label: "None", color: "default" },
  1: { label: "Low", color: "default" },
  2: { label: "Medium", color: "warning" },
  3: { label: "High", color: "danger" },
  4: { label: "Urgent", color: "danger" },
};

interface PersonalTaskListProps {
  initialTasks: PersonalTask[];
}

export function PersonalTaskList({ initialTasks }: PersonalTaskListProps) {
  const [tasks, setTasks] = useState<PersonalTask[]>(initialTasks);
  const [filter, setFilter] = useState<string>("all");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = { limit: 100 };
      
      if (filter === "needs_delegation") {
        params.linked = "unlinked";
        params.status = "backlog"; // Or in_progress too? Usually backlog.
      } else if (filter === "delegated") {
        params.linked = "linked";
      } else if (filter === "overdue") {
        params.due = "overdue";
      }
      
      let data = await api.getPersonalTasks(params);
      
      // Client-side filter for "Done on team, still open personally"
      if (filter === "waiting_on_me") {
        data = await api.getPersonalTasks({ limit: 200 });
        data = data.filter(t => 
          t.link_count > 0 && 
          t.open_link_count === 0 && 
          t.status !== "done"
        );
      }
      
      setTasks(data);
    } catch (err) {
      console.error("Failed to fetch personal tasks:", err);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleSync = async (runType: "incremental" | "full" = "incremental") => {
    setIsSyncing(true);
    try {
      await api.syncPersonalTasks(runType);
      // The SSE event will trigger a refresh or we can poll
    } catch (err) {
      console.error("Sync failed:", err);
      setIsSyncing(false);
    }
  };

  // SSE for sync completion and promotions
  const { lastEvent } = useSSE(["personal_task.sync.completed", "personal_task.promoted"]);

  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.event === "personal_task.sync.completed") {
      setIsSyncing(false);
      fetchTasks();
    }
    if (lastEvent.event === "personal_task.promoted") {
        fetchTasks();
    }
  }, [lastEvent, fetchTasks]);

  const renderCell = (task: PersonalTask, columnKey: React.Key) => {
    switch (columnKey) {
      case "title":
        return (
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">{task.title}</span>
            <span className="text-xs text-foreground-400 truncate max-w-[300px]">
              {task.description || "No description"}
            </span>
          </div>
        );
      case "status":
        const config = statusConfig[task.status] || statusConfig.backlog;
        const Icon = config.icon;
        return (
          <Chip
            startContent={<Icon size={12} />}
            variant="flat"
            color={config.color}
            size="sm"
            className="capitalize"
          >
            {task.source_status || task.status.replace("_", " ")}
          </Chip>
        );
      case "priority":
        const pConfig = priorityConfig[task.priority] || priorityConfig[0];
        return (
          <Chip variant="dot" color={pConfig.color} size="sm" className="border-none">
            {pConfig.label}
          </Chip>
        );
      case "due":
        if (!task.due_at && !task.scheduled_at) return <span className="text-xs text-foreground-500">-</span>;
        const isOverdue = task.due_at && new Date(task.due_at) < new Date() && task.status !== "done";
        return (
          <div className="flex flex-col gap-1">
            {task.due_at && (
              <div className={`flex items-center gap-1.5 text-[10px] ${isOverdue ? "text-danger" : "text-foreground-500"}`}>
                <Calendar size={10} />
                <span>Due {formatLocal(task.due_at, { month: "short", day: "numeric" })}</span>
              </div>
            )}
            {task.scheduled_at && (
              <div className="flex items-center gap-1.5 text-[10px] text-primary-400">
                <Clock size={10} />
                <span>Sched {formatLocal(task.scheduled_at, { month: "short", day: "numeric" })}</span>
              </div>
            )}
          </div>
        );
      case "links":
        if (task.link_count === 0) return null;
        return (
          <Tooltip content={`${task.link_count} linked team tasks (${task.open_link_count} open)`}>
            <div className={`flex items-center gap-1 ${task.open_link_count > 0 ? "text-primary" : "text-success"}`}>
              {task.open_link_count > 0 ? <LinkIcon size={14} /> : <ClipboardCheck size={14} />}
              <span className="text-xs font-medium">{task.link_count}</span>
              {task.open_link_count > 0 && (
                 <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              )}
            </div>
          </Tooltip>
        );
      case "actions":
        return (
          <div className="flex items-center gap-2">
            {task.source_url && (
              <Button
                isIconOnly
                size="sm"
                variant="light"
                as="a"
                href={task.source_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink size={14} className="text-foreground-400" />
              </Button>
            )}
            <Button
              size="sm"
              variant="flat"
              color="primary"
              className="h-7 text-[10px] font-medium uppercase tracking-wider"
              onPress={() => setSelectedTaskId(task.id)}
            >
              Details
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
        <Tabs 
          aria-label="Personal Task Filters" 
          selectedKey={filter}
          onSelectionChange={(key) => setFilter(key as string)}
          size="sm"
          variant="underlined"
          classNames={{
            tabList: "bg-content2/50 p-1 rounded-lg border border-divider/50",
            cursor: "bg-background shadow-sm",
            tab: "h-8 px-3",
            tabContent: "text-[11px] font-medium"
          }}
        >
          <Tab key="all" title={<div className="flex items-center gap-2"><Inbox size={14}/><span>All</span></div>} />
          <Tab key="needs_delegation" title={<div className="flex items-center gap-2"><ArrowUpRight size={14}/><span>Needs Delegation</span></div>} />
          <Tab key="delegated" title={<div className="flex items-center gap-2"><LinkIcon size={14}/><span>Delegated</span></div>} />
          <Tab key="waiting_on_me" title={<div className="flex items-center gap-2"><CheckCircle2 size={14}/><span>Done on Team</span></div>} />
          <Tab key="overdue" title={<div className="flex items-center gap-2"><AlertCircle size={14}/><span>Overdue</span></div>} />
        </Tabs>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 mr-2">
            <span className="text-[10px] text-foreground-400 uppercase tracking-wider font-semibold">{tasks.length} items</span>
            {tasks.length > 0 && (
               <span className="text-[10px] text-foreground-500 font-mono">
                 Synced {timeAgo(tasks[0].last_synced_at)}
               </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="flat"
              onPress={() => handleSync("incremental")}
              isLoading={isSyncing}
              startContent={!isSyncing && <RefreshCw size={14} />}
              className="border border-divider bg-content1 text-[11px]"
            >
              {isSyncing ? "Syncing..." : "Sync"}
            </Button>
            <Tooltip content="Full reconcile (slow)">
              <Button
                isIconOnly
                size="sm"
                variant="flat"
                onPress={() => handleSync("full")}
                isLoading={isSyncing}
                className="border border-divider bg-content1"
              >
                <ArrowUpCircle size={14} className="rotate-180" />
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>

      <Card className="border border-divider bg-content1/50 backdrop-blur-xl">
        <Table 
          aria-label="Personal tasks table"
          classNames={{
            base: "max-h-[70vh] overflow-y-auto",
            table: "min-w-[800px]",
            thead: "bg-content2/50",
            th: "text-[10px] font-semibold uppercase tracking-wider text-foreground-500 border-b border-divider",
            td: "py-3 border-b border-divider/50"
          }}
          removeWrapper
        >
          <TableHeader>
            <TableColumn key="title">Task</TableColumn>
            <TableColumn key="status" width={140}>Status</TableColumn>
            <TableColumn key="priority" width={100}>Priority</TableColumn>
            <TableColumn key="due" width={140}>Date</TableColumn>
            <TableColumn key="links" width={60}>Links</TableColumn>
            <TableColumn key="actions" width={120} align="end">Actions</TableColumn>
          </TableHeader>
          <TableBody 
            items={tasks}
            loadingContent={<Spinner size="sm" />}
            isLoading={isLoading}
            emptyContent={isLoading ? " " : "No personal tasks found."}
          >
            {(item) => (
              <TableRow key={item.id} className="hover:bg-content2/30 cursor-pointer" onClick={() => setSelectedTaskId(item.id)}>
                {(columnKey) => <TableCell>{renderCell(item, columnKey)}</TableCell>}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {selectedTaskId && (
        <PersonalTaskDrawer 
          taskId={selectedTaskId}
          isOpen={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onPromoted={() => {
            fetchTasks();
          }}
        />
      )}
    </div>
  );
}
