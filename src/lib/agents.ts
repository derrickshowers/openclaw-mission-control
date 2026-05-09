export const KNOWN_AGENT_IDS = ["derrick", "frank", "tom", "michael", "joanna", "ivy"] as const;
export const TEAM_AGENT_IDS = ["frank", "tom", "michael", "joanna", "ivy"] as const;

export function normalizeAgentId(agentName?: string | null): string | null {
  if (!agentName) return null;
  const normalized = String(agentName).trim().toLowerCase();
  return normalized || null;
}

export function isKnownAgent(agentName?: string | null): boolean {
  const normalized = normalizeAgentId(agentName);
  return !!normalized && (KNOWN_AGENT_IDS as readonly string[]).includes(normalized);
}

function normalizeProxiedAvatarUrl(avatarUrl?: string | null): string | null {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith("/api/agents/")) {
    return avatarUrl.replace("/api/agents/", "/api/mc/agents/");
  }
  return avatarUrl;
}

export function resolveAgentAvatarUrl(
  agentName?: string | null,
  avatarUrl?: string | null
): string | null {
  const normalized = normalizeAgentId(agentName);
  if (!normalized || !isKnownAgent(normalized)) return null;

  if (normalized === "derrick") return "/images/team/derrick.jpg";

  const normalizedAvatarUrl = normalizeProxiedAvatarUrl(avatarUrl);
  if (normalizedAvatarUrl) return normalizedAvatarUrl;

  return `/api/mc/agents/${normalized}/avatar`;
}
