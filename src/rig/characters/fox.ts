import { RigDefinition, UniqueDirection, DirectionProfile, PartProfile } from '../types';

/**
 * Fox (Pip) rig definition — paper-puppet storybook aesthetic.
 * 46 named parts, 5 unique direction profiles (W, SW, NW mirrored from E, SE, NE).
 *
 * Skeleton: body → neck → head, body → shoulders → front legs, body → hips → back legs
 * Leg hierarchy: upper-leg → lower-leg → ankle → paw → [toe-1..4]
 * Toes splay per direction: S shows 4, E shows 2 (near-side), N shows back-paw toes.
 */

// --- Skeleton hierarchy ---
const LEG = (prefix: string) => ({
  name: `${prefix}-upper-leg`, children: [{ name: `${prefix}-lower-leg`, children: [
    { name: `${prefix}-ankle`, children: [{ name: `${prefix}-paw`, children: [
      { name: `${prefix}-toe-1` }, { name: `${prefix}-toe-2` },
      { name: `${prefix}-toe-3` }, { name: `${prefix}-toe-4` },
    ]}]},
  ]}],
});

const skeleton = {
  name: 'body',
  children: [
    {
      name: 'neck',
      children: [{
        name: 'head',
        children: [
          { name: 'snout' },
          { name: 'left-eye' },
          { name: 'right-eye' },
          { name: 'nose' },
          { name: 'left-ear' },
          { name: 'right-ear' },
        ],
      }],
    },
    {
      name: 'shoulders',
      children: [LEG('front-left'), LEG('front-right')],
    },
    {
      name: 'hips',
      children: [LEG('back-left'), LEG('back-right')],
    },
    { name: 'tail-1', children: [{ name: 'tail-2', children: [{ name: 'tail-3' }] }] },
  ],
};

// --- Helper: generate ankle/paw/toe profiles for a leg ---
type LegFootProfile = {
  ankle: PartProfile;
  paw: PartProfile;
  toes: [PartProfile, PartProfile, PartProfile, PartProfile];
};

function legFoot(prefix: string, foot: LegFootProfile): Record<string, PartProfile> {
  const result: Record<string, PartProfile> = {};
  result[`${prefix}-ankle`] = foot.ankle;
  result[`${prefix}-paw`] = foot.paw;
  result[`${prefix}-toe-1`] = foot.toes[0];
  result[`${prefix}-toe-2`] = foot.toes[1];
  result[`${prefix}-toe-3`] = foot.toes[2];
  result[`${prefix}-toe-4`] = foot.toes[3];
  return result;
}

const HIDDEN_FOOT: LegFootProfile = {
  ankle: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, depth: 0, visible: false },
  paw:   { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, depth: 0, visible: false },
  toes: [
    { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, depth: 0, visible: false },
    { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, depth: 0, visible: false },
    { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, depth: 0, visible: false },
    { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, depth: 0, visible: false },
  ],
};

// --- Direction profiles ---
// All positions are parent-relative (relative to parent bone in skeleton hierarchy).
// Root bone (body) is relative to container center (0,0).
// Use tools/migrate-to-relative.ts to regenerate from absolute positions.

