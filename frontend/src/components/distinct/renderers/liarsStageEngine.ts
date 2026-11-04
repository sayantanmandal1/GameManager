import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { LiarsBarSfx } from './liarsBarAssets';
import { STAGE_TABLE_TOP, stageSeatAngles, stageSeatRadius, stageTableRadius, type StageBase, type StageCardRank, type StageSeat, type StageSnapshot } from './liarsStageModel';

const MODEL_BYTES: Record<string, number> = { bristle: 929_000, toar: 1_005_000, scubby: 1_319_000, foxy: 1_306_000, gerk: 1_584_000, cupcake: 1_261_000 };
const LOOPING = new Set(['idle', 'look', 'nocard', 'lobby', 'win', 'face']);
const CARD_W = 0.12;
const CARD_H = 0.165;
const CARD_ART = '/liars-bar/cards';
/** Fallback moments (s) inside the original clips: hammer cock in `roulet`, trigger in `dead`/`empty`. */
const GUN_TIMES = { cock: 3.2, shot: 0.33, click: 0.33 };
const gltfCache = new Map<string, Promise<GLTF>>();

function loadCharacter(id: string, onBytes: (bytes: number) => void): Promise<GLTF> {
  let pending = gltfCache.get(id);
  if (!pending) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    pending = loader.loadAsync(`/liars-bar/models/${id}.glb`, (event) => onBytes(event.loaded));
    pending.catch(() => gltfCache.delete(id));
    gltfCache.set(id, pending);
  }
  return pending;
}

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Actor {
  seat: StageSeat;
  holder: THREE.Group;
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  actions: Map<string, THREE.AnimationAction>;
  current: THREE.AnimationAction | null;
  currentName: string;
  busy: boolean;
  hold: boolean;
  holdUntil: number;
  posture: 'down' | 'up';
  base: StageBase;
  cards: THREE.Object3D[];
  head: THREE.Object3D | null;
  muzzle: THREE.Object3D | null;
  gunTimes: typeof GUN_TIMES;
  chair: THREE.Group;
  throwSoundAt: number;
  throwLandAt: number;
  angle: number;
}

interface Tween {
  start: number;
  duration: number;
  update: (t: number) => void;
  done?: () => void;
}

export interface StageTagPosition { x: number; y: number; visible: boolean }

export interface LiarsStageOptions {
  onSound: (name: LiarsBarSfx, volume?: number) => void;
  onTags: (positions: Map<string, StageTagPosition>) => void;
  onLost: () => void;
}

