import { describe, it, expect } from 'vitest';
import { validateTriggerSave, isValidTrigger, sanitizeAreaId } from '../vite-plugins/trigger-save';

const good = {
  id: 'bridge-cross',
  col: 4,
  row: 5,
  width: 2,
  height: 1,
  type: 'thought',
  actionRef: 'The grey lifts.',
  repeatable: false,
};

describe('trigger-save — areaId sanitisation', () => {
  it('accepts a kebab area id', () => {
    expect(sanitizeAreaId('ashen-isle')).toBe('ashen-isle');
  });
  it('rejects traversal and bad chars', () => {
    expect(sanitizeAreaId('../etc/passwd')).toBeNull();
    expect(sanitizeAreaId('Ashen_Isle')).toBeNull();
    expect(sanitizeAreaId(42)).toBeNull();
  });
});

describe('trigger-save — trigger validation', () => {
  it('accepts a well-formed trigger', () => {
    expect(isValidTrigger(good)).toBe(true);
  });
  it('rejects a missing type / coords', () => {
    expect(isValidTrigger({ ...good, type: 'nope' })).toBe(false);
    expect(isValidTrigger({ ...good, col: 'x' })).toBe(false);
    expect(isValidTrigger({ ...good, width: 0 })).toBe(false);
  });
  it('rejects a non-boolean repeatable', () => {
    expect(isValidTrigger({ ...good, repeatable: 'yes' })).toBe(false);
  });
  it('accepts optional condition / setFlags / incrementFlags', () => {
    expect(isValidTrigger({ ...good, condition: 'a == true', setFlags: { x: true }, incrementFlags: ['n'] })).toBe(true);
  });
  it('rejects a setFlags array or string', () => {
    expect(isValidTrigger({ ...good, setFlags: ['a'] })).toBe(false);
  });
});

describe('trigger-save — payload validation', () => {
  it('accepts a valid payload', () => {
    const r = validateTriggerSave({ areaId: 'ashen-isle', triggers: [good] });
    expect(r.ok).toBe(true);
  });
  it('rejects a bad areaId, writing nothing', () => {
    expect(validateTriggerSave({ areaId: '../x', triggers: [good] }).ok).toBe(false);
  });
  it('rejects a malformed trigger', () => {
    expect(validateTriggerSave({ areaId: 'ashen-isle', triggers: [{ ...good, type: 'bad' }] }).ok).toBe(false);
  });
  it('rejects duplicate ids in one payload', () => {
    const r = validateTriggerSave({ areaId: 'ashen-isle', triggers: [good, good] });
    expect(r.ok).toBe(false);
  });
  it('accepts an empty triggers array (clears the sidecar)', () => {
    expect(validateTriggerSave({ areaId: 'ashen-isle', triggers: [] }).ok).toBe(true);
  });
});