const profileS: DirectionProfile = {
  parts: {
    // Front-facing: wide body, face visible, 2 front legs with splayed toes, tail hidden
    // All positions are parent-relative (relative to parent bone in skeleton hierarchy).
    'body':                   { x: 0, y: 2, scaleX: 1, scaleY: 0.85, rotation: 0, depth: 5, visible: true },
    'neck':                   { x: 0, y: -8, scaleX: 0.7, scaleY: 0.6, rotation: 0, depth: 8, visible: true },
    'head':                   { x: 0, y: -8, scaleX: 1, scaleY: 1, rotation: 0, depth: 10, visible: true },
    'snout':                  { x: 0, y: 6, scaleX: 1, scaleY: 1, rotation: 0, depth: 11, visible: true },
    'left-eye':               { x: -5, y: -2, scaleX: 1, scaleY: 1, rotation: 0, depth: 12, visible: true },
    'right-eye':              { x: 5, y: -2, scaleX: 1, scaleY: 1, rotation: 0, depth: 12, visible: true },
    'nose':                   { x: 0, y: 4, scaleX: 1, scaleY: 1, rotation: 0, depth: 12, visible: true },
    'left-ear':               { x: -9, y: -12, scaleX: 1, scaleY: 1, rotation: -0.2, depth: 9, visible: true },
    'right-ear':              { x: 9, y: -12, scaleX: 1, scaleY: 1, rotation: 0.2, depth: 9, visible: true },
    'shoulders':              { x: 0, y: 6, scaleX: 0.9, scaleY: 0.5, rotation: 0, depth: 4, visible: true },
    'front-left-upper-leg':   { x: -6, y: 6, scaleX: 1, scaleY: 1, rotation: 0, depth: 6, visible: true },
    'front-left-lower-leg':   { x: 0, y: 10, scaleX: 1, scaleY: 1, rotation: 0, depth: 6, visible: true },
    'front-right-upper-leg':  { x: 6, y: 6, scaleX: 1, scaleY: 1, rotation: 0, depth: 6, visible: true },
    'front-right-lower-leg':  { x: 0, y: 10, scaleX: 1, scaleY: 1, rotation: 0, depth: 6, visible: true },
    'hips':                   { x: 0, y: 4, scaleX: 0.85, scaleY: 0.5, rotation: 0, depth: 3, visible: false },
    'back-left-upper-leg':    { x: -8, y: 6, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: false },
    'back-left-lower-leg':    { x: 0, y: 10, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: false },
    'back-right-upper-leg':   { x: 8, y: 6, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: false },
    'back-right-lower-leg':   { x: 0, y: 10, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: false },
    'tail-1':                 { x: 0, y: 10, scaleX: 0.5, scaleY: 0.5, rotation: 0, depth: 1, visible: true, alpha: 0.4 },
    'tail-2':                 { x: 0, y: 2, scaleX: 0.4, scaleY: 0.4, rotation: 0, depth: 0, visible: false },
    'tail-3':                 { x: 0, y: 2, scaleX: 0.3, scaleY: 0.3, rotation: 0, depth: 0, visible: false },
    ...legFoot('front-left', {
      ankle: { x: 0, y: 6, scaleX: 0.8, scaleY: 0.8, rotation: 0, depth: 6, visible: true },
      paw:   { x: 0, y: 4, scaleX: 1, scaleY: 1, rotation: 0, depth: 6, visible: true },
      toes: [
        { x: -4, y: 4, scaleX: 1, scaleY: 1, rotation: -0.3, depth: 6, visible: true },
        { x: -1, y: 5, scaleX: 1, scaleY: 1, rotation: -0.1, depth: 6, visible: true },
        { x: 1, y: 5, scaleX: 1, scaleY: 1, rotation: 0.1, depth: 6, visible: true },
        { x: 4, y: 4, scaleX: 1, scaleY: 1, rotation: 0.3, depth: 6, visible: true },
      ],
    }),
    ...legFoot('front-right', {
      ankle: { x: 0, y: 6, scaleX: 0.8, scaleY: 0.8, rotation: 0, depth: 6, visible: true },
      paw:   { x: 0, y: 4, scaleX: 1, scaleY: 1, rotation: 0, depth: 6, visible: true },
      toes: [
        { x: -4, y: 4, scaleX: 1, scaleY: 1, rotation: -0.3, depth: 6, visible: true },
        { x: -1, y: 5, scaleX: 1, scaleY: 1, rotation: -0.1, depth: 6, visible: true },
        { x: 1, y: 5, scaleX: 1, scaleY: 1, rotation: 0.1, depth: 6, visible: true },
        { x: 4, y: 4, scaleX: 1, scaleY: 1, rotation: 0.3, depth: 6, visible: true },
      ],
    }),
    ...legFoot('back-left', HIDDEN_FOOT),
    ...legFoot('back-right', HIDDEN_FOOT),
  },
};

