"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { SimsScene } from "./sims-scene";
import type { SimsPanelTarget, SimsRoomState } from "./sims-types";

interface SimsCanvasProps {
  room: SimsRoomState;
  selectedTarget: SimsPanelTarget;
  onSelectTarget: (target: SimsPanelTarget) => void;
  motionEnabled: boolean;
}

export function SimsCanvas({
  room,
  selectedTarget,
  onSelectTarget,
  motionEnabled,
}: SimsCanvasProps) {
  return (
    <div className="relative min-h-[640px] overflow-hidden rounded-[28px] border border-zinc-200 bg-[#efe6d6] shadow-[0_30px_80px_rgba(39,25,12,0.14)] dark:border-white/10 dark:shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-white/35 to-transparent" />
      <Canvas
        shadows
        dpr={[1, 1.6]}
        camera={{ position: [0, 8.2, 10.8], fov: 36 }}
      >
        <Suspense fallback={null}>
          <SimsScene
            room={room}
            selectedTarget={selectedTarget}
            onSelectTarget={onSelectTarget}
            motionEnabled={motionEnabled}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
