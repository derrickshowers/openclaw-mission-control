export const KNOWN_AGENT_IDS = ["derrick", "frank", "tom", "michael", "joanna"] as const;
export const TEAM_AGENT_IDS = ["frank", "tom", "michael", "joanna"] as const;

const STATIC_TEAM_AVATARS = new Set(["frank", "joanna", "michael", "tom"]);

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

function buildStaticTeamAvatarUrl(agentId: string, avatarUrl?: string | null): string {
  const basePath = `/avatars/${agentId}.png`;
  const normalizedAvatarUrl = normalizeProxiedAvatarUrl(avatarUrl);
  if (!normalizedAvatarUrl) return basePath;

  try {
    const parsed = new URL(normalizedAvatarUrl, "https://mission-control.local");
    const version = parsed.searchParams.get("v");
    return version ? `${basePath}?v=${encodeURIComponent(version)}` : basePath;
  } catch {
    return basePath;
  }
}

export function resolveAgentAvatarUrl(
  agentName?: string | null,
  avatarUrl?: string | null
): string | null {
  const normalized = normalizeAgentId(agentName);
  if (!normalized || !isKnownAgent(normalized)) return null;

  if (normalized === "derrick") return "/images/team/derrick.jpg";
  if (STATIC_TEAM_AVATARS.has(normalized)) {
    return buildStaticTeamAvatarUrl(normalized, avatarUrl);
  }

  const normalizedAvatarUrl = normalizeProxiedAvatarUrl(avatarUrl);
  if (normalizedAvatarUrl) return normalizedAvatarUrl;

  return `/api/mc/agents/${normalized}/avatar`;
}