const profileN: DirectionProfile = {
  parts: {
    // Back-facing: tail prominent, back of head, back legs with toes visible
    // All positions are parent-relative (relative to parent bone in skeleton hierarchy).
    'body':                   { x: 0, y: 2, scaleX: 1, scaleY: 0.85, rotation: 0, depth: 5, visible: true },
    'neck':                   { x: 0, y: -8, scaleX: 0.7, scaleY: 0.6, rotation: 0, depth: 8, visible: true },
    'head':                   { x: 0, y: -8, scaleX: 1, scaleY: 0.9, rotation: 0, depth: 10, visible: true },
    'snout':                  { x: 0, y: 4, scaleX: 0.8, scaleY: 0.6, rotation: 0, depth: 9, visible: false },
    'left-eye':               { x: 0, y: -2, scaleX: 1, scaleY: 1, rotation: 0, depth: 12, visible: false },
    'right-eye':              { x: 0, y: -2, scaleX: 1, scaleY: 1, rotation: 0, depth: 12, visible: false },
    'nose':                   { x: 0, y: 4, scaleX: 1, scaleY: 1, rotation: 0, depth: 12, visible: false },
    'left-ear':               { x: -8, y: -10, scaleX: 1, scaleY: 0.9, rotation: -0.15, depth: 11, visible: true },
    'right-ear':              { x: 8, y: -10, scaleX: 1, scaleY: 0.9, rotation: 0.15, depth: 11, visible: true },
    'shoulders':              { x: 0, y: 6, scaleX: 0.9, scaleY: 0.5, rotation: 0, depth: 3, visible: false },
    'front-left-upper-leg':   { x: -6, y: 6, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: false },
    'front-left-lower-leg':   { x: 0, y: 10, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: false },
    'front-right-upper-leg':  { x: 6, y: 6, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: false },
    'front-right-lower-leg':  { x: 0, y: 10, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: false },
    'hips':                   { x: 0, y: 6, scaleX: 0.85, scaleY: 0.5, rotation: 0, depth: 4, visible: true },
    'back-left-upper-leg':    { x: -7, y: 6, scaleX: 1, scaleY: 1, rotation: 0, depth: 6, visible: true },
    'back-left-lower-leg':    { x: 0, y: 10, scaleX: 1, scaleY: 1, rotation: 0, depth: 6, visible: true },
    'back-right-upper-leg':   { x: 7, y: 6, scaleX: 1, scaleY: 1, rotation: 0, depth: 6, visible: true },
    'back-right-lower-leg':   { x: 0, y: 10, scaleX: 1, scaleY: 1, rotation: 0, depth: 6, visible: true },
    'tail-1':                 { x: 0, y: -10, scaleX: 1, scaleY: 1, rotation: 0, depth: 12, visible: true },
    'tail-2':                 { x: 0, y: -10, scaleX: 0.9, scaleY: 0.9, rotation: 0, depth: 13, visible: true },
    'tail-3':                 { x: 0, y: -8, scaleX: 0.8, scaleY: 0.8, rotation: 0, depth: 14, visible: true },
    ...legFoot('front-left', HIDDEN_FOOT),
    ...legFoot('front-right', HIDDEN_FOOT),
    ...legFoot('back-left', {
      ankle: { x: 0, y: 6, scaleX: 0.8, scaleY: 0.8, rotation: 0, depth: 6, visible: true },
      paw:   { x: 0, y: 4, scaleX: 1, scaleY: 1, rotation: 0, depth: 6, visible: true },
      toes: [
        { x: -4, y: 4, scaleX: 1, scaleY: 1, rotation: -0.3, depth: 6, visible: true },
        { x: -1, y: 5, scaleX: 1, scaleY: 1, rotation: -0.1, depth: 6, visible: true },
        { x: 1, y: 5, scaleX: 1, scaleY: 1, rotation: 0.1, depth: 6, visible: true },
        { x: 4, y: 4, scaleX: 1, scaleY: 1, rotation: 0.3, depth: 6, visible: true },
      ],
    }),
    ...legFoot('back-right', {
      ankle: { x: 0, y: 6, scaleX: 0.8, scaleY: 0.8, rotation: 0, depth: 6, visible: true },
      paw:   { x: 0, y: 4, scaleX: 1, scaleY: 1, rotation: 0, depth: 6, visible: true },
      toes: [
        { x: -4, y: 4, scaleX: 1, scaleY: 1, rotation: -0.3, depth: 6, visible: true },
        { x: -1, y: 5, scaleX: 1, scaleY: 1, rotation: -0.1, depth: 6, visible: true },
        { x: 1, y: 5, scaleX: 1, scaleY: 1, rotation: 0.1, depth: 6, visible: true },
        { x: 4, y: 4, scaleX: 1, scaleY: 1, rotation: 0.3, depth: 6, visible: true },
      ],
    }),
  },
};

