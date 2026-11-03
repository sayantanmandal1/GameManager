'use client';

import { useEffect, useRef, useState } from 'react';
import type { Group, MeshStandardMaterial, Scene, WebGLRenderer } from 'three';

interface Seat {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
}

interface Props {
  readonly kind: 'deck' | 'dice';
  readonly players: readonly Seat[];
  readonly youId: string;
  readonly currentTurnId: string | null;
  readonly round: number;
  readonly tableCount?: number;
  readonly privateDice?: readonly number[];
}

interface TableController {
  update: (props: Props) => void;
  dispose: () => void;
}

const PIPS: Readonly<Record<number, readonly number[]>> = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

export function LiarTableScene(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<TableController | null>(null);
  const latestRef = useRef(props);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  useEffect(() => {
    latestRef.current = props;
    controllerRef.current?.update(props);
  }, [props]);

  useEffect(() => {
    if (navigator.userAgent.includes('jsdom')) return;
    let disposed = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onContextLost = (event: Event) => {
      event.preventDefault();
      console.error('Liar table WebGL context lost');
      controllerRef.current?.dispose();
      controllerRef.current = null;
      setStatus('unavailable');
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    void import('three').then((THREE) => {
      if (disposed) return;
      const controller = createTable(THREE, canvas, latestRef.current);
      controllerRef.current = controller;
      setStatus('ready');
    }).catch((error: unknown) => {
      if (disposed) return;
      console.error('Unable to initialize the Liar table 3D view', error);
      setStatus('unavailable');
    });
    return () => {
      disposed = true;
      canvas.removeEventListener('webglcontextlost', onContextLost);
      controllerRef.current?.dispose();
      controllerRef.current = null;
    };
  }, []);

  return (
    <div className="relative h-56 overflow-hidden rounded-3xl border border-[#d1af68]/25 bg-[#16140f] sm:h-80 lg:h-96 [@media(min-width:1024px)_and_(max-height:850px)]:h-44" data-liar-table-scene>
      <canvas ref={canvasRef} aria-hidden="true" className={`h-full w-full ${status === 'ready' ? '' : 'invisible'}`} />
      {status !== 'ready' && (
        <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(ellipse_at_center,#204c3a_0%,#142a22_45%,#18120d_75%)] px-6 text-center">
          <div className="rounded-[50%] border-8 border-[#61432a] px-12 py-8 shadow-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#e2c47d]">The bluffing table</p>
            <p role="status" className="mt-2 text-xs text-white/65">{status === 'unavailable' ? '3D is unavailable on this device. All game controls remain available below.' : 'Preparing the 3D table...'}</p>
          </div>
        </div>
      )}
      <span className="pointer-events-none absolute bottom-3 left-4 rounded-full bg-black/55 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#e5cc91]">Original GameVerse tavern</span>
    </div>
  );
}

export function LiarDie({ value, label }: Readonly<{ value: number; label: string }>) {
  return <span aria-label={label} role="img" className="grid h-12 w-12 grid-cols-3 grid-rows-3 place-items-center rounded-xl border border-[#c6bda8] bg-[#fff4d8] p-2 shadow-[0_3px_0_#998f7d,0_6px_12px_#0005]">
    {Array.from({ length: 9 }, (_, index) => <span key={index} aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${PIPS[value].includes(index) ? 'bg-[#25211c]' : ''}`} />)}
  </span>;
}

function createTable(THREE: typeof import('three'), canvas: HTMLCanvasElement, initial: Props): TableController {
  const renderer: WebGLRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene: Scene = new THREE.Scene();
  scene.background = new THREE.Color('#16130f');
  scene.fog = new THREE.Fog('#16130f', 9, 24);
  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 40);
  camera.position.set(0, 6.8, 8.5);
  camera.lookAt(0, 0.9, -0.5);
  scene.add(new THREE.HemisphereLight('#ffe3b0', '#27342a', 2));
  const light = new THREE.PointLight('#ffd18c', 85, 15, 2);
  light.position.set(0, 5.5, 0);
  light.castShadow = true;
  light.shadow.mapSize.set(512, 512);
  scene.add(light);
  const material = (color: string, roughness = 0.75) => new THREE.MeshStandardMaterial({ color, roughness });
  const wood = material('#51331f');
  const gold = material('#b08b48', 0.3);
  const felt = material('#174635');
  const dark = material('#241b15');
  const cream = material('#faf0d7');
  const mesh = (geometry: import('three').BufferGeometry, surface: MeshStandardMaterial, parent: Group | Scene = scene) => {
    const result = new THREE.Mesh(geometry, surface);
    result.castShadow = true;
    result.receiveShadow = true;
    parent.add(result);
    return result;
  };
  mesh(new THREE.PlaneGeometry(30, 30), material('#211a13')).rotation.x = -Math.PI / 2;
  const table = mesh(new THREE.CylinderGeometry(3.55, 3.65, 0.3, 64), wood);
  table.position.y = 1.05;
  const top = mesh(new THREE.CylinderGeometry(3.32, 3.32, 0.05, 64), felt);
  top.position.y = 1.23;
  const edge = mesh(new THREE.TorusGeometry(3.34, 0.025, 8, 64), gold);
  edge.rotation.x = Math.PI / 2;
  edge.position.y = 1.27;
  mesh(new THREE.CylinderGeometry(0.35, 0.7, 1, 12), dark).position.y = 0.5;

  // Procedural set dressing and figures are original; no game assets are bundled.
  const wall = mesh(new THREE.BoxGeometry(15, 6, 0.3), material('#34271c'));
  wall.position.set(0, 3, -6);
  for (let shelfIndex = 0; shelfIndex < 2; shelfIndex += 1) {
    const shelf = mesh(new THREE.BoxGeometry(11, 0.12, 0.65), wood);
    shelf.position.set(0, 2.2 + shelfIndex * 1.5, -5.6);
    for (let index = 0; index < 12; index += 1) {
      const bottle = new THREE.Group();
      const glass = material(index % 2 ? '#305a3d' : '#775328', 0.2);
      mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.55, 8), glass, bottle).position.y = 0.28;
      mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.22, 8), gold, bottle).position.y = 0.65;
      mesh(new THREE.CylinderGeometry(0.132, 0.16, 0.18, 8), cream, bottle).position.y = 0.27;
      bottle.position.set(-5 + index * 0.9, 2.28 + shelfIndex * 1.5, -5.6);
      scene.add(bottle);
    }
  }
  const lamp = mesh(new THREE.ConeGeometry(0.8, 0.4, 24, 1, true), gold);
  lamp.position.set(0, 5.2, 0);
  const seats = new Map<string, { figure: Group; marker: MeshStandardMaterial }>();
  const playerIndex = Math.max(0, initial.players.findIndex((player) => player.id === initial.youId));
  initial.players.forEach((player, index) => {
    const angle = ((index - playerIndex) / initial.players.length) * Math.PI * 2;
    const figure = new THREE.Group();
    const coat = material(['#5f3530', '#2e4657', '#5a4c32', '#3f3556', '#305347', '#5a3745'][index % 6]);
    mesh(new THREE.CylinderGeometry(0.3, 0.45, 0.8, 8), coat, figure).position.y = 1;
    mesh(new THREE.SphereGeometry(0.27, 12, 10), material('#bd9470'), figure).position.y = 1.68;
    const hat = mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.12, 12), dark, figure);
    hat.position.y = 1.91;
    mesh(new THREE.BoxGeometry(0.65, 0.12, 0.65), wood, figure).position.y = 0.45;
    figure.position.set(Math.sin(angle) * 4.1, 0, Math.cos(angle) * 4.1);
    figure.lookAt(0, 0, 0);
    if (index === playerIndex) figure.visible = false;
    scene.add(figure);
    const marker = material('#b18f51');
    const cup = mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.6, 20), marker);
    cup.position.set(Math.sin(angle) * 2.55, 1.57, Math.cos(angle) * 2.55);
    seats.set(player.id, { figure, marker });
  });
  const pieces = new THREE.Group();
  scene.add(pieces);
  const disposedGeometries = new Set<import('three').BufferGeometry>();
  const disposedMaterials = new Set<import('three').Material>();
  const disposeObject = (object: import('three').Object3D) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (!disposedGeometries.has(object.geometry)) {
      object.geometry.dispose();
      disposedGeometries.add(object.geometry);
    }
    for (const surface of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!disposedMaterials.has(surface)) {
        surface.dispose();
        disposedMaterials.add(surface);
      }
    }
  };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  let animationStart = 0;
  let previousRound = -1;
  let disposed = false;
  const render = () => renderer.render(scene, camera);
  const animate = (time: number) => {
    if (disposed) return;
    const progress = reducedMotion.matches ? 1 : Math.min(1, (time - animationStart) / 650);
    pieces.position.y = Math.sin(progress * Math.PI) * 0.35;
    pieces.rotation.y = (1 - progress) * 0.2;
    render();
    if (progress < 1 && !document.hidden) frame = requestAnimationFrame(animate);
  };
  const update = (props: Props) => {
    for (const player of props.players) {
      const seat = seats.get(player.id);
      if (!seat) continue;
      seat.figure.scale.setScalar(player.active ? 1 : 0.65);
      seat.marker.emissive.set(player.id === props.currentTurnId ? '#805b20' : '#000000');
    }
    disposedGeometries.clear();
    disposedMaterials.clear();
    for (const child of [...pieces.children]) {
      child.traverse(disposeObject);
      pieces.remove(child);
    }
    disposedGeometries.clear();
    disposedMaterials.clear();
    if (props.kind === 'deck') {
      for (let index = 0; index < Math.min(props.tableCount ?? 0, 20); index += 1) {
        const card = mesh(new THREE.BoxGeometry(0.5, 0.018, 0.75), material('#912f38'), pieces);
        card.position.set((index % 3 - 1) * 0.08, 1.29 + index * 0.02, 0);
        card.rotation.y = index * 0.13;
      }
    } else if (props.privateDice?.length) {
      const ink = material('#171411');
      const ivory = material('#fff4d8');
      const pipGeometry = new THREE.SphereGeometry(0.022, 8, 6);
      (props.privateDice ?? []).forEach((value, index, dice) => {
        const die = new THREE.Group();
        mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), ivory, die);
        const sideFaces: Readonly<Record<number, readonly [number, number]>> = {
          1: [3, 2], 2: [3, 6], 3: [5, 6], 4: [2, 6], 5: [4, 6], 6: [3, 5],
        };
        const [right, front] = sideFaces[value];
        const faces = [
          { value, normal: new THREE.Vector3(0, 1, 0) },
          { value: 7 - value, normal: new THREE.Vector3(0, -1, 0) },
          { value: right, normal: new THREE.Vector3(1, 0, 0) },
          { value: 7 - right, normal: new THREE.Vector3(-1, 0, 0) },
          { value: front, normal: new THREE.Vector3(0, 0, 1) },
          { value: 7 - front, normal: new THREE.Vector3(0, 0, -1) },
        ];
        for (const face of faces) {
          const orientation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), face.normal);
          for (const pip of PIPS[face.value]) {
            const dot = mesh(pipGeometry, ink, die);
            dot.position.set(((pip % 3) - 1) * 0.082, 0.151, (Math.floor(pip / 3) - 1) * 0.082).applyQuaternion(orientation);
            dot.scale.y = 0.2;
            dot.quaternion.copy(orientation);
          }
        }
        die.position.set((index - (dice.length - 1) / 2) * 0.42, 1.43, 1.4);
        pieces.add(die);
      });
    }
    cancelAnimationFrame(frame);
    if (previousRound !== props.round) {
      previousRound = props.round;
      animationStart = performance.now();
      frame = requestAnimationFrame(animate);
    } else {
      pieces.position.y = 0;
      pieces.rotation.y = 0;
      render();
    }
  };
  const resize = () => {
    renderer.setSize(Math.max(1, canvas.clientWidth), Math.max(1, canvas.clientHeight), false);
    camera.aspect = Math.max(1, canvas.clientWidth) / Math.max(1, canvas.clientHeight);
    camera.updateProjectionMatrix();
    render();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  const onVisibilityChange = () => {
    cancelAnimationFrame(frame);
    if (!document.hidden) {
      pieces.position.y = 0;
      pieces.rotation.y = 0;
      render();
    }
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
  resize();
  update(initial);
  return {
    update,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      scene.traverse(disposeObject);
      renderer.dispose();
    },
  };
}
