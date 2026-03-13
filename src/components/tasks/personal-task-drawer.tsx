"use client";

import { useState, useEffect } from "react";
import { 
  Button, 
  Chip, 
  Card, 
  CardBody, 
  Divider,
  Spinner,
  Select,
  SelectItem,
  Input,
  Textarea,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Checkbox,
  useDisclosure
} from "@heroui/react";
import { 
  X, 
  ExternalLink, 
  ArrowUpCircle, 
  Calendar, 
  Clock, 
  Link as LinkIcon,
  Bot,
  User,
  Folder,
  History,
  ArrowUpRight
} from "lucide-react";
import { useRouter } from "next/navigation";
import { api, type PersonalTaskDetail, type Project } from "@/lib/api";
import { formatLocal, timeAgo } from "@/lib/dates";
import { KNOWN_AGENT_IDS } from "@/lib/agents";

interface PersonalTaskDrawerProps {
  taskId: string;
  isOpen: boolean;
  onClose: () => void;
  onPromoted?: () => void;
}

const AGENTS = [...KNOWN_AGENT_IDS];
const PRIORITIES = [
  { value: "0", label: "None" },
  { value: "1", label: "Low" },
  { value: "2", label: "Medium" },
  { value: "3", label: "High" },
  { value: "4", label: "Urgent" },
];