const profileE: DirectionProfile = {
  parts: {
    // Side-facing (right): full body profile, 4 legs, 2 toes per paw (side view)
    // All positions are parent-relative (relative to parent bone in skeleton hierarchy).
    'body':                   { x: 0, y: 0, scaleX: 1.2, scaleY: 0.8, rotation: 0, depth: 5, visible: true },
    'neck':                   { x: 10, y: -6, scaleX: 0.6, scaleY: 0.7, rotation: 0.15, depth: 8, visible: true },
    'head':                   { x: 4, y: -4, scaleX: 0.9, scaleY: 0.9, rotation: 0, depth: 10, visible: true },
    'snout':                  { x: 10, y: 2, scaleX: 1, scaleY: 0.8, rotation: 0, depth: 11, visible: true },
    'left-eye':               { x: 4, y: -3, scaleX: 1, scaleY: 1, rotation: 0, depth: 12, visible: true },
    'right-eye':              { x: 4, y: -3, scaleX: 1, scaleY: 1, rotation: 0, depth: 12, visible: false },
    'nose':                   { x: 14, y: 2, scaleX: 1, scaleY: 1, rotation: 0, depth: 12, visible: true },
    'left-ear':               { x: -2, y: -14, scaleX: 0.9, scaleY: 1, rotation: 0.1, depth: 11, visible: true },
    'right-ear':              { x: -2, y: -14, scaleX: 0.9, scaleY: 1, rotation: 0.1, depth: 9, visible: false },
    'shoulders':              { x: 6, y: 6, scaleX: 0.5, scaleY: 0.7, rotation: 0.1, depth: 4, visible: true },
    'front-left-upper-leg':   { x: 0, y: 6, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: true, alpha: 0.7 },
    'front-left-lower-leg':   { x: 0, y: 10, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: true, alpha: 0.7 },
    'front-right-upper-leg':  { x: 2, y: 6, scaleX: 1, scaleY: 1, rotation: 0, depth: 7, visible: true },
    'front-right-lower-leg':  { x: 0, y: 10, scaleX: 1, scaleY: 1, rotation: 0, depth: 7, visible: true },
    'hips':                   { x: -6, y: 4, scaleX: 0.5, scaleY: 0.7, rotation: -0.1, depth: 4, visible: true },
    'back-left-upper-leg':    { x: -4, y: 8, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: true, alpha: 0.7 },
    'back-left-lower-leg':    { x: 0, y: 10, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: true, alpha: 0.7 },
    'back-right-upper-leg':   { x: -2, y: 8, scaleX: 1, scaleY: 1, rotation: 0, depth: 7, visible: true },
    'back-right-lower-leg':   { x: 0, y: 10, scaleX: 1, scaleY: 1, rotation: 0, depth: 7, visible: true },
    'tail-1':                 { x: -18, y: -2, scaleX: 1, scaleY: 1, rotation: -0.15, depth: 2, visible: true },
    'tail-2':                 { x: -12, y: -2, scaleX: 0.9, scaleY: 0.9, rotation: -0.1, depth: 1, visible: true },
    'tail-3':                 { x: -10, y: -1, scaleX: 0.85, scaleY: 0.85, rotation: 0, depth: 0, visible: true },
    ...legFoot('front-left', {
      ankle: { x: 0, y: 6, scaleX: 0.8, scaleY: 0.8, rotation: 0, depth: 3, visible: true, alpha: 0.7 },
      paw:   { x: 0, y: 4, scaleX: 1, scaleY: 0.8, rotation: 0, depth: 3, visible: true, alpha: 0.7 },
      toes: [
        { x: 2, y: 3, scaleX: 1, scaleY: 1, rotation: 0.2, depth: 3, visible: true, alpha: 0.7 },
        { x: -1, y: 4, scaleX: 1, scaleY: 1, rotation: -0.1, depth: 3, visible: true, alpha: 0.7 },
        { x: -6, y: -32, scaleX: 1, scaleY: 1, rotation: 0, depth: 0, visible: false },
        { x: -6, y: -32, scaleX: 1, scaleY: 1, rotation: 0, depth: 0, visible: false },
      ],
    }),
    ...legFoot('front-right', {
      ankle: { x: 0, y: 6, scaleX: 0.8, scaleY: 0.8, rotation: 0, depth: 7, visible: true },
      paw:   { x: 0, y: 4, scaleX: 1, scaleY: 0.8, rotation: 0, depth: 7, visible: true },
      toes: [
        { x: 2, y: 3, scaleX: 1, scaleY: 1, rotation: 0.2, depth: 7, visible: true },
        { x: -1, y: 4, scaleX: 1, scaleY: 1, rotation: -0.1, depth: 7, visible: true },
        { x: -8, y: -32, scaleX: 1, scaleY: 1, rotation: 0, depth: 0, visible: false },
        { x: -8, y: -32, scaleX: 1, scaleY: 1, rotation: 0, depth: 0, visible: false },
      ],
    }),
    ...legFoot('back-left', {
      ankle: { x: 0, y: 6, scaleX: 0.8, scaleY: 0.8, rotation: 0, depth: 3, visible: true, alpha: 0.7 },
      paw:   { x: 0, y: 4, scaleX: 1, scaleY: 0.8, rotation: 0, depth: 3, visible: true, alpha: 0.7 },
      toes: [
        { x: 2, y: 3, scaleX: 1, scaleY: 1, rotation: 0.2, depth: 3, visible: true, alpha: 0.7 },
        { x: -1, y: 4, scaleX: 1, scaleY: 1, rotation: -0.1, depth: 3, visible: true, alpha: 0.7 },
        { x: 10, y: -32, scaleX: 1, scaleY: 1, rotation: 0, depth: 0, visible: false },
        { x: 10, y: -32, scaleX: 1, scaleY: 1, rotation: 0, depth: 0, visible: false },
      ],
    }),
    ...legFoot('back-right', {
      ankle: { x: 0, y: 6, scaleX: 0.8, scaleY: 0.8, rotation: 0, depth: 7, visible: true },
      paw:   { x: 0, y: 4, scaleX: 1, scaleY: 0.8, rotation: 0, depth: 7, visible: true },
      toes: [
        { x: 2, y: 3, scaleX: 1, scaleY: 1, rotation: 0.2, depth: 7, visible: true },
        { x: -1, y: 4, scaleX: 1, scaleY: 1, rotation: -0.1, depth: 7, visible: true },
        { x: 8, y: -32, scaleX: 1, scaleY: 1, rotation: 0, depth: 0, visible: false },
        { x: 8, y: -32, scaleX: 1, scaleY: 1, rotation: 0, depth: 0, visible: false },
      ],
    }),
  },
};

