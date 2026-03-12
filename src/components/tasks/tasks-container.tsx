"use client";

import { useState, useEffect } from "react";
import { Tabs, Tab, Card, CardBody } from "@heroui/react";
import { Users, User, LayoutGrid } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { KanbanBoard } from "./kanban-board";
import { PersonalTaskList } from "./personal-task-list";
import { type Task, type PersonalTask, type Project } from "@/lib/api";

interface TasksContainerProps {
  initialTeamTasks: Task[];
  initialPersonalTasks: PersonalTask[];
  initialProjectId: string | null;
  initialScope: "team" | "personal" | "all";
  projects: Project[];
}

export function TasksContainer({ 
  initialTeamTasks, 
  initialPersonalTasks, 
  initialProjectId, 
  initialScope,
  projects 
}: TasksContainerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [scope, setScope] = useState<string>(initialScope);

  const handleScopeChange = (key: React.Key) => {
    const newScope = key as string;
    setScope(newScope);
    
    const params = new URLSearchParams(searchParams.toString());
    params.set("scope", newScope);
    router.push(`/tasks?${params.toString()}`);
  };

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex items-center justify-between">
        <Tabs 
          aria-label="Task Scopes" 
          selectedKey={scope} 
          onSelectionChange={handleScopeChange}
          variant="underlined"
          classNames={{
            tabList: "gap-6 w-full relative rounded-none p-0 border-b border-divider",
            cursor: "w-full bg-[#8b5cf6]",
            tab: "max-w-fit px-0 h-12",
            tabContent: "group-data-[selected=true]:text-[#8b5cf6]"
          }}
        >
          <Tab
            key="team"
            title={
              <div className="flex items-center space-x-2">
                <Users size={16} />
                <span>Team Tasks</span>
              </div>
            }
          />
          <Tab
            key="personal"
            title={
              <div className="flex items-center space-x-2">
                <User size={16} />
                <span>Personal (Notion)</span>
              </div>
            }
          />
          <Tab
            key="all"
            title={
              <div className="flex items-center space-x-2">
                <LayoutGrid size={16} />
                <span>All Tasks</span>
              </div>
            }
          />
        </Tabs>
      </div>

      <div className="flex-1 overflow-hidden">
        {scope === "team" && (
          <KanbanBoard 
            initialTasks={initialTeamTasks} 
            initialProjectId={initialProjectId} 
            projects={projects}
          />
        )}
        {scope === "personal" && (
          <PersonalTaskList 
            initialTasks={initialPersonalTasks} 
          />
        )}
        {scope === "all" && (
          <div className="h-full overflow-y-auto space-y-8 pb-8">
             <section>
               <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground-400 mb-4 px-1">Team Tasks</h3>
               <KanbanBoard 
                initialTasks={initialTeamTasks} 
                initialProjectId={initialProjectId} 
                projects={projects}
               />
             </section>
             <section className="pt-4 border-t border-divider">
               <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground-400 mb-4 px-1">Personal Tasks</h3>
               <PersonalTaskList 
                initialTasks={initialPersonalTasks} 
               />
             </section>
          </div>
        )}
      </div>
    </div>
  );
}
