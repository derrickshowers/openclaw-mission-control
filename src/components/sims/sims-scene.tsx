"use client";

import { Html, useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group, Mesh } from "three";
import type { SimsAgentSceneState, SimsPanelTarget, SimsRoomState, SimsZoneId } from "./sims-types";

interface SimsSceneProps {
  room: SimsRoomState;
  selectedTarget: SimsPanelTarget;
  onSelectTarget: (target: SimsPanelTarget) => void;
  motionEnabled: boolean;
}

const zoneSelected = (target: SimsPanelTarget, zoneId: SimsZoneId) =>
  target.kind === "zone" && target.zoneId === zoneId;
const agentSelected = (target: SimsPanelTarget, agentId: string) =>
  target.kind === "agent" && target.agentId === agentId;

const AGENT_SPRITE_PATHS: Record<string, string> = {
  frank: "/sims/agents/frank.png",
  tom: "/sims/agents/tom.png",
  michael: "/sims/agents/michael.png",
  joanna: "/sims/agents/joanna.png",
  ivy: "/sims/agents/ivy.png",
  sloane: "/sims/agents/sloane.png",
};

export function SimsScene({ room, selectedTarget, onSelectTarget, motionEnabled }: SimsSceneProps) {
  const blockedCount = room.blockedTasks.length;
  const taskWallBars = useMemo(() => Math.max(1, Math.min(blockedCount, 5)), [blockedCount]);
  const reviewBars = useMemo(() => Math.max(1, Math.min(room.activeTasks.length, 5)), [room.activeTasks.length]);

  return (
    <group>
      <color attach="background" args={["#d7ebfb"]} />
      <fog attach="fog" args={["#d7ebfb", 28, 42]} />
      <ambientLight intensity={1.2} />
      <directionalLight
        castShadow
        intensity={1.55}
        position={[12, 16, 10]}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <hemisphereLight intensity={0.6} groundColor="#738b58" color="#fff6eb" />

      <GroundPlane />
      <BuildingShell />
      <OpenOffice selected={selectedTarget.kind === "overview"} />
      <TaskWall
        selected={zoneSelected(selectedTarget, "task-wall")}
        blockedCount={blockedCount}
        barCount={taskWallBars}
        onSelect={() => onSelectTarget({ kind: "zone", zoneId: "task-wall" })}
      />
      <ReviewTable
        selected={zoneSelected(selectedTarget, "review-table")}
        barCount={reviewBars}
        onSelect={() => onSelectTarget({ kind: "zone", zoneId: "review-table" })}
      />
      <BreakRoom
        selected={zoneSelected(selectedTarget, "break-room")}
        idleCount={room.agents.filter((agent) => agent.currentZoneId === "break-room").length}
        onSelect={() => onSelectTarget({ kind: "zone", zoneId: "break-room" })}
      />
      <KingsOffice
        selected={zoneSelected(selectedTarget, "king-office")}
        pressureCount={Math.max(1, blockedCount || room.activeTasks.length)}
        onSelect={() => onSelectTarget({ kind: "zone", zoneId: "king-office" })}
      />
      <Courtyard
        selected={zoneSelected(selectedTarget, "courtyard")}
        outsideCount={room.agents.filter((agent) => agent.currentZoneId === "courtyard").length}
        onSelect={() => onSelectTarget({ kind: "zone", zoneId: "courtyard" })}
      />

      {room.agents.map((agent) => (
        <DeskLane
          key={agent.id}
          agent={agent}
          selected={agentSelected(selectedTarget, agent.id)}
          motionEnabled={motionEnabled}
          onSelect={() => onSelectTarget({ kind: "agent", agentId: agent.id })}
        />
      ))}
    </group>
  );
}

function GroundPlane() {
  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 2.2]}>
        <planeGeometry args={[44, 36]} />
        <meshStandardMaterial color="#8dc56b" />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[2.4, -0.005, 7.35]}>
        <planeGeometry args={[12.8, 7.1]} />
        <meshStandardMaterial color="#d8d1c4" />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[11.2, -0.004, 2.7]}>
        <planeGeometry args={[4.2, 18]} />
        <meshStandardMaterial color="#84b45e" />
      </mesh>
      <Plant position={[-4.8, 0, 10.8]} />
      <Plant position={[4.9, 0, 10.6]} />
      <Plant position={[12.8, 0, 8.9]} />
    </group>
  );
}

