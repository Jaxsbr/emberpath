import { RigDefinition, UniqueDirection, DirectionProfile } from '../types';

/**
 * Fox (Pip) rig definition — paper-puppet storybook aesthetic.
 * 16 named parts, 5 unique direction profiles (W, SW, NW mirrored from E, SE, NE).
 */

// --- Skeleton hierarchy ---
const skeleton = {
  name: 'body',
  children: [
    {
      name: 'head',
      children: [
        { name: 'snout' },
        { name: 'left-ear' },
        { name: 'right-ear' },
      ],
    },
    { name: 'tail-1', children: [{ name: 'tail-2', children: [{ name: 'tail-3' }] }] },
    { name: 'front-left-upper-leg', children: [{ name: 'front-left-lower-leg' }] },
    { name: 'front-right-upper-leg', children: [{ name: 'front-right-lower-leg' }] },
    { name: 'back-left-upper-leg', children: [{ name: 'back-left-lower-leg' }] },
    { name: 'back-right-upper-leg', children: [{ name: 'back-right-lower-leg' }] },
  ],
};

// --- Direction profiles ---
// All positions are relative to container center (0,0). Depth is local render order.

const profileS: DirectionProfile = {
  parts: {
    // Front-facing: wide body, face visible, 2 front legs, tail hidden
    'body':                   { x: 0, y: 2, scaleX: 1, scaleY: 0.85, rotation: 0, depth: 5, visible: true },
    'head':                   { x: 0, y: -14, scaleX: 1, scaleY: 1, rotation: 0, depth: 10, visible: true },
    'snout':                  { x: 0, y: -8, scaleX: 1, scaleY: 1, rotation: 0, depth: 11, visible: true },
    'left-ear':               { x: -9, y: -26, scaleX: 1, scaleY: 1, rotation: -0.2, depth: 9, visible: true },
    'right-ear':              { x: 9, y: -26, scaleX: 1, scaleY: 1, rotation: 0.2, depth: 9, visible: true },
    'tail-1':                 { x: 0, y: 12, scaleX: 0.5, scaleY: 0.5, rotation: 0, depth: 1, visible: true, alpha: 0.4 },
    'tail-2':                 { x: 0, y: 14, scaleX: 0.4, scaleY: 0.4, rotation: 0, depth: 0, visible: false },
    'tail-3':                 { x: 0, y: 16, scaleX: 0.3, scaleY: 0.3, rotation: 0, depth: 0, visible: false },
    'front-left-upper-leg':   { x: -6, y: 14, scaleX: 1, scaleY: 1, rotation: 0, depth: 6, visible: true },
    'front-left-lower-leg':   { x: -6, y: 24, scaleX: 1, scaleY: 1, rotation: 0, depth: 6, visible: true },
    'front-right-upper-leg':  { x: 6, y: 14, scaleX: 1, scaleY: 1, rotation: 0, depth: 6, visible: true },
    'front-right-lower-leg':  { x: 6, y: 24, scaleX: 1, scaleY: 1, rotation: 0, depth: 6, visible: true },
    'back-left-upper-leg':    { x: -8, y: 12, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: false },
    'back-left-lower-leg':    { x: -8, y: 22, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: false },
    'back-right-upper-leg':   { x: 8, y: 12, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: false },
    'back-right-lower-leg':   { x: 8, y: 22, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: false },
  },
};

