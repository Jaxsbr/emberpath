import { TILE_SIZE } from '../maps/constants';
import { TriggerDefinition } from '../data/areas/types';
import { getFlag, setFlag } from '../triggers/flags';
import { evaluateCondition } from './conditions';

export interface TriggerCallbacks {
  onDialogue: (actionRef: string) => void;
  onStory: (actionRef: string) => void;
  onThought: (actionRef: string) => void;
}

export class TriggerZoneSystem {
  private triggers: TriggerDefinition[];
  private callbacks: TriggerCallbacks;
  private insideZones: Set<string> = new Set();
  private dialogueActiveCheck: (() => boolean) | null = null;

  constructor(triggers: TriggerDefinition[], callbacks: TriggerCallbacks) {
    this.triggers = triggers;
    this.callbacks = callbacks;
  }

  setDialogueActiveCheck(check: () => boolean): void {
    this.dialogueActiveCheck = check;
  }

  update(playerX: number, playerY: number, playerWidth: number, playerHeight: number): void {
    // Suppress triggers while dialogue is active (zone-level mutual exclusion)
    if (this.dialogueActiveCheck && this.dialogueActiveCheck()) return;

    const currentlyInside = new Set<string>();

    for (const trigger of this.triggers) {
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
    if (trigger.condition && !evaluateCondition(trigger.condition)) {
      return;
    }

    // Mark one-shot triggers as fired
    if (!trigger.repeatable) {
      setFlag(`_trigger_fired_${trigger.id}`, true);
    }

    // Dispatch by type
    console.log('[trigger] firing:', trigger.id, 'type:', trigger.type);
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

}