function BuildingShell() {
  return (
    <group>
      <mesh receiveShadow position={[0, 0.06, 0.05]}>
        <boxGeometry args={[21.4, 0.12, 15.5]} />
        <meshStandardMaterial color="#d6bc98" />
      </mesh>

      <RoomFloor position={[-3.55, 0.09, -0.15]} size={[13, 11.5]} color="#f7efe4" />
      <RoomFloor position={[6.25, 0.09, -2.7]} size={[6.2, 4.9]} color="#fbf4e8" />
      <RoomFloor position={[6.25, 0.09, 3.3]} size={[6.2, 4.9]} color="#f6efe4" />

      <WallSegment position={[0, 2.4, -7.72]} size={[21.5, 4.8, 0.28]} />
      <WallSegment position={[-10.62, 2.4, -0.2]} size={[0.28, 4.8, 15.3]} />
      <WallSegment position={[10.62, 2.4, -2.45]} size={[0.28, 4.8, 10.8]} />
      <WallSegment position={[3.2, 2.4, -4.65]} size={[0.28, 4.8, 6.2]} />
      <WallSegment position={[3.2, 2.4, 3.35]} size={[0.28, 4.8, 4.6]} />
      <WallSegment position={[6.85, 2.4, 0.28]} size={[7.5, 4.8, 0.22]} />
      <WallSegment position={[6.85, 2.4, 5.72]} size={[7.5, 4.8, 0.28]} />

      <WindowStrip position={[6.25, 2.55, -7.58]} width={5.2} />
      <WindowStrip position={[6.25, 2.55, 5.58]} width={5.2} />
      <WindowColumn position={[10.46, 2.55, 3.3]} depth={4.5} />
    </group>
  );
}

function RoomFloor({
  position,
  size,
  color,
}: {
  position: [number, number, number];
  size: [number, number];
  color: string;
}) {
  return (
    <mesh receiveShadow position={position}>
      <boxGeometry args={[size[0], 0.04, size[1]]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function WallSegment({
  position,
  size,
}: {
  position: [number, number, number];
  size: [number, number, number];
}) {
  return (
    <mesh castShadow receiveShadow position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color="#f9f2e8" />
    </mesh>
  );
}

function WindowStrip({ position, width }: { position: [number, number, number]; width: number }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[width, 1.35, 0.06]} />
      <meshStandardMaterial color="#d8f0ff" transparent opacity={0.5} />
    </mesh>
  );
}

function WindowColumn({ position, depth }: { position: [number, number, number]; depth: number }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[0.06, 1.35, depth]} />
      <meshStandardMaterial color="#d8f0ff" transparent opacity={0.45} />
    </mesh>
  );
}

function OpenOffice({ selected }: { selected: boolean }) {
  return (
    <group>
      <mesh receiveShadow position={[-3.55, 0.1, -0.15]}>
        <boxGeometry args={[13, 0.03, 11.45]} />
        <meshStandardMaterial color={selected ? "#f4ead7" : "#f7efe4"} />
      </mesh>
      <mesh receiveShadow position={[-2.2, 0.13, -5.8]}>
        <boxGeometry args={[4.2, 0.02, 0.48]} />
        <meshStandardMaterial color="#efe4d2" />
      </mesh>
      <mesh receiveShadow position={[-7.75, 0.13, 4.7]}>
        <boxGeometry args={[1.7, 0.02, 1.7]} />
        <meshStandardMaterial color="#efe4d2" />
      </mesh>
      <mesh castShadow receiveShadow position={[-7.75, 0.62, 4.7]}>
        <boxGeometry args={[1.5, 1, 0.18]} />
        <meshStandardMaterial color="#d0b089" />
      </mesh>
      <mesh castShadow receiveShadow position={[-8.3, 1.18, 4.7]}>
        <boxGeometry args={[0.3, 0.2, 0.24]} />
        <meshStandardMaterial color="#fb7185" />
      </mesh>
      <mesh castShadow receiveShadow position={[-7.55, 1.18, 4.7]}>
        <boxGeometry args={[0.3, 0.2, 0.24]} />
        <meshStandardMaterial color="#facc15" />
      </mesh>
    </group>
  );
}