export function PersonalTaskDrawer({ taskId, isOpen, onClose, onPromoted }: PersonalTaskDrawerProps) {
  const router = useRouter();
  const [task, setTask] = useState<PersonalTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const { isOpen: isConfirmOpen, onOpen: onConfirmOpen, onClose: onConfirmClose } = useDisclosure();

  // Promotion form state
  const [promoTitle, setPromoTitle] = useState("");
  const [promoDescription, setPromoDescription] = useState("");
  const [promoAssignee, setPromoAssignee] = useState("");
  const [promoProject, setPromoProject] = useState("");
  const [promoPriority, setPromoPriority] = useState("0");
  const [promoStatus, setPromoStatus] = useState("backlog");
  const [promoRelation, setPromoRelation] = useState("delegated");
  const [promoCreateAnother, setPromoCreateAnother] = useState(false);

  useEffect(() => {
    if (isOpen && taskId) {
      setLoading(true);
      Promise.all([
        api.getPersonalTask(taskId),
        api.getProjects()
      ]).then(([taskData, projectsData]) => {
        setTask(taskData);
        setProjects(projectsData);
        setPromoTitle(taskData.title);
        setPromoDescription(taskData.description || "");
        setPromoPriority(String(taskData.priority));
        setLoading(false);
      }).catch(err => {
        console.error("Failed to load personal task details:", err);
        setLoading(false);
      });
    }
  }, [isOpen, taskId]);

  const handlePromote = async (createAnother = false) => {
    if (!task) return;
    setPromoting(true);
    try {
      const result = await api.promotePersonalTask(task.id, {
        title: promoTitle,
        description: promoDescription || undefined,
        assignee: promoAssignee || undefined,
        project_id: promoProject || undefined,
        priority: parseInt(promoPriority),
        status: promoStatus as any,
        relation: promoRelation as any,
        create_another: createAnother
      });
      
      if (result.created) {
        onConfirmClose();
        // Refresh details to show the new link
        const updated = await api.getPersonalTask(taskId);
        setTask(updated);
        onPromoted?.();
      } else if (result.reason === "existing_open_link") {
        onConfirmOpen();
      }
    } catch (err) {
      console.error("Promotion failed:", err);
    } finally {
      setPromoting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="fixed right-0 top-0 z-50 flex h-[100dvh] w-full max-w-lg flex-col border-l border-divider bg-background shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-divider px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-content2">
              <User size={18} className="text-foreground-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Personal Task</h2>
              <p className="text-[10px] font-mono uppercase tracking-widest text-foreground-400">Notion Sync</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-foreground-400 hover:bg-content2 hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Spinner color="primary" />
            </div>
          ) : task ? (
            <>
              {/* Main Info */}
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <h1 className="text-xl font-bold text-foreground leading-tight">{task.title}</h1>
                  {task.source_url && (
                    <Button
                      isIconOnly
                      size="sm"
                      variant="flat"
                      as="a"
                      href={task.source_url}
                      target="_blank"
                    >
                      <ExternalLink size={16} />
                    </Button>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  <Chip size="sm" variant="flat" color="primary" className="capitalize">
                    {task.source_status || task.status}
                  </Chip>
                  {task.due_at && (
                    <Chip size="sm" variant="flat" startContent={<Calendar size={12} />} className="text-foreground-500">
                      Due {formatLocal(task.due_at, { month: "short", day: "numeric", year: "numeric" })}
                    </Chip>
                  )}
                  {task.scheduled_at && (
                    <Chip size="sm" variant="flat" startContent={<Clock size={12} />} className="text-primary-400">
                      Scheduled {formatLocal(task.scheduled_at, { month: "short", day: "numeric", year: "numeric" })}
                    </Chip>
                  )}
                  <Chip size="sm" variant="flat" startContent={<History size={12} />} className="text-foreground-400">
                    Synced {timeAgo(task.last_synced_at)}
                  </Chip>
                </div>

                {task.description && (
                  <div className="rounded-xl border border-divider bg-content2/30 p-4">
                    <p className="whitespace-pre-wrap text-sm text-foreground-400 leading-relaxed">
                      {task.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Promotion / Delegation */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground-500">Delegation</h3>
                  {task.link_count > 0 && (
                    <Chip size="sm" variant="dot" color="primary" className="border-none text-[10px]">
                      {task.link_count} Linked {task.link_count === 1 ? "Task" : "Tasks"}
                    </Chip>
                  )}
                </div>

                {task.linked_team_tasks.length > 0 ? (
                  <div className="space-y-3">
                    {task.linked_team_tasks.map((link) => (
                      <Card key={link.id} className="border border-divider bg-content2/20 shadow-none">
                        <CardBody className="p-3">
                          <div className="flex items-start justify-between">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {link.team_task?.title || "Deleted Team Task"}
                              </p>
                              <div className="mt-1 flex items-center gap-2 text-[10px] text-foreground-500">
                                <span className="capitalize">{link.team_task?.status || "unknown"}</span>
                                <span>•</span>
                                <span>Assigned to {link.team_task?.assignee || "nobody"}</span>
                                {link.team_task?.project_name && (
                                  <>
                                    <span>•</span>
                                    <span className="flex items-center gap-1"><Folder size={10} /> {link.team_task.project_name}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                               <Chip size="sm" variant="flat" className="text-[10px] uppercase">{link.relation}</Chip>
                               {link.team_task && (
                                 <Button 
                                   isIconOnly 
                                   size="sm" 
                                   variant="light" 
                                   onPress={() => {
                                     onClose();
                                     router.push(`/tasks?scope=team&task=${link.team_task_id}`);
                                   }}
                                 >
                                   <ArrowUpRight size={14} />
                                 </Button>
                               )}
                            </div>
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                    
                    <Button 
                      fullWidth 
                      variant="flat" 
                      color="primary" 
                      startContent={<ArrowUpCircle size={18} />}
                      onPress={() => {
                        setPromoCreateAnother(true);
                        onConfirmOpen();
                      }}
                    >
                      Delegate Again
                    </Button>
                  </div>
                ) : (
                  <Card className="border border-dashed border-divider bg-content1 shadow-none">
                    <CardBody className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="mb-3 rounded-full bg-primary/10 p-3 text-primary">
                        <Bot size={24} />
                      </div>
                      <p className="text-sm font-medium text-foreground">Needs follow-through?</p>
                      <p className="mt-1 text-xs text-foreground-500">Promote this to a team task to assign it to an agent.</p>
                      <Button 
                        className="mt-4" 
                        color="primary" 
                        startContent={<ArrowUpCircle size={18} />}
                        onPress={() => {
                          setPromoCreateAnother(false);
                          onConfirmOpen();
                        }}
                      >
                        Create Team Task
                      </Button>
                    </CardBody>
                  </Card>
                )}
              </div>

              {/* Links Table Metadata */}
              {task.raw_payload && (
                <div className="space-y-4 pt-4 border-t border-divider">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground-500">Source Metadata</h3>
                  <div className="rounded-lg bg-content2/50 p-4 font-mono text-[10px] text-foreground-400 overflow-x-auto">
                    <pre>{JSON.stringify(task.raw_payload.properties, null, 2)}</pre>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-20 text-center text-foreground-500">Task not found.</div>
          )}
        </div>
      </div>

      {/* Promotion Modal */}
      <Modal 
        isOpen={isConfirmOpen} 
        onClose={onConfirmClose}
        className="dark bg-[#121212] text-white"
        placement="top-center"
      >
        <ModalContent>
          <ModalHeader className="border-b border-[#222222] text-sm">
            Delegate to Team
          </ModalHeader>
          <ModalBody className="gap-4 py-6">
            <Input
              label="Task Title"
              value={promoTitle}
              onValueChange={setPromoTitle}
              variant="bordered"
              size="sm"
            />
            <Textarea
              label="Description"
              placeholder="Add more context for the team..."
              value={promoDescription}
              onValueChange={setPromoDescription}
              variant="bordered"
              size="sm"
              minRows={2}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Assignee"
                placeholder="Unassigned"
                selectedKeys={promoAssignee ? [promoAssignee] : []}
                onSelectionChange={(keys) => setPromoAssignee(Array.from(keys)[0] as string || "")}
                variant="bordered"
                size="sm"
              >
                {AGENTS.map((a) => (
                  <SelectItem key={a} className="capitalize">{a}</SelectItem>
                ))}
              </Select>
              <Select
                label="Status"
                selectedKeys={[promoStatus]}
                onSelectionChange={(keys) => setPromoStatus(Array.from(keys)[0] as string || "backlog")}
                variant="bordered"
                size="sm"
              >
                <SelectItem key="backlog">Backlog</SelectItem>
                <SelectItem key="in_progress">In Progress</SelectItem>
                <SelectItem key="blocked">Blocked</SelectItem>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Priority"
                selectedKeys={[promoPriority]}
                onSelectionChange={(keys) => setPromoPriority(Array.from(keys)[0] as string || "0")}
                variant="bordered"
                size="sm"
              >
                {PRIORITIES.map((p) => (
                  <SelectItem key={p.value}>{p.label}</SelectItem>
                ))}
              </Select>
              <Select
                label="Relation"
                selectedKeys={[promoRelation]}
                onSelectionChange={(keys) => setPromoRelation(Array.from(keys)[0] as string || "delegated")}
                variant="bordered"
                size="sm"
              >
                <SelectItem key="delegated">Delegated</SelectItem>
                <SelectItem key="related">Related</SelectItem>
              </Select>
            </div>
            <Select
              label="Project"
              placeholder="No project"
              selectedKeys={promoProject ? [promoProject] : []}
              onSelectionChange={(keys) => setPromoProject(Array.from(keys)[0] as string || "")}
              variant="bordered"
              size="sm"
            >
              {projects.map((p) => (
                <SelectItem key={p.id}>{p.name}</SelectItem>
              ))}
            </Select>

            {task?.open_link_count && task.open_link_count > 0 ? (
               <div className="mt-2 rounded-lg bg-warning-50 p-3 text-xs text-warning-700 space-y-2">
                 <p>Note: This personal task already has an active link to a team task.</p>
                 <Checkbox 
                   size="sm" 
                   isSelected={promoCreateAnother} 
                   onValueChange={setPromoCreateAnother}
                   classNames={{ label: "text-[10px] text-warning-800 font-medium" }}
                 >
                   Force create another team task
                 </Checkbox>
               </div>
            ) : null}
          </ModalBody>
          <ModalFooter className="border-t border-[#222222]">
            <Button variant="flat" onPress={onConfirmClose} size="sm">Cancel</Button>
            <Button 
              color="primary" 
              onPress={() => handlePromote(promoCreateAnother)} 
              isLoading={promoting}
              size="sm"
              startContent={!promoting && <ArrowUpCircle size={16} />}
            >
              {task?.link_count && !promoCreateAnother ? "Re-delegate" : (task?.link_count ? "Delegate Again" : "Delegate Task")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
