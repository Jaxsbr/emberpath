import Phaser from 'phaser';
import { PLAYER_SIZE, NPC_SIZE } from '../maps/constants';
import {
  getCharacterKindIds,
  getCharacterCollision,
  characterTextureKey,
  characterTextureFrame,
  isCharacterKind,
  PLAYER_CHARACTER_ID,
  type CharacterCollision,
} from '../maps/characters';

// #185 character collision editor. The Collision tab's CHARACTER target — the
// sibling of the OBJECT sub-cell paint editor (objectShapeEditor.ts). Objects are
// grid-anchored, so their collider is sub-cell paint over a footprint; CHARACTERS
// (Pip / each NPC sprite) move + animate, so their collider is a single
// CENTRE-referenced rect that travels with the live sprite — the same AABB the
// runtime sweep already uses, just authored to hug the body instead of the full
// PLAYER_SIZE/NPC_SIZE square. Flow: pick a kind, drag the rect to position, drag
// the handles to size, Save → POST /__character-shape/save → merged into
// src/data/character-shapes.json under `collision`. GameScene + collision.ts read
// it via getCharacterCollision(kind) wherever that character appears; an
// unauthored kind keeps the legacy feet-square (zero regression).
//
// Mirrors the character branch of shadowEditor.ts (centre-referenced shape, fit to
// FIT_BOX, move/east/south drag handles) but is rect-only and has no alpha — a
// collision body is a box, not a soft shadow.

const BACKDROP_DEPTH = 58;
const SPRITE_DEPTH = 59;
const FILL_DEPTH = 59.5; // the translucent red body preview, under the edit overlay
const OVERLAY_DEPTH = 60;
const FIT_BOX = 420; // target on-screen px for the sprite's longest side
const HANDLE_PX = 11; // half-size of a drag handle hit box (screen px)
const BLOCKED_COLOR = 0xff3344;
const BLOCKED_FILL_ALPHA = 0.32;
const OUTLINE_COLOR = 0xff6677;
const HANDLE_COLOR = 0xffffff;
const REF_COLOR = 0xffcc44;

// The faithful "current box" when a kind has no authored collision: the legacy
// feet-square centred on the sprite (dx=dy=0), so Save-without-edit is a no-op.
function defaultCollision(kind: string): CharacterCollision {
  const size = kind === PLAYER_CHARACTER_ID ? PLAYER_SIZE : NPC_SIZE;
  return { w: size, h: size, dx: 0, dy: 0 };
}

export class CharacterCollisionEditorSystem {
  private graphics: Phaser.GameObjects.Graphics;
  private fillGfx: Phaser.GameObjects.Graphics;
  private sprite: Phaser.GameObjects.Image | null = null;
  private backdrop: Phaser.GameObjects.Rectangle;

  // Authored box state, in WORLD px relative to the sprite centre.
  private box: CharacterCollision;

  // Screen-space mapping (sprite centre).
  private pxPerWorld = 1;
  private refScreenX = 0;
  private refScreenY = 0;

  // Drag state.
  private dragging: 'move' | 'east' | 'south' | null = null;
  private dragStart = { px: 0, py: 0, dx: 0, dy: 0, w: 0, h: 0 };

  private saveKey: Phaser.Input.Keyboard.Key | null = null;

  private hud: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private readoutEl: HTMLDivElement | null = null;

