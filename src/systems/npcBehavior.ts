import Phaser from 'phaser';
import { NpcDefinition } from '../data/areas/types';
import {
  TILE_SIZE,
  NPC_SIZE,
  NPC_SPEED,
  NPC_IDLE_MIN_MS,
  NPC_IDLE_MAX_MS,
  TileType,
} from '../maps/constants';
import { Direction, vectorToDirection } from './direction';
import { collidesWithWall } from './collision';

type NpcState = 'idle' | 'walk' | 'aware' | 'dialogue';

const ARRIVAL_EPSILON = 0.5;
const PATH_SAMPLES = 4;

// Direction → tile offset. Names match src/systems/direction.ts DIRECTIONS.
const DIRECTION_OFFSETS: Record<Direction, { dc: number; dr: number }> = {
  'north': { dc: 0, dr: -1 },
  'north-east': { dc: 1, dr: -1 },
  'east': { dc: 1, dr: 0 },
  'south-east': { dc: 1, dr: 1 },
  'south': { dc: 0, dr: 1 },
  'south-west': { dc: -1, dr: 1 },
  'west': { dc: -1, dr: 0 },
  'north-west': { dc: -1, dr: -1 },
};

interface NpcRuntime {
  def: NpcDefinition;
  sprite: Phaser.GameObjects.Sprite;
  spawnTile: { col: number; row: number };
  // Centre-of-bounding-box coordinates in world space (NOT top-left).
  position: { x: number; y: number };
  state: NpcState;
  facingDirection: Direction;
  targetPosition: { x: number; y: number } | null;
  dwellTimer: number;
  // Guard for the loop-invariant rule (Learning EP-01): only issue setTexture when
  // the quantised facing direction actually changes. Null forces an update on next tick.
  lastStaticDir: Direction | null;
  currentAnimKey: string;
}

export class NpcBehaviorSystem {
  private runtimes: Map<string, NpcRuntime> = new Map();
  private scene: Phaser.Scene;
  private map: TileType[][];
  private shutdownBound: (() => void) | null = null;

  constructor(
    scene: Phaser.Scene,
    npcs: NpcDefinition[],
    map: TileType[][],
    spritesById: Map<string, Phaser.GameObjects.Sprite>,
  ) {
    this.scene = scene;
    this.map = map;

    const offset = (TILE_SIZE - NPC_SIZE) / 2;
    for (const def of npcs) {
      const sprite = spritesById.get(def.id);
      if (!sprite) continue;
      const cx = def.col * TILE_SIZE + offset + NPC_SIZE / 2;
      const cy = def.row * TILE_SIZE + offset + NPC_SIZE / 2;
      this.runtimes.set(def.id, {
        def,
        sprite,
        spawnTile: { col: def.col, row: def.row },
        position: { x: cx, y: cy },
        state: 'idle',
        facingDirection: 'south',
        targetPosition: null,
        dwellTimer: this.randomDwell(),
        lastStaticDir: null,
        currentAnimKey: `npc-${def.sprite}-idle-south`,
      });
    }

    this.shutdownBound = () => this.shutdown();
    this.scene.events.on('shutdown', this.shutdownBound);
    this.scene.events.on('destroy', this.shutdownBound);
  }

  update(delta: number, playerCenter: { x: number; y: number }): void {
    for (const runtime of this.runtimes.values()) {
      this.stepRuntime(runtime, delta, playerCenter);
    }
  }

  /** Live (centre) world-space position of every NPC, keyed by NPC id. */
  getLivePositions(): Map<string, { x: number; y: number }> {
    const out = new Map<string, { x: number; y: number }>();
    for (const [id, runtime] of this.runtimes) {
      out.set(id, { x: runtime.position.x, y: runtime.position.y });
    }
    return out;
  }

