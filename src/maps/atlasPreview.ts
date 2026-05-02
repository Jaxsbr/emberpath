// Labelled-atlas preview generator (US-93). Produces a 4×4 grid PNG showing
// each Wang mask `'0000'`..`'1111'` with the picked frame and the mask label
// overlaid in umber text. Used by US-95 to verify generated PixelLab tilesets
// before wiring them into TILESETS — preempts Learning EP-03's
// "visual-pick-without-verification" failure mode.
//
// Browser-only — uses HTMLCanvasElement. Invoked from a small dev page or a
// Phaser dev tool. Not loaded by the production game scene.

import { TILESETS, WangTilesetDefinition } from './tilesets';

// Umber text from STYLE_PALETTE. Hardcoded here (not imported from
// styleGuide.ts) to keep this module Phaser-free and importable from
// tooling without dragging in style-side imports. Verified against
// STYLE_PALETTE.umberDark in the codex.
const LABEL_COLOR = '#3A2C20';
const PADDING_PX = 4;

/**
 * Render the labelled-atlas preview for a registered Wang tileset to a
 * canvas and return its PNG data URL. Caller is responsible for downloading
 * or displaying the URL — the function does no DOM mutation beyond creating
 * the temporary `<canvas>`.
 *
 * @param tilesetId — id registered in `TILESETS` whose `wang` block is
 *   inspected.
 * @param atlasImage — the loaded atlas image (HTMLImageElement). Caller
 *   ensures the image is fully loaded before calling.
 * @param framePixels — the size of one atlas frame in pixels (e.g. 16 for
 *   Kenney 16×16).
 * @param atlasGridCols — number of columns in the source atlas. Used to
 *   compute frame source-rect from the frame string (which is the linear
 *   frame index).
 */
export function generateAtlasPreviewDataUrl(
  tilesetId: string,
  atlasImage: HTMLImageElement,
  framePixels: number,
  atlasGridCols: number,
): string {
  const ts = TILESETS[tilesetId];
  if (!ts || !ts.wang) {
    throw new Error(`[atlasPreview] No wang block on tileset '${tilesetId}'`);
  }
  const def: WangTilesetDefinition = ts.wang;
  // Each preview cell is 2× the source frame so the mask label fits.
  const cellPx = framePixels * 4 + PADDING_PX * 2;
  const sizePx = cellPx * 4;
  const canvas = document.createElement('canvas');
  canvas.width = sizePx;
  canvas.height = sizePx;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('[atlasPreview] 2D context unavailable');

  // White background — preview is for printing/inspection, not in-engine.
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, sizePx, sizePx);
  ctx.imageSmoothingEnabled = false;

  for (let mInt = 0; mInt < 16; mInt++) {
    const mask = mInt.toString(2).padStart(4, '0');
    const gridRow = Math.floor(mInt / 4);
    const gridCol = mInt % 4;
    const cellX = gridCol * cellPx + PADDING_PX;
    const cellY = gridRow * cellPx + PADDING_PX;

    const frames = def.cornerMaskTable[mask] ?? def.fallbackFrames;
    const frameStr = frames[0] ?? '0';
    const frameIdx = Number.parseInt(frameStr, 10);
    if (Number.isFinite(frameIdx) && frameIdx >= 0) {
      const sx = (frameIdx % atlasGridCols) * framePixels;
      const sy = Math.floor(frameIdx / atlasGridCols) * framePixels;
      const drawSize = framePixels * 4;
      ctx.drawImage(atlasImage, sx, sy, framePixels, framePixels, cellX, cellY, drawSize, drawSize);
    }

    // Mask label in umber, drawn over a translucent cream box for legibility.
    const labelText = mask;
    const labelY = cellY + framePixels * 4 - 14;
    ctx.fillStyle = 'rgba(244, 232, 211, 0.85)';
    ctx.fillRect(cellX, labelY - 12, framePixels * 4, 14);
    ctx.fillStyle = LABEL_COLOR;
    ctx.font = 'bold 12px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(labelText, cellX + 2, labelY - 11);

    // Mark the absent-mask cells with a thin diagonal line so the
    // degenerate-fallback fact is visible at a glance.
    if (!def.cornerMaskTable[mask]) {
      ctx.strokeStyle = 'rgba(58, 44, 32, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cellX, cellY);
      ctx.lineTo(cellX + framePixels * 4, cellY + framePixels * 4);
      ctx.stroke();
    }
  }

  return canvas.toDataURL('image/png');
}