  constructor(
    private scene: Phaser.Scene,
    private readonly kind: string,
    // Editor-app hosting (#182/#185): `hudParent` flows the HUD inside that
    // container; `onSwitch` re-mounts on a new kind without a URL reload;
    // `onSwitchTarget` jumps to the OBJECT collision editor (the Collision tab
    // owns the object⇄character toggle, mirroring the Shadow tab). All absent →
    // standalone in-game behaviour.
    private readonly opts?: {
      hudParent?: HTMLElement;
      onSwitch?: (kind: string) => void;
      onSwitchTarget?: (target: 'object' | 'character') => void;
    },
  ) {
    const cam = this.scene.cameras.main;
    cam.stopFollow();
    cam.setZoom(1);
    cam.setScroll(0, 0);
    const viewW = cam.width;
    const viewH = cam.height;

    this.backdrop = this.scene.add
      .rectangle(0, 0, viewW, viewH, 0x14101e, 1)
      .setOrigin(0, 0)
      .setDepth(BACKDROP_DEPTH);

    const textureKey = characterTextureKey(this.kind);
    if (textureKey && this.scene.textures.exists(textureKey)) {
      this.sprite = this.scene.add.image(0, 0, textureKey, characterTextureFrame(this.kind)).setDepth(SPRITE_DEPTH);
    }
    this.setupMapping(viewW, viewH);

    const authored = getCharacterCollision(this.kind);
    this.box = authored ? { ...authored } : defaultCollision(this.kind);

    this.fillGfx = this.scene.add.graphics().setDepth(FILL_DEPTH);
    this.graphics = this.scene.add.graphics().setDepth(OVERLAY_DEPTH);
    const uiCam = this.scene.cameras.getCamera('ui');
    if (uiCam) {
      uiCam.ignore(this.graphics);
      uiCam.ignore(this.fillGfx);
      uiCam.ignore(this.backdrop);
      if (this.sprite) uiCam.ignore(this.sprite);
    }

    this.setupInput();
    this.buildHud();
    this.redraw();
  }

  // ref = sprite CENTRE. The in-game sprite renders at native px (scale 1), so
  // 1 world px = 1 native px; fit the native frame to FIT_BOX → pxPerWorld = fit.
  private setupMapping(viewW: number, viewH: number): void {
    const nativeW = this.sprite ? this.sprite.width : 64;
    const nativeH = this.sprite ? this.sprite.height : 64;
    const fit = FIT_BOX / Math.max(nativeW, nativeH);
    this.pxPerWorld = fit;
    const cx = Math.round(viewW / 2);
    const cy = Math.round(viewH / 2);
    this.refScreenX = cx;
    this.refScreenY = cy;
    if (this.sprite) {
      this.sprite.setOrigin(0.5, 0.5).setPosition(cx, cy).setDisplaySize(nativeW * fit, nativeH * fit);
    }
  }

  private setupInput(): void {
    const input = this.scene.input;
    input.on('pointerdown', this.onPointerDown, this);
    input.on('pointermove', this.onPointerMove, this);
    input.on('pointerup', this.onPointerUp, this);
    const kb = this.scene.input.keyboard;
    if (kb) this.saveKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
  }

  private centreScreen(): { x: number; y: number } {
    return {
      x: this.refScreenX + this.box.dx * this.pxPerWorld,
      y: this.refScreenY + this.box.dy * this.pxPerWorld,
    };
  }
  private eastHandle(): { x: number; y: number } {
    const c = this.centreScreen();
    return { x: c.x + (this.box.w / 2) * this.pxPerWorld, y: c.y };
  }
  private southHandle(): { x: number; y: number } {
    const c = this.centreScreen();
    return { x: c.x, y: c.y + (this.box.h / 2) * this.pxPerWorld };
  }

  private near(px: number, py: number, h: { x: number; y: number }): boolean {
    return Math.abs(px - h.x) <= HANDLE_PX && Math.abs(py - h.y) <= HANDLE_PX;
  }

  private insideBox(px: number, py: number): boolean {
    const c = this.centreScreen();
    const hw = (this.box.w / 2) * this.pxPerWorld;
    const hh = (this.box.h / 2) * this.pxPerWorld;
    if (hw <= 0 || hh <= 0) return false;
    return Math.abs(px - c.x) <= hw && Math.abs(py - c.y) <= hh;
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const { x, y } = pointer;
    if (this.near(x, y, this.eastHandle())) this.dragging = 'east';
    else if (this.near(x, y, this.southHandle())) this.dragging = 'south';
    else if (this.insideBox(x, y)) this.dragging = 'move';
    else this.dragging = null;
    if (this.dragging) {
      this.dragStart = { px: x, py: y, dx: this.box.dx, dy: this.box.dy, w: this.box.w, h: this.box.h };
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.dragging) return;
    const dpx = (pointer.x - this.dragStart.px) / this.pxPerWorld;
    const dpy = (pointer.y - this.dragStart.py) / this.pxPerWorld;
    if (this.dragging === 'move') {
      this.box.dx = Math.round(this.dragStart.dx + dpx);
      this.box.dy = Math.round(this.dragStart.dy + dpy);
    } else if (this.dragging === 'east') {
      this.box.w = Math.max(2, Math.round(this.dragStart.w + dpx * 2));
    } else if (this.dragging === 'south') {
      this.box.h = Math.max(2, Math.round(this.dragStart.h + dpy * 2));
    }
    this.updateReadout();
    this.redraw();
  }