function DeskLane({
  agent,
  selected,
  motionEnabled,
  onSelect,
}: {
  agent: SimsAgentSceneState;
  selected: boolean;
  motionEnabled: boolean;
  onSelect: () => void;
}) {
  const deskBorderColor = agent.hasBlockedTask ? "#ef4444" : selected ? agent.accent : "#8b5e34";
  const laneColor =
    agent.mood === "blocked" ? "#fee2e2" : agent.mood === "busy" ? "#fef3c7" : "#dcfce7";

  return (
    <group>
      <mesh
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[agent.deskPosition[0], 0.121, agent.deskPosition[2]]}
      >
        <planeGeometry args={[2.55, 2.1]} />
        <meshStandardMaterial color={laneColor} />
      </mesh>

      <mesh castShadow receiveShadow position={agent.deskPosition} onClick={onSelect}>
        <boxGeometry args={[1.9, 0.7, 1.02]} />
        <meshStandardMaterial color="#8b5e34" />
      </mesh>
      <mesh
        castShadow
        receiveShadow
        position={[agent.deskPosition[0], 0.92, agent.deskPosition[2] - 0.16]}
        onClick={onSelect}
      >
        <boxGeometry args={[1.35, 0.55, 0.12]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <mesh
        castShadow
        receiveShadow
        position={[agent.deskPosition[0] + 0.7, 0.55, agent.deskPosition[2] + 0.36]}
        onClick={onSelect}
      >
        <cylinderGeometry args={[0.12, 0.12, 0.45, 16]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh
        castShadow
        receiveShadow
        position={[agent.deskPosition[0] - 0.62, 0.52, agent.deskPosition[2] + 0.3]}
        onClick={onSelect}
      >
        <boxGeometry args={[0.34, 0.25, 0.45]} />
        <meshStandardMaterial color="#d4d4d8" />
      </mesh>

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[agent.deskPosition[0], 0.135, agent.deskPosition[2]]}
        onClick={onSelect}
      >
        <ringGeometry args={[1.08, 1.22, 48]} />
        <meshStandardMaterial color={deskBorderColor} emissive={deskBorderColor} emissiveIntensity={selected ? 0.62 : 0.18} />
      </mesh>

      <AgentAvatar agent={agent} selected={selected} motionEnabled={motionEnabled} onSelect={onSelect} />
    </group>
  );
}

function AgentAvatar({
  agent,
  selected,
  motionEnabled,
  onSelect,
}: {
  agent: SimsAgentSceneState;
  selected: boolean;
  motionEnabled: boolean;
  onSelect: () => void;
}) {
  const groupRef = useRef<Group>(null);
  const ringRef = useRef<Mesh>(null);
  const spriteTexture = useTexture(AGENT_SPRITE_PATHS[agent.id] ?? `/avatars/${agent.id}.png`);
  const [baseX, baseY, baseZ] = agent.avatarPosition;

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime() + baseX;
    if (groupRef.current) {
      groupRef.current.position.set(
        baseX,
        baseY + (motionEnabled ? Math.sin(elapsed * 1.5) * 0.035 : 0),
        baseZ,
      );
    }

    if (ringRef.current) {
      const scale = agent.isBusy && motionEnabled ? 1 + (Math.sin(elapsed * 2.4) + 1) * 0.08 : 1;
      ringRef.current.scale.setScalar(scale);
    }
  });

  const bodyColor = agent.hasBlockedTask ? "#ef4444" : agent.accent;
  const statusLabel = agent.hasBlockedTask
    ? `${agent.blockedTasks.length} blocked`
    : agent.isBusy
      ? "working"
      : "idle";
  const spriteTint = agent.hasBlockedTask ? "#ead2d2" : "#ffffff";
  const spriteOpacity = agent.hasBlockedTask ? 0.9 : 0.98;
  const shadowOpacity = selected ? 0.24 : agent.isBusy ? 0.18 : 0.14;

  return (
    <group ref={groupRef} position={agent.avatarPosition} onClick={onSelect}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} scale={[1.6, 0.92, 1]}>
        <circleGeometry args={[0.34, 28]} />
        <meshBasicMaterial color="#0f172a" transparent opacity={shadowOpacity} />
      </mesh>
      <sprite scale={[1.16, 1.74, 1]} center={[0.5, 0]} position={[0, -0.54, 0.02]}>
        <spriteMaterial
          map={spriteTexture}
          transparent
          alphaTest={0.14}
          opacity={spriteOpacity}
          color={spriteTint}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.49, 0]}>
        <ringGeometry args={[0.28, 0.36, 36]} />
        <meshStandardMaterial
          color={agent.hasBlockedTask ? "#ef4444" : selected ? "#111827" : bodyColor}
          emissive={agent.hasBlockedTask ? "#ef4444" : bodyColor}
          emissiveIntensity={selected ? 0.45 : 0.2}
        />
      </mesh>
      <Html position={[0, 1.34, 0]} center>
        <button
          type="button"
          onClick={onSelect}
          className={`rounded-full border px-2.5 py-1 text-[10px] font-medium shadow-sm backdrop-blur ${selected ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200/80 bg-white/88 text-zinc-700"}`}
        >
          {agent.displayName}
          <span className="ml-1 text-[10px] uppercase tracking-[0.14em] opacity-70">{statusLabel}</span>
        </button>
      </Html>
    </group>
  );
}

