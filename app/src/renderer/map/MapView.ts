import 'pixi.js/unsafe-eval';
import { Application, Graphics, Rectangle } from 'pixi.js';
import { boxPath, ROOT_BOX, tagText, type Connections, type PinKey } from '../../core/connections';
import { HEADER_H, ROW_H, PIN_PREVIEW, type Layout, type Rect } from '../../core/layout';
import { chooseOverviewDepth } from '../../core/overview';
import type { MapNode, Program } from '../../core/types';
import type { LoadResult } from '../../worker/pipeline';
import { detailFor, nodeTitle, visibleNodes } from './detail';
import { drawBody } from './drawBox';
import { curve, pinPoint } from './drawLinks';
import { drawPins, pinLabel, tagsFor } from './drawSymbol';
import { highlightedNodes, occurrences } from './highlight';
import { Scene } from './scene';
import { BACKGROUND, HIGHLIGHT, LINE } from './theme';
import type { Transform } from './view';

const MIN_DRAWN_PX = 4;
const MAX_HIGHLIGHT_CURVES = 300;
const OVERVIEW_MAX_PX = 8192;

type Loaded = Extract<LoadResult, { status: 'ok' }>;
interface PaintOptions {
  maxDepth?: number;
}

export class MapView {
  onSignalClick: (signalId: number) => void = () => {};
  onClear: () => void = () => {};

  private readonly app = new Application();
  private readonly scene = new Scene();
  private readonly tip = document.createElement('div');
  private readonly listPanel = document.createElement('div');
  private ready: Promise<void>;
  private data: Loaded | null = null;
  private view: Transform = { k: 1, x: 0, y: 0 };
  private litSignal: number | null = null;
  private litNodes: Set<number> | null = null;
  private frame = 0;
  private animation = 0;
  private drag: { x: number; y: number; moved: boolean } | null = null;
  private readonly abort = new AbortController();

  constructor(private readonly host: HTMLElement) {
    this.tip.className = 'map-tip';
    this.listPanel.className = 'map-list';
    this.ready = this.app
      .init({ resizeTo: host, background: BACKGROUND, antialias: true, preference: 'webgl', autoDensity: true, resolution: window.devicePixelRatio })
      .then(() => {
        host.append(this.app.canvas, this.tip, this.listPanel);
        this.app.stage.addChild(this.scene.root);
        this.app.ticker.stop();
        this.app.renderer.on('resize', () => this.schedule());
        this.bind();
      });
  }

  async show(r: Loaded): Promise<void> {
    await this.ready;
    this.data = r;
    this.litSignal = null;
    this.litNodes = null;
    this.closeList();
    this.view = this.fit(this.bounds(r.layout));
    this.schedule();
  }

  flyTo(nodeId: number): void {
    const rect = this.data?.layout.get(nodeId);
    if (!rect) return;
    const target = this.fit(rect, Math.max(0.9, Math.min(1.2, this.fit(rect).k)));
    const from = { ...this.view };
    const start = performance.now();
    cancelAnimationFrame(this.animation);
    const step = (now: number) => {
      const u = Math.min(1, (now - start) / 320);
      const e = u * (2 - u);
      this.view = {
        k: from.k * Math.pow(target.k / from.k, e),
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
      };
      this.paintNow();
      if (u < 1) this.animation = requestAnimationFrame(step);
    };
    this.animation = requestAnimationFrame(step);
  }

  highlightSignal(signalId: number): void {
    if (!this.data) return;
    this.litSignal = signalId;
    this.litNodes = highlightedNodes(this.data.program, occurrences(this.data.program, signalId).map((o) => o.nodeId));
    this.schedule();
  }

  highlightNodes(nodeIds: number[]): void {
    if (!this.data) return;
    this.litSignal = null;
    this.litNodes = highlightedNodes(this.data.program, nodeIds);
    this.schedule();
  }

  clearHighlight(): void {
    this.litSignal = null;
    this.litNodes = null;
    this.closeList();
    this.schedule();
  }

  async captureView(): Promise<Uint8Array> {
    await this.ready;
    this.paintNow();
    return this.encode(this.scene.root, this.app.screen.width, this.app.screen.height, window.devicePixelRatio);
  }

  async captureOverview(): Promise<Uint8Array> {
    await this.ready;
    if (!this.data) return new Uint8Array();
    const { program, layout } = this.data;
    const b = this.bounds(layout);
    const k = Math.min(1, OVERVIEW_MAX_PX / Math.max(b.w, b.h));
    const offscreen = new Scene();
    const backdrop = new Graphics().rect(0, 0, b.w * k, b.h * k).fill(BACKGROUND);
    offscreen.root.addChildAt(backdrop, 0);
    this.paint(offscreen, { k, x: -b.x * k, y: -b.y * k }, b, { maxDepth: chooseOverviewDepth(program, layout) });
    const png = await this.encode(offscreen.root, b.w * k, b.h * k, 1);
    offscreen.destroy();
    return png;
  }