  /**
   * Snap the NPC into dialogue state and turn to face the player.
   * Idempotent — calling twice while already in dialogue is a no-op.
   */
  enterDialogue(npcId: string, playerCenter: { x: number; y: number }): void {
    const runtime = this.runtimes.get(npcId);
    if (!runtime) return;
    if (runtime.state === 'dialogue') return;
    runtime.state = 'dialogue';
    runtime.targetPosition = null;
    const dx = playerCenter.x - runtime.position.x;
    const dy = playerCenter.y - runtime.position.y;
    const dir = vectorToDirection(dx, dy);
    runtime.facingDirection = dir;
    runtime.sprite.stop();
    runtime.sprite.setTexture(`npc-${runtime.def.sprite}-static-${dir}`);
    runtime.lastStaticDir = dir;
    runtime.currentAnimKey = '';
  }

  /**
   * Leave dialogue state. If the player is still within awareness range, transition
   * to aware (facing the player); otherwise back to idle on a fresh dwell timer.
   * Idempotent — no-op when the NPC is not in dialogue.
   */
  exitDialogue(npcId: string): void {
    const runtime = this.runtimes.get(npcId);
    if (!runtime) return;
    if (runtime.state !== 'dialogue') return;
    runtime.state = 'idle';
    runtime.dwellTimer = this.randomDwell();
    // Force re-evaluation of aware state and animation/texture on next update tick.
    runtime.lastStaticDir = null;
    runtime.currentAnimKey = '';
  }

  private shutdown(): void {
    // Clear per-NPC state. Phaser tears down the sprites themselves on scene restart.
    this.runtimes.clear();
    if (this.shutdownBound) {
      this.scene.events.off('shutdown', this.shutdownBound);
      this.scene.events.off('destroy', this.shutdownBound);
      this.shutdownBound = null;
    }
  }

  private stepRuntime(runtime: NpcRuntime, delta: number, playerCenter: { x: number; y: number }): void {
    if (runtime.state === 'dialogue') return;

    const npcTile = this.centerToTile(runtime.position);
    const playerTile = this.centerToTile(playerCenter);
    const tileDist = this.chebyshev(npcTile, playerTile);
    const inAwareness = tileDist <= runtime.def.awarenessRadius;

    // Awareness gate — takes precedence over idle/walk progression.
    if (runtime.state === 'idle' || runtime.state === 'walk') {
      if (inAwareness) {
        runtime.state = 'aware';
        runtime.targetPosition = null;
        runtime.lastStaticDir = null;
        runtime.currentAnimKey = '';
      }
    }

    if (runtime.state === 'aware') {
      if (!inAwareness) {
        runtime.state = 'idle';
        runtime.dwellTimer = this.randomDwell();
        runtime.lastStaticDir = null;
        this.playAnim(runtime, `npc-${runtime.def.sprite}-idle-${runtime.facingDirection}`);
      } else {
        const dx = playerCenter.x - runtime.position.x;
        const dy = playerCenter.y - runtime.position.y;
        const dir = vectorToDirection(dx, dy);
        runtime.facingDirection = dir;
        if (runtime.lastStaticDir !== dir) {
          runtime.lastStaticDir = dir;
          runtime.sprite.stop();
          runtime.sprite.setTexture(`npc-${runtime.def.sprite}-static-${dir}`);
        }
        return;
      }
    }

    if (runtime.state === 'idle') {
      runtime.dwellTimer -= delta;
      if (runtime.dwellTimer > 0) {
        this.playAnim(runtime, `npc-${runtime.def.sprite}-idle-${runtime.facingDirection}`);
        return;
      }
      if (runtime.def.wanderRadius <= 0) {
        runtime.dwellTimer = this.randomDwell();
        return;
      }
      const step = this.pickWanderStep(runtime);
      if (!step) {
        runtime.dwellTimer = this.randomDwell();
        return;
      }
      runtime.targetPosition = step.target;
      runtime.facingDirection = step.direction;
      runtime.state = 'walk';
      this.playAnim(runtime, `npc-${runtime.def.sprite}-walk-${step.direction}`);
      return;
    }

    if (runtime.state === 'walk') {
      const target = runtime.targetPosition;
      if (!target) {
        runtime.state = 'idle';
        runtime.dwellTimer = this.randomDwell();
        return;
      }
      const dx = target.x - runtime.position.x;
      const dy = target.y - runtime.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const moveDist = NPC_SPEED * (delta / 1000);
      if (dist <= moveDist + ARRIVAL_EPSILON) {
        runtime.position.x = target.x;
        runtime.position.y = target.y;
        runtime.targetPosition = null;
        runtime.state = 'idle';
        runtime.dwellTimer = this.randomDwell();
        this.playAnim(runtime, `npc-${runtime.def.sprite}-idle-${runtime.facingDirection}`);
      } else {
        const nx = dx / dist;
        const ny = dy / dist;
        runtime.position.x += nx * moveDist;
        runtime.position.y += ny * moveDist;
      }
      runtime.sprite.setPosition(runtime.position.x, runtime.position.y);
    }
  }

