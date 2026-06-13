import Phaser from 'phaser';

// Subtle water animation (Jaco request, 2026-06-13). The new sand-water tileset
// rendered as still tiles read as a flat grey slab — no sense it's water. This
// gives each water cell a slow, low-amplitude brightness shimmer driven by a
// pair of travelling sine waves, so light seems to drift across the surface.
//
// Deliberately a LUMINANCE shimmer, not a colour one: the world is intentionally
// drained/grey (desaturation pipeline + grey-out lighting), and a bright lively
// blue sea would break that vision. Brightness variation survives desaturation
// (which collapses colour but keeps luminance), so the motion reads as faint
// glints of light on dark water — alive, but still drained.
//
// Cheap: a per-tile tint recompute each frame over the ~150 coastal water cells.

interface ShimmerTile {
  sprite: Phaser.GameObjects.Sprite;
  col: number;
  row: number;
}

// Brightness multiplier oscillates between MID-AMP and MID+AMP (of 255). Kept
// in the upper range so the shimmer reads as drifting shadows/glints on the
// surface — visible, but it only ever dims the water, never a hard flash. Two
// waves at different speeds/directions avoid an obvious uniform pulse.
const MID = 175;
const AMP = 80;
const SPEED_A = 0.9; // rad/s
const SPEED_B = 0.55;
const KX_A = 0.55; // spatial frequency — staggers neighbours so the wave travels
const KY_A = 0.8;
const KX_B = -0.85;
const KY_B = 0.35;

export class WaterShimmerSystem {
  private scene: Phaser.Scene;
  private tiles: ShimmerTile[];

  constructor(scene: Phaser.Scene, tiles: ShimmerTile[]) {
    this.scene = scene;
    this.tiles = tiles;
  }

  // Called from GameScene.update with the scene clock (ms). No-op when there is
  // no water in the area.
  update(timeMs: number): void {
    if (this.tiles.length === 0) return;
    const t = timeMs * 0.001;
    for (const tile of this.tiles) {
      const wave =
        0.6 * Math.sin(t * SPEED_A + tile.col * KX_A + tile.row * KY_A) +
        0.4 * Math.sin(t * SPEED_B + tile.col * KX_B + tile.row * KY_B);
      const lum = Math.round(MID + AMP * wave);
      const c = lum < 0 ? 0 : lum > 255 ? 255 : lum;
      tile.sprite.setTint((c << 16) | (c << 8) | c);
    }
  }

  // Drop tint references so a scene.restart doesn't keep stale sprites (the
  // sprites themselves are owned/destroyed by GameScene's tileLayer).
  destroy(): void {
    this.tiles = [];
  }
}
