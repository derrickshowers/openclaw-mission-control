"use client";

import { useState, useMemo } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users,
  X,
  Umbrella,
  MoreVertical
} from "lucide-react";
import { 
  Button, 
  Card, 
  CardBody, 
  Chip, 
  Tooltip,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure
} from "@heroui/react";
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  isToday,
  startOfDay,
  endOfDay,
  addWeeks,
  subWeeks
} from "date-fns";

// Mock events for now
const MOCK_EVENTS = [
  {
    id: "1",
    title: "Team Sync",
    start: new Date(new Date().setHours(10, 0, 0, 0)),
    end: new Date(new Date().setHours(11, 0, 0, 0)),
    type: "team",
    attendees: ["frank", "michael", "tom"],
    location: "Discord"
  },
  {
    id: "2",
    title: "Product Review",
    start: new Date(new Date().setDate(new Date().getDate() + 1)),
    type: "project",
    project: "Mission Control"
  },
  {
    id: "3",
    title: "Architecture Session",
    start: new Date(new Date().setDate(new Date().getDate() - 2)),
    type: "technical",
    attendees: ["tom", "michael"]
  }
];

export function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = useMemo(() => {
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [startDate, endDate]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate);
    const end = endOfWeek(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const handlePrev = () => {
    setCurrentDate(viewMode === "month" ? subMonths(currentDate, 1) : subWeeks(currentDate, 1));
  };

  const handleNext = () => {
    setCurrentDate(viewMode === "month" ? addMonths(currentDate, 1) : addWeeks(currentDate, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const openEvent = (event: any) => {
    setSelectedEvent(event);
    onOpen();
  };

  return (
    <div className="flex h-full flex-col">
      {/* Calendar Header */}
      <div className="mb-4 flex items-center justify-between px-1">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-foreground">
            {format(currentDate, "MMMM yyyy")}
          </h2>
          <div className="flex items-center gap-1 rounded-lg border border-divider bg-gray-50 dark:bg-content1 p-0.5">
            <Button 
              isIconOnly 
              size="sm" 
              variant="light" 
              onPress={handlePrev}
              className="h-7 w-7 text-foreground-400 hover:text-foreground"
            >
              <ChevronLeft size={16} />
            </Button>
            <Button 
              size="sm" 
              variant="light" 
              onPress={handleToday}
              className="h-7 px-2 text-xs font-medium text-foreground-500 hover:text-foreground"
            >
              Today
            </Button>
            <Button 
              isIconOnly 
              size="sm" 
              variant="light" 
              onPress={handleNext}
              className="h-7 w-7 text-foreground-400 hover:text-foreground"
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-divider bg-gray-50 dark:bg-content1 p-0.5">
            <Button
              size="sm"
              variant={viewMode === "month" ? "flat" : "light"}
              onPress={() => setViewMode("month")}
              className={`h-7 px-3 text-[11px] font-medium ${viewMode === "month" ? "bg-white dark:bg-[#1A1A1A] text-foreground dark:text-white" : "text-foreground-400"}`}
            >
              Month
            </Button>
            <Button
              size="sm"
              variant={viewMode === "week" ? "flat" : "light"}
              onPress={() => setViewMode("week")}
              className={`h-7 px-3 text-[11px] font-medium ${viewMode === "week" ? "bg-white dark:bg-[#1A1A1A] text-foreground dark:text-white" : "text-foreground-400"}`}
            >
              Week
            </Button>
          </div>
          <Button
            size="sm"
            color="primary"
            startContent={<Plus size={16} />}
            className="h-8"
          >
            Add Event
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-hidden rounded-xl border border-divider bg-white dark:bg-[#0A0A0A] shadow-sm">
        {/* Days of week header */}
        <div className="grid grid-cols-7 border-b border-divider bg-gray-50/50 dark:bg-content1/50">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-foreground-400">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Body */}
        <div className="grid h-full grid-cols-7 grid-rows-6">
          {(viewMode === "month" ? calendarDays : weekDays).map((day, idx) => {
            const isSelectedMonth = isSameMonth(day, monthStart);
            const isTodayDay = isToday(day);
            const dayEvents = MOCK_EVENTS.filter(e => isSameDay(e.start, day));

            return (
              <div 
                key={day.toString()} 
                className={`relative flex flex-col border-b border-r border-divider p-1 transition-colors hover:bg-gray-50/50 dark:hover:bg-[#111111]/50 ${
                  !isSelectedMonth ? "bg-gray-50/30 dark:bg-[#080808]/30 text-foreground-300" : "bg-white dark:bg-[#0A0A0A]"
                }`}
              >
                <div className="flex items-center justify-between p-1">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium ${
                    isTodayDay ? "bg-primary text-white" : ""
                  }`}>
                    {format(day, "d")}
                  </span>
                </div>
                
                <div className="flex-1 space-y-1 overflow-y-auto px-0.5">
                  {dayEvents.map(event => (
                    <button
                      key={event.id}
                      onClick={() => openEvent(event)}
                      className={`w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium transition-opacity hover:opacity-80 ${
                        event.type === 'team' ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20' :
                        event.type === 'project' ? 'bg-success-500/10 text-success-600 dark:text-success-400 border border-success-500/20' :
                        'bg-warning-500/10 text-warning-600 dark:text-warning-400 border border-warning-500/20'
                      }`}
                    >
                      {event.title}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Event Details Modal */}
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        className="bg-white dark:bg-[#121212] text-gray-900 dark:text-white"
        backdrop="opaque"
        classNames={{
          backdrop: "bg-black/20 dark:bg-black/60"
        }}
      >
        <ModalContent>
          {selectedEvent && (
            <>
              <ModalHeader className="border-b border-divider flex items-center justify-between">
                <span className="text-sm font-medium">Event Details</span>
                <div className="flex items-center gap-2">
                  <Chip size="sm" variant="flat" className="capitalize">{selectedEvent.type}</Chip>
                </div>
              </ModalHeader>
              <ModalBody className="py-6 space-y-6">
                <div>
                  <h2 className="text-xl font-bold">{selectedEvent.title}</h2>
                  <div className="mt-3 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-foreground-400">
                      <Clock size={16} strokeWidth={1.5} />
                      <span className="text-sm">
                        {format(selectedEvent.start, "EEEE, MMMM do")}
                      </span>
                    </div>
                    {selectedEvent.location && (
                      <div className="flex items-center gap-2 text-foreground-400">
                        <MapPin size={16} strokeWidth={1.5} />
                        <span className="text-sm">{selectedEvent.location}</span>
                      </div>
                    )}
                  </div>
                </div>

                {selectedEvent.attendees && (
                  <div className="border-t border-divider pt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground-300 mb-3">Attendees</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedEvent.attendees.map((a: string) => (
                        <Chip key={a} size="sm" variant="flat" className="capitalize">{a}</Chip>
                      ))}
                    </div>
                  </div>
                )}
              </ModalBody>
              <ModalFooter className="border-t border-divider">
                <Button size="sm" variant="flat" onPress={onClose}>Close</Button>
                <Button size="sm" color="primary">Edit Event</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