  destroy(): void {
    this.abort.abort();
    cancelAnimationFrame(this.frame);
    cancelAnimationFrame(this.animation);
    this.app.destroy(true, { children: true });
    this.tip.remove();
    this.listPanel.remove();
  }

  private async encode(target: Scene['root'], w: number, h: number, resolution: number): Promise<Uint8Array> {
    const canvas = this.app.renderer.extract.canvas({
      target,
      frame: new Rectangle(0, 0, w, h),
      resolution,
      clearColor: BACKGROUND,
    }) as HTMLCanvasElement;
    const blob = await new Promise<Blob>((ok, fail) => canvas.toBlob((x) => (x ? ok(x) : fail(new Error('encode'))), 'image/png'));
    return new Uint8Array(await blob.arrayBuffer());
  }

  private bounds(l: Layout): Rect {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const r of l.values()) {
      x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y);
      x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h);
    }
    if (x0 === Infinity) return { x: 0, y: 0, w: 1, h: 1 };
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  private fit(r: Rect, forcedK?: number): Transform {
    const { width, height } = this.app.screen;
    const k = forcedK ?? Math.min((width - 40) / r.w, (height - 40) / r.h, 2);
    return { k, x: width / 2 - (r.x + r.w / 2) * k, y: height / 2 - (r.y + r.h / 2) * k };
  }

  private schedule(): void {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.paintNow());
  }

  private paintNow(): void {
    if (!this.data) {
      this.scene.begin();
      this.scene.end();
    } else {
      const { width, height } = this.app.screen;
      const t = this.view;
      this.paint(this.scene, t, { x: -t.x / t.k, y: -t.y / t.k, w: width / t.k, h: height / t.k }, {});
    }
    this.app.render();
  }

  private paint(s: Scene, t: Transform, world: Rect, opts: PaintOptions): void {
    const { program: p, connections: c, layout: l } = this.data!;
    s.begin();
    const depthOf = new Map<number, number>();
    const visible = visibleNodes(p, l, world, MIN_DRAWN_PX / t.k).filter((id) => {
      const n = p.nodes.get(id)!;
      const depth = n.parent === null ? 1 : (depthOf.get(n.parent) ?? 0) + 1;
      depthOf.set(id, depth);
      return opts.maxDepth === undefined || (depth <= opts.maxDepth && n.children.length > 0);
    });
    const shown = new Set(visible);
    const fullDetail = (n: MapNode) => opts.maxDepth === undefined && detailFor(l.get(n.id)!.w * t.k) === 'full';

    for (const id of visible) {
      const n = p.nodes.get(id)!;
      const r = l.get(id)!;
      const alpha = this.litNodes && !this.litNodes.has(id) ? 0.22 : 1;
      const detail = opts.maxDepth !== undefined ? 'box' : detailFor(r.w * t.k);
      drawBody(s, n, r, t, detail, alpha);
      if (fullDetail(n)) drawPins(s, p, c, n, r, t, alpha, this.litSignal, true);
    }

    const boxes = new Set<number>([ROOT_BOX]);
    for (const id of visible) if (p.nodes.get(id)!.children.length) boxes.add(id);
    const dimLines = this.litNodes !== null;
    for (const box of boxes) {
      for (const line of c.linesByBox.get(box) ?? []) {
        if (!shown.has(line.from.nodeId) || !shown.has(line.to.nodeId)) continue;
        if (!fullDetail(p.nodes.get(line.from.nodeId)!) || !fullDetail(p.nodes.get(line.to.nodeId)!)) continue;
        if (line.signalId === this.litSignal) continue;
        curve(s, pinPoint(p, l, line.from, t), pinPoint(p, l, line.to, t), LINE, 1, dimLines ? 0.18 : 0.75);
      }
    }
    if (this.litSignal !== null && opts.maxDepth === undefined) this.paintPath(s, t, this.litSignal);
    s.end();
  }

  /** Links the first driver of a signal to every other place it appears. */
  private paintPath(s: Scene, t: Transform, signalId: number): void {
    const { program: p, layout: l } = this.data!;
    const all = occurrences(p, signalId);
    const hub = all.find((o) => o.pin.side === 'out') ?? all[0];
    if (!hub) return;
    const key = (o: (typeof all)[number]): PinKey => ({ nodeId: o.nodeId, side: o.pin.side, index: o.pin.index });
    const a = pinPoint(p, l, key(hub), t);
    for (const o of all.slice(0, MAX_HIGHLIGHT_CURVES)) {
      if (o !== hub) curve(s, a, pinPoint(p, l, key(o), t), HIGHLIGHT, 2, 0.9);
    }
  }

  private bind(): void {
    const el = this.app.canvas;
    const signal = this.abort.signal;
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      cancelAnimationFrame(this.animation);
      const box = el.getBoundingClientRect();
      const mx = e.clientX - box.left;
      const my = e.clientY - box.top;
      const f = Math.exp(-e.deltaY * 0.0016);
      const k = Math.max(0.002, Math.min(8, this.view.k * f));
      const u = k / this.view.k;
      this.view = { k, x: mx - (mx - this.view.x) * u, y: my - (my - this.view.y) * u };
      this.schedule();
    }, { passive: false, signal });
    el.addEventListener('pointerdown', (e) => {
      this.drag = { x: e.clientX, y: e.clientY, moved: false };
      el.setPointerCapture(e.pointerId);
    }, { signal });
    el.addEventListener('pointermove', (e) => {
      if (!this.drag) return this.hover(e);
      const dx = e.clientX - this.drag.x;
      const dy = e.clientY - this.drag.y;
      if (dx || dy) {
        this.drag.moved = true;
        this.view = { ...this.view, x: this.view.x + dx, y: this.view.y + dy };
        this.drag.x = e.clientX;
        this.drag.y = e.clientY;
        this.schedule();
      }
    }, { signal });
    el.addEventListener('pointerup', (e) => {
      const moved = this.drag?.moved;
      this.drag = null;
      if (!moved) this.click(e);
    }, { signal });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.clearHighlight();
        this.onClear();
      }
    }, { signal });
  }

  private pinAt(e: PointerEvent) {
    if (!this.data) return null;
    const { program: p, layout: l } = this.data;
    const box = this.app.canvas.getBoundingClientRect();
    const t = this.view;
    const x = (e.clientX - box.left - t.x) / t.k;
    const y = (e.clientY - box.top - t.y) / t.k;
    const hits = visibleNodes(p, l, { x, y, w: 0.01, h: 0.01 }, MIN_DRAWN_PX / t.k);
    const id = hits.at(-1);
    if (id === undefined) return null;
    const n = p.nodes.get(id)!;
    const r = l.get(id)!;
    if (detailFor(r.w * t.k) !== 'full') return { n, pin: null, more: null };
    const row = Math.floor((y - r.y - HEADER_H) / ROW_H);
    const side = x < r.x + r.w / 2 ? ('in' as const) : ('out' as const);
    const pins = n.pins.filter((q) => q.side === side);
    if (row === PIN_PREVIEW && pins.length > PIN_PREVIEW) return { n, pin: null, more: side };
    return { n, pin: row >= 0 && row < PIN_PREVIEW ? (pins[row] ?? null) : null, more: null };
  }

  private click(e: PointerEvent): void {
    this.closeList();
    const hit = this.pinAt(e);
    if (hit?.more) return this.openList(hit.n, hit.more, e);
    if (hit?.pin?.signalId != null) {
      this.highlightSignal(hit.pin.signalId);
      this.onSignalClick(hit.pin.signalId);
    } else {
      this.clearHighlight();
      this.onClear();
    }
  }

  private hover(e: PointerEvent): void {
    const hit = this.pinAt(e);
    const data = this.data;
    if (!hit || !data) {
      this.tip.style.display = 'none';
      return;
    }
    let text = nodeTitle(hit.n);
    if (hit.pin) {
      text = pinLabel(data.program, hit.pin);
      const tag = tagsFor(data.connections, hit.n, hit.pin.side).get(hit.pin.index);
      if (tag) text += `\n${tag.dir}: ${boxPath(data.program, tag.first)}${tag.more ? ` and ${tag.more} more` : ''}`;
    } else if (hit.more) {
      text = 'Show all pins';
    }
    const box = this.host.getBoundingClientRect();
    this.tip.textContent = text;
    this.tip.style.display = 'block';
    this.tip.style.left = `${e.clientX - box.left + 14}px`;
    this.tip.style.top = `${e.clientY - box.top + 14}px`;
  }

  private openList(n: MapNode, side: 'in' | 'out', e: PointerEvent): void {
    const { program: p, connections: c } = this.data!;
    const box = this.host.getBoundingClientRect();
    const tags = tagsFor(c, n, side);
    this.listPanel.replaceChildren(
      ...n.pins.filter((x) => x.side === side).map((pin) => {
        const row = document.createElement('button');
        const tag = tags.get(pin.index);
        row.textContent = pinLabel(p, pin) + (tag ? `  ${tagText(p, tag)}` : '');
        row.onclick = () => {
          if (pin.signalId !== null) {
            this.highlightSignal(pin.signalId);
            this.onSignalClick(pin.signalId);
          }
        };
        return row;
      }),
    );
    this.listPanel.style.display = 'block';
    this.listPanel.style.left = `${Math.min(e.clientX - box.left, box.width - 340)}px`;
    this.listPanel.style.top = `${Math.min(e.clientY - box.top, box.height - 340)}px`;
  }

  private closeList(): void {
    this.listPanel.style.display = 'none';
  }
}
