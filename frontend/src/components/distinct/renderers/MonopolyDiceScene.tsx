'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  Mesh,
  PerspectiveCamera,
  Quaternion,
  Scene,
  WebGLRenderer,
} from 'three';

interface MonopolyDiceSceneProps {
  readonly roll: readonly [number, number] | null;
  readonly rollSequence: number;
  readonly rolling: boolean;
  readonly compact?: boolean;
  readonly reduceMotion?: boolean;
}

interface DiceController {
  readonly module: typeof import('three');
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly dice: [Mesh, Mesh];
  readonly canvas: HTMLCanvasElement;
  phase: 'idle' | 'tumbling' | 'settling';
  phaseStartedAt: number;
  settleAt: number | null;
  settleFrom: [Quaternion, Quaternion];
  settleTargets: [Quaternion, Quaternion];
  targetRoll: readonly [number, number];
  lastRollSequence: number;
}

const FACE_VALUES = [3, 4, 1, 6, 2, 5] as const;
const FACE_NORMALS: Record<number, readonly [number, number, number]> = {
  1: [0, 1, 0],
  2: [0, 0, 1],
  3: [1, 0, 0],
  4: [-1, 0, 0],
  5: [0, 0, -1],
  6: [0, -1, 0],
};
const PIP_POSITIONS: Record<number, readonly number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function MonopolyDiceScene({
  roll,
  rollSequence,
  rolling,
  compact = false,
  reduceMotion = false,
}: MonopolyDiceSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<DiceController | null>(null);
  const frameRef = useRef<number | null>(null);
  const initialRollRef = useRef<readonly [number, number]>(roll ?? [1, 1]);
  const initialSequenceRef = useRef(rollSequence);
  const [webglReady, setWebglReady] = useState(false);

  useEffect(() => {
    if (globalThis.navigator?.userAgent.includes('jsdom')) return;
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;

    const initialize = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        const THREE = await import('three');
        const { RoundedBoxGeometry } = await import('three/examples/jsm/geometries/RoundedBoxGeometry.js');
        if (disposed) return;

        const renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: true,
        });
        renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
        renderer.setClearColor(0x000000, 0);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(31, 2, 0.1, 50);
        camera.position.set(0, 4.8, 8.2);
        camera.lookAt(0, 0.15, 0);

        scene.add(new THREE.HemisphereLight(0xfff5dd, 0x26302c, 2.8));
        const keyLight = new THREE.DirectionalLight(0xffffff, 5.2);
        keyLight.position.set(-3.5, 7, 5);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(1024, 1024);
        scene.add(keyLight);
        const rimLight = new THREE.DirectionalLight(0xffd3a1, 2.2);
        rimLight.position.set(5, 3, -4);
        scene.add(rimLight);

        const geometry = new RoundedBoxGeometry(1.45, 1.45, 1.45, 6, 0.18);
        const materials = FACE_VALUES.map((value) => new THREE.MeshStandardMaterial({
          map: createFaceTexture(THREE, value),
          color: 0xfffdf4,
          roughness: 0.34,
          metalness: 0.04,
        }));
        const first = new THREE.Mesh(geometry, materials);
        const second = new THREE.Mesh(geometry, materials);
        first.position.set(-1.02, 0.85, 0);
        second.position.set(1.02, 0.85, 0.08);
        first.castShadow = true;
        second.castShadow = true;
        scene.add(first, second);

        const floor = new THREE.Mesh(
          new THREE.PlaneGeometry(6.5, 3.8),
          new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.34 }),
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;
        floor.receiveShadow = true;
        scene.add(floor);

        const initialRoll = initialRollRef.current;
        const controller: DiceController = {
          module: THREE,
          renderer,
          scene,
          camera,
          dice: [first, second],
          canvas,
          phase: 'idle',
          phaseStartedAt: performance.now(),
          settleAt: null,
          settleFrom: [first.quaternion.clone(), second.quaternion.clone()],
          settleTargets: [
            topFaceQuaternion(THREE, initialRoll[0], -0.18),
            topFaceQuaternion(THREE, initialRoll[1], 0.22),
          ],
          targetRoll: initialRoll,
          lastRollSequence: initialSequenceRef.current,
        };
        first.quaternion.copy(controller.settleTargets[0]);
        second.quaternion.copy(controller.settleTargets[1]);
        controllerRef.current = controller;
        canvas.dataset.dicePhase = 'idle';

        const resize = () => {
          const width = Math.max(1, canvas.clientWidth);
          const height = Math.max(1, canvas.clientHeight);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };
        resize();
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(canvas);
        setWebglReady(true);

        const renderFrame = (now: number) => {
          if (disposed) return;
          animateDice(controller, now);
          renderer.render(scene, camera);
          frameRef.current = requestAnimationFrame(renderFrame);
        };
        frameRef.current = requestAnimationFrame(renderFrame);
      } catch {
        setWebglReady(false);
      }
    };

    void initialize();
    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      const controller = controllerRef.current;
      if (controller) {
        const disposedGeometries = new Set<import('three').BufferGeometry>();
        const disposedMaterials = new Set<import('three').Material>();
        const disposedTextures = new Set<{ dispose: () => void }>();
        for (const die of controller.dice) {
          if (!disposedGeometries.has(die.geometry)) {
            disposedGeometries.add(die.geometry);
            die.geometry.dispose();
          }
          const materials = Array.isArray(die.material) ? die.material : [die.material];
          for (const material of materials) {
            if (disposedMaterials.has(material)) continue;
            disposedMaterials.add(material);
            const texture = (material as { map?: { dispose: () => void } | null }).map;
            if (texture && !disposedTextures.has(texture)) {
              disposedTextures.add(texture);
              texture.dispose();
            }
            material.dispose();
          }
        }
        controller.renderer.dispose();
      }
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    const nextRoll = roll ?? controller.targetRoll;
    const now = performance.now();

    if (reduceMotion) {
      settleImmediately(controller, nextRoll, rollSequence);
      return;
    }
    if (rolling) {
      controller.phase = 'tumbling';
      controller.phaseStartedAt = now;
      controller.settleAt = null;
      controller.canvas.dataset.dicePhase = 'tumbling';
      return;
    }
    if (rollSequence !== controller.lastRollSequence || controller.phase === 'tumbling') {
      controller.targetRoll = nextRoll;
      controller.lastRollSequence = rollSequence;
      controller.settleTargets = [
        topFaceQuaternion(controller.module, nextRoll[0], -0.18),
        topFaceQuaternion(controller.module, nextRoll[1], 0.22),
      ];
      if (controller.phase === 'tumbling') {
        controller.settleAt = now + 180;
      } else {
        controller.phase = 'tumbling';
        controller.phaseStartedAt = now;
        controller.settleAt = now + 350;
        controller.canvas.dataset.dicePhase = 'tumbling';
      }
    }
  }, [reduceMotion, roll, rollSequence, rolling, webglReady]);

  const shownRoll = roll ?? [1, 1];
  const label = rolling
    ? 'Dice rolling'
    : roll
      ? `Dice show ${roll[0]} and ${roll[1]}`
      : 'Dice ready to roll';

  return (
    <div
      data-monopoly-dice-scene
      aria-label={label}
      role="img"
      className={`relative ${compact ? 'h-16 w-28' : 'h-20 w-36 sm:h-32 sm:w-56'}`}
    >
      <canvas
        ref={canvasRef}
        data-monopoly-dice-canvas
        className={`absolute inset-0 h-full w-full transition-opacity duration-200 ${webglReady ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        data-monopoly-dice-fallback
        aria-hidden="true"
        className={`absolute inset-0 flex items-center justify-center gap-2 transition-opacity duration-200 ${webglReady ? 'opacity-0' : 'opacity-100'}`}
      >
        <FallbackDie value={shownRoll[0]} rolling={rolling} compact={compact} />
        <FallbackDie value={shownRoll[1]} rolling={rolling} compact={compact} />
      </div>
    </div>
  );
}

function animateDice(controller: DiceController, now: number): void {
  if (controller.phase === 'tumbling') {
    const elapsed = Math.max(0, now - controller.phaseStartedAt);
    controller.dice[0].rotation.set(elapsed * 0.010, elapsed * 0.014, elapsed * 0.008);
    controller.dice[1].rotation.set(-elapsed * 0.012, elapsed * 0.011, -elapsed * 0.009);
    controller.dice[0].position.y = 0.82 + Math.abs(Math.sin(elapsed * 0.011)) * 0.65;
    controller.dice[1].position.y = 0.82 + Math.abs(Math.sin(elapsed * 0.013 + 1.2)) * 0.62;
    if (controller.settleAt !== null && now >= controller.settleAt) {
      controller.phase = 'settling';
      controller.phaseStartedAt = now;
      controller.settleFrom = [
        controller.dice[0].quaternion.clone(),
        controller.dice[1].quaternion.clone(),
      ];
      controller.canvas.dataset.dicePhase = 'settling';
    }
    return;
  }

  if (controller.phase === 'settling') {
    const progress = Math.min(1, (now - controller.phaseStartedAt) / 480);
    const eased = 1 - Math.pow(1 - progress, 3);
    controller.dice[0].quaternion.slerpQuaternions(controller.settleFrom[0], controller.settleTargets[0], eased);
    controller.dice[1].quaternion.slerpQuaternions(controller.settleFrom[1], controller.settleTargets[1], eased);
    const bounce = Math.sin(progress * Math.PI) * 0.38 * (1 - progress);
    controller.dice[0].position.y = 0.75 + bounce;
    controller.dice[1].position.y = 0.75 + bounce * 0.82;
    if (progress >= 1) {
      controller.phase = 'idle';
      controller.canvas.dataset.dicePhase = 'idle';
    }
  }
}

function settleImmediately(
  controller: DiceController,
  roll: readonly [number, number],
  rollSequence: number,
): void {
  controller.targetRoll = roll;
  controller.lastRollSequence = rollSequence;
  controller.settleTargets = [
    topFaceQuaternion(controller.module, roll[0], -0.18),
    topFaceQuaternion(controller.module, roll[1], 0.22),
  ];
  controller.dice[0].quaternion.copy(controller.settleTargets[0]);
  controller.dice[1].quaternion.copy(controller.settleTargets[1]);
  controller.dice[0].position.y = 0.75;
  controller.dice[1].position.y = 0.75;
  controller.phase = 'idle';
  controller.settleAt = null;
  controller.canvas.dataset.dicePhase = 'idle';
}

function topFaceQuaternion(
  THREE: typeof import('three'),
  value: number,
  yaw: number,
): Quaternion {
  const normal = FACE_NORMALS[value] ?? FACE_NORMALS[1];
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(...normal),
    new THREE.Vector3(0, 1, 0),
  );
  quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
  return quaternion;
}

function createFaceTexture(
  THREE: typeof import('three'),
  value: number,
): import('three').CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) return new THREE.CanvasTexture(canvas);
  context.fillStyle = '#fffdf4';
  context.fillRect(0, 0, 256, 256);
  const positions = [58, 128, 198];
  context.fillStyle = '#171411';
  for (const pip of PIP_POSITIONS[value] ?? PIP_POSITIONS[1]) {
    const column = pip % 3;
    const row = Math.floor(pip / 3);
    context.beginPath();
    context.arc(positions[column], positions[row], 17, 0, Math.PI * 2);
    context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function FallbackDie({ value, rolling, compact }: Readonly<{
  value: number;
  rolling: boolean;
  compact: boolean;
}>) {
  const pips = new Set(PIP_POSITIONS[value] ?? []);
  return (
    <span className={`grid grid-cols-3 grid-rows-3 place-items-center rounded-xl border-2 border-[#29251f] bg-[#fffdf4] p-1.5 shadow-[0_5px_0_#5d5448,0_12px_20px_rgba(0,0,0,0.4)] ${compact ? 'h-10 w-10' : 'h-11 w-11 sm:h-14 sm:w-14'} ${rolling ? 'animate-[dice-shake_0.4s_ease-in-out_infinite]' : ''}`}>
      {Array.from({ length: 9 }, (_, index) => (
        <span key={index} className={`h-1.5 w-1.5 rounded-full bg-[#171411] ${pips.has(index) ? 'opacity-100' : 'opacity-0'}`} />
      ))}
    </span>
  );
}