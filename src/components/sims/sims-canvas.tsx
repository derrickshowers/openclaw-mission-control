"use client";

import { Suspense, useEffect, useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { MOUSE, TOUCH } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { SimsScene } from "./sims-scene";
import type { SimsPanelTarget, SimsRoomState } from "./sims-types";

interface SimsCanvasProps {
  room: SimsRoomState;
  selectedTarget: SimsPanelTarget;
  onSelectTarget: (target: SimsPanelTarget) => void;
  motionEnabled: boolean;
  cameraResetToken: number;
}

export function SimsCanvas({
  room,
  selectedTarget,
  onSelectTarget,
  motionEnabled,
  cameraResetToken,
}: SimsCanvasProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  useEffect(() => {
    if (!controlsRef.current) return;
    controlsRef.current.reset();
    controlsRef.current.update();
  }, [cameraResetToken]);

  return (
    <div className="relative min-h-[760px] overflow-hidden rounded-[28px] border border-zinc-200 bg-[#d7ebfb] shadow-[0_30px_80px_rgba(39,25,12,0.14)] dark:border-white/10 dark:shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-white/40 to-transparent dark:from-white/10" />
      <div className="pointer-events-none absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/85 px-3 py-1.5 text-[11px] font-medium text-zinc-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-black/35 dark:text-zinc-200">
        Environment beta · {room.roomCount} rooms visible
      </div>
      <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-full border border-white/70 bg-white/85 px-3 py-1.5 text-[11px] font-medium text-zinc-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-black/35 dark:text-zinc-200">
        Drag to move · Scroll or pinch to zoom
      </div>
      <Canvas
        shadows
        dpr={[1, 1.8]}
        camera={{ position: [17.8, 28.4, 28.9], fov: 44 }}
      >
        <Suspense fallback={null}>
          <OrbitControls
            ref={controlsRef}
            makeDefault
            enableRotate={false}
            enablePan
            enableZoom
            screenSpacePanning
            minDistance={16}
            maxDistance={46}
            target={[2.7, 0.9, 5.8]}
            mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }}
            touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_PAN }}
          />
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
