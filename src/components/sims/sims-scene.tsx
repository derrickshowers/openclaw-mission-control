"use client";

import { Html } from "@react-three/drei";
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

const zoneSelected = (target: SimsPanelTarget, zoneId: SimsZoneId) => target.kind === "zone" && target.zoneId === zoneId;
const agentSelected = (target: SimsPanelTarget, agentId: string) => target.kind === "agent" && target.agentId === agentId;

export function SimsScene({ room, selectedTarget, onSelectTarget, motionEnabled }: SimsSceneProps) {
  const blockedCount = room.blockedTasks.length;
  const taskWallBars = useMemo(() => Math.max(1, Math.min(blockedCount, 5)), [blockedCount]);
  const reviewBars = useMemo(() => Math.max(1, Math.min(room.activeTasks.length, 5)), [room.activeTasks.length]);

  return (
    <group>
      <color attach="background" args={["#efe6d6"]} />
      <ambientLight intensity={1.3} />
      <directionalLight
        castShadow
        intensity={1.5}
        position={[8, 14, 8]}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <hemisphereLight intensity={0.55} groundColor="#7c5f43" color="#fff8ef" />

      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[14, 12]} />
        <meshStandardMaterial color="#b89267" />
      </mesh>

      <mesh receiveShadow position={[0, 0.03, 0]}>
        <boxGeometry args={[11.5, 0.06, 9.6]} />
        <meshStandardMaterial color="#d9bd98" />
      </mesh>

      <mesh receiveShadow position={[0, 2.4, -5.05]}>
        <boxGeometry args={[11.6, 4.8, 0.25]} />
        <meshStandardMaterial color="#f7efe2" />
      </mesh>
      <mesh receiveShadow position={[-5.8, 2.4, 0]}>
        <boxGeometry args={[0.25, 4.8, 10.1]} />
        <meshStandardMaterial color="#f8f1e7" />
      </mesh>
      <mesh receiveShadow position={[5.8, 2.4, 0]}>
        <boxGeometry args={[0.25, 4.8, 10.1]} />
        <meshStandardMaterial color="#f8f1e7" />
      </mesh>

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
      <BreakArea
        selected={zoneSelected(selectedTarget, "break-area")}
        idleCount={room.idleAgentsCount}
        onSelect={() => onSelectTarget({ kind: "zone", zoneId: "break-area" })}
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
  const laneColor = agent.mood === "blocked" ? "#fee2e2" : agent.mood === "busy" ? "#fef3c7" : "#dcfce7";

  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[agent.deskPosition[0], 0.031, agent.deskPosition[2]]}>
        <planeGeometry args={[2.35, 1.95]} />
        <meshStandardMaterial color={laneColor} />
      </mesh>

      <mesh castShadow receiveShadow position={agent.deskPosition} onClick={onSelect}>
        <boxGeometry args={[1.8, 0.7, 1]} />
        <meshStandardMaterial color="#8b5e34" />
      </mesh>
      <mesh castShadow receiveShadow position={[agent.deskPosition[0], 0.9, agent.deskPosition[2] - 0.15]} onClick={onSelect}>
        <boxGeometry args={[1.35, 0.55, 0.12]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <mesh castShadow receiveShadow position={[agent.deskPosition[0] + 0.65, 0.55, agent.deskPosition[2] + 0.4]} onClick={onSelect}>
        <cylinderGeometry args={[0.12, 0.12, 0.45, 16]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh castShadow receiveShadow position={[agent.deskPosition[0] - 0.6, 0.52, agent.deskPosition[2] + 0.35]} onClick={onSelect}>
        <boxGeometry args={[0.3, 0.25, 0.45]} />
        <meshStandardMaterial color="#d4d4d8" />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[agent.deskPosition[0], 0.04, agent.deskPosition[2]]} onClick={onSelect}>
        <ringGeometry args={[1.02, 1.14, 48]} />
        <meshStandardMaterial color={deskBorderColor} emissive={deskBorderColor} emissiveIntensity={selected ? 0.6 : 0.18} />
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
  const baseY = agent.avatarPosition[1];

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime() + agent.avatarPosition[0];
    if (groupRef.current) {
      groupRef.current.position.y = baseY + (motionEnabled ? Math.sin(elapsed * 1.8) * 0.05 : 0);
      groupRef.current.rotation.y = motionEnabled ? Math.sin(elapsed * 0.5) * 0.14 : 0;
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

  return (
    <group ref={groupRef} position={agent.avatarPosition} onClick={onSelect}>
      <mesh castShadow position={[0, 0.38, 0]}>
        <cylinderGeometry args={[0.22, 0.26, 0.72, 18]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>
      <mesh castShadow position={[0, 0.92, 0]}>
        <sphereGeometry args={[0.2, 20, 20]} />
        <meshStandardMaterial color="#f8dcc2" />
      </mesh>
      <mesh castShadow position={[0, 0.68, 0.18]}>
        <boxGeometry args={[0.24, 0.08, 0.16]} />
        <meshStandardMaterial color="#fef3c7" />
      </mesh>
      <mesh castShadow position={[0.18, 0.26, 0]} rotation={[0, 0, -0.18]}>
        <boxGeometry args={[0.08, 0.34, 0.08]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>
      <mesh castShadow position={[-0.18, 0.26, 0]} rotation={[0, 0, 0.18]}>
        <boxGeometry args={[0.08, 0.34, 0.08]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>
      <mesh castShadow position={[0.08, -0.16, 0]}>
        <boxGeometry args={[0.08, 0.4, 0.08]} />
        <meshStandardMaterial color="#525252" />
      </mesh>
      <mesh castShadow position={[-0.08, -0.16, 0]}>
        <boxGeometry args={[0.08, 0.4, 0.08]} />
        <meshStandardMaterial color="#525252" />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.34, 0]}>
        <ringGeometry args={[0.28, 0.36, 36]} />
        <meshStandardMaterial
          color={agent.hasBlockedTask ? "#ef4444" : selected ? "#111827" : agent.accent}
          emissive={agent.hasBlockedTask ? "#ef4444" : agent.accent}
          emissiveIntensity={selected ? 0.45 : 0.2}
        />
      </mesh>
      <Html position={[0, 1.45, 0]} center>
        <button
          type="button"
          onClick={onSelect}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-sm backdrop-blur ${selected ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200/80 bg-white/90 text-zinc-700"}`}
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
      <mesh castShadow receiveShadow position={[0, 2.2, -4.72]}>
        <boxGeometry args={[3.3, 2.1, 0.12]} />
        <meshStandardMaterial color={selected ? "#fecaca" : "#f7d9d5"} />
      </mesh>
      {Array.from({ length: barCount }).map((_, index) => (
        <mesh key={index} position={[-0.95 + index * 0.48, 2.5 - index * 0.24, -4.62]}>
          <boxGeometry args={[0.34, 0.2, 0.02]} />
          <meshStandardMaterial color={blockedCount > 0 ? "#ef4444" : "#fca5a5"} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 1.1, -4.35]}>
        <ringGeometry args={[0.42, 0.52, 40]} />
        <meshStandardMaterial color={selected ? "#ef4444" : "#fca5a5"} emissive={selected ? "#ef4444" : "#fca5a5"} emissiveIntensity={0.28} />
      </mesh>
      <Html position={[0, 3.55, -4.62]} center>
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
      <mesh castShadow receiveShadow position={[0, 0.58, -0.2]}>
        <boxGeometry args={[2.55, 0.22, 1.65]} />
        <meshStandardMaterial color={selected ? "#ddd6fe" : "#d6c5b3"} />
      </mesh>
      <mesh castShadow receiveShadow position={[-0.9, 0.24, -0.65]}>
        <boxGeometry args={[0.18, 0.5, 0.18]} />
        <meshStandardMaterial color="#6b4f33" />
      </mesh>
      <mesh castShadow receiveShadow position={[0.9, 0.24, -0.65]}>
        <boxGeometry args={[0.18, 0.5, 0.18]} />
        <meshStandardMaterial color="#6b4f33" />
      </mesh>
      <mesh castShadow receiveShadow position={[-0.9, 0.24, 0.25]}>
        <boxGeometry args={[0.18, 0.5, 0.18]} />
        <meshStandardMaterial color="#6b4f33" />
      </mesh>
      <mesh castShadow receiveShadow position={[0.9, 0.24, 0.25]}>
        <boxGeometry args={[0.18, 0.5, 0.18]} />
        <meshStandardMaterial color="#6b4f33" />
      </mesh>
      {Array.from({ length: barCount }).map((_, index) => (
        <mesh key={index} position={[-0.8 + index * 0.4, 0.72, -0.05]} rotation={[-0.2, 0, 0]}>
          <boxGeometry args={[0.25, 0.04, 0.32]} />
          <meshStandardMaterial color={selected ? "#7c3aed" : "#ffffff"} />
        </mesh>
      ))}
      <Html position={[0, 1.45, -0.15]} center>
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

function BreakArea({
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
      <mesh castShadow receiveShadow position={[0, 0.4, 4.25]}>
        <boxGeometry args={[2.4, 0.28, 1.1]} />
        <meshStandardMaterial color={selected ? "#ccfbf1" : "#f6ddc6"} />
      </mesh>
      <mesh castShadow receiveShadow position={[-0.7, 0.78, 4.22]}>
        <boxGeometry args={[0.65, 0.48, 0.65]} />
        <meshStandardMaterial color="#fb7185" />
      </mesh>
      <mesh castShadow receiveShadow position={[0.72, 0.78, 4.22]}>
        <boxGeometry args={[0.65, 0.48, 0.65]} />
        <meshStandardMaterial color="#38bdf8" />
      </mesh>
      <Html position={[0, 1.4, 4.2]} center>
        <button
          type="button"
          onClick={onSelect}
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold shadow-sm ${selected ? "border-teal-500 bg-teal-500 text-white" : "border-teal-200 bg-white/95 text-teal-700"}`}
        >
          Break Area · {idleCount} idle
        </button>
      </Html>
    </group>
  );
}
