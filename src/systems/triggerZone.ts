import { TILE_SIZE } from '../maps/constants';
import { triggers, TriggerDefinition } from '../data/triggers';
import { getFlag, setFlag } from '../triggers/flags';

export interface TriggerCallbacks {
  onDialogue: (actionRef: string) => void;
  onStory: (actionRef: string) => void;
  onThought: (actionRef: string) => void;
}

export class TriggerZoneSystem {
  private callbacks: TriggerCallbacks;
  private insideZones: Set<string> = new Set(); // tracks which zones the player is currently inside
  private dialogueActiveCheck: (() => boolean) | null = null;

  constructor(callbacks: TriggerCallbacks) {
    this.callbacks = callbacks;
  }

  setDialogueActiveCheck(check: () => boolean): void {
    this.dialogueActiveCheck = check;
  }

  update(playerX: number, playerY: number, playerWidth: number, playerHeight: number): void {
    // Suppress triggers while dialogue is active (zone-level mutual exclusion)
    if (this.dialogueActiveCheck && this.dialogueActiveCheck()) return;

    const currentlyInside = new Set<string>();

    for (const trigger of triggers) {
      const zoneX = trigger.col * TILE_SIZE;
      const zoneY = trigger.row * TILE_SIZE;
      const zoneW = trigger.width * TILE_SIZE;
      const zoneH = trigger.height * TILE_SIZE;

      const overlaps =
        playerX < zoneX + zoneW &&
        playerX + playerWidth > zoneX &&
        playerY < zoneY + zoneH &&
        playerY + playerHeight > zoneY;

      if (overlaps) {
        currentlyInside.add(trigger.id);

        // Only fire on entry (not while standing inside)
        if (!this.insideZones.has(trigger.id)) {
          this.tryFire(trigger);
        }
      }
    }

    this.insideZones = currentlyInside;
  }

  private tryFire(trigger: TriggerDefinition): void {
    // Check one-shot: if not repeatable and already fired, skip
    if (!trigger.repeatable) {
      const firedFlag = getFlag(`_trigger_fired_${trigger.id}`);
      if (firedFlag === true) return;
    }

    // Check condition
    if (trigger.condition && !this.evaluateCondition(trigger.condition)) {
      return;
    }

    // Mark one-shot triggers as fired
    if (!trigger.repeatable) {
      setFlag(`_trigger_fired_${trigger.id}`, true);
    }

    // Dispatch by type
    switch (trigger.type) {
      case 'dialogue':
        this.callbacks.onDialogue(trigger.actionRef);
        break;
      case 'story':
        this.callbacks.onStory(trigger.actionRef);
        break;
      case 'thought':
        this.callbacks.onThought(trigger.actionRef);
        break;
    }
  }

  private evaluateCondition(condition: string): boolean {
    // Parse conditions: "flag == value AND flag2 >= value2"
    const clauses = condition.split(/\s+AND\s+/);
    for (const clause of clauses) {
      if (!this.evaluateClause(clause.trim())) {
        return false;
      }
    }
    return true;
  }

  private evaluateClause(clause: string): boolean {
    // Match: flagName operator value
    const match = clause.match(/^(\S+)\s*(==|>=|>|<=|<|!=)\s*(.+)$/);
    if (!match) return false;

    const [, flagName, operator, rawValue] = match;
    const flagValue = getFlag(flagName);

    // Parse the expected value
    let expected: string | number | boolean;
    if (rawValue === 'true') expected = true;
    else if (rawValue === 'false') expected = false;
    else if (!isNaN(Number(rawValue))) expected = Number(rawValue);
    else expected = rawValue;

    // If flag doesn't exist, treat as false/0/""
    const actual = flagValue ?? (typeof expected === 'boolean' ? false : typeof expected === 'number' ? 0 : '');

    switch (operator) {
      case '==': return actual === expected;
      case '!=': return actual !== expected;
      case '>=': return Number(actual) >= Number(expected);
      case '>': return Number(actual) > Number(expected);
      case '<=': return Number(actual) <= Number(expected);
      case '<': return Number(actual) < Number(expected);
      default: return false;
    }
  }
}