  private onPointerUp(): void {
    this.dragging = null;
  }

  update(): void {
    if (this.saveKey && Phaser.Input.Keyboard.JustDown(this.saveKey)) void this.save();
  }

  private redraw(): void {
    const c = this.centreScreen();
    const hw = (this.box.w / 2) * this.pxPerWorld;
    const hh = (this.box.h / 2) * this.pxPerWorld;

    // Translucent red body preview — the area that blocks Pip.
    const fg = this.fillGfx;
    fg.clear();
    fg.fillStyle(BLOCKED_COLOR, BLOCKED_FILL_ALPHA);
    fg.fillRect(c.x - hw, c.y - hh, hw * 2, hh * 2);

    // Editing overlay: outline, handles, ref crosshair.
    const g = this.graphics;
    g.clear();
    g.lineStyle(2, OUTLINE_COLOR, 0.95);
    g.strokeRect(c.x - hw, c.y - hh, hw * 2, hh * 2);

    // Sprite-centre crosshair + a faint line to the box centre so the offset reads.
    g.lineStyle(1, REF_COLOR, 0.9);
    g.lineBetween(this.refScreenX - 8, this.refScreenY, this.refScreenX + 8, this.refScreenY);
    g.lineBetween(this.refScreenX, this.refScreenY - 8, this.refScreenX, this.refScreenY + 8);
    g.lineStyle(1, REF_COLOR, 0.4);
    g.lineBetween(this.refScreenX, this.refScreenY, c.x, c.y);

    g.fillStyle(HANDLE_COLOR, 1);
    for (const h of [this.eastHandle(), this.southHandle()]) {
      g.fillRect(h.x - 5, h.y - 5, 10, 10);
    }
  }

  private buildHud(): void {
    const hud = document.createElement('div');
    hud.id = 'char-collision-editor-hud';
    const embedded = !!this.opts?.hudParent;
    hud.style.cssText =
      (embedded ? 'position:static;' : 'position:fixed;top:10px;left:10px;z-index:9999;') +
      'font:12px/1.4 system-ui,sans-serif;' +
      'background:rgba(20,16,30,0.92);color:#eee;padding:10px 12px;border-radius:6px;' +
      'max-width:280px;box-shadow:0 2px 10px rgba(0,0,0,0.5);';

    const title = document.createElement('div');
    title.style.cssText = 'font-weight:600;margin-bottom:6px';
    title.textContent = 'Collision editor — character';
    hud.appendChild(title);

    // Target toggle (object ⇄ character) — mirrors the Shadow tab. Switching to
    // object jumps to the sub-cell paint editor for the same Collision tab.
    const targetRow = document.createElement('div');
    targetRow.style.cssText = 'margin-bottom:6px';
    for (const t of ['object', 'character'] as const) {
      const b = document.createElement('button');
      b.textContent = t;
      b.style.cssText =
        'cursor:pointer;border:0;border-radius:4px;margin-right:4px;padding:3px 8px;' +
        (t === 'character'
          ? 'background:#c97a3a;color:#fff;font-weight:600'
          : 'background:#3a3550;color:#ddd');
      b.addEventListener('click', () => {
        if (t !== 'character' && this.opts?.onSwitchTarget) this.opts.onSwitchTarget(t);
      });
      targetRow.appendChild(b);
    }
    hud.appendChild(targetRow);

    // Kind selector — switching remounts on the new character kind.
    const select = document.createElement('select');
    select.id = 'char-collision-kind-select';
    select.style.cssText = 'width:100%;margin-bottom:6px;padding:3px';
    for (const id of getCharacterKindIds()) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = id;
      if (id === this.kind) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener('change', () => {
      if (this.opts?.onSwitch) {
        this.opts.onSwitch(select.value);
        return;
      }
      const url = new URL(window.location.href);
      url.searchParams.set('editor', 'character-collision');
      url.searchParams.set('kind', select.value);
      window.location.href = url.toString();
    });
    hud.appendChild(select);

    const help = document.createElement('div');
    help.style.cssText = 'opacity:0.8;margin-bottom:6px';
    help.innerHTML =
      'Drag the red box to position. Drag the white handles to size.<br>' +
      'Yellow cross = sprite centre (the box travels with the character).<br>' +
      'Enter or Save: write the collision body.';
    hud.appendChild(help);

    const readout = document.createElement('div');
    readout.id = 'char-collision-readout';
    readout.style.cssText = 'margin-bottom:6px;font-weight:600;font-family:monospace;font-size:11px';
    hud.appendChild(readout);
    this.readoutEl = readout;

    const btn = document.createElement('button');
    btn.id = 'char-collision-save';
    btn.textContent = 'Save collision';
    btn.style.cssText =
      'cursor:pointer;border:0;border-radius:4px;background:#c97a3a;color:#fff;' +
      'padding:6px 10px;font-weight:600;width:100%';
    btn.addEventListener('click', () => void this.save());
    hud.appendChild(btn);

    const clearBtn = document.createElement('button');
    clearBtn.id = 'char-collision-clear';
    clearBtn.textContent = 'Clear authored (revert to feet-box)';
    clearBtn.style.cssText =
      'cursor:pointer;border:0;border-radius:4px;background:#5a4a6a;color:#fff;' +
      'padding:5px 10px;margin-top:5px;width:100%';
    clearBtn.addEventListener('click', () => void this.clearAuthored());
    hud.appendChild(clearBtn);

    const status = document.createElement('div');
    status.id = 'char-collision-status';
    status.style.cssText = 'margin-top:6px;min-height:14px;opacity:0.9';
    hud.appendChild(status);
    this.statusEl = status;

    (this.opts?.hudParent ?? document.body).appendChild(hud);
    this.hud = hud;
    this.updateReadout();
  }