function TaskWall({
  selected,
  blockedCount,
  barCount,
  onSelect,
}: {
  selected: boolean;
  blockedCount: number;
  barCount: number;
  onSelect: () => void;
}) {
  return (
    <group onClick={onSelect}>
      <mesh castShadow receiveShadow position={[-2.45, 2.4, -7.35]}>
        <boxGeometry args={[4.1, 2.25, 0.12]} />
        <meshStandardMaterial color={selected ? "#fecaca" : "#f7d9d5"} />
      </mesh>
      {Array.from({ length: barCount }).map((_, index) => (
        <mesh key={index} position={[-3.65 + index * 0.56, 2.72 - index * 0.22, -7.25]}>
          <boxGeometry args={[0.38, 0.22, 0.02]} />
          <meshStandardMaterial color={blockedCount > 0 ? "#ef4444" : "#fca5a5"} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-2.45, 1.18, -6.95]}>
        <ringGeometry args={[0.42, 0.52, 40]} />
        <meshStandardMaterial color={selected ? "#ef4444" : "#fca5a5"} emissive={selected ? "#ef4444" : "#fca5a5"} emissiveIntensity={0.3} />
      </mesh>
      <Html position={[-0.45, 3.72, -6.9]} center>
        <button
          type="button"
          onClick={onSelect}
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold shadow-sm ${selected ? "border-rose-500 bg-rose-500 text-white" : "border-rose-200 bg-white/95 text-rose-700"}`}
        >
          Task Wall · {blockedCount} blocked
        </button>
      </Html>
    </group>
  );
}

function ReviewTable({
  selected,
  barCount,
  onSelect,
}: {
  selected: boolean;
  barCount: number;
  onSelect: () => void;
}) {
  return (
    <group onClick={onSelect}>
      <mesh castShadow receiveShadow position={[-2.2, 0.58, 0.1]}>
        <boxGeometry args={[2.9, 0.22, 1.9]} />
        <meshStandardMaterial color={selected ? "#ddd6fe" : "#d6c5b3"} />
      </mesh>
      {[
        [-3.2, 0.24, -0.42],
        [-1.2, 0.24, -0.42],
        [-3.2, 0.24, 0.62],
        [-1.2, 0.24, 0.62],
      ].map((position, index) => (
        <mesh key={index} castShadow receiveShadow position={position as [number, number, number]}>
          <boxGeometry args={[0.18, 0.5, 0.18]} />
          <meshStandardMaterial color="#6b4f33" />
        </mesh>
      ))}
      {Array.from({ length: barCount }).map((_, index) => (
        <mesh key={index} position={[-3 + index * 0.45, 0.72, 0.2]} rotation={[-0.2, 0, 0]}>
          <boxGeometry args={[0.28, 0.04, 0.34]} />
          <meshStandardMaterial color={selected ? "#7c3aed" : "#ffffff"} />
        </mesh>
      ))}
      <Html position={[-0.25, 1.98, 0.62]} center>
        <button
          type="button"
          onClick={onSelect}
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold shadow-sm ${selected ? "border-violet-500 bg-violet-500 text-white" : "border-violet-200 bg-white/95 text-violet-700"}`}
        >
          Review Table
        </button>
      </Html>
    </group>
  );
}

