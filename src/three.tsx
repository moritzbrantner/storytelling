"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Mesh } from "three";

import { cn } from "@moritzbrantner/ui";

import { getStoryRendererKey, getStoryStageProps } from "./story-render-registry";
import type { StoryNodeData } from "./story-model";
import type {
  StoryRendererRegistry,
  StoryRenderProps,
  StoryThreeSceneComponent,
  StoryThreeSceneProps,
} from "./story-render-types";

export type StoryCanvasStageProps<TData extends StoryNodeData = StoryNodeData> =
  StoryRenderProps<TData> & {
    registry?: StoryRendererRegistry<TData>;
    className?: string;
    cameraPosition?: [number, number, number];
  };

function DefaultThreeScene<TData extends StoryNodeData = StoryNodeData>({
  currentIndex,
  progress,
}: StoryThreeSceneProps<TData>) {
  const meshRef = useRef<Mesh>(null);
  const hue = (currentIndex * 62) % 360;

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    mesh.rotation.x = state.clock.elapsedTime * 0.35;
    mesh.rotation.y = state.clock.elapsedTime * 0.55;
    mesh.position.y = Math.sin(state.clock.elapsedTime * 1.4) * 0.18;
  });

  return (
    <>
      <color attach="background" args={["#050816"]} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 4, 5]} intensity={1.8} />
      <pointLight position={[-4, -3, 2]} intensity={1.2} color={`hsl(${hue}, 85%, 70%)`} />
      <mesh ref={meshRef} scale={1 + progress * 0.35}>
        <icosahedronGeometry args={[1.75, 1]} />
        <meshStandardMaterial
          color={`hsl(${hue}, 85%, 62%)`}
          emissive={`hsl(${hue}, 90%, 40%)`}
          emissiveIntensity={0.45}
          roughness={0.2}
          metalness={0.6}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.7, 0]}>
        <circleGeometry args={[4.5, 64]} />
        <meshStandardMaterial color="#0f172a" transparent opacity={0.55} />
      </mesh>
    </>
  );
}

export function StoryCanvasStage<TData extends StoryNodeData = StoryNodeData>({
  node,
  registry,
  className,
  cameraPosition = [0, 0, 6],
  ...renderProps
}: StoryCanvasStageProps<TData>) {
  const rendererKey = getStoryRendererKey(node);
  const Scene = (registry?.three?.[rendererKey] ??
    DefaultThreeScene) as StoryThreeSceneComponent<TData>;

  return (
    <div
      className={cn(
        "relative min-h-[24rem] overflow-hidden rounded-lg border bg-black shadow-2xl shadow-black/20",
        className,
      )}
    >
      <Canvas camera={{ position: cameraPosition, fov: 42 }}>
        <Scene node={node} {...renderProps} stageProps={getStoryStageProps(node)} />
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/50 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/65 to-transparent" />
    </div>
  );
}
