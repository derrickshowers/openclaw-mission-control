import { NextRequest, NextResponse } from "next/server";
import { getInsight, updateInsight } from "../_store";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = getInsight(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const patch: Parameters<typeof updateInsight>[1] = {};

  if (body.status !== undefined) patch.status = body.status;
  if (body.notion_page_id !== undefined) patch.notion_page_id = body.notion_page_id;

  const updated = updateInsight(id, patch);
  return NextResponse.json(updated);
}