  private playAnim(runtime: NpcRuntime, key: string): void {
    if (runtime.currentAnimKey === key) return;
    runtime.currentAnimKey = key;
    runtime.sprite.play(key);
  }

  private pickWanderStep(runtime: NpcRuntime): { target: { x: number; y: number }; direction: Direction } | null {
    const currentTile = this.centerToTile(runtime.position);
    const directions: Direction[] = [
      'north', 'north-east', 'east', 'south-east',
      'south', 'south-west', 'west', 'north-west',
    ];
    this.shuffleInPlace(directions);

    for (let i = 0; i < directions.length; i++) {
      let dir: Direction = directions[i];
      let { dc, dr } = DIRECTION_OFFSETS[dir];
      let candidateTile = { col: currentTile.col + dc, row: currentTile.row + dr };

      // Wander-radius enforcement: if candidate is outside radius, pivot toward spawn.
      if (this.chebyshev(candidateTile, runtime.spawnTile) > runtime.def.wanderRadius) {
        const towardSpawn = this.directionToward(currentTile, runtime.spawnTile);
        if (!towardSpawn) continue;
        dir = towardSpawn;
        ({ dc, dr } = DIRECTION_OFFSETS[dir]);
        candidateTile = { col: currentTile.col + dc, row: currentTile.row + dr };
        if (this.chebyshev(candidateTile, runtime.spawnTile) > runtime.def.wanderRadius) {
          continue;
        }
      }

      const targetCenter = this.tileCenter(candidateTile);
      if (!this.isPathClear(runtime.position, targetCenter)) continue;
      return { target: targetCenter, direction: dir };
    }
    return null;
  }

  /** Direction from `from` tile toward `to` tile, clamped to one of the 8 octants. */
  private directionToward(from: { col: number; row: number }, to: { col: number; row: number }): Direction | null {
    const dc = to.col - from.col;
    const dr = to.row - from.row;
    if (dc === 0 && dr === 0) return null;
    return vectorToDirection(dc, dr);
  }

  /** Sample several points along the path from/to in world space and reject if any hit a wall. */
  private isPathClear(from: { x: number; y: number }, to: { x: number; y: number }): boolean {
    for (let i = 1; i <= PATH_SAMPLES; i++) {
      const t = i / PATH_SAMPLES;
      const px = from.x + (to.x - from.x) * t;
      const py = from.y + (to.y - from.y) * t;
      // Bounding-box top-left for collidesWithWall.
      const bx = px - NPC_SIZE / 2;
      const by = py - NPC_SIZE / 2;
      if (collidesWithWall(bx, by, NPC_SIZE, NPC_SIZE, this.map)) return false;
    }
    return true;
  }

  private centerToTile(p: { x: number; y: number }): { col: number; row: number } {
    return { col: Math.floor(p.x / TILE_SIZE), row: Math.floor(p.y / TILE_SIZE) };
  }

  private tileCenter(tile: { col: number; row: number }): { x: number; y: number } {
    const offset = (TILE_SIZE - NPC_SIZE) / 2;
    return {
      x: tile.col * TILE_SIZE + offset + NPC_SIZE / 2,
      y: tile.row * TILE_SIZE + offset + NPC_SIZE / 2,
    };
  }

  private chebyshev(a: { col: number; row: number }, b: { col: number; row: number }): number {
    return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
  }

  private randomDwell(): number {
    return NPC_IDLE_MIN_MS + Math.random() * (NPC_IDLE_MAX_MS - NPC_IDLE_MIN_MS);
  }

  private shuffleInPlace<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}