function BreakRoom({
  selected,
  idleCount,
  onSelect,
}: {
  selected: boolean;
  idleCount: number;
  onSelect: () => void;
}) {
  return (
    <group onClick={onSelect}>
      <mesh receiveShadow position={[6.25, 0.12, 3.3]}>
        <boxGeometry args={[6.15, 0.03, 4.8]} />
        <meshStandardMaterial color={selected ? "#dffaf6" : "#f6efe4"} />
      </mesh>
      <mesh castShadow receiveShadow position={[5.55, 0.48, 3.05]}>
        <boxGeometry args={[1.35, 0.62, 0.88]} />
        <meshStandardMaterial color="#fb7185" />
      </mesh>
      <mesh castShadow receiveShadow position={[7.2, 0.48, 4.15]}>
        <boxGeometry args={[1.25, 0.62, 0.88]} />
        <meshStandardMaterial color="#38bdf8" />
      </mesh>
      <mesh castShadow receiveShadow position={[6.95, 0.98, 2.05]}>
        <boxGeometry args={[1.8, 0.7, 0.3]} />
        <meshStandardMaterial color="#d6b48d" />
      </mesh>
      <mesh castShadow receiveShadow position={[6.15, 1.28, 2.08]}>
        <boxGeometry args={[0.48, 0.22, 0.22]} />
        <meshStandardMaterial color="#f59e0b" />
      </mesh>
      <mesh castShadow receiveShadow position={[7.6, 1.28, 2.08]}>
        <boxGeometry args={[0.48, 0.22, 0.22]} />
        <meshStandardMaterial color="#22c55e" />
      </mesh>
      <Plant position={[8.75, 0.1, 2.25]} />
      <Html position={[6.7, 1.9, 3.95]} center>
        <button
          type="button"
          onClick={onSelect}
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold shadow-sm ${selected ? "border-teal-500 bg-teal-500 text-white" : "border-teal-200 bg-white/95 text-teal-700"}`}
        >
          Break Room · {idleCount} here
        </button>
      </Html>
    </group>
  );
}

function KingsOffice({
  selected,
  pressureCount,
  onSelect,
}: {
  selected: boolean;
  pressureCount: number;
  onSelect: () => void;
}) {
  return (
    <group onClick={onSelect}>
      <mesh receiveShadow position={[6.25, 0.12, -2.7]}>
        <boxGeometry args={[6.15, 0.03, 4.8]} />
        <meshStandardMaterial color={selected ? "#f9edcf" : "#fbf4e8"} />
      </mesh>
      <mesh castShadow receiveShadow position={[6.35, 0.65, -2.7]}>
        <boxGeometry args={[2.2, 0.3, 1.4]} />
        <meshStandardMaterial color="#7c5a3a" />
      </mesh>
      <mesh castShadow receiveShadow position={[6.35, 0.98, -3.05]}>
        <boxGeometry args={[1.35, 0.5, 0.12]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <mesh castShadow receiveShadow position={[6.35, 0.45, -1.72]}>
        <boxGeometry args={[0.8, 0.4, 0.8]} />
        <meshStandardMaterial color="#c084fc" />
      </mesh>
      <mesh castShadow receiveShadow position={[5.05, 0.16, -2.7]}>
        <boxGeometry args={[1.6, 0.05, 2.5]} />
        <meshStandardMaterial color={selected ? "#fde68a" : "#f6d365"} />
      </mesh>
      {Array.from({ length: Math.min(pressureCount, 4) }).map((_, index) => (
        <mesh key={index} position={[7.75, 0.85 + index * 0.22, -1.45]} rotation={[0, 0, 0.08]}>
          <boxGeometry args={[0.55, 0.08, 0.35]} />
          <meshStandardMaterial color={index % 2 === 0 ? "#fca5a5" : "#fdba74"} />
        </mesh>
      ))}
      <Html position={[6.8, 2.38, -1.7]} center>
        <button
          type="button"
          onClick={onSelect}
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold shadow-sm ${selected ? "border-amber-500 bg-amber-500 text-white" : "border-amber-200 bg-white/95 text-amber-700"}`}
        >
          King&apos;s Office
        </button>
      </Html>
    </group>
  );
}

