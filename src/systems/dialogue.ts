import Phaser from 'phaser';
import { DialogueScript, DialogueNode, DialogueChoice } from '../data/dialogues';

const BOX_HEIGHT = 120;
const BOX_Y = 480; // bottom of 600px canvas
const BOX_PADDING = 12;
const SPEAKER_FONT_SIZE = 14;
const TEXT_FONT_SIZE = 16;
const CHOICE_FONT_SIZE = 14;
const CHARS_PER_SECOND = 30;
const BOX_COLOR = 0x111122;
const BOX_ALPHA = 0.9;
const DEPTH = 200;

export class DialogueSystem {
  private scene: Phaser.Scene;
  private active = false;
  private script: DialogueScript | null = null;
  private currentNode: DialogueNode | null = null;

  // UI elements
  private boxGraphics: Phaser.GameObjects.Graphics | null = null;
  private speakerText: Phaser.GameObjects.Text | null = null;
  private dialogueText: Phaser.GameObjects.Text | null = null;
  private choiceTexts: Phaser.GameObjects.Text[] = [];
  private selectedChoiceIndex = 0;

  // Typewriter state
  private fullText = '';
  private revealedCount = 0;
  private typewriterTimer: Phaser.Time.TimerEvent | null = null;
  private typewriterComplete = false;

  // Input
  private spaceKey: Phaser.Input.Keyboard.Key | null = null;
  private upKey: Phaser.Input.Keyboard.Key | null = null;
  private downKey: Phaser.Input.Keyboard.Key | null = null;
  private enterKey: Phaser.Input.Keyboard.Key | null = null;
  private tapDownTime = 0;
  private tapDownPos = { x: 0, y: 0 };

  // Callbacks
  private onEndCallback: (() => void) | null = null;
  private onChoiceCallback: ((choice: DialogueChoice) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.setupInput();
  }

  get isActive(): boolean {
    return this.active;
  }

  setOnEnd(cb: () => void): void {
    this.onEndCallback = cb;
  }

  setOnChoice(cb: (choice: DialogueChoice) => void): void {
    this.onChoiceCallback = cb;
  }

  start(script: DialogueScript): void {
    if (this.active) return;
    this.active = true;
    this.script = script;
    this.createBox();
    const startNode = script.nodes.find(n => n.id === script.startNodeId);
    if (startNode) {
      this.showNode(startNode);
    }
  }