const profileSE: DirectionProfile = {
  parts: {
    // Diagonal front-right: mix of front and side, 3 toes on near paws, 2 on far
    // All positions are parent-relative (relative to parent bone in skeleton hierarchy).
    'body':                   { x: 0, y: 1, scaleX: 1.1, scaleY: 0.85, rotation: 0, depth: 5, visible: true },
    'neck':                   { x: 6, y: -7, scaleX: 0.65, scaleY: 0.65, rotation: 0.08, depth: 8, visible: true },
    'head':                   { x: 2, y: -6, scaleX: 0.95, scaleY: 0.95, rotation: 0, depth: 10, visible: true },
    'snout':                  { x: 6, y: 4, scaleX: 1, scaleY: 0.9, rotation: 0, depth: 11, visible: true },
    'left-eye':               { x: -4, y: -3, scaleX: 0.9, scaleY: 1, rotation: 0, depth: 12, visible: true, alpha: 0.7 },
    'right-eye':              { x: 4, y: -2, scaleX: 1, scaleY: 1, rotation: 0, depth: 12, visible: true },
    'nose':                   { x: 9, y: 3, scaleX: 1, scaleY: 1, rotation: 0, depth: 12, visible: true },
    'left-ear':               { x: -10, y: -12, scaleX: 0.8, scaleY: 0.9, rotation: -0.15, depth: 9, visible: true, alpha: 0.7 },
    'right-ear':              { x: 4, y: -13, scaleX: 1, scaleY: 1, rotation: 0.2, depth: 11, visible: true },
    'shoulders':              { x: 4, y: 6, scaleX: 0.7, scaleY: 0.55, rotation: 0.05, depth: 4, visible: true },
    'front-left-upper-leg':   { x: 0, y: 7, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: true, alpha: 0.6 },
    'front-left-lower-leg':   { x: 0, y: 10, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: true, alpha: 0.6 },
    'front-right-upper-leg':  { x: 4, y: 7, scaleX: 1, scaleY: 1, rotation: 0, depth: 7, visible: true },
    'front-right-lower-leg':  { x: 0, y: 10, scaleX: 1, scaleY: 1, rotation: 0, depth: 7, visible: true },
    'hips':                   { x: -4, y: 5, scaleX: 0.7, scaleY: 0.55, rotation: -0.05, depth: 3, visible: true },
    'back-left-upper-leg':    { x: -4, y: 7, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: true, alpha: 0.6 },
    'back-left-lower-leg':    { x: 0, y: 10, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: true, alpha: 0.6 },
    'back-right-upper-leg':   { x: 0, y: 7, scaleX: 1, scaleY: 1, rotation: 0, depth: 6, visible: true },
    'back-right-lower-leg':   { x: 0, y: 10, scaleX: 1, scaleY: 1, rotation: 0, depth: 6, visible: true },
    'tail-1':                 { x: -14, y: 3, scaleX: 0.9, scaleY: 0.9, rotation: -0.1, depth: 2, visible: true },
    'tail-2':                 { x: -10, y: -2, scaleX: 0.8, scaleY: 0.8, rotation: -0.05, depth: 1, visible: true },
    'tail-3':                 { x: -8, y: -1, scaleX: 0.7, scaleY: 0.7, rotation: 0, depth: 0, visible: true },
    ...legFoot('front-left', {
      ankle: { x: 0, y: 6, scaleX: 0.8, scaleY: 0.8, rotation: 0, depth: 3, visible: true, alpha: 0.6 },
      paw:   { x: 0, y: 4, scaleX: 1, scaleY: 0.9, rotation: 0, depth: 3, visible: true, alpha: 0.6 },
      toes: [
        { x: -2, y: 4, scaleX: 1, scaleY: 1, rotation: -0.1, depth: 3, visible: true, alpha: 0.6 },
        { x: 1, y: 4, scaleX: 1, scaleY: 1, rotation: 0.1, depth: 3, visible: true, alpha: 0.6 },
        { x: -4, y: -34, scaleX: 1, scaleY: 1, rotation: 0, depth: 0, visible: false },
        { x: -4, y: -34, scaleX: 1, scaleY: 1, rotation: 0, depth: 0, visible: false },
      ],
    }),
    ...legFoot('front-right', {
      ankle: { x: 0, y: 6, scaleX: 0.8, scaleY: 0.8, rotation: 0, depth: 7, visible: true },
      paw:   { x: 0, y: 4, scaleX: 1, scaleY: 0.9, rotation: 0, depth: 7, visible: true },
      toes: [
        { x: -3, y: 4, scaleX: 1, scaleY: 1, rotation: -0.2, depth: 7, visible: true },
        { x: 0, y: 5, scaleX: 1, scaleY: 1, rotation: 0, depth: 7, visible: true },
        { x: 3, y: 4, scaleX: 1, scaleY: 1, rotation: 0.2, depth: 7, visible: true },
        { x: -8, y: -34, scaleX: 1, scaleY: 1, rotation: 0, depth: 0, visible: false },
      ],
    }),
    ...legFoot('back-left', {
      ankle: { x: 0, y: 6, scaleX: 0.8, scaleY: 0.8, rotation: 0, depth: 3, visible: true, alpha: 0.6 },
      paw:   { x: 0, y: 4, scaleX: 1, scaleY: 0.9, rotation: 0, depth: 3, visible: true, alpha: 0.6 },
      toes: [
        { x: -2, y: 4, scaleX: 1, scaleY: 1, rotation: -0.1, depth: 3, visible: true, alpha: 0.6 },
        { x: 1, y: 4, scaleX: 1, scaleY: 1, rotation: 0.1, depth: 3, visible: true, alpha: 0.6 },
        { x: 8, y: -33, scaleX: 1, scaleY: 1, rotation: 0, depth: 0, visible: false },
        { x: 8, y: -33, scaleX: 1, scaleY: 1, rotation: 0, depth: 0, visible: false },
      ],
    }),
    ...legFoot('back-right', {
      ankle: { x: 0, y: 6, scaleX: 0.8, scaleY: 0.8, rotation: 0, depth: 6, visible: true },
      paw:   { x: 0, y: 4, scaleX: 1, scaleY: 0.9, rotation: 0, depth: 6, visible: true },
      toes: [
        { x: -3, y: 4, scaleX: 1, scaleY: 1, rotation: -0.2, depth: 6, visible: true },
        { x: 0, y: 5, scaleX: 1, scaleY: 1, rotation: 0, depth: 6, visible: true },
        { x: 3, y: 4, scaleX: 1, scaleY: 1, rotation: 0.2, depth: 6, visible: true },
        { x: 4, y: -33, scaleX: 1, scaleY: 1, rotation: 0, depth: 0, visible: false },
      ],
    }),
  },
};

