/**
 * Migration tool: convert fox.ts absolute profiles to parent-relative profiles.
 *
 * Run: npx tsx tools/migrate-to-relative.ts
 *
 * Walks the bone hierarchy for each of the 5 unique directions.
 * For each bone, computes: relative_xy = bone_absolute_xy - parent_absolute_xy.
 * Outputs updated fox.ts with parent-relative profile positions.
 */
import { foxRigDefinition } from '../src/rig/characters/fox';
import { BoneDefinition, PartProfile, UniqueDirection, DirectionProfile } from '../src/rig/types';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIRECTIONS: UniqueDirection[] = ['S', 'N', 'E', 'SE', 'NE'];

interface RelativeProfiles {
  [dir: string]: { [partName: string]: PartProfile };
}

/** Walk the bone tree and compute relative positions for each bone. */
function computeRelativeProfiles(
  skeleton: BoneDefinition,
  absoluteProfiles: Record<UniqueDirection, DirectionProfile>,
): RelativeProfiles {
  const result: RelativeProfiles = {};

  for (const dir of DIRECTIONS) {
    const absProfile = absoluteProfiles[dir];
    const relParts: Record<string, PartProfile> = {};

    // Walk tree, passing parent's absolute position
    function walkBone(bone: BoneDefinition, parentAbsX: number, parentAbsY: number): void {
      const absPart = absProfile.parts[bone.name];
      if (!absPart) return;

      // Compute relative position
      relParts[bone.name] = {
        ...absPart,
        x: absPart.x - parentAbsX,
        y: absPart.y - parentAbsY,
      };

      // Recurse into children with this bone's absolute position as the parent
      if (bone.children) {
        for (const child of bone.children) {
          walkBone(child, absPart.x, absPart.y);
        }
      }
    }

    // Root bone: parent is at origin (0, 0)
    walkBone(skeleton, 0, 0);

    result[dir] = relParts;
  }

  return result;
}

/** Format a number for output — strip trailing .0 for integers. */
function n(val: number): string {
  if (Number.isInteger(val)) return val.toString();
  return val.toString();
}

/** Generate a PartProfile literal string. */
function profileLiteral(p: PartProfile): string {
  let s = `{ x: ${n(p.x)}, y: ${n(p.y)}, scaleX: ${n(p.scaleX)}, scaleY: ${n(p.scaleY)}, rotation: ${n(p.rotation)}, depth: ${n(p.depth)}, visible: ${p.visible}`;
  if (p.alpha !== undefined && p.alpha !== 1) {
    s += `, alpha: ${n(p.alpha)}`;
  }
  s += ' }';
  return s;
}

/** Collect all part names in tree order (depth-first). */
function collectPartNames(bone: BoneDefinition): string[] {
  const names = [bone.name];
  if (bone.children) {
    for (const child of bone.children) {
      names.push(...collectPartNames(child));
    }
  }
  return names;
}

/** Check if a part is a foot subtree member. */
function isFootPart(name: string): boolean {
  return /-(ankle|paw|toe-[1-4])$/.test(name);
}

/** Get the leg prefix from a foot part name. */
function getLegPrefix(name: string): string {
  return name.replace(/-(ankle|paw|toe-[1-4])$/, '');
}

/** Check if all foot parts for a leg prefix are hidden (not visible in any direction). */
function isHiddenFoot(parts: Record<string, PartProfile>, prefix: string): boolean {
  const footNames = [`${prefix}-ankle`, `${prefix}-paw`,
    `${prefix}-toe-1`, `${prefix}-toe-2`, `${prefix}-toe-3`, `${prefix}-toe-4`];
  return footNames.every(n => {
    const p = parts[n];
    return !p || !p.visible;
  });
}

/** Generate a legFoot() call or HIDDEN_FOOT for a leg prefix. */
function generateLegFoot(parts: Record<string, PartProfile>, prefix: string, indent: string): string {
  if (isHiddenFoot(parts, prefix)) {
    return `${indent}...legFoot('${prefix}', HIDDEN_FOOT),`;
  }

  const ankle = parts[`${prefix}-ankle`];
  const paw = parts[`${prefix}-paw`];
  const toes = [1, 2, 3, 4].map(i => parts[`${prefix}-toe-${i}`]);

  const lines: string[] = [];
  lines.push(`${indent}...legFoot('${prefix}', {`);
  lines.push(`${indent}  ankle: ${profileLiteral(ankle)},`);
  lines.push(`${indent}  paw:   ${profileLiteral(paw)},`);
  lines.push(`${indent}  toes: [`);
  for (const toe of toes) {
    lines.push(`${indent}    ${profileLiteral(toe)},`);
  }
  lines.push(`${indent}  ],`);
  lines.push(`${indent}}),`);
  return lines.join('\n');
}

