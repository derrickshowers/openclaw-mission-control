"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Input, Textarea, Card, CardBody, Progress, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/react";
import { Plus, Folder, ArrowRight, AlertTriangle, User } from "lucide-react";
import { api, type Project } from "@/lib/api";
import { timeAgo } from "@/lib/dates";

interface ProjectsViewProps {
  initialProjects: Project[];
}

export function ProjectsView({ initialProjects }: ProjectsViewProps) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New project form state
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newOwner, setNewOwner] = useState("derrick");

  const createProject = async () => {
    if (!newName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const project = await api.createProject({
        name: newName,
        description: newDescription || undefined,
        owner: newOwner || undefined,
      });

      setProjects((prev) => [...prev, project]);
      setNewName("");
      setNewDescription("");
      onClose();
    } catch (err) {
      console.error("Failed to create project:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Projects</h1>
          <p className="text-sm text-foreground-400">Track high-level progress across workstreams</p>
        </div>
        <Button
          size="sm"
          variant="flat"
          onPress={onOpen}
          className="w-full border border-divider bg-gray-50 dark:bg-[#121212] text-sm sm:w-auto"
          startContent={<Plus size={16} strokeWidth={1.5} />}
        >
          New Project
        </Button>
      </div>

      {/* Projects List */}
      <div className="flex-1 space-y-3 overflow-y-auto">
        {projects.map((project) => (
          <Card
            key={project.id}
            className="border border-divider bg-white dark:bg-[#0A0A0A] hover:border-foreground-200 dark:hover:border-[#333333] transition-colors"
            shadow="none"
            radius="sm"
          >
            <CardBody className="flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center lg:gap-6">
              {/* Left: Info */}
              <div className="flex flex-1 flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-foreground dark:text-white truncate">{project.name}</h3>
                  {project.task_summary?.blocked ? (
                    <AlertTriangle size={14} className="text-danger" />
                  ) : null}
                </div>
                <p className="text-xs text-foreground-400 line-clamp-1 mt-0.5">
                  {project.description || "No description"}
                </p>
              </div>

              {/* Center: Progress */}
              <div className="w-full lg:flex-[1.5] flex flex-col gap-2">
                <div className="flex flex-col gap-1 text-[10px] text-foreground-400 sm:flex-row sm:items-center sm:justify-between">
                  <span>{project.task_summary?.progress || 0}% complete · {project.task_summary?.total || 0} tasks</span>
                  <div className="flex flex-wrap gap-2">
                    {project.task_summary?.backlog ? <span>{project.task_summary.backlog} Backlog</span> : null}
                    {project.task_summary?.in_progress ? <span>{project.task_summary.in_progress} In Progress</span> : null}
                    {project.task_summary?.blocked ? <span className="text-danger font-medium">{project.task_summary.blocked} Blocked</span> : null}
                    {project.task_summary?.done ? <span>{project.task_summary.done} Done</span> : null}
                  </div>
                </div>
                <Progress
                  aria-label="Project progress"
                  size="sm"
                  value={project.task_summary?.progress || 0}
                  className="max-w-full"
                  classNames={{
                    base: "h-1",
                    indicator: "bg-primary dark:bg-[#8b5cf6]",
                    track: "bg-gray-100 dark:bg-[#1A1A1A]"
                  }}
                />
              </div>

              {/* Right: Meta & CTA */}
              <div className="flex w-full items-center justify-between gap-3 text-[11px] text-foreground-400 lg:flex-1 lg:justify-end lg:gap-6">
                <div className="flex items-center gap-1.5 min-w-[70px]">
                  <User size={12} strokeWidth={1.5} />
                  <span className="capitalize">{project.owner || "derrick"}</span>
                </div>
                <div className="min-w-[100px] text-right">
                  {project.last_activity_at ? `Active ${timeAgo(project.last_activity_at)}` : "No activity"}
                </div>
                <Button
                  as={Link}
                  href={`/tasks?project_id=${project.id}`}
                  size="sm"
                  variant="light"
                  className="h-8 text-foreground-400 hover:text-foreground hover:bg-gray-100 dark:hover:bg-[#1A1A1A]"
                  endContent={<ArrowRight size={14} strokeWidth={1.5} />}
                >
                  View tasks
                </Button>
              </div>
            </CardBody>
          </Card>
        ))}

        {projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-divider rounded-lg">
            <Folder size={40} strokeWidth={1} className="text-foreground-200 dark:text-[#222222] mb-4" />
            <p className="text-foreground-400">No projects found</p>
            <Button size="sm" variant="flat" onPress={onOpen} className="mt-4">
              Create your first project
            </Button>
          </div>
        )}
      </div>

      {/* New Project Modal */}
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        className="bg-white dark:bg-[#121212] text-foreground dark:text-white max-h-[85dvh]"
        placement="top-center"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader className="border-b border-divider text-sm">
            New Project
          </ModalHeader>
          <ModalBody className="gap-4 py-6">
            <Input
              label="Name"
              placeholder="e.g. Mission Control"
              value={newName}
              onValueChange={setNewName}
              variant="bordered"
              size="sm"
              classNames={{ inputWrapper: "border-divider bg-white dark:bg-[#080808] data-[focus=true]:border-primary data-[focus-visible=true]:border-primary" }}
              autoFocus
            />
            <Textarea
              label="Description"
              placeholder="What is this project about?"
              value={newDescription}
              onValueChange={setNewDescription}
              variant="bordered"
              size="sm"
              classNames={{ inputWrapper: "border-divider bg-white dark:bg-[#080808] data-[focus=true]:border-primary data-[focus-visible=true]:border-primary" }}
            />
            <Input
              label="Owner"
              placeholder="derrick"
              value={newOwner}
              onValueChange={setNewOwner}
              variant="bordered"
              size="sm"
              classNames={{ inputWrapper: "border-divider bg-white dark:bg-[#080808] data-[focus=true]:border-primary data-[focus-visible=true]:border-primary" }}
            />
          </ModalBody>
          <ModalFooter className="border-t border-divider">
            <Button variant="flat" onPress={onClose} size="sm">
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={createProject}
              size="sm"
              isLoading={isSubmitting}
              isDisabled={!newName.trim()}
            >
              Create Project
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
