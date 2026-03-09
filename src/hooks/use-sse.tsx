"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from "react";

export interface SSEEvent {
  id: string;
  event: string;
  data: any;
  receivedAt: number;
}

type SSECallback = (event: SSEEvent) => void;

interface SSEContextValue {
  connected: boolean;
  subscribe: (events: string | string[], callback: SSECallback) => () => void;
}

const SSEContext = createContext<SSEContextValue | null>(null);

// All known named event types we want to listen for
const NAMED_EVENTS = [
  "task.created",
  "task.updated",
  "task.deleted",
  "task.moved",
  "comment.created",
  "attachment.created",
  "attachment.deleted",
  "agent.status",
];

export function SSEProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const subscribersRef = useRef<Map<string, Set<SSECallback>>>(new Map());
  const esRef = useRef<EventSource | null>(null);

  const dispatch = useCallback((eventType: string, msg: MessageEvent) => {
    try {
      const data = JSON.parse(msg.data);
      const sseEvent: SSEEvent = {
        id: msg.lastEventId || "",
        event: eventType,
        data,
        receivedAt: Date.now(),
      };

      // Dispatch to specific subscribers
      const subs = subscribersRef.current.get(eventType);
      if (subs) {
        for (const cb of subs) cb(sseEvent);
      }

      // Dispatch to wildcard subscribers
      const wildcardSubs = subscribersRef.current.get("*");
      if (wildcardSubs) {
        for (const cb of wildcardSubs) cb(sseEvent);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/mc/activity/stream");
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    // Listen for unnamed messages (generic events)
    es.onmessage = (msg) => dispatch("message", msg);

    // Listen for all known named events
    for (const eventName of NAMED_EVENTS) {
      es.addEventListener(eventName, (msg) => dispatch(eventName, msg as MessageEvent));
    }

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [dispatch]);

  const subscribe = useCallback(
    (events: string | string[], callback: SSECallback) => {
      const eventList = Array.isArray(events) ? events : [events];
      for (const evt of eventList) {
        if (!subscribersRef.current.has(evt)) {
          subscribersRef.current.set(evt, new Set());
        }
        subscribersRef.current.get(evt)!.add(callback);
      }

      return () => {
        for (const evt of eventList) {
          subscribersRef.current.get(evt)?.delete(callback);
        }
      };
    },
    []
  );

  return (
    <SSEContext.Provider value={{ connected, subscribe }}>
      {children}
    </SSEContext.Provider>
  );
}

/**
 * Subscribe to SSE events by type. Returns the most recent matching event.
 */
export function useSSE(events: string | string[]): {
  lastEvent: SSEEvent | null;
  connected: boolean;
} {
  const ctx = useContext(SSEContext);
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);

  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe(events, setLastEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx]);

  return { lastEvent, connected: ctx?.connected ?? false };
}

/**
 * Just get connection status without subscribing to events.
 */
export function useSSEStatus(): boolean {
  const ctx = useContext(SSEContext);
  return ctx?.connected ?? false;
}
