import { describe, it, expect } from 'vitest';
import {
  ShadowShape,
  resolveShadow,
  defaultEntityShadow,
  pickShadow,
} from '../src/maps/shadows';

describe('resolveShadow', () => {
  it('places the shape centre at reference + (dx, dy)', () => {
    const s: ShadowShape = { shape: 'ellipse', w: 20, h: 8, dx: 4, dy: -3, alpha: 0.2 };
    const r = resolveShadow(s, 100, 200);
    expect(r.cx).toBe(104);
    expect(r.cy).toBe(197);
    expect(r.w).toBe(20);
    expect(r.h).toBe(8);
    expect(r.shape).toBe('ellipse');
    expect(r.alpha).toBe(0.2);
  });

  it('handles a zero offset (centre sits on the reference point)', () => {
    const s: ShadowShape = { shape: 'rect', w: 32, h: 16, dx: 0, dy: 0, alpha: 0.3 };
    const r = resolveShadow(s, 50, 60);
    expect(r.cx).toBe(50);
    expect(r.cy).toBe(60);
    expect(r.shape).toBe('rect');
  });

  it('carries negative reference coordinates through unchanged', () => {
    const s: ShadowShape = { shape: 'ellipse', w: 10, h: 4, dx: -5, dy: 5, alpha: 0.1 };
    const r = resolveShadow(s, -20, -40);
    expect(r.cx).toBe(-25);
    expect(r.cy).toBe(-35);
  });
});

describe('defaultEntityShadow', () => {
  it('is a feet ellipse: height 0.4x width, centred under the sprite, dropped to the feet', () => {
    const s = defaultEntityShadow(20, 22, 0.22);
    expect(s.shape).toBe('ellipse');
    expect(s.w).toBe(20);
    expect(s.h).toBeCloseTo(8);
    expect(s.dx).toBe(0);
    expect(s.dy).toBe(22);
    expect(s.alpha).toBe(0.22);
  });
});

describe('pickShadow', () => {
  const fallback: ShadowShape = { shape: 'ellipse', w: 10, h: 4, dx: 0, dy: 0, alpha: 0.2 };

  it('returns the authored shape when present', () => {
    const authored: ShadowShape = { shape: 'rect', w: 30, h: 20, dx: 1, dy: 2, alpha: 0.3 };
    expect(pickShadow(authored, fallback)).toBe(authored);
  });

  it('falls back when no authored shape', () => {
    expect(pickShadow(undefined, fallback)).toBe(fallback);
  });
});

// A round object (circle) authored shadow keeps equal w/h through resolution —
// the whole point of the shape tool (no square shadow under a round tree).
describe('shape fidelity', () => {
  it('a circle (w==h ellipse) resolves to equal width and height', () => {
    const circle: ShadowShape = { shape: 'ellipse', w: 24, h: 24, dx: 0, dy: 10, alpha: 0.25 };
    const r = resolveShadow(circle, 0, 0);
    expect(r.w).toBe(r.h);
    expect(r.shape).toBe('ellipse');
  });

  it('a rectangle stays rect through resolution', () => {
    const rect: ShadowShape = { shape: 'rect', w: 40, h: 12, dx: 0, dy: 0, alpha: 0.2 };
    expect(resolveShadow(rect, 0, 0).shape).toBe('rect');
  });
});
