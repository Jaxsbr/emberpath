import Phaser from 'phaser';
import { DialogueScript, DialogueNode, DialogueChoice } from '../data/dialogues';

const BOX_HEIGHT = 120;
const BOX_PADDING = 12;
const SPEAKER_FONT_SIZE = 14;
const TEXT_FONT_SIZE = 16;
const CHOICE_FONT_SIZE = 14;
const CHARS_PER_SECOND = 30;
const BOX_COLOR = 0x111122;
const BOX_ALPHA = 0.9;
const DEPTH = 200;

// Mobile choice layout
const MOBILE_CHOICE_HEIGHT = 44;
const MOBILE_CHOICE_GAP = 2;
const MOBILE_CONFIRM_HEIGHT = 44;
const MOBILE_CHOICE_BG = 0x1a1a33;
const MOBILE_CHOICE_HIGHLIGHT_BG = 0x2a2a55;
const MOBILE_CONFIRM_BG = 0x334422;
const CHOICE_TEXT_OFFSET_TOP = 60; // vertical offset from box top to first choice row

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

  // Mobile choice elements
  private isTouchDevice: boolean;
  private currentBoxHeight = BOX_HEIGHT;
  private mobileChoicesActive = false;
  private mobileHighlightIndex = -1;
  private choiceBgs: Phaser.GameObjects.Rectangle[] = [];
  private confirmBg: Phaser.GameObjects.Rectangle | null = null;
  private confirmLabel: Phaser.GameObjects.Text | null = null;

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
  private choiceJustSelected = false;

  // Close guard — prevents NPC interaction from restarting dialogue on the same tap
  private lastCloseTime = 0;

  // Callbacks
  private onEndCallback: (() => void) | null = null;
  private onChoiceCallback: ((choice: DialogueChoice) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.isTouchDevice = scene.sys.game.device.input.touch;
    this.setupInput();
    this.scene.scale.on('resize', this.handleResize, this);
    this.scene.events.on('shutdown', this.cleanupResize, this);
    this.scene.events.on('destroy', this.cleanupResize, this);
  }

  /** Scale a design-pixel value to canvas pixels using the main camera's zoom. */
  private s(v: number): number {
    return v * this.scene.cameras.main.zoom;
  }

  private get boxY(): number {
    return this.scene.scale.height - this.s(this.currentBoxHeight);
  }

  private get canvasWidth(): number {
    return this.scene.scale.width;
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
    if (this.scene.time.now - this.lastCloseTime < 100) return;
    this.active = true;
    this.script = script;
    this.currentBoxHeight = BOX_HEIGHT;
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
      if (this.choiceJustSelected) {
        this.choiceJustSelected = false;
        return;
      }
      // On mobile with choices active, don't advance from general taps
      if (this.mobileChoicesActive) return;
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
      if (this.isTouchDevice) return; // Mobile: choices handle their own input
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

    // Reset box to normal height when showing a new node
    this.currentBoxHeight = BOX_HEIGHT;
    this.redrawBox();

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

    if (this.isTouchDevice) {
      this.showMobileChoices(choices);
    } else {
      this.showDesktopChoices(choices);
    }
  }

  private showDesktopChoices(choices: DialogueChoice[]): void {
    this.selectedChoiceIndex = 0;
    const startY = this.boxY + this.s(BOX_PADDING + 50);

    for (let i = 0; i < choices.length; i++) {
      const choiceText = this.scene.add.text(
        this.s(BOX_PADDING + 20),
        startY + i * this.s(22),
        `${i === 0 ? '> ' : '  '}${choices[i].text}`,
        {
          fontSize: `${this.s(CHOICE_FONT_SIZE)}px`,
          color: i === 0 ? '#ffdd44' : '#aaaaaa',
        },
      );
      choiceText.setScrollFactor(0);
      choiceText.setDepth(DEPTH);
      this.ignoreOnMainCamera(choiceText);
      choiceText.setInteractive();
      choiceText.on('pointerdown', () => {
        this.selectedChoiceIndex = i;
        this.updateDesktopChoiceHighlight();
        this.selectChoice();
      });
      this.choiceTexts.push(choiceText);
    }
  }

  private showMobileChoices(choices: DialogueChoice[]): void {
    this.mobileChoicesActive = true;
    this.mobileHighlightIndex = -1;
    this.selectedChoiceIndex = 0;

    // Calculate expanded box height (design pixels — scaled via s() when rendering)
    const choiceAreaHeight = choices.length * (MOBILE_CHOICE_HEIGHT + MOBILE_CHOICE_GAP)
      + MOBILE_CONFIRM_HEIGHT + MOBILE_CHOICE_GAP;
    this.currentBoxHeight = CHOICE_TEXT_OFFSET_TOP + choiceAreaHeight + BOX_PADDING;
    this.redrawBox();

    const rowWidth = this.canvasWidth - this.s(BOX_PADDING) * 2;
    const startY = this.boxY + this.s(CHOICE_TEXT_OFFSET_TOP);

    for (let i = 0; i < choices.length; i++) {
      const rowY = startY + i * this.s(MOBILE_CHOICE_HEIGHT + MOBILE_CHOICE_GAP);

      const bg = this.scene.add.rectangle(
        this.s(BOX_PADDING), rowY, rowWidth, this.s(MOBILE_CHOICE_HEIGHT), MOBILE_CHOICE_BG,
      );
      bg.setOrigin(0, 0);
      bg.setScrollFactor(0);
      bg.setDepth(DEPTH);
      this.ignoreOnMainCamera(bg);
      bg.setInteractive();
      bg.on('pointerdown', () => {
        this.highlightMobileChoice(i);
      });
      this.choiceBgs.push(bg);

      const label = this.scene.add.text(
        this.s(BOX_PADDING * 2), rowY + (this.s(MOBILE_CHOICE_HEIGHT) - this.s(CHOICE_FONT_SIZE)) / 2,
        choices[i].text,
        {
          fontSize: `${this.s(CHOICE_FONT_SIZE)}px`,
          color: '#aaaaaa',
        },
      );
      label.setScrollFactor(0);
      label.setDepth(DEPTH);
      this.ignoreOnMainCamera(label);
      this.choiceTexts.push(label);
    }

    // Confirm button — initially hidden
    const confirmY = startY + choices.length * this.s(MOBILE_CHOICE_HEIGHT + MOBILE_CHOICE_GAP);
    this.confirmBg = this.scene.add.rectangle(
      this.s(BOX_PADDING), confirmY, rowWidth, this.s(MOBILE_CONFIRM_HEIGHT), MOBILE_CONFIRM_BG,
    );
    this.confirmBg.setOrigin(0, 0);
    this.confirmBg.setScrollFactor(0);
    this.confirmBg.setDepth(DEPTH);
    this.ignoreOnMainCamera(this.confirmBg);
    this.confirmBg.setInteractive();
    this.confirmBg.on('pointerdown', () => {
      if (this.mobileHighlightIndex >= 0) {
        this.selectedChoiceIndex = this.mobileHighlightIndex;
        this.selectChoice();
      }
    });
    this.confirmBg.setVisible(false);

    this.confirmLabel = this.scene.add.text(
      this.canvasWidth / 2, confirmY + this.s(MOBILE_CONFIRM_HEIGHT) / 2,
      'Confirm',
      {
        fontSize: `${this.s(CHOICE_FONT_SIZE)}px`,
        color: '#ffffff',
        fontStyle: 'bold',
      },
    );
    this.confirmLabel.setOrigin(0.5, 0.5);
    this.confirmLabel.setScrollFactor(0);
    this.confirmLabel.setDepth(DEPTH);
    this.ignoreOnMainCamera(this.confirmLabel);
    this.confirmLabel.setVisible(false);
  }

  private highlightMobileChoice(index: number): void {
    this.mobileHighlightIndex = index;

    // Update choice row backgrounds and text colors
    for (let i = 0; i < this.choiceBgs.length; i++) {
      const isHighlighted = i === index;
      this.choiceBgs[i].setFillStyle(isHighlighted ? MOBILE_CHOICE_HIGHLIGHT_BG : MOBILE_CHOICE_BG);
      if (this.choiceTexts[i]) {
        this.choiceTexts[i].setColor(isHighlighted ? '#ffdd44' : '#aaaaaa');
      }
    }

    // Show confirm button
    if (this.confirmBg) this.confirmBg.setVisible(true);
    if (this.confirmLabel) this.confirmLabel.setVisible(true);
  }

  private moveChoiceSelection(dir: number): void {
    if (this.choiceTexts.length === 0) return;
    this.selectedChoiceIndex = (this.selectedChoiceIndex + dir + this.choiceTexts.length) % this.choiceTexts.length;
    this.updateDesktopChoiceHighlight();
  }

  private updateDesktopChoiceHighlight(): void {
    if (!this.currentNode?.choices) return;
    for (let i = 0; i < this.choiceTexts.length; i++) {
      const prefix = i === this.selectedChoiceIndex ? '> ' : '  ';
      this.choiceTexts[i].setText(`${prefix}${this.currentNode.choices[i].text}`);
      this.choiceTexts[i].setColor(i === this.selectedChoiceIndex ? '#ffdd44' : '#aaaaaa');
    }
  }

  private selectChoice(): void {
    if (!this.currentNode?.choices || this.choiceTexts.length === 0) return;
    this.choiceJustSelected = true;
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
    this.boxGraphics.fillRect(0, this.boxY, this.canvasWidth, this.s(this.currentBoxHeight));
    this.ignoreOnMainCamera(this.boxGraphics);

    this.speakerText = this.scene.add.text(this.s(BOX_PADDING), this.boxY - this.s(20), '', {
      fontSize: `${this.s(SPEAKER_FONT_SIZE)}px`,
      color: '#ffdd44',
      fontStyle: 'bold',
    });
    this.speakerText.setScrollFactor(0);
    this.speakerText.setDepth(DEPTH);
    this.ignoreOnMainCamera(this.speakerText);

    this.dialogueText = this.scene.add.text(this.s(BOX_PADDING), this.boxY + this.s(BOX_PADDING), '', {
      fontSize: `${this.s(TEXT_FONT_SIZE)}px`,
      color: '#ffffff',
      wordWrap: { width: this.canvasWidth - this.s(BOX_PADDING) * 2 },
    });
    this.dialogueText.setScrollFactor(0);
    this.dialogueText.setDepth(DEPTH);
    this.ignoreOnMainCamera(this.dialogueText);
  }

  private redrawBox(): void {
    if (!this.boxGraphics) return;
    this.boxGraphics.clear();
    this.boxGraphics.fillStyle(BOX_COLOR, BOX_ALPHA);
    this.boxGraphics.fillRect(0, this.boxY, this.canvasWidth, this.s(this.currentBoxHeight));

    // Reposition text elements to match new box position
    if (this.speakerText) {
      this.speakerText.setPosition(this.s(BOX_PADDING), this.boxY - this.s(20));
      this.speakerText.setFontSize(this.s(SPEAKER_FONT_SIZE));
    }
    if (this.dialogueText) {
      this.dialogueText.setPosition(this.s(BOX_PADDING), this.boxY + this.s(BOX_PADDING));
      this.dialogueText.setFontSize(this.s(TEXT_FONT_SIZE));
      this.dialogueText.setWordWrapWidth(this.canvasWidth - this.s(BOX_PADDING) * 2);
    }
  }

  private handleResize(): void {
    if (!this.active) return;
    this.redrawBox();

    if (this.mobileChoicesActive && this.currentNode?.choices) {
      // Reposition mobile choice rows
      const rowWidth = this.canvasWidth - this.s(BOX_PADDING) * 2;
      const startY = this.boxY + this.s(CHOICE_TEXT_OFFSET_TOP);

      for (let i = 0; i < this.choiceBgs.length; i++) {
        const rowY = startY + i * this.s(MOBILE_CHOICE_HEIGHT + MOBILE_CHOICE_GAP);
        this.choiceBgs[i].setPosition(this.s(BOX_PADDING), rowY);
        this.choiceBgs[i].setSize(rowWidth, this.s(MOBILE_CHOICE_HEIGHT));
        if (this.choiceTexts[i]) {
          this.choiceTexts[i].setPosition(
            this.s(BOX_PADDING * 2), rowY + (this.s(MOBILE_CHOICE_HEIGHT) - this.s(CHOICE_FONT_SIZE)) / 2,
          );
          this.choiceTexts[i].setFontSize(this.s(CHOICE_FONT_SIZE));
        }
      }

      // Reposition confirm button
      if (this.confirmBg) {
        const confirmY = startY
          + this.currentNode.choices.length * this.s(MOBILE_CHOICE_HEIGHT + MOBILE_CHOICE_GAP);
        this.confirmBg.setPosition(this.s(BOX_PADDING), confirmY);
        this.confirmBg.setSize(rowWidth, this.s(MOBILE_CONFIRM_HEIGHT));
        if (this.confirmLabel) {
          this.confirmLabel.setPosition(this.canvasWidth / 2, confirmY + this.s(MOBILE_CONFIRM_HEIGHT) / 2);
          this.confirmLabel.setFontSize(this.s(CHOICE_FONT_SIZE));
        }
      }
    } else if (this.choiceTexts.length > 0) {
      // Reposition desktop choices
      const startY = this.boxY + this.s(BOX_PADDING + 50);
      for (let i = 0; i < this.choiceTexts.length; i++) {
        this.choiceTexts[i].setPosition(this.s(BOX_PADDING + 20), startY + i * this.s(22));
        this.choiceTexts[i].setFontSize(this.s(CHOICE_FONT_SIZE));
      }
    }
  }

  private clearChoices(): void {
    for (const ct of this.choiceTexts) {
      ct.destroy();
    }
    this.choiceTexts = [];
    this.selectedChoiceIndex = 0;

    // Clean up mobile choice elements
    for (const bg of this.choiceBgs) {
      bg.destroy();
    }
    this.choiceBgs = [];
    this.mobileHighlightIndex = -1;
    this.mobileChoicesActive = false;

    if (this.confirmBg) {
      this.confirmBg.destroy();
      this.confirmBg = null;
    }
    if (this.confirmLabel) {
      this.confirmLabel.destroy();
      this.confirmLabel = null;
    }
  }

  private close(): void {
    this.lastCloseTime = this.scene.time.now;
    this.typewriterTimer?.destroy();
    this.typewriterTimer = null;
    this.boxGraphics?.destroy();
    this.boxGraphics = null;
    this.speakerText?.destroy();
    this.speakerText = null;
    this.dialogueText?.destroy();
    this.dialogueText = null;
    this.clearChoices();
    this.currentBoxHeight = BOX_HEIGHT;
    this.active = false;
    this.script = null;
    this.currentNode = null;
    if (this.onEndCallback) {
      this.onEndCallback();
    }
  }

  private ignoreOnMainCamera(obj: Phaser.GameObjects.GameObject): void {
    this.scene.cameras.main.ignore(obj);
  }

  private cleanupResize(): void {
    this.scene.scale.off('resize', this.handleResize, this);
    this.scene.events.off('shutdown', this.cleanupResize, this);
    this.scene.events.off('destroy', this.cleanupResize, this);
  }

  destroy(): void {
    this.cleanupResize();
    this.close();
  }
}