  private setupInput(): void {
    if (this.scene.input.keyboard) {
      this.spaceKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.upKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
      this.downKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
      this.enterKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    }

    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.active) return;
      this.tapDownTime = pointer.downTime;
      this.tapDownPos = { x: pointer.x, y: pointer.y };
    });

    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.active) return;
      const duration = pointer.upTime - this.tapDownTime;
      const dx = pointer.x - this.tapDownPos.x;
      const dy = pointer.y - this.tapDownPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (duration < 300 && distance < 15) {
        this.handleAdvance();
      }
    });
  }

  update(): void {
    if (!this.active) return;

    if (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.handleAdvance();
    }

    if (this.currentNode?.choices && this.typewriterComplete) {
      if (this.upKey && Phaser.Input.Keyboard.JustDown(this.upKey)) {
        this.moveChoiceSelection(-1);
      }
      if (this.downKey && Phaser.Input.Keyboard.JustDown(this.downKey)) {
        this.moveChoiceSelection(1);
      }
      if (this.enterKey && Phaser.Input.Keyboard.JustDown(this.enterKey)) {
        this.selectChoice();
      }
    }
  }

  private handleAdvance(): void {
    if (!this.typewriterComplete) {
      this.completeTypewriter();
      return;
    }

    if (this.currentNode?.choices) {
      this.selectChoice();
      return;
    }

    if (this.currentNode?.nextId) {
      const nextNode = this.script!.nodes.find(n => n.id === this.currentNode!.nextId);
      if (nextNode) {
        this.showNode(nextNode);
        return;
      }
    }

    this.close();
  }

  private showNode(node: DialogueNode): void {
    this.currentNode = node;
    this.clearChoices();

    if (this.speakerText) {
      this.speakerText.setText(node.speaker);
    }

    this.fullText = node.text;
    this.revealedCount = 0;
    this.typewriterComplete = false;

    if (this.dialogueText) {
      this.dialogueText.setText('');
    }

    this.typewriterTimer?.destroy();
    this.typewriterTimer = this.scene.time.addEvent({
      delay: 1000 / CHARS_PER_SECOND,
      callback: () => {
        this.revealedCount++;
        if (this.dialogueText) {
          this.dialogueText.setText(this.fullText.substring(0, this.revealedCount));
        }
        if (this.revealedCount >= this.fullText.length) {
          this.typewriterComplete = true;
          this.typewriterTimer?.destroy();
          this.typewriterTimer = null;
          if (node.choices) {
            this.showChoices(node.choices);
          }
        }
      },
      loop: true,
    });
  }

  private completeTypewriter(): void {
    this.typewriterTimer?.destroy();
    this.typewriterTimer = null;
    this.revealedCount = this.fullText.length;
    this.typewriterComplete = true;
    if (this.dialogueText) {
      this.dialogueText.setText(this.fullText);
    }
    if (this.currentNode?.choices) {
      this.showChoices(this.currentNode.choices);
    }
  }

  private showChoices(choices: DialogueChoice[]): void {
    this.clearChoices();
    this.selectedChoiceIndex = 0;
    const startY = BOX_Y + BOX_PADDING + 50;

    for (let i = 0; i < choices.length; i++) {
      const choiceText = this.scene.add.text(
        BOX_PADDING + 20,
        startY + i * 22,
        `${i === 0 ? '> ' : '  '}${choices[i].text}`,
        {
          fontSize: `${CHOICE_FONT_SIZE}px`,
          color: i === 0 ? '#ffdd44' : '#aaaaaa',
        },
      );
      choiceText.setScrollFactor(0);
      choiceText.setDepth(DEPTH);
      choiceText.setInteractive();
      choiceText.on('pointerdown', () => {
        this.selectedChoiceIndex = i;
        this.updateChoiceHighlight();
        this.selectChoice();
      });
      this.choiceTexts.push(choiceText);
    }
  }

  private moveChoiceSelection(dir: number): void {
    if (this.choiceTexts.length === 0) return;
    this.selectedChoiceIndex = (this.selectedChoiceIndex + dir + this.choiceTexts.length) % this.choiceTexts.length;
    this.updateChoiceHighlight();
  }

  private updateChoiceHighlight(): void {
    if (!this.currentNode?.choices) return;
    for (let i = 0; i < this.choiceTexts.length; i++) {
      const prefix = i === this.selectedChoiceIndex ? '> ' : '  ';
      this.choiceTexts[i].setText(`${prefix}${this.currentNode.choices[i].text}`);
      this.choiceTexts[i].setColor(i === this.selectedChoiceIndex ? '#ffdd44' : '#aaaaaa');
    }
  }

  private selectChoice(): void {
    if (!this.currentNode?.choices || this.choiceTexts.length === 0) return;
    const choice = this.currentNode.choices[this.selectedChoiceIndex];
    if (this.onChoiceCallback) {
      this.onChoiceCallback(choice);
    }
    const nextNode = this.script!.nodes.find(n => n.id === choice.nextId);
    if (nextNode) {
      this.showNode(nextNode);
    } else {
      this.close();
    }
  }

  private createBox(): void {
    this.boxGraphics = this.scene.add.graphics();
    this.boxGraphics.setScrollFactor(0);
    this.boxGraphics.setDepth(DEPTH);
    this.boxGraphics.fillStyle(BOX_COLOR, BOX_ALPHA);
    this.boxGraphics.fillRect(0, BOX_Y, 800, BOX_HEIGHT);

    this.speakerText = this.scene.add.text(BOX_PADDING, BOX_Y - 20, '', {
      fontSize: `${SPEAKER_FONT_SIZE}px`,
      color: '#ffdd44',
      fontStyle: 'bold',
    });
    this.speakerText.setScrollFactor(0);
    this.speakerText.setDepth(DEPTH);

    this.dialogueText = this.scene.add.text(BOX_PADDING, BOX_Y + BOX_PADDING, '', {
      fontSize: `${TEXT_FONT_SIZE}px`,
      color: '#ffffff',
      wordWrap: { width: 800 - BOX_PADDING * 2 },
    });
    this.dialogueText.setScrollFactor(0);
    this.dialogueText.setDepth(DEPTH);
  }

  private clearChoices(): void {
    for (const ct of this.choiceTexts) {
      ct.destroy();
    }
    this.choiceTexts = [];
    this.selectedChoiceIndex = 0;
  }

  private close(): void {
    this.typewriterTimer?.destroy();
    this.typewriterTimer = null;
    this.boxGraphics?.destroy();
    this.boxGraphics = null;
    this.speakerText?.destroy();
    this.speakerText = null;
    this.dialogueText?.destroy();
    this.dialogueText = null;
    this.clearChoices();
    this.active = false;
    this.script = null;
    this.currentNode = null;
    if (this.onEndCallback) {
      this.onEndCallback();
    }
  }

  destroy(): void {
    this.close();
  }
}