const profileN: DirectionProfile = {
  parts: {
    // Back-facing: tail prominent, back of head, back legs visible
    'body':                   { x: 0, y: 2, scaleX: 1, scaleY: 0.85, rotation: 0, depth: 5, visible: true },
    'head':                   { x: 0, y: -14, scaleX: 1, scaleY: 0.9, rotation: 0, depth: 10, visible: true },
    'snout':                  { x: 0, y: -10, scaleX: 0.8, scaleY: 0.6, rotation: 0, depth: 9, visible: false },
    'left-ear':               { x: -8, y: -24, scaleX: 1, scaleY: 0.9, rotation: -0.15, depth: 11, visible: true },
    'right-ear':              { x: 8, y: -24, scaleX: 1, scaleY: 0.9, rotation: 0.15, depth: 11, visible: true },
    'tail-1':                 { x: 0, y: -8, scaleX: 1, scaleY: 1, rotation: 0, depth: 12, visible: true },
    'tail-2':                 { x: 0, y: -18, scaleX: 0.9, scaleY: 0.9, rotation: 0, depth: 13, visible: true },
    'tail-3':                 { x: 0, y: -26, scaleX: 0.8, scaleY: 0.8, rotation: 0, depth: 14, visible: true },
    'front-left-upper-leg':   { x: -6, y: 14, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: false },
    'front-left-lower-leg':   { x: -6, y: 24, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: false },
    'front-right-upper-leg':  { x: 6, y: 14, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: false },
    'front-right-lower-leg':  { x: 6, y: 24, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: false },
    'back-left-upper-leg':    { x: -7, y: 14, scaleX: 1, scaleY: 1, rotation: 0, depth: 6, visible: true },
    'back-left-lower-leg':    { x: -7, y: 24, scaleX: 1, scaleY: 1, rotation: 0, depth: 6, visible: true },
    'back-right-upper-leg':   { x: 7, y: 14, scaleX: 1, scaleY: 1, rotation: 0, depth: 6, visible: true },
    'back-right-lower-leg':   { x: 7, y: 24, scaleX: 1, scaleY: 1, rotation: 0, depth: 6, visible: true },
  },
};

const profileE: DirectionProfile = {
  parts: {
    // Side-facing (right): full body profile, 4 legs, full tail chain
    'body':                   { x: 0, y: 0, scaleX: 1.2, scaleY: 0.8, rotation: 0, depth: 5, visible: true },
    'head':                   { x: 14, y: -10, scaleX: 0.9, scaleY: 0.9, rotation: 0, depth: 10, visible: true },
    'snout':                  { x: 24, y: -8, scaleX: 1, scaleY: 0.8, rotation: 0, depth: 11, visible: true },
    'left-ear':               { x: 12, y: -24, scaleX: 0.9, scaleY: 1, rotation: 0.1, depth: 11, visible: true },
    'right-ear':              { x: 12, y: -24, scaleX: 0.9, scaleY: 1, rotation: 0.1, depth: 9, visible: false },
    'tail-1':                 { x: -18, y: -2, scaleX: 1, scaleY: 1, rotation: -0.15, depth: 2, visible: true },
    'tail-2':                 { x: -30, y: -4, scaleX: 0.9, scaleY: 0.9, rotation: -0.1, depth: 1, visible: true },
    'tail-3':                 { x: -40, y: -5, scaleX: 0.85, scaleY: 0.85, rotation: 0, depth: 0, visible: true },
    // Near legs (right side — higher depth)
    'front-right-upper-leg':  { x: 8, y: 12, scaleX: 1, scaleY: 1, rotation: 0, depth: 7, visible: true },
    'front-right-lower-leg':  { x: 8, y: 22, scaleX: 1, scaleY: 1, rotation: 0, depth: 7, visible: true },
    'back-right-upper-leg':   { x: -8, y: 12, scaleX: 1, scaleY: 1, rotation: 0, depth: 7, visible: true },
    'back-right-lower-leg':   { x: -8, y: 22, scaleX: 1, scaleY: 1, rotation: 0, depth: 7, visible: true },
    // Far legs (left side — lower depth, slightly less alpha)
    'front-left-upper-leg':   { x: 6, y: 12, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: true, alpha: 0.7 },
    'front-left-lower-leg':   { x: 6, y: 22, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: true, alpha: 0.7 },
    'back-left-upper-leg':    { x: -10, y: 12, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: true, alpha: 0.7 },
    'back-left-lower-leg':    { x: -10, y: 22, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: true, alpha: 0.7 },
  },
};