  private updateReadout(): void {
    if (!this.readoutEl) return;
    const b = this.box;
    this.readoutEl.textContent = `w${b.w} h${b.h} dx${b.dx} dy${b.dy}`;
  }

  private setStatus(msg: string, ok: boolean): void {
    if (this.statusEl) {
      this.statusEl.textContent = msg;
      this.statusEl.style.color = ok ? '#8fe388' : '#ff8888';
    }
  }

  private async save(): Promise<void> {
    const payload = { kind: this.kind, collision: { ...this.box } };
    this.setStatus('Saving…', true);
    try {
      const res = await fetch('/__character-shape/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        this.setStatus(`Save failed (${res.status})`, false);
        return;
      }
      const body = (await res.json()) as { path?: string };
      this.setStatus(`Saved ${this.kind} collision → ${body.path ?? ''}`, true);
    } catch (err) {
      this.setStatus(`Save error: ${String(err)}`, false);
    }
  }

  private async clearAuthored(): Promise<void> {
    const payload = { kind: this.kind, collision: null };
    this.setStatus('Clearing…', true);
    try {
      const res = await fetch('/__character-shape/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        this.setStatus(`Clear failed (${res.status})`, false);
        return;
      }
      this.setStatus(`Cleared ${this.kind} — reverts to feet-box`, true);
      this.box = defaultCollision(this.kind);
      this.updateReadout();
      this.redraw();
    } catch (err) {
      this.setStatus(`Clear error: ${String(err)}`, false);
    }
  }

  destroy(): void {
    const input = this.scene.input;
    input.off('pointerdown', this.onPointerDown, this);
    input.off('pointermove', this.onPointerMove, this);
    input.off('pointerup', this.onPointerUp, this);
    this.graphics.destroy();
    this.fillGfx.destroy();
    this.backdrop.destroy();
    if (this.sprite) this.sprite.destroy();
    if (this.hud && this.hud.parentNode) this.hud.parentNode.removeChild(this.hud);
    this.hud = null;
  }
}

// Resolve a `?kind=` against the character family, defaulting to Pip.
export function resolveCharacterCollisionKind(raw: string | null | undefined): string {
  if (raw && isCharacterKind(raw)) return raw;
  return PLAYER_CHARACTER_ID;
}
