"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@heroui/react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  startOfWeek as getWeekStart,
  endOfWeek as getWeekEnd,
} from "date-fns";
import { parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Clock, Repeat, X } from "lucide-react";

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  all_day: number;
  recurrence?: string;
  category: string;
  color?: string;
  created_by?: string;
}

type ViewMode = "month" | "week";

const CATEGORY_COLORS: Record<string, string> = {
  cron: "#6366f1",
  standup: "#06b6d4",
  meeting: "#8b5cf6",
  deadline: "#ef4444",
  event: "#64748b",
};

export function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);

  const calendarDays = useMemo(() => {
    if (viewMode === "month") {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
      const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
      return eachDayOfInterval({ start: calStart, end: calEnd });
    } else {
      const weekStart = getWeekStart(currentDate, { weekStartsOn: 0 });
      const weekEnd = getWeekEnd(currentDate, { weekStartsOn: 0 });
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    }
  }, [currentDate, viewMode]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const start = format(calendarDays[0], "yyyy-MM-dd");
      const end = format(calendarDays[calendarDays.length - 1], "yyyy-MM-dd");
      const res = await fetch(`/api/mc/events?start=${start}&end=${end}`);
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [calendarDays]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const navigate = (direction: "prev" | "next") => {
    if (viewMode === "month") {
      setCurrentDate((d) => (direction === "next" ? addMonths(d, 1) : subMonths(d, 1)));
    } else {
      setCurrentDate((d) => (direction === "next" ? addWeeks(d, 1) : subWeeks(d, 1)));
    }
  };

  const goToday = () => setCurrentDate(new Date());

  const getEventsForDay = (day: Date): CalendarEvent[] => {
    const dayStr = format(day, "yyyy-MM-dd");
    return events.filter((e) => e.start_date.startsWith(dayStr));
  };

  return (
    <div className="mx-auto flex h-full max-w-[1400px] flex-col">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">
            {viewMode === "month"
              ? format(currentDate, "MMMM yyyy")
              : `Week of ${format(calendarDays[0], "MMM d")} – ${format(calendarDays[6], "MMM d, yyyy")}`}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="flat"
            className="text-xs border border-[#222222] bg-[#080808]"
            onPress={goToday}
          >
            Today
          </Button>
          <div className="flex">
            <Button
              size="sm"
              variant="flat"
              isIconOnly
              className="border border-[#222222] bg-[#080808] rounded-r-none"
              onPress={() => navigate("prev")}
            >
              <ChevronLeft size={14} strokeWidth={1.5} />
            </Button>
            <Button
              size="sm"
              variant="flat"
              isIconOnly
              className="border border-[#222222] bg-[#080808] rounded-l-none border-l-0"
              onPress={() => navigate("next")}
            >
              <ChevronRight size={14} strokeWidth={1.5} />
            </Button>
          </div>
          <div className="flex ml-2">
            <Button
              size="sm"
              variant="flat"
              className={`text-xs border border-[#222222] rounded-r-none ${viewMode === "month" ? "bg-[#1A1A1A] text-white" : "bg-[#080808] text-[#888888]"}`}
              onPress={() => setViewMode("month")}
            >
              Month
            </Button>
            <Button
              size="sm"
              variant="flat"
              className={`text-xs border border-[#222222] rounded-l-none border-l-0 ${viewMode === "week" ? "bg-[#1A1A1A] text-white" : "bg-[#080808] text-[#888888]"}`}
              onPress={() => setViewMode("week")}
            >
              Week
            </Button>
          </div>
        </div>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 border-b border-[#333333]">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="px-2 py-1.5 text-xs text-[#888888] text-right font-medium"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div
        className={`grid grid-cols-7 flex-1 ${
          viewMode === "week" ? "grid-rows-1" : ""
        }`}
        style={
          viewMode === "month"
            ? { gridTemplateRows: `repeat(${Math.ceil(calendarDays.length / 7)}, minmax(0, 1fr))` }
            : undefined
        }
      >
        {calendarDays.map((day) => {
          const dayEvents = getEventsForDay(day);
          const inMonth = isSameMonth(day, currentDate);
          const today = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={`border-b border-r border-[#333333] p-1 transition-colors hover:bg-[#0c0c0c] ${
                viewMode === "week" ? "min-h-[300px]" : "min-h-[80px]"
              } ${inMonth ? "bg-[#080808]" : "bg-[#111111]"}`}
            >
              <div className="flex justify-end mb-0.5">
                <span
                  className={`text-xs px-1.5 py-0.5 ${
                    today
                      ? "bg-white text-black rounded-full font-medium"
                      : inMonth
                      ? "text-[#888888]"
                      : "text-[#555555]"
                  }`}
                >
                  {format(day, "d")}
                </span>
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, viewMode === "week" ? 10 : 3).map((event) => (
                  <button
                    key={event.id}
                    onClick={() => setSelectedEvent(event)}
                    className="flex w-full items-center gap-1 rounded-sm bg-[#1a1a1a] border border-[#333333] px-1.5 py-0.5 text-left text-xs text-[#D4D4D8] truncate transition-colors hover:bg-[#2a2a2a] hover:border-[#444444] cursor-pointer"
                    title={event.title}
                  >
                    {event.recurrence ? (
                      <Repeat size={10} strokeWidth={1.5} className="flex-shrink-0 text-[#888888]" />
                    ) : (
                      <Clock size={10} strokeWidth={1.5} className="flex-shrink-0 text-[#888888]" />
                    )}
                    <span className="truncate">{event.title}</span>
                  </button>
                ))}
                {dayEvents.length > (viewMode === "week" ? 10 : 3) && (
                  <span className="text-[10px] text-[#555555] px-1">
                    +{dayEvents.length - (viewMode === "week" ? 10 : 3)} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Event Detail Drawer */}
      {selectedEvent && (
        <EventDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  );
}

function EventDrawer({
  event,
  onClose,
}: {
  event: CalendarEvent;
  onClose: () => void;
}) {
  const color = CATEGORY_COLORS[event.category] || CATEGORY_COLORS.event;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="relative ml-auto h-full w-full max-w-md border-l border-[#222222] bg-[#0A0A0A] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#222222] px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs text-[#888888] capitalize">{event.category}</span>
          </div>
          <button onClick={onClose} className="text-[#888888] hover:text-white">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <h2 className="text-lg font-semibold text-white">{event.title}</h2>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Clock size={14} strokeWidth={1.5} className="text-[#888888]" />
              <span className="text-[#CCCCCC]">
                {format(parseISO(event.start_date), "EEEE, MMMM d, yyyy")}
                {event.end_date && ` – ${format(parseISO(event.end_date), "MMM d, yyyy")}`}
              </span>
            </div>

            {event.recurrence && (
              <div className="flex items-center gap-2 text-sm">
                <Repeat size={14} strokeWidth={1.5} className="text-[#888888]" />
                <span className="text-[#CCCCCC] capitalize">{event.recurrence}</span>
              </div>
            )}
          </div>

          {event.description && (
            <div className="border-t border-[#222222] pt-4">
              <p className="text-sm text-[#aaaaaa] whitespace-pre-wrap">{event.description}</p>
            </div>
          )}

          {event.created_by && (
            <div className="border-t border-[#222222] pt-4">
              <span className="text-xs text-[#555555]">Created by </span>
              <span className="text-xs text-[#888888] capitalize">{event.created_by}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
