import { NextRequest } from "next/server";

const PROXY_URL = process.env.PROXY_API_URL || "http://localhost:3001";
const API_KEY = process.env.MISSION_API_KEY || "";

export async function GET(request: NextRequest) {
  const upstream = await fetch(`${PROXY_URL}/api/activity/stream`, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: "text/event-stream",
    },
  });

  if (!upstream.ok || !upstream.body) {
    return new Response("Failed to connect to activity stream", { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