export class LiarsStageEngine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.05, 40);
  private readonly clock = new THREE.Timer();
  private readonly owned = new Set<{ dispose: () => void }>();
  private readonly actors = new Map<string, Actor>();
  private readonly tweens: Tween[] = [];
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private readonly tagPositions = new Map<string, StageTagPosition>();
  private readonly table = new THREE.Group();
  private readonly pileGroup = new THREE.Group();
  private readonly revealGroup = new THREE.Group();
  private readonly lamp = new THREE.Group();
  private readonly flash: THREE.PointLight;
  private readonly flashSprite: THREE.Sprite;
  private readonly dust: THREE.Points;
  private readonly cardBack: THREE.MeshStandardMaterial;
  private readonly cardEdge: THREE.MeshStandardMaterial;
  private readonly cardAtlas: THREE.MeshStandardMaterial;
  private readonly faceMaterials = new Map<StageCardRank, THREE.MeshStandardMaterial>();
  private readonly cardGeometry = new THREE.BoxGeometry(CARD_W, 0.0025, CARD_H);
  private readonly resize: ResizeObserver;
  private readonly reducedMotion: boolean;
  private frame = 0;
  private seatKey = '';
  private players = 0;
  private pileTarget = 0;
  private pileShown = 0;
  private pendingLand: Array<{ at: number; count: number }> = [];
  private revealKey: string | null = null;
  private lobby = false;
  private focusId: string | null = null;
  private pointer = new THREE.Vector2();
  private yaw = 0;
  private pitch = 0;
  private shake = 0;
  private youAngle = 0;
  private spectator = false;
  private disposed = false;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly options: LiarsStageOptions) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    canvas.addEventListener('webglcontextlost', this.handleLost);

    this.scene.background = new THREE.Color(0x0a0705);
    this.scene.fog = new THREE.FogExp2(0x0a0705, 0.085);
    this.cardBack = this.own(new THREE.MeshStandardMaterial({ map: this.own(cardArtTexture(`${CARD_ART}/back.webp`)), roughness: 0.62 }));
    this.cardEdge = this.own(new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 0.8 }));
    // Original hand-card meshes sample a packed atlas (faces on the top row, backs below) in glTF UV space.
    this.cardAtlas = this.own(new THREE.MeshStandardMaterial({ map: this.own(cardArtTexture(`${CARD_ART}/atlas.webp`, false)), roughness: 0.6 }));
    this.own(this.cardGeometry);
    this.buildRoom();
    this.flash = new THREE.PointLight(0xffb066, 0, 4, 1.6);
    this.scene.add(this.flash);
    this.flashSprite = new THREE.Sprite(this.own(new THREE.SpriteMaterial({ map: this.own(glowTexture()), color: 0xffc27a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 })));
    this.flashSprite.scale.setScalar(0.4);
    this.scene.add(this.flashSprite);
    this.dust = this.buildDust();
    this.scene.add(this.table, this.pileGroup, this.revealGroup);

    const parent = canvas.parentElement ?? canvas;
    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(parent);
    this.fit();
    canvas.addEventListener('pointermove', this.handlePointer);
    canvas.addEventListener('pointerleave', this.handleLeave);
    this.frame = requestAnimationFrame(this.tick);
  }

  /** Loads (once) and seats the characters; resolves when every model is on stage. */
  async setSeats(seats: StageSeat[], onProgress: (fraction: number) => void) {
    const key = seats.map((seat) => `${seat.id}:${seat.character}:${seat.you ? 1 : 0}`).join('|');
    if (key === this.seatKey) return;
    this.seatKey = key;
    const ids = [...new Set(seats.map((seat) => seat.character))];
    const total = ids.reduce((sum, id) => sum + (MODEL_BYTES[id] ?? 1_000_000), 0);
    const loaded = new Map<string, number>();
    const report = () => onProgress(Math.min(1, [...loaded.values()].reduce((sum, value) => sum + value, 0) / total));
    const models = await Promise.all(ids.map(async (id) => {
      const gltf = await loadCharacter(id, (bytes) => { loaded.set(id, bytes); report(); });
      loaded.set(id, MODEL_BYTES[id] ?? 1_000_000);
      report();
      return [id, gltf] as const;
    }));
    if (this.disposed || key !== this.seatKey) return;
    const byId = new Map(models);
    for (const actor of this.actors.values()) this.removeActor(actor);
    this.actors.clear();
    this.players = seats.length;
    const youIndex = seats.findIndex((seat) => seat.you);
    this.spectator = youIndex < 0;
    const angles = stageSeatAngles(seats.length, youIndex);
    this.youAngle = 0;
    this.buildTable(seats.length);
    seats.forEach((seat, index) => {
      const gltf = byId.get(seat.character);
      if (gltf) this.actors.set(seat.id, this.createActor(seat, gltf, angles[index]));
    });
    this.layout();
  }

  apply(snapshot: StageSnapshot) {
    for (const actor of this.actors.values()) {
      const base = snapshot.base[actor.seat.id] ?? 'idle';
      const count = snapshot.hands[actor.seat.id] ?? 0;
      actor.cards.forEach((card, index) => { card.visible = index < count; });
      if (base !== actor.base) {
        actor.base = base;
        if (base === 'dead' && actor.hold) this.startClip(actor, 'dead', { fade: 0.08 });
        else if (!actor.busy) this.settle(actor);
      }
    }
    const lobby = Object.values(snapshot.base).some((base) => base === 'lobby');
    if (lobby !== this.lobby) {
      this.lobby = lobby;
      this.layout();
    }
    if (snapshot.pile < this.pileTarget) this.pendingLand = [];
    this.pileTarget = snapshot.pile;
    this.focusId = snapshot.focusId;
    if (snapshot.revealKey !== this.revealKey) {
      this.revealKey = snapshot.revealKey;
      this.showReveal(snapshot.reveal);
    }
    this.syncPile();
  }

  /** First snapshot after seating: jump straight to each base pose without transitions. */
  applyInstant(snapshot: StageSnapshot) {
    for (const actor of this.actors.values()) {
      actor.base = snapshot.base[actor.seat.id] ?? 'idle';
      actor.busy = false;
      actor.hold = false;
      actor.posture = actor.base === 'look' ? 'up' : 'down';
      const clip = actor.base;
      this.startClip(actor, clip, { fade: 0, atEnd: clip === 'dead' });
    }
    this.revealKey = null;
    this.pileShown = snapshot.pile;
    this.apply(snapshot);
  }

  throwCards(id: string, count: number) {
    const actor = this.actors.get(id);
    const now = this.clock.getElapsed();
    if (!actor || actor.seat.you) {
      this.pendingLand.push({ at: now + 0.55, count });
      this.flyFromCamera(count);
      this.later(80, () => this.options.onSound('card-throw-soft', 0.6));
      return;
    }
    this.playOnce(actor, 'throw');
    this.pendingLand.push({ at: now + actor.throwLandAt, count });
    this.later(actor.throwSoundAt * 1000, () => this.options.onSound('card-throw', 0.6));
  }

  callLiar(id: string) {
    const actor = this.actors.get(id);
    if (!actor || actor.seat.you) {
      this.later(250, () => this.options.onSound('fist-table', 0.8));
      this.kick(0.012);
      return;
    }
    const clip = actor.actions.get('liar')?.getClip();
    this.playOnce(actor, 'liar', { speed: 0.75 });
    const hit = clip ? Math.min(clip.duration * 0.4, 0.6) / 0.75 : 0.55;
    this.later(hit * 1000, () => { this.options.onSound('fist-table', 0.8); this.kick(0.008); });
  }

  reload(ids: string[], seconds: number) {
    for (const id of ids) {
      const actor = this.actors.get(id);
      const clip = actor?.actions.get('reload')?.getClip();
      if (!actor || actor.seat.you || !clip || actor.base === 'dead') continue;
      this.playOnce(actor, 'reload', { speed: Math.max(1, clip.duration / seconds) });
    }
  }

  /** Raises the revolver to the temple; the hammer cocks where the original clip draws it back. */
  aim(id: string) {
    const actor = this.actors.get(id);
    const other = actor && !actor.seat.you ? actor : null;
    this.later((other?.gunTimes.cock ?? GUN_TIMES.cock) * 1000, () => this.options.onSound('revolver-cock', 0.55));
    if (other) this.playOnce(other, 'roulet', { hold: true });
  }

  fire(id: string) {
    const actor = this.actors.get(id);
    const other = actor && !actor.seat.you ? actor : null;
    if (other) {
      other.base = 'dead';
      if (other.currentName !== 'dead') this.startClip(other, 'dead', { fade: 0.06 });
      other.busy = false;
      other.hold = false;
    }
    const shotMs = other ? other.gunTimes.shot * 1000 : 40;
    this.later(shotMs, () => {
      this.options.onSound('gunshot', 0.72);
      const at = new THREE.Vector3();
      if (other) (other.muzzle ?? other.head ?? other.holder).getWorldPosition(at);
      else {
        this.camera.getWorldPosition(at);
        at.y -= 0.1;
      }
      this.flash.position.copy(at);
      this.flashSprite.position.copy(at);
      this.tween(0.32, (t) => {
        const k = (1 - t) ** 2;
        this.flash.intensity = 55 * k;
        (this.flashSprite.material as THREE.SpriteMaterial).opacity = k;
        this.flashSprite.scale.setScalar(0.25 + 0.35 * t);
      });
      this.kick(0.03);
    });
    if (other) this.later(Math.max(820, shotMs + 480), () => this.options.onSound('head-fall', 0.75));
  }

  click(id: string) {
    const actor = this.actors.get(id);
    const other = actor && !actor.seat.you ? actor : null;
    this.later(other ? other.gunTimes.click * 1000 : 40, () => this.options.onSound('dry-fire', 0.8));
    if (!other) return;
    other.hold = false;
    this.playOnce(other, 'empty');
  }

  setPointer(x: number, y: number) {
    this.pointer.set(x, y);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resize.disconnect();
    for (const timer of this.timers) clearTimeout(timer);
    this.clock.dispose();
    this.canvas.removeEventListener('webglcontextlost', this.handleLost);
    this.canvas.removeEventListener('pointermove', this.handlePointer);
    this.canvas.removeEventListener('pointerleave', this.handleLeave);
    for (const actor of this.actors.values()) this.removeActor(actor);
    for (const item of this.owned) item.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  private readonly handleLost = (event: Event) => {
    event.preventDefault();
    this.options.onLost();
  };

  private readonly handlePointer = (event: PointerEvent) => {
    const bounds = this.canvas.getBoundingClientRect();
    this.pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1);
  };

  private readonly handleLeave = () => this.pointer.set(0, 0);

  private own<T extends { dispose: () => void }>(item: T): T {
    this.owned.add(item);
    return item;
  }

  private later(ms: number, run: () => void) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (!this.disposed) run();
    }, ms);
    this.timers.add(timer);
  }

  private tween(duration: number, update: (t: number) => void, done?: () => void) {
    this.tweens.push({ start: this.clock.getElapsed(), duration, update, done });
  }

  private kick(amount: number) {
    if (!this.reducedMotion) this.shake = Math.max(this.shake, amount);
  }

  private fit() {
    const parent = this.canvas.parentElement ?? this.canvas;
    const width = Math.max(1, parent.clientWidth);
    const height = Math.max(1, parent.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    const aspect = width / height;
    this.camera.fov = aspect < 1.45 ? 66 : aspect < 1.7 ? 60 : 56;
    this.camera.updateProjectionMatrix();
  }

  private buildRoom() {
    const random = seeded(7);
    const floorTexture = this.own(woodTexture(random, '#3a2618', 6));
    floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(5, 5);
    const floor = new THREE.Mesh(this.own(new THREE.CircleGeometry(9, 48)), this.own(new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 0.86 })));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const wallTexture = this.own(woodTexture(random, '#2a1a10', 10));
    wallTexture.wrapS = wallTexture.wrapT = THREE.RepeatWrapping;
    wallTexture.repeat.set(12, 1.4);
    const wall = new THREE.Mesh(this.own(new THREE.CylinderGeometry(6.5, 6.5, 5, 40, 1, true)), this.own(new THREE.MeshStandardMaterial({ map: wallTexture, roughness: 0.9, side: THREE.BackSide })));
    wall.position.y = 2.5;
    this.scene.add(wall);

    const hemi = new THREE.HemisphereLight(0x9a7654, 0x170d07, 0.75);
    this.scene.add(hemi);
    const fill = new THREE.DirectionalLight(0xffd7a8, 0.3);
    fill.position.set(0, 2.2, 3.5);
    this.scene.add(fill);

    const shadeMaterial = this.own(new THREE.MeshStandardMaterial({ color: 0x23301f, metalness: 0.55, roughness: 0.42, side: THREE.DoubleSide }));
    const shade = new THREE.Mesh(this.own(new THREE.ConeGeometry(0.34, 0.24, 32, 1, true)), shadeMaterial);
    shade.position.y = 0.12;
    const bulb = new THREE.Mesh(this.own(new THREE.SphereGeometry(0.055, 16, 12)), this.own(new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: 0xffc77a, emissiveIntensity: 3.2 })));
    bulb.position.y = 0.02;
    const cord = new THREE.Mesh(this.own(new THREE.CylinderGeometry(0.008, 0.008, 2.6, 6)), this.own(new THREE.MeshStandardMaterial({ color: 0x111111 })));
    cord.position.y = 1.5;
    // Wide cone so seated faces (~1.3 m out) catch the lamp, not just the felt.
    const spot = new THREE.SpotLight(0xffc98a, 13, 7, 1.12, 0.75, 1.2);
    const faceFill = new THREE.PointLight(0xffc98a, 2.4, 4.5, 1.5);
    faceFill.position.set(0, -0.35, 0);
    this.lamp.add(faceFill);
    spot.position.set(0, 0, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0004;
    spot.shadow.normalBias = 0.02;
    spot.shadow.camera.near = 0.3;
    spot.shadow.camera.far = 5;
    const target = new THREE.Object3D();
    target.position.set(0, -2, 0);
    spot.target = target;
    this.lamp.add(shade, bulb, cord, spot, target);
    this.lamp.position.set(0, 2.15, 0);
    this.scene.add(this.lamp);

    const glass = [0x3d5a2a, 0x5a2e14, 0x2b4a4a, 0x6b4a18, 0x3a1f2a];
    const bottleGeometry = this.own(new THREE.LatheGeometry([
      new THREE.Vector2(0, 0), new THREE.Vector2(0.045, 0), new THREE.Vector2(0.05, 0.02), new THREE.Vector2(0.05, 0.2),
      new THREE.Vector2(0.03, 0.25), new THREE.Vector2(0.014, 0.3), new THREE.Vector2(0.014, 0.36), new THREE.Vector2(0, 0.36),
    ], 14));
    const shelfMaterial = this.own(new THREE.MeshStandardMaterial({ color: 0x2b1a0f, roughness: 0.85 }));
    const shelfGeometry = this.own(new THREE.BoxGeometry(3.4, 0.05, 0.32));
    const bottleMaterials = glass.map((color) => this.own(new THREE.MeshStandardMaterial({ color, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.82, emissive: color, emissiveIntensity: 0.18 })));
    for (const side of [0, 1]) {
      const bar = new THREE.Group();
      for (let row = 0; row < 3; row += 1) {
        const shelf = new THREE.Mesh(shelfGeometry, shelfMaterial);
        shelf.position.set(0, 1.1 + row * 0.62, 0);
        bar.add(shelf);
        for (let index = 0; index < 11; index += 1) {
          if (random() < 0.22) continue;
          const bottle = new THREE.Mesh(bottleGeometry, bottleMaterials[Math.floor(random() * bottleMaterials.length)]);
          bottle.position.set(-1.55 + index * 0.31 + (random() - 0.5) * 0.08, 1.125 + row * 0.62, (random() - 0.5) * 0.1);
          bottle.scale.setScalar(0.8 + random() * 0.45);
          bar.add(bottle);
        }
      }
      const angle = side === 0 ? Math.PI : Math.PI * 0.5;
      bar.position.set(Math.sin(angle) * 6.1, 0, Math.cos(angle) * 6.1);
      bar.lookAt(0, 0, 0);
      this.scene.add(bar);
      const glow = new THREE.PointLight(0xff9a4a, 3.2, 4.5, 1.4);
      glow.position.set(Math.sin(angle) * 5.4, 2.4, Math.cos(angle) * 5.4);
      this.scene.add(glow);
    }
  }

  private buildDust() {
    const random = seeded(11);
    const count = 160;
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const radius = Math.sqrt(random()) * 1.15;
      const angle = random() * Math.PI * 2;
      positions.set([Math.cos(angle) * radius, 0.9 + random() * 1.25, Math.sin(angle) * radius], index * 3);
    }
    const geometry = this.own(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(geometry, this.own(new THREE.PointsMaterial({ map: this.own(glowTexture()), color: 0xffd9a0, size: 0.018, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })));
    this.scene.add(points);
    return points;
  }

  private buildTable(players: number) {
    for (const child of [...this.table.children]) this.table.remove(child);
    const radius = stageTableRadius(players);
    const random = seeded(3 + players);
    const topTexture = this.own(woodTexture(random, '#5a3a22', 9));
    const top = new THREE.Mesh(this.own(new THREE.CylinderGeometry(radius, radius, 0.06, 64)), this.own(new THREE.MeshStandardMaterial({ map: topTexture, roughness: 0.55 })));
    top.position.y = STAGE_TABLE_TOP - 0.03;
    top.receiveShadow = true;
    const inlay = new THREE.Mesh(this.own(new THREE.CircleGeometry(radius * 0.7, 64)), this.own(new THREE.MeshStandardMaterial({ map: this.own(feltTexture(random)), roughness: 0.92 })));
    inlay.rotation.x = -Math.PI / 2;
    inlay.position.y = STAGE_TABLE_TOP + 0.001;
    inlay.receiveShadow = true;
    const rim = new THREE.Mesh(this.own(new THREE.TorusGeometry(radius, 0.035, 12, 72)), this.own(new THREE.MeshStandardMaterial({ color: 0x2c1a0e, roughness: 0.4 })));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = STAGE_TABLE_TOP - 0.02;
    const legMaterial = this.own(new THREE.MeshStandardMaterial({ color: 0x24160c, roughness: 0.6 }));
    const leg = new THREE.Mesh(this.own(new THREE.CylinderGeometry(0.09, 0.14, STAGE_TABLE_TOP - 0.06, 20)), legMaterial);
    leg.position.y = (STAGE_TABLE_TOP - 0.06) / 2;
    const foot = new THREE.Mesh(this.own(new THREE.CylinderGeometry(0.42, 0.48, 0.05, 32)), legMaterial);
    foot.position.y = 0.025;
    for (const mesh of [top, rim, leg]) mesh.castShadow = true;
    this.table.add(top, inlay, rim, leg, foot);
  }

  private createActor(seat: StageSeat, gltf: GLTF, angle: number): Actor {
    const model = cloneSkinned(gltf.scene);
    const holder = new THREE.Group();
    holder.add(model);
    const actions = new Map<string, THREE.AnimationAction>();
    const mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) actions.set(clip.name, mixer.clipAction(clip));
    let head: THREE.Object3D | null = null;
    let muzzle: THREE.Object3D | null = null;
    let cardGroup: THREE.Object3D | null = null;
    let handGun: THREE.Object3D | null = null;
    model.traverse((node) => {
      if (/(HumanHead|RHINO_Head)$/.test(node.name)) head = node;
      if (/^Kartlar/.test(node.name) && node.parent && /^KartsParent/.test(node.parent.name)) cardGroup = node;
      if (node.userData?.gvProp === 'ElRevolver') handGun = node;
      const mesh = node as THREE.SkinnedMesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.frustumCulled = false;
        if ((mesh.material as THREE.Material).name === 'gv_cards') mesh.material = this.cardAtlas;
      }
    });
    const gunParts: string[] = [];
    if (handGun) {
      muzzle = gunMuzzle(handGun);
      (handGun as THREE.Object3D).traverse((node) => { if (/^(Hammer|Trigger)/.test(node.name)) gunParts.push(node.name); });
    }
    const clipOf = (name: string) => actions.get(name)?.getClip();
    const gunTimes = {
      cock: Math.min(motionStart(clipOf('roulet'), gunParts, 1.5) ?? GUN_TIMES.cock, 3.9),
      shot: motionStart(clipOf('dead'), gunParts) ?? GUN_TIMES.shot,
      click: motionStart(clipOf('empty'), gunParts) ?? GUN_TIMES.click,
    };
    const cards = cardGroup ? [...(cardGroup as THREE.Object3D).children]
      .filter((child) => /^kart\d/.test(child.name))
      .sort((a, b) => a.name.localeCompare(b.name)) : [];
    const chair = this.buildChair();
    holder.add(chair);
    this.scene.add(holder);
    if (seat.you) {
      model.visible = false;
      chair.visible = false;
    }
    const throwClip = actions.get('throw')?.getClip();
    const timing = throwClip ? propToggleTimes(throwClip, 'kartucan') : null;
    const actor: Actor = {
      seat, holder, model, mixer, actions, current: null, currentName: '', busy: false, hold: false, holdUntil: 0,
      posture: 'down', base: 'idle', cards, head, muzzle, gunTimes, chair, angle,
      throwSoundAt: timing?.on ?? 0.9, throwLandAt: timing?.off ?? 1.4,
    };
    mixer.addEventListener('finished', (event) => this.handleFinished(actor, event.action as THREE.AnimationAction));
    const face = actions.get('face');
    if (face) face.setLoop(THREE.LoopRepeat, Infinity).play();
    return actor;
  }

  private removeActor(actor: Actor) {
    actor.mixer.stopAllAction();
    actor.mixer.uncacheRoot(actor.model);
    this.scene.remove(actor.holder);
    actor.holder.traverse((node) => {
      if (!node.userData.gvOwned) return;
      const mesh = node as THREE.Mesh;
      mesh.geometry?.dispose();
    });
  }

  private layout() {
    const seatRadius = stageSeatRadius(this.players);
    for (const actor of this.actors.values()) {
      const radius = this.lobby ? seatRadius + 0.55 : seatRadius;
      actor.holder.position.set(Math.sin(actor.angle) * radius, 0, Math.cos(actor.angle) * radius);
      actor.holder.lookAt(0, 0, 0);
      actor.chair.position.set(0, 0, this.lobby ? 0.55 : 0);
    }
    if (this.spectator) {
      this.camera.position.set(0, 2.55, seatRadius + 1.7);
    } else {
      // Bigger tables sit the camera a little further back so both neighbours stay in frame.
      const back = seatRadius + (this.players > 4 ? 0.6 : 0.22);
      this.camera.position.set(Math.sin(this.youAngle) * back, this.players > 4 ? 1.58 : 1.45, Math.cos(this.youAngle) * back);
    }
  }

  private buildChair() {
    const chair = new THREE.Group();
    const wood = this.own(new THREE.MeshStandardMaterial({ color: 0x3b2414, roughness: 0.7 }));
    const seat = new THREE.Mesh(this.own(new THREE.BoxGeometry(0.5, 0.05, 0.46)), wood);
    seat.position.set(0, 0.47, -0.16);
    const legGeometry = this.own(new THREE.CylinderGeometry(0.022, 0.02, 0.46, 8));
    for (const [x, z] of [[-0.21, 0.04], [0.21, 0.04], [-0.21, -0.36], [0.21, -0.36]]) {
      const leg = new THREE.Mesh(legGeometry, wood);
      leg.position.set(x, 0.23, z);
      chair.add(leg);
    }
    const postGeometry = this.own(new THREE.BoxGeometry(0.04, 0.62, 0.04));
    for (const x of [-0.22, 0.22]) {
      const post = new THREE.Mesh(postGeometry, wood);
      post.position.set(x, 0.79, -0.4);
      chair.add(post);
    }
    const rail = new THREE.Mesh(this.own(new THREE.BoxGeometry(0.48, 0.09, 0.03)), wood);
    rail.position.set(0, 1.05, -0.4);
    const rail2 = rail.clone();
    rail2.position.y = 0.8;
    chair.add(seat, rail, rail2);
    chair.traverse((node) => { (node as THREE.Mesh).castShadow = true; });
    return chair;
  }

  private faceMaterial(rank: StageCardRank) {
    let material = this.faceMaterials.get(rank);
    if (!material) {
      const map = rank === 'devil' ? cardFaceTexture(rank) : cardArtTexture(`${CARD_ART}/${rank}.webp`);
      material = this.own(new THREE.MeshStandardMaterial({ map: this.own(map), roughness: 0.55 }));
      this.faceMaterials.set(rank, material);
    }
    return material;
  }

  private tableCard(face: StageCardRank | null) {
    const top = face ? this.faceMaterial(face) : this.cardBack;
    const bottom = face ? this.cardBack : this.cardBack;
    const mesh = new THREE.Mesh(this.cardGeometry, [this.cardEdge, this.cardEdge, top, bottom, this.cardEdge, this.cardEdge]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private syncPile() {
    const now = this.clock.getElapsed();
    this.pendingLand = this.pendingLand.filter((entry) => entry.at > now);
    const inFlight = this.pendingLand.reduce((sum, entry) => sum + entry.count, 0);
    const revealCount = this.revealGroup.children.length;
    const shown = Math.max(0, Math.min(this.pileTarget - inFlight, this.pileTarget) - revealCount);
    if (shown === this.pileShown && this.pileGroup.children.length === shown) return;
    this.pileShown = shown;
    while (this.pileGroup.children.length > shown) this.pileGroup.remove(this.pileGroup.children[this.pileGroup.children.length - 1]);
    while (this.pileGroup.children.length < shown) {
      const index = this.pileGroup.children.length;
      const random = seeded(97 + index * 13);
      const card = this.tableCard(null);
      const radius = Math.sqrt(random()) * 0.11;
      const angle = random() * Math.PI * 2;
      card.position.set(Math.cos(angle) * radius, STAGE_TABLE_TOP + 0.003 + index * 0.0026, Math.sin(angle) * radius);
      card.rotation.y = random() * Math.PI * 2;
      this.pileGroup.add(card);
    }
  }

  private showReveal(ranks: StageCardRank[] | null) {
    for (const child of [...this.revealGroup.children]) this.revealGroup.remove(child);
    if (!ranks || ranks.length === 0) return;
    const spacing = CARD_W + 0.03;
    const towardYou = this.spectator ? 0 : this.youAngle;
    this.revealGroup.rotation.y = towardYou;
    ranks.forEach((rank, index) => {
      const card = this.tableCard(rank);
      const x = (index - (ranks.length - 1) / 2) * spacing;
      card.position.set(x, STAGE_TABLE_TOP + 0.004, 0.18);
      card.rotation.z = Math.PI;
      this.revealGroup.add(card);
      this.later(260 + index * 210, () => {
        this.options.onSound('card-flip', 0.7);
        this.tween(0.42, (t) => {
          const eased = 1 - (1 - t) ** 3;
          card.rotation.z = Math.PI * (1 - eased);
          card.position.y = STAGE_TABLE_TOP + 0.004 + Math.sin(Math.PI * t) * 0.09;
        });
      });
    });
  }

  private flyFromCamera(count: number) {
    const start = new THREE.Vector3(0, -0.25, -0.35).applyQuaternion(this.camera.quaternion).add(this.camera.position);
    for (let index = 0; index < count; index += 1) {
      const card = this.tableCard(null);
      const random = seeded(Date.now() + index);
      const end = new THREE.Vector3((random() - 0.5) * 0.16, STAGE_TABLE_TOP + 0.04, (random() - 0.5) * 0.16);
      card.position.copy(start);
      this.scene.add(card);
      const spin = (random() - 0.5) * 3;
      this.later(index * 70, () => this.tween(0.5, (t) => {
        const eased = 1 - (1 - t) ** 2;
        card.position.lerpVectors(start, end, eased);
        card.position.y += Math.sin(Math.PI * t) * 0.12;
        card.rotation.y = spin * t;
      }, () => this.scene.remove(card)));
    }
  }

  private startClip(actor: Actor, name: string, options: { fade?: number; speed?: number; atEnd?: boolean } = {}) {
    const action = actor.actions.get(name) ?? actor.actions.get('idle');
    if (!action) return;
    const loop = LOOPING.has(name);
    const previous = actor.current;
    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop;
    action.timeScale = options.speed ?? 1;
    action.setEffectiveWeight(1);
    if (options.atEnd) action.time = action.getClip().duration;
    action.play();
    const fade = options.fade ?? 0.25;
    if (previous && previous !== action && fade > 0) action.crossFadeFrom(previous, fade, false);
    else if (previous && previous !== action) previous.stop();
    actor.current = action;
    actor.currentName = name;
  }

  private playOnce(actor: Actor, name: string, options: { speed?: number; hold?: boolean } = {}) {
    if (!actor.actions.has(name)) return;
    actor.busy = true;
    actor.hold = !!options.hold;
    actor.holdUntil = this.clock.getElapsed() + 9;
    actor.posture = name === 'throw' ? 'up' : 'down';
    this.startClip(actor, name, { speed: options.speed, fade: 0.2 });
  }

  private handleFinished(actor: Actor, action: THREE.AnimationAction) {
    if (action !== actor.current || actor.currentName === 'dead') return;
    if (actor.hold) return;
    actor.busy = false;
    this.settle(actor);
  }

  private settle(actor: Actor) {
    const target = actor.base;
    if (target === 'dead') {
      if (actor.currentName !== 'dead') this.startClip(actor, 'dead', { fade: 0.15 });
      return;
    }
    if (target === 'look') {
      if (actor.posture === 'up') {
        if (actor.currentName !== 'look') this.startClip(actor, 'look');
      } else {
        actor.posture = 'up';
        actor.busy = true;
        this.startClip(actor, 'gecis', { fade: 0.2 });
      }
      return;
    }
    if (actor.posture === 'up') {
      actor.posture = 'down';
      actor.busy = true;
      this.startClip(actor, 'kapama', { fade: 0.2 });
      return;
    }
    if (actor.currentName !== target) this.startClip(actor, target, { fade: 0.35 });
  }

  private readonly tick = () => {
    this.frame = requestAnimationFrame(this.tick);
    const delta = Math.min(this.clock.update().getDelta(), 0.25);
    const now = this.clock.getElapsed();
    for (const actor of this.actors.values()) {
      if (actor.hold && now > actor.holdUntil) {
        actor.hold = false;
        actor.busy = false;
        this.settle(actor);
      }
      actor.mixer.update(delta);
    }
    for (let index = this.tweens.length - 1; index >= 0; index -= 1) {
      const tween = this.tweens[index];
      const t = Math.min(1, (now - tween.start) / tween.duration);
      tween.update(t);
      if (t >= 1) {
        this.tweens.splice(index, 1);
        tween.done?.();
      }
    }
    if (this.pendingLand.length) this.syncPile();
    if (!this.reducedMotion) {
      this.lamp.rotation.z = Math.sin(now * 0.55) * 0.022;
      this.lamp.rotation.x = Math.sin(now * 0.37 + 1) * 0.014;
      this.dust.rotation.y = now * 0.02;
      this.dust.position.y = Math.sin(now * 0.2) * 0.03;
    }
    this.updateCamera(delta);
    this.renderer.render(this.scene, this.camera);
    this.emitTags();
  };

  private updateCamera(delta: number) {
    const lookAt = new THREE.Vector3(0, 0.98, 0);
    let focusYaw = 0;
    let strength = 0;
    const focus = this.focusId ? this.actors.get(this.focusId) : null;
    if (focus && !focus.seat.you && !this.spectator) {
      const target = focus.holder.position;
      const toTarget = new THREE.Vector3(target.x - this.camera.position.x, 0, target.z - this.camera.position.z);
      const forward = new THREE.Vector3(-this.camera.position.x, 0, -this.camera.position.z);
      focusYaw = Math.atan2(forward.x * toTarget.z - forward.z * toTarget.x, forward.x * toTarget.x + forward.z * toTarget.z);
      strength = 0.55;
    }
    const targetYaw = -focusYaw * strength - this.pointer.x * 0.24;
    const targetPitch = -this.pointer.y * 0.06;
    const smoothing = 1 - Math.exp(-delta * (this.reducedMotion ? 12 : 3.2));
    this.yaw += (targetYaw - this.yaw) * smoothing;
    this.pitch += (targetPitch - this.pitch) * smoothing;
    const base = new THREE.Vector3().subVectors(lookAt, this.camera.position);
    base.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    base.y += this.pitch * base.length();
    const shakeX = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const shakeY = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    this.shake = Math.max(0, this.shake - delta * 0.12);
    this.camera.lookAt(this.camera.position.x + base.x + shakeX, this.camera.position.y + base.y + shakeY, this.camera.position.z + base.z);
  }

  private emitTags() {
    const point = new THREE.Vector3();
    for (const actor of this.actors.values()) {
      if (actor.seat.you) {
        this.tagPositions.set(actor.seat.id, { x: 0, y: 0, visible: false });
        continue;
      }
      if (actor.head) actor.head.getWorldPosition(point);
      else actor.holder.getWorldPosition(point).setY(1.4);
      point.y += 0.36;
      point.project(this.camera);
      this.tagPositions.set(actor.seat.id, { x: (point.x + 1) / 2, y: (1 - point.y) / 2, visible: point.z < 1 });
    }
    this.options.onTags(this.tagPositions);
  }
}

function propToggleTimes(clip: THREE.AnimationClip, nodeName: string) {
  const track = clip.tracks.find((entry) => entry.name === `${nodeName}.scale`);
  if (!track) return null;
  let on: number | null = null;
  let off: number | null = null;
  for (let index = 0; index < track.times.length; index += 1) {
    const visible = track.values[index * 3] > 1e-6;
    if (visible && on === null) on = track.times[index];
    if (!visible && on !== null) off = track.times[index];
  }
  return on === null ? null : { on, off: off ?? on + 0.4 };
}

function canvasTexture(width: number, height: number, draw: (context: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context) draw(context);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function woodTexture(random: () => number, base: string, planks: number) {
  return canvasTexture(512, 512, (context) => {
    context.fillStyle = base;
    context.fillRect(0, 0, 512, 512);
    const width = 512 / planks;
    for (let plank = 0; plank < planks; plank += 1) {
      const shade = (random() - 0.5) * 0.22;
      context.fillStyle = shade > 0 ? `rgba(255,214,170,${shade * 0.5})` : `rgba(0,0,0,${-shade})`;
      context.fillRect(plank * width, 0, width, 512);
      for (let streak = 0; streak < 26; streak += 1) {
        context.strokeStyle = `rgba(0,0,0,${0.05 + random() * 0.14})`;
        context.lineWidth = 0.6 + random() * 1.6;
        context.beginPath();
        const x = plank * width + random() * width;
        const wobble = random() * 3;
        context.moveTo(x, 0);
        for (let y = 0; y <= 512; y += 24) context.lineTo(x + Math.sin(y * 0.018 + streak) * wobble, y);
        context.stroke();
      }
      context.fillStyle = 'rgba(0,0,0,0.55)';
      context.fillRect(plank * width, 0, 2, 512);
    }
  });
}

function feltTexture(random: () => number) {
  return canvasTexture(512, 512, (context) => {
    const gradient = context.createRadialGradient(256, 256, 30, 256, 256, 256);
    gradient.addColorStop(0, '#4a211b');
    gradient.addColorStop(1, '#25100c');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 512, 512);
    for (let index = 0; index < 5000; index += 1) {
      context.fillStyle = `rgba(${random() < 0.5 ? '0,0,0' : '255,220,190'},${random() * 0.06})`;
      context.fillRect(random() * 512, random() * 512, 2, 2);
    }
    context.strokeStyle = 'rgba(214,170,96,0.35)';
    context.lineWidth = 5;
    context.beginPath();
    context.arc(256, 256, 236, 0, Math.PI * 2);
    context.stroke();
  });
}

function glowTexture() {
  return canvasTexture(64, 64, (context) => {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.35, 'rgba(255,220,160,0.6)');
    gradient.addColorStop(1, 'rgba(255,200,120,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
  });
}

function cardArtTexture(url: string, flipY = true) {
  const texture = new THREE.TextureLoader().load(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.flipY = flipY;
  return texture;
}

/** Marker at the barrel end of the original revolver mesh, from the bounds baked into its glTF extras. */
function gunMuzzle(gun: THREE.Object3D) {
  const data = gun.userData as { gvMin?: number[]; gvMax?: number[]; gvL?: number[]; gvH?: number[] };
  const marker = new THREE.Object3D();
  if (data.gvMin && data.gvMax) {
    const [lAxis, lSign] = data.gvL ?? [0, 1];
    const [hAxis, hSign] = data.gvH ?? [1, 1];
    const point = [0, 1, 2].map((axis) => (data.gvMin![axis] + data.gvMax![axis]) / 2);
    point[lAxis] = lSign > 0 ? data.gvMax[lAxis] : data.gvMin[lAxis];
    point[hAxis] += hSign * 0.25 * (data.gvMax[hAxis] - data.gvMin[hAxis]);
    marker.position.fromArray(point);
  }
  gun.add(marker);
  return marker;
}

/** Start (s) of the first rotation/translation of any named part after `after`, or null if they never move. */
function motionStart(clip: THREE.AnimationClip | undefined, parts: string[], after = 0) {
  if (!clip || parts.length === 0) return null;
  let start: number | null = null;
  for (const track of clip.tracks) {
    const dot = track.name.lastIndexOf('.');
    if (!parts.includes(track.name.slice(0, dot)) || track.name.endsWith('.scale')) continue;
    const size = track.getValueSize();
    let reference = -1;
    for (let index = 0; index < track.times.length; index += 1) {
      if (track.times[index] < after) continue;
      if (reference < 0) {
        reference = index;
        continue;
      }
      let delta = 0;
      for (let k = 0; k < size; k += 1) delta = Math.max(delta, Math.abs(track.values[index * size + k] - track.values[reference * size + k]));
      if (delta > 1e-3) {
        const at = track.times[index - 1];
        start = start === null ? at : Math.min(start, at);
        break;
      }
    }
  }
  return start;
}

function cardFaceTexture(rank: StageCardRank) {
  const label = rank === 'joker' ? 'J' : rank === 'devil' ? '☠' : rank;
  const color = rank === 'devil' ? '#a8232c' : rank === 'joker' ? '#41306a' : '#241c16';
  return canvasTexture(256, 384, (context) => {
    context.fillStyle = '#f4e8cc';
    context.fillRect(0, 0, 256, 384);
    context.strokeStyle = color;
    context.lineWidth = 4;
    context.strokeRect(14, 14, 228, 356);
    context.fillStyle = color;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = 'bold 42px Georgia, serif';
    context.fillText(label, 40, 48);
    context.save();
    context.translate(216, 336);
    context.rotate(Math.PI);
    context.fillText(label, 0, 0);
    context.restore();
    if (rank === 'devil') {
      context.lineWidth = 9;
      context.lineJoin = 'round';
      context.save();
      context.translate(52, 112);
      context.scale(2.4, 2.4);
      context.stroke(new Path2D('M15 8L24 19H40L49 8L46 32L38 51H26L18 32ZM24 30L29 33M40 30L35 33M27 42H37'));
      context.restore();
    } else if (rank === 'joker') {
      context.font = 'bold 120px Georgia, serif';
      context.fillText('★', 128, 170);
      context.font = 'bold 34px Georgia, serif';
      context.fillText('JOKER', 128, 270);
    } else {
      context.font = 'bold 150px Georgia, serif';
      context.fillText(rank, 128, 200);
      context.font = 'bold 26px Georgia, serif';
      context.fillText(rank === 'A' ? 'ACE' : rank === 'K' ? 'KING' : 'QUEEN', 128, 300);
    }
  });
}
