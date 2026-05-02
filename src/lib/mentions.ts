import { KNOWN_AGENT_IDS } from "@/lib/agents";

export type MentionSegment =
  | { type: "text"; value: string }
  | { type: "mention"; value: string };

const SORTED_AGENT_IDS = [...KNOWN_AGENT_IDS].sort((a, b) => b.length - a.length);
const WORD_CHAR_RE = /[A-Za-z0-9_]/;

function isWordChar(char?: string): boolean {
  return !!char && WORD_CHAR_RE.test(char);
}

export function findMergedMentionPrefix(token: string): {
  agent: string;
  remainder: string;
} | null {
  const normalizedToken = token.toLowerCase();

  for (const agent of SORTED_AGENT_IDS) {
    if (!normalizedToken.startsWith(agent)) continue;

    const remainder = token.slice(agent.length);
    if (!remainder) continue;
    if (!/^[A-Z]/.test(remainder)) continue;

    return { agent, remainder };
  }

  return null;
}

export function splitTextWithMentions(text: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const atIndex = text.indexOf("@", cursor);
    if (atIndex === -1) break;

    const precedingChar = atIndex > 0 ? text[atIndex - 1] : undefined;
    if (isWordChar(precedingChar)) {
      cursor = atIndex + 1;
      continue;
    }

    let matchedAgent: string | null = null;

    for (const agent of SORTED_AGENT_IDS) {
      const candidate = text.slice(atIndex + 1, atIndex + 1 + agent.length);
      if (candidate.toLowerCase() !== agent) continue;

      const trailingChar = text[atIndex + 1 + agent.length];
      if (isWordChar(trailingChar) && !(trailingChar && /[A-Z]/.test(trailingChar))) {
        continue;
      }

      matchedAgent = agent;
      break;
    }

    if (!matchedAgent) {
      cursor = atIndex + 1;
      continue;
    }

    if (atIndex > cursor) {
      segments.push({ type: "text", value: text.slice(cursor, atIndex) });
    }

    segments.push({ type: "mention", value: matchedAgent });
    cursor = atIndex + 1 + matchedAgent.length;
  }

  if (cursor < text.length) {
    segments.push({ type: "text", value: text.slice(cursor) });
  }

  return segments.length > 0 ? segments : [{ type: "text", value: text }];
}