const profileNE: DirectionProfile = {
  parts: {
    // Diagonal back-right: back of head, tail visible, rear emphasis, 2-3 toes
    // All positions are parent-relative (relative to parent bone in skeleton hierarchy).
    'body':                   { x: 0, y: 1, scaleX: 1.1, scaleY: 0.85, rotation: 0, depth: 5, visible: true },
    'neck':                   { x: 6, y: -7, scaleX: 0.6, scaleY: 0.6, rotation: 0.08, depth: 8, visible: true },
    'head':                   { x: 2, y: -6, scaleX: 0.9, scaleY: 0.9, rotation: 0, depth: 10, visible: true },
    'snout':                  { x: 8, y: 2, scaleX: 0.7, scaleY: 0.6, rotation: 0, depth: 11, visible: true, alpha: 0.5 },
    'left-eye':               { x: 4, y: -2, scaleX: 0.8, scaleY: 1, rotation: 0, depth: 12, visible: true, alpha: 0.3 },
    'right-eye':              { x: 4, y: -2, scaleX: 0.8, scaleY: 1, rotation: 0, depth: 12, visible: false },
    'nose':                   { x: 11, y: 2, scaleX: 0.7, scaleY: 0.7, rotation: 0, depth: 12, visible: true, alpha: 0.4 },
    'left-ear':               { x: -6, y: -12, scaleX: 0.85, scaleY: 0.9, rotation: -0.1, depth: 11, visible: true },
    'right-ear':              { x: 6, y: -12, scaleX: 1, scaleY: 1, rotation: 0.15, depth: 9, visible: true, alpha: 0.7 },
    'shoulders':              { x: 4, y: 6, scaleX: 0.7, scaleY: 0.55, rotation: 0.05, depth: 4, visible: true },
    'front-left-upper-leg':   { x: 0, y: 7, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: true, alpha: 0.6 },
    'front-left-lower-leg':   { x: 0, y: 10, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: true, alpha: 0.6 },
    'front-right-upper-leg':  { x: 2, y: 7, scaleX: 1, scaleY: 1, rotation: 0, depth: 7, visible: true },
    'front-right-lower-leg':  { x: 0, y: 10, scaleX: 1, scaleY: 1, rotation: 0, depth: 7, visible: true },
    'hips':                   { x: -4, y: 5, scaleX: 0.7, scaleY: 0.55, rotation: -0.05, depth: 4, visible: true },
    'back-left-upper-leg':    { x: -4, y: 7, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: true, alpha: 0.6 },
    'back-left-lower-leg':    { x: 0, y: 10, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: true, alpha: 0.6 },
    'back-right-upper-leg':   { x: -2, y: 7, scaleX: 1, scaleY: 1, rotation: 0, depth: 6, visible: true },
    'back-right-lower-leg':   { x: 0, y: 10, scaleX: 1, scaleY: 1, rotation: 0, depth: 6, visible: true },
    'tail-1':                 { x: -14, y: -5, scaleX: 1, scaleY: 1, rotation: -0.1, depth: 12, visible: true },
    'tail-2':                 { x: -10, y: -4, scaleX: 0.9, scaleY: 0.9, rotation: -0.05, depth: 13, visible: true },
    'tail-3':                 { x: -8, y: -2, scaleX: 0.8, scaleY: 0.8, rotation: 0, depth: 14, visible: true },
    ...legFoot('front-left', {
      ankle: { x: 0, y: 6, scaleX: 0.8, scaleY: 0.8, rotation: 0, depth: 3, visible: true, alpha: 0.6 },
      paw:   { x: 0, y: 3, scaleX: 1, scaleY: 0.8, rotation: 0, depth: 3, visible: true, alpha: 0.6 },
      toes: [
        { x: 2, y: 3, scaleX: 1, scaleY: 1, rotation: 0.2, depth: 3, visible: true, alpha: 0.6 },
        { x: -1, y: 4, scaleX: 1, scaleY: 1, rotation: -0.1, depth: 3, visible: true, alpha: 0.6 },
        { x: -4, y: -33, scaleX: 1, scaleY: 1, rotation: 0, depth: 0, visible: false },
        { x: -4, y: -33, scaleX: 1, scaleY: 1, rotation: 0, depth: 0, visible: false },
      ],
    }),
    ...legFoot('front-right', {
      ankle: { x: 0, y: 6, scaleX: 0.8, scaleY: 0.8, rotation: 0, depth: 7, visible: true },
      paw:   { x: 0, y: 3, scaleX: 1, scaleY: 0.8, rotation: 0, depth: 7, visible: true },
      toes: [
        { x: 2, y: 3, scaleX: 1, scaleY: 1, rotation: 0.2, depth: 7, visible: true },
        { x: -1, y: 4, scaleX: 1, scaleY: 1, rotation: -0.1, depth: 7, visible: true },
        { x: -6, y: -33, scaleX: 1, scaleY: 1, rotation: 0, depth: 0, visible: false },
        { x: -6, y: -33, scaleX: 1, scaleY: 1, rotation: 0, depth: 0, visible: false },
      ],
    }),
    ...legFoot('back-left', {
      ankle: { x: 0, y: 6, scaleX: 0.8, scaleY: 0.8, rotation: 0, depth: 3, visible: true, alpha: 0.6 },
      paw:   { x: 0, y: 3, scaleX: 1, scaleY: 0.8, rotation: 0, depth: 3, visible: true, alpha: 0.6 },
      toes: [
        { x: 2, y: 3, scaleX: 1, scaleY: 1, rotation: 0.2, depth: 3, visible: true, alpha: 0.6 },
        { x: -1, y: 4, scaleX: 1, scaleY: 1, rotation: -0.1, depth: 3, visible: true, alpha: 0.6 },
        { x: 8, y: -32, scaleX: 1, scaleY: 1, rotation: 0, depth: 0, visible: false },
        { x: 8, y: -32, scaleX: 1, scaleY: 1, rotation: 0, depth: 0, visible: false },
      ],
    }),
    ...legFoot('back-right', {
      ankle: { x: 0, y: 6, scaleX: 0.8, scaleY: 0.8, rotation: 0, depth: 6, visible: true },
      paw:   { x: 0, y: 3, scaleX: 1, scaleY: 0.8, rotation: 0, depth: 6, visible: true },
      toes: [
        { x: 2, y: 3, scaleX: 1, scaleY: 1, rotation: 0.2, depth: 6, visible: true },
        { x: -1, y: 4, scaleX: 1, scaleY: 1, rotation: -0.1, depth: 6, visible: true },
        { x: 6, y: -32, scaleX: 1, scaleY: 1, rotation: 0, depth: 0, visible: false },
        { x: 6, y: -32, scaleX: 1, scaleY: 1, rotation: 0, depth: 0, visible: false },
      ],
    }),
  },
};

const profiles: Record<UniqueDirection, DirectionProfile> = {
  S: profileS,
  N: profileN,
  E: profileE,
  SE: profileSE,
  NE: profileNE,
};

export const foxRigDefinition: RigDefinition = {
  name: 'fox',
  atlasKey: 'fox-atlas',
  skeleton,
  profiles,
  walkRunParams: {
    walkBobHeight: 1.5,
    walkLegSwing: 0.3,
    walkTailSwing: 0.15,
    walkEarSwing: 0.08,
    runMultiplier: 1.8,
    walkToRunDelay: 0.8,
    walkCycleHz: 3,
    runCycleHz: 5,
    decelerationDuration: 0.2,
  },
  idleParams: {
    breathingAmplitude: 0.02,
    breathingPeriod: 2.5,
    tailSwayAmplitude: 0.08,
    tailSwayPeriod: 3,
    headTurnDelay: 3,
    headTurnAngle: 0.25,
    sitDelay: 6,
    sitLowerAmount: 4,
    earFlickMinInterval: 2,
    earFlickMaxInterval: 5,
    earFlickAmplitude: 0.15,
  },
  collisionSize: 24,
};