const profileSE: DirectionProfile = {
  parts: {
    // Diagonal front-right: mix of front and side
    'body':                   { x: 0, y: 1, scaleX: 1.1, scaleY: 0.85, rotation: 0, depth: 5, visible: true },
    'head':                   { x: 8, y: -12, scaleX: 0.95, scaleY: 0.95, rotation: 0, depth: 10, visible: true },
    'snout':                  { x: 14, y: -8, scaleX: 1, scaleY: 0.9, rotation: 0, depth: 11, visible: true },
    'left-ear':               { x: -2, y: -24, scaleX: 0.8, scaleY: 0.9, rotation: -0.15, depth: 9, visible: true, alpha: 0.7 },
    'right-ear':              { x: 12, y: -25, scaleX: 1, scaleY: 1, rotation: 0.2, depth: 11, visible: true },
    'tail-1':                 { x: -14, y: 4, scaleX: 0.9, scaleY: 0.9, rotation: -0.1, depth: 2, visible: true },
    'tail-2':                 { x: -24, y: 2, scaleX: 0.8, scaleY: 0.8, rotation: -0.05, depth: 1, visible: true },
    'tail-3':                 { x: -32, y: 1, scaleX: 0.7, scaleY: 0.7, rotation: 0, depth: 0, visible: true },
    // Near legs (right / front)
    'front-right-upper-leg':  { x: 8, y: 14, scaleX: 1, scaleY: 1, rotation: 0, depth: 7, visible: true },
    'front-right-lower-leg':  { x: 8, y: 24, scaleX: 1, scaleY: 1, rotation: 0, depth: 7, visible: true },
    'back-right-upper-leg':   { x: -4, y: 13, scaleX: 1, scaleY: 1, rotation: 0, depth: 6, visible: true },
    'back-right-lower-leg':   { x: -4, y: 23, scaleX: 1, scaleY: 1, rotation: 0, depth: 6, visible: true },
    // Far legs (left / back)
    'front-left-upper-leg':   { x: 4, y: 14, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: true, alpha: 0.6 },
    'front-left-lower-leg':   { x: 4, y: 24, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: true, alpha: 0.6 },
    'back-left-upper-leg':    { x: -8, y: 13, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: true, alpha: 0.6 },
    'back-left-lower-leg':    { x: -8, y: 23, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: true, alpha: 0.6 },
  },
};

const profileNE: DirectionProfile = {
  parts: {
    // Diagonal back-right: back of head, tail visible, rear emphasis
    'body':                   { x: 0, y: 1, scaleX: 1.1, scaleY: 0.85, rotation: 0, depth: 5, visible: true },
    'head':                   { x: 8, y: -12, scaleX: 0.9, scaleY: 0.9, rotation: 0, depth: 10, visible: true },
    'snout':                  { x: 16, y: -10, scaleX: 0.7, scaleY: 0.6, rotation: 0, depth: 11, visible: true, alpha: 0.5 },
    'left-ear':               { x: 2, y: -24, scaleX: 0.85, scaleY: 0.9, rotation: -0.1, depth: 11, visible: true },
    'right-ear':              { x: 14, y: -24, scaleX: 1, scaleY: 1, rotation: 0.15, depth: 9, visible: true, alpha: 0.7 },
    'tail-1':                 { x: -14, y: -4, scaleX: 1, scaleY: 1, rotation: -0.1, depth: 12, visible: true },
    'tail-2':                 { x: -24, y: -8, scaleX: 0.9, scaleY: 0.9, rotation: -0.05, depth: 13, visible: true },
    'tail-3':                 { x: -32, y: -10, scaleX: 0.8, scaleY: 0.8, rotation: 0, depth: 14, visible: true },
    // Near legs (right)
    'front-right-upper-leg':  { x: 6, y: 14, scaleX: 1, scaleY: 1, rotation: 0, depth: 7, visible: true },
    'front-right-lower-leg':  { x: 6, y: 24, scaleX: 1, scaleY: 1, rotation: 0, depth: 7, visible: true },
    'back-right-upper-leg':   { x: -6, y: 13, scaleX: 1, scaleY: 1, rotation: 0, depth: 6, visible: true },
    'back-right-lower-leg':   { x: -6, y: 23, scaleX: 1, scaleY: 1, rotation: 0, depth: 6, visible: true },
    // Far legs (left)
    'front-left-upper-leg':   { x: 4, y: 14, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: true, alpha: 0.6 },
    'front-left-lower-leg':   { x: 4, y: 24, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: true, alpha: 0.6 },
    'back-left-upper-leg':    { x: -8, y: 13, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: true, alpha: 0.6 },
    'back-left-lower-leg':    { x: -8, y: 23, scaleX: 1, scaleY: 1, rotation: 0, depth: 3, visible: true, alpha: 0.6 },
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
