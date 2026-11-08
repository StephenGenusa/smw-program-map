import { BitmapText, Container, Graphics } from 'pixi.js';

const FONT_SIZE = 40;

/** One drawing surface: shapes underneath, a reusable pool of text on top. */
export class Scene {
  readonly root = new Container();
  readonly shapes = new Graphics();
  readonly links = new Graphics();
  private readonly labels = new Container();
  private used = 0;
  private titles: { x: number; y: number; w: number; h: number }[] = [];

  constructor() {
    this.root.addChild(this.shapes, this.links, this.labels);
  }

  begin(): void {
    this.shapes.clear();
    this.links.clear();
    this.used = 0;
    this.titles = [];
  }

  /** Claims space for a floating title; false if an earlier title already holds it. */
  claimTitle(x: number, y: number, w: number, h: number): boolean {
    if (this.titles.some((t) => x < t.x + t.w && t.x < x + w && y < t.y + t.h && t.y < y + h)) return false;
    this.titles.push({ x, y, w, h });
    return true;
  }

  text(value: string, x: number, y: number, px: number, color: number, alpha = 1, maxWidth = Infinity, right = false): void {
    const chars = Math.floor(maxWidth / (px * 0.56));
    const shown = value.length > chars ? `${value.slice(0, Math.max(0, chars - 1))}…` : value;
    let label = this.labels.children[this.used] as BitmapText | undefined;
    if (!label) {
      label = new BitmapText({ text: shown, style: { fontFamily: 'Arial', fontSize: FONT_SIZE, fill: 0xffffff } });
      this.labels.addChild(label);
    } else if (label.text !== shown) {
      label.text = shown;
    }
    this.used++;
    label.visible = true;
    label.tint = color;
    label.alpha = alpha;
    label.scale.set(px / FONT_SIZE);
    label.position.set(right ? x - label.width : x, y);
  }

  end(): void {
    const kids = this.labels.children;
    for (let i = this.used; i < kids.length; i++) kids[i]!.visible = false;
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}
