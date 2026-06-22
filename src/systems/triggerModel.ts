import type { LightSpec, TriggerDefinition, TriggerType } from '../data/areas/types';
import { CONDITION_OPS, coerceFlagValue, type ConditionOp } from './conditions';

// Editor P3 (#187) — the pure model the Triggers authoring tab edits, plus the
// compile/parse bridge to the on-disk TriggerDefinition. This is the correctness
// floor of the whole tool: a non-coder edits the structured form, and these
// functions translate it to/from the EXACT condition string + fields the runtime
// already consumes (systems/conditions.ts, systems/triggerZone.ts). No second
// grammar — it builds on conditions.ts's operators and value coercion, so a
// trigger authored in the editor evaluates byte-identically to one hand-written
// in a TypeScript area file.
//
// Pure + dependency-free of the DOM (the tab's form binding lives in
// tools/editor/src/triggerForm.ts and calls these). Re-exported here so callers
// import the grammar constants from one place.
export { CONDITION_OPS, type ConditionOp };

export const TRIGGER_TYPES: TriggerType[] = ['dialogue', 'story', 'thought', 'exit'];

// One clause of a condition: `flag op value`. `value` is the author's raw string
// (coerced at evaluate time by conditions.ts) — kept raw so round-tripping never
// mangles intent (the string "01" stays "01", not 1).
export interface ConditionClause {
  flag: string;
  op: ConditionOp;
  value: string;
}

export interface SetFlagEntry {
  name: string;
  value: string;
}

// The full editable shape of one trigger. Mirrors TriggerDefinition field-for-
// field except `condition` is decomposed into `clauses` (the form's clause rows)
// and `setFlags` is a list (form rows) rather than a record.
export interface TriggerFormModel {
  id: string;
  col: number;
  row: number;
  width: number;
  height: number;
  type: TriggerType;
  actionRef: string;
  repeatable: boolean;
  clauses: ConditionClause[];
  setFlags: SetFlagEntry[];
  incrementFlags: string[];
  light?: LightSpec;
}

export interface ParseResult {
  clauses: ConditionClause[];
  errors: string[];
}

// Same clause grammar as conditions.ts (operators in two-char-first order so
// `>=` is matched before `>`). Kept in lock-step with that module via the shared
// CONDITION_OPS export — see the test that asserts every compiled clause both
// parses back AND evaluates as intended.
const CLAUSE_RE = /^(\S+)\s*(==|>=|>|<=|<|!=)\s*(.+)$/;

// ---- condition: form clauses <-> grammar string ----------------------------

// Compile clause rows to the canonical condition string, or `undefined` for no
// condition (an always-on trigger). Blank rows (no flag) are dropped so a
// half-filled form never emits a malformed clause.
export function compileCondition(clauses: ConditionClause[]): string | undefined {
  const parts = clauses
    .filter((c) => c.flag.trim() !== '')
    .map((c) => `${c.flag.trim()} ${c.op} ${c.value.trim()}`);
  return parts.length > 0 ? parts.join(' AND ') : undefined;
}

// Parse a stored condition string back into clause rows. Accepts every spacing
// variant the runtime accepts; an unparseable clause is reported in `errors`
// (and skipped) rather than thrown, so loading legacy data never hard-fails the
// editor.
export function parseCondition(condition: string | undefined): ParseResult {
  const errors: string[] = [];
  const clauses: ConditionClause[] = [];
  if (!condition || condition.trim() === '') return { clauses, errors };
  for (const rawClause of condition.split(/\s+AND\s+/)) {
    const clause = rawClause.trim();
    if (clause === '') continue;
    const m = clause.match(CLAUSE_RE);
    if (!m) {
      errors.push(`Unparseable clause: "${clause}"`);
      continue;
    }
    clauses.push({ flag: m[1], op: m[2] as ConditionOp, value: m[3].trim() });
  }
  return { clauses, errors };
}

// ---- effect: form model <-> TriggerDefinition ------------------------------

// Build the on-disk TriggerDefinition from the form. Omits empty optional fields
// so a sidecar is minimal and diffs cleanly. setFlags values are coerced through
// the SAME helper the runtime evaluates with, so `"true"` lands as boolean true.
export function toTriggerDefinition(form: TriggerFormModel): TriggerDefinition {
  const def: TriggerDefinition = {
    id: form.id.trim(),
    col: form.col,
    row: form.row,
    width: form.width,
    height: form.height,
    type: form.type,
    actionRef: form.actionRef.trim(),
    repeatable: form.repeatable,
  };
  const condition = compileCondition(form.clauses);
  if (condition !== undefined) def.condition = condition;

  const setFlags = form.setFlags.filter((f) => f.name.trim() !== '');
  if (setFlags.length > 0) {
    def.setFlags = {};
    for (const f of setFlags) def.setFlags[f.name.trim()] = coerceFlagValue(f.value.trim());
  }

  const inc = form.incrementFlags.map((s) => s.trim()).filter((s) => s !== '');
  if (inc.length > 0) def.incrementFlags = inc;

  if (form.light) def.light = form.light;
  return def;
}

// Inverse of toTriggerDefinition: hydrate the form from stored data. The
// id/coords/type/etc. round-trip exactly; `condition` is decomposed back into
// clause rows; `setFlags` record becomes form rows (values stringified for the
// text inputs).
export function fromTriggerDefinition(def: TriggerDefinition): { form: TriggerFormModel; errors: string[] } {
  const { clauses, errors } = parseCondition(def.condition);
  const form: TriggerFormModel = {
    id: def.id,
    col: def.col,
    row: def.row,
    width: def.width,
    height: def.height,
    type: def.type,
    actionRef: def.actionRef,
    repeatable: def.repeatable,
    clauses,
    setFlags: def.setFlags
      ? Object.entries(def.setFlags).map(([name, value]) => ({ name, value: String(value) }))
      : [],
    incrementFlags: def.incrementFlags ? [...def.incrementFlags] : [],
    light: def.light,
  };
  return { form, errors };
}

// A fresh empty form for a newly-placed zone at the given tile rect.
export function emptyTriggerForm(id: string, col: number, row: number, width = 1, height = 1): TriggerFormModel {
  return {
    id,
    col,
    row,
    width,
    height,
    type: 'thought',
    actionRef: '',
    repeatable: false,
    clauses: [],
    setFlags: [],
    incrementFlags: [],
  };
}