function Courtyard({
  selected,
  outsideCount,
  onSelect,
}: {
  selected: boolean;
  outsideCount: number;
  onSelect: () => void;
}) {
  return (
    <group onClick={onSelect} position={[2.1, 0, 0]}>
      <mesh receiveShadow position={[0.35, 0.065, 7.35]}>
        <boxGeometry args={[12.15, 0.12, 6.85]} />
        <meshStandardMaterial color={selected ? "#d3f3d4" : "#bcc9b3"} />
      </mesh>
      <mesh receiveShadow position={[0.35, 0.11, 7.42]}>
        <boxGeometry args={[10.7, 0.03, 5.55]} />
        <meshStandardMaterial color={selected ? "#e2eef8" : "#d6dee7"} />
      </mesh>
      <mesh receiveShadow position={[0.45, 0.12, 4.98]}>
        <boxGeometry args={[5.4, 0.04, 1.08]} />
        <meshStandardMaterial color={selected ? "#bbf7d0" : "#64748b"} />
      </mesh>
      <mesh receiveShadow position={[0.35, 0.135, 6.12]}>
        <boxGeometry args={[9.8, 0.01, 0.08]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      <mesh receiveShadow position={[0.35, 0.135, 7.42]}>
        <boxGeometry args={[9.8, 0.01, 0.08]} />
        <meshStandardMaterial color="#a3b1c2" />
      </mesh>
      <mesh receiveShadow position={[0.35, 0.135, 8.72]}>
        <boxGeometry args={[9.8, 0.01, 0.08]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      <mesh castShadow receiveShadow position={[-1.9, 0.42, 6.85]}>
        <boxGeometry args={[1.8, 0.18, 0.5]} />
        <meshStandardMaterial color="#8b5e34" />
      </mesh>
      <mesh castShadow receiveShadow position={[-2.55, 0.21, 6.85]}>
        <boxGeometry args={[0.14, 0.4, 0.14]} />
        <meshStandardMaterial color="#6b4f33" />
      </mesh>
      <mesh castShadow receiveShadow position={[-1.25, 0.21, 6.85]}>
        <boxGeometry args={[0.14, 0.4, 0.14]} />
        <meshStandardMaterial color="#6b4f33" />
      </mesh>
      <mesh castShadow receiveShadow position={[2.35, 0.52, 7.45]}>
        <cylinderGeometry args={[1.08, 1.08, 0.14, 28]} />
        <meshStandardMaterial color={selected ? "#f8fafc" : "#f3f4f6"} />
      </mesh>
      <mesh castShadow receiveShadow position={[1.2, 0.34, 7.45]}>
        <boxGeometry args={[0.42, 0.42, 0.42]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      <mesh castShadow receiveShadow position={[3.5, 0.34, 7.45]}>
        <boxGeometry args={[0.42, 0.42, 0.42]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      <mesh castShadow receiveShadow position={[2.35, 0.34, 6.2]}>
        <boxGeometry args={[0.42, 0.42, 0.42]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      <Plant position={[3.7, 0.02, 8.75]} />
      <Plant position={[1.2, 0.02, 6.0]} />
      <mesh castShadow receiveShadow position={[2.35, 1.95, 7.45]}>
        <cylinderGeometry args={[0.08, 0.08, 3.4, 14]} />
        <meshStandardMaterial color="#9ca3af" />
      </mesh>
      <mesh castShadow receiveShadow position={[2.35, 3.6, 7.45]}>
        <coneGeometry args={[1.9, 1.1, 24]} />
        <meshStandardMaterial color="#38bdf8" />
      </mesh>
      <Html position={[3.15, 2.62, 8.55]} center>
        <button
          type="button"
          onClick={onSelect}
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold shadow-sm ${selected ? "border-emerald-500 bg-emerald-500 text-white" : "border-emerald-200 bg-white/95 text-emerald-700"}`}
        >
          Outside Patio · {outsideCount} outside
        </button>
      </Html>
    </group>
  );
}

function Plant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.12, 0.18, 1.4, 12]} />
        <meshStandardMaterial color="#7c5a3a" />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 1.55, 0]}>
        <sphereGeometry args={[0.72, 18, 18]} />
        <meshStandardMaterial color="#4ade80" />
      </mesh>
    </group>
  );
}