/** Generate a profile constant. */
function generateProfile(
  varName: string,
  dirLabel: string,
  comment: string,
  parts: Record<string, PartProfile>,
  skeleton: BoneDefinition,
): string {
  const allNames = collectPartNames(skeleton);
  const lines: string[] = [];
  lines.push(`const ${varName}: DirectionProfile = {`);
  lines.push(`  parts: {`);
  lines.push(`    // ${comment}`);
  lines.push(`    // All positions are parent-relative (relative to parent bone in skeleton hierarchy).`);

  // Group: non-foot parts first, then foot parts by leg prefix
  const nonFootParts = allNames.filter(n => !isFootPart(n));
  const legPrefixes: string[] = [];
  const seenPrefixes = new Set<string>();
  for (const name of allNames) {
    if (isFootPart(name)) {
      const prefix = getLegPrefix(name);
      if (!seenPrefixes.has(prefix)) {
        seenPrefixes.add(prefix);
        legPrefixes.push(prefix);
      }
    }
  }

  // Non-foot parts
  for (const name of nonFootParts) {
    const p = parts[name];
    if (!p) continue;
    const paddedName = `'${name}':`.padEnd(26);
    lines.push(`    ${paddedName}${profileLiteral(p)},`);
  }

  // Foot parts grouped by legFoot
  for (const prefix of legPrefixes) {
    lines.push(generateLegFoot(parts, prefix, '    '));
  }

  lines.push(`  },`);
  lines.push(`};`);
  return lines.join('\n');
}

function main(): void {
  const relProfiles = computeRelativeProfiles(
    foxRigDefinition.skeleton,
    foxRigDefinition.profiles,
  );

  // Verify: resolve relative back to absolute and compare
  let errors = 0;
  for (const dir of DIRECTIONS) {
    const absProfile = foxRigDefinition.profiles[dir];
    const relParts = relProfiles[dir];

    function verifyBone(bone: BoneDefinition, parentAbsX: number, parentAbsY: number): void {
      const relPart = relParts[bone.name];
      const absPart = absProfile.parts[bone.name];
      if (!relPart || !absPart) return;

      const resolvedX = parentAbsX + relPart.x;
      const resolvedY = parentAbsY + relPart.y;

      if (Math.abs(resolvedX - absPart.x) > 0.001 || Math.abs(resolvedY - absPart.y) > 0.001) {
        console.error(`MISMATCH ${dir}/${bone.name}: resolved (${resolvedX}, ${resolvedY}) != absolute (${absPart.x}, ${absPart.y})`);
        errors++;
      }

      if (bone.children) {
        for (const child of bone.children) {
          verifyBone(child, absPart.x, absPart.y);
        }
      }
    }

    verifyBone(foxRigDefinition.skeleton, 0, 0);
  }

  if (errors > 0) {
    console.error(`\n${errors} verification errors — aborting.`);
    process.exit(1);
  }
  console.log('Verification passed: all relative profiles resolve to original absolute positions.');

  // Generate new fox.ts content
  const profileComments: Record<string, string> = {
    S: 'Front-facing: wide body, face visible, 2 front legs with splayed toes, tail hidden',
    N: 'Back-facing: tail prominent, back of head, back legs with toes visible',
    E: 'Side-facing (right): full body profile, 4 legs, 2 toes per paw (side view)',
    SE: 'Diagonal front-right: mix of front and side, 3 toes on near paws, 2 on far',
    NE: 'Diagonal back-right: back of head, tail visible, rear emphasis, 2-3 toes',
  };

  const profileCode = [
    generateProfile('profileS', 'S', profileComments.S, relProfiles.S, foxRigDefinition.skeleton),
    '',
    generateProfile('profileN', 'N', profileComments.N, relProfiles.N, foxRigDefinition.skeleton),
    '',
    generateProfile('profileE', 'E', profileComments.E, relProfiles.E, foxRigDefinition.skeleton),
    '',
    generateProfile('profileSE', 'SE', profileComments.SE, relProfiles.SE, foxRigDefinition.skeleton),
    '',
    generateProfile('profileNE', 'NE', profileComments.NE, relProfiles.NE, foxRigDefinition.skeleton),
  ].join('\n');

  // Read the original fox.ts and replace profiles section
  const foxPath = path.join(__dirname, '..', 'src', 'rig', 'characters', 'fox.ts');
  const original = fs.readFileSync(foxPath, 'utf-8');

  // Find the profiles section: from "// --- Direction profiles ---" to the "const profiles:" line
  const profilesStart = original.indexOf('// --- Direction profiles ---');
  const profilesMapLine = 'const profiles: Record<UniqueDirection, DirectionProfile> = {';
  const profilesMapIdx = original.indexOf(profilesMapLine);

  if (profilesStart === -1 || profilesMapIdx === -1) {
    console.error('Could not find profile section markers in fox.ts');
    process.exit(1);
  }

  const newContent =
    original.substring(0, profilesStart) +
    '// --- Direction profiles ---\n' +
    '// All positions are parent-relative (relative to parent bone in skeleton hierarchy).\n' +
    '// Root bone (body) is relative to container center (0,0).\n' +
    '// Use tools/migrate-to-relative.ts to regenerate from absolute positions.\n\n' +
    profileCode + '\n\n' +
    original.substring(profilesMapIdx);

  fs.writeFileSync(foxPath, newContent, 'utf-8');
  console.log(`Updated ${foxPath} with parent-relative profiles.`);

  // Print a summary of changes
  console.log('\nSample changes (S profile):');
  const sampleParts = ['body', 'neck', 'head', 'snout', 'shoulders', 'front-left-upper-leg'];
  for (const name of sampleParts) {
    const abs = foxRigDefinition.profiles.S.parts[name];
    const rel = relProfiles.S[name];
    if (abs && rel) {
      console.log(`  ${name}: (${abs.x}, ${abs.y}) → (${rel.x}, ${rel.y})`);
    }
  }
}

main();
