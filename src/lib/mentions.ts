import { KNOWN_AGENT_IDS } from "@/lib/agents";

export type MentionSegment =
  | { type: "text"; value: string }
  | { type: "mention"; value: string };

const SORTED_AGENT_IDS = [...KNOWN_AGENT_IDS].sort((a, b) => b.length - a.length);
const WORD_CHAR_RE = /[A-Za-z0-9_]/;
const LOWERCASE_MERGE_MIN_LENGTH = 3;

function isWordChar(char?: string): boolean {
  return !!char && WORD_CHAR_RE.test(char);
}

function isLowercaseMergeRemainder(remainder: string): boolean {
  return /^[a-z0-9_]+$/.test(remainder) && remainder.length >= LOWERCASE_MERGE_MIN_LENGTH;
}

function findMentionMatch(text: string, atIndex: number): {
  agent: string;
  mergedRemainder: string;
  tokenEnd: number;
} | null {
  const precedingChar = atIndex > 0 ? text[atIndex - 1] : undefined;
  if (isWordChar(precedingChar)) return null;

  for (const agent of SORTED_AGENT_IDS) {
    const candidate = text.slice(atIndex + 1, atIndex + 1 + agent.length);
    if (candidate.toLowerCase() !== agent) continue;

    let cursor = atIndex + 1 + agent.length;
    while (cursor < text.length && isWordChar(text[cursor])) {
      cursor += 1;
    }

    const mergedRemainder = text.slice(atIndex + 1 + agent.length, cursor);
    if (
      mergedRemainder &&
      !/^[A-Z]/.test(mergedRemainder) &&
      !isLowercaseMergeRemainder(mergedRemainder)
    ) {
      continue;
    }

    return { agent, mergedRemainder, tokenEnd: cursor };
  }

  return null;
}

export function findMergedMentionPrefix(token: string): {
  agent: string;
  remainder: string;
} | null {
  const match = findMentionMatch(`@${token}`, 0);
  if (!match || !match.mergedRemainder) return null;
  return { agent: match.agent, remainder: match.mergedRemainder };
}

export function normalizeMentionText(text: string): string {
  let normalized = "";
  let cursor = 0;

  while (cursor < text.length) {
    const atIndex = text.indexOf("@", cursor);
    if (atIndex === -1) {
      normalized += text.slice(cursor);
      break;
    }

    normalized += text.slice(cursor, atIndex);
    const match = findMentionMatch(text, atIndex);

    if (!match) {
      normalized += "@";
      cursor = atIndex + 1;
      continue;
    }

    normalized += `@${match.agent}`;
    if (match.mergedRemainder) {
      normalized += ` ${match.mergedRemainder}`;
    }
    cursor = match.tokenEnd;
  }

  return normalized;
}

export function splitTextWithMentions(text: string): MentionSegment[] {
  const normalizedText = normalizeMentionText(text);
  const segments: MentionSegment[] = [];
  let cursor = 0;

  while (cursor < normalizedText.length) {
    const atIndex = normalizedText.indexOf("@", cursor);
    if (atIndex === -1) break;

    const match = findMentionMatch(normalizedText, atIndex);
    if (!match) {
      cursor = atIndex + 1;
      continue;
    }

    if (atIndex > cursor) {
      segments.push({ type: "text", value: normalizedText.slice(cursor, atIndex) });
    }

    segments.push({ type: "mention", value: match.agent });
    cursor = atIndex + 1 + match.agent.length;
  }

  if (cursor < normalizedText.length) {
    segments.push({ type: "text", value: normalizedText.slice(cursor) });
  }

  return segments.length > 0 ? segments : [{ type: "text", value: normalizedText }];
}
