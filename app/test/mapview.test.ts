// Runs the real MapView. Only the GPU layer (pixi, Scene) and browser globals are faked.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computeConnections } from '../src/core/connections';
import { layoutProgram } from '../src/core/layout';
import type { Program } from '../src/core/types';
import { MapView } from '../src/renderer/map/MapView';
import { folder, prog, sg, sm } from './helpers';

const h = vi.hoisted(() => ({ canvas: null as unknown as EventTarget, scenes: [] as { fills: number[] }[] }));

vi.mock('pixi.js/unsafe-eval', () => ({}));
vi.mock('pixi.js', () => {
  class Application {
    canvas = h.canvas;
    screen = { width: 800, height: 600 };
    stage = { addChild() {} };
    ticker = { stop() {} };
    renderer = { on() {}, extract: { canvas: () => ({ toBlob: (cb: (b: Blob) => void) => cb(new Blob(['x'])) }) } };
    init() { return Promise.resolve(); }
    render() {}
    destroy() {}
  }
  class Graphics {
    rect() { return this; }
    fill() { return this; }
  }
  class Rectangle {}
  return { Application, Graphics, Rectangle };
});
vi.mock('../src/renderer/map/scene', () => {
  class Scene {
    fills: number[] = [];
    root = { addChildAt() {} };
    links: unknown;
    shapes: unknown;
    constructor() {
      const chain = (fills?: number[]): unknown => {
        const proxy: unknown = new Proxy({}, {
          get: (_t, key) => (arg?: { alpha?: number }) => {
            if (key === 'fill' && fills) fills.push(arg?.alpha ?? 1);
            return proxy;
          },
        });
        return proxy;
      };
      this.shapes = chain(this.fills);
      this.links = chain();
      h.scenes.push(this);
    }
    begin() { this.fills.length = 0; }
    end() {}
    destroy() {}
    text() {}
    claimTitle() { return false; }
  }
  return { Scene };
});

interface FakeEl { className: string; style: Record<string, string>; remove(): void; replaceChildren(): void }

let queue: Map<number, (now: number) => void>;
let elements: FakeEl[];
let map: MapView;
let cleared: ReturnType<typeof vi.fn<() => void>>;

function flushFrames(): void {
  let now = performance.now();
  for (let guard = 0; queue.size && guard < 100; guard++) {
    now += 400;
    const due = [...queue.values()];
    queue.clear();
    due.forEach((f) => f(now));
  }
}
const fire = (type: string, props: Record<string, number> = {}) =>
  h.canvas.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { clientX: 0, clientY: 0, button: 0, pointerId: 1, ...props }));
const viewOf = () => ({ ...map['view'] });
const tip = () => elements.find((e) => e.className === 'map-tip')!;

async function loaded(p: Program) {
  const connections = computeConnections(p);
  return { status: 'ok', program: p, connections, layout: await layoutProgram(p, connections) } as never;
}
const boxes = () => prog(folder(1, 'root'), sm({ H: 2, PrH: 1, I1: 5 }), sm({ H: 3, PrH: 1, O1: 5 }), folder(6, 'other'), sm({ H: 7, PrH: 6 }), sg(5));

/** Puts the pointer over node 2 so the hover tooltip shows. */
function hoverNode(): void {
  const r = map['data']!.layout.get(2)!;
  const v = map['view'];
  fire('pointermove', { clientX: (r.x + r.w / 2) * v.k + v.x, clientY: (r.y + r.h / 2) * v.k + v.y });
  expect(tip().style.display).toBe('block');
}

beforeEach(async () => {
  h.canvas = Object.assign(new EventTarget(), {
    setPointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  });
  h.scenes.length = 0;
  queue = new Map();
  elements = [];
  let nextFrame = 1;
  vi.stubGlobal('requestAnimationFrame', (f: (now: number) => void) => { queue.set(nextFrame, f); return nextFrame++; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => queue.delete(id));
  vi.stubGlobal('window', Object.assign(new EventTarget(), { devicePixelRatio: 1 }));
  vi.stubGlobal('document', {
    createElement: () => {
      const el: FakeEl = { className: '', style: {}, remove() {}, replaceChildren() {} };
      elements.push(el);
      return el;
    },
  });
  const host = { append() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) };
  map = new MapView(host as unknown as HTMLElement);
  cleared = vi.fn();
  map.onClear = cleared;
  await map.show(await loaded(boxes()));
  flushFrames();
});

describe('overview export', () => {
  it('draws the nodes of a program that has no boxes', async () => {
    await map.show(await loaded(prog(sm({ H: 1 }), sm({ H: 2 }))));
    await map.captureOverview();
    expect(h.scenes.at(-1)!.fills.length).toBeGreaterThan(0);
  });
  it('still leaves out loose symbols when the program has boxes', async () => {
    await map.show(await loaded(prog(folder(1, 'root'), sm({ H: 2, PrH: 1 }), sm({ H: 3 }))));
    await map.captureOverview();
    // Body and header of the one root box.
    expect(h.scenes.at(-1)!.fills).toHaveLength(2);
  });
  it('is not dimmed by the current highlight', async () => {
    map.highlightNodes([7]);
    await map.captureOverview();
    const fills = h.scenes.at(-1)!.fills;
    expect(fills.length).toBeGreaterThan(0);
    expect(fills.every((a) => a === 1)).toBe(true);
  });
  it('keeps the highlight dimming on the live map', () => {
    map.highlightNodes([7]);
    flushFrames();
    expect(h.scenes[0]!.fills).toContain(0.22);
  });
});

describe('flyTo', () => {
  it('stops when the user starts dragging', () => {
    const before = viewOf();
    map.flyTo(2);
    fire('pointerdown');
    flushFrames();
    expect(viewOf()).toEqual(before);
  });
  it('does not override the fit of a newly shown file', async () => {
    map.flyTo(2);
    const next = await loaded(prog(sm({ H: 1 })));
    await map.show(next);
    const fitted = viewOf();
    flushFrames();
    expect(viewOf()).toEqual(fitted);
  });
});

describe('reloading a file', () => {
  it('keeps the current view when asked to', async () => {
    fire('pointerdown', { clientX: 10, clientY: 10 });
    fire('pointermove', { clientX: 30, clientY: 15 });
    fire('pointerup', { clientX: 30, clientY: 15 });
    const panned = viewOf();
    await map.show(await loaded(boxes()), { keepView: true });
    expect(viewOf()).toEqual(panned);
  });
  it('fits a file opened normally', async () => {
    const fitted = viewOf();
    fire('pointerdown', { clientX: 10, clientY: 10 });
    fire('pointermove', { clientX: 30, clientY: 15 });
    fire('pointerup', { clientX: 30, clientY: 15 });
    await map.show(await loaded(boxes()));
    expect(viewOf()).toEqual(fitted);
  });
});

describe('pointer gestures', () => {
  it.each(['pointercancel', 'lostpointercapture'])('stops panning after %s', (ended) => {
    fire('pointerdown');
    fire(ended);
    const before = viewOf();
    fire('pointermove', { clientX: 50, clientY: 50 });
    expect(viewOf()).toEqual(before);
  });
  it('pans with the primary button', () => {
    const before = viewOf();
    fire('pointerdown', { clientX: 10, clientY: 10 });
    fire('pointermove', { clientX: 30, clientY: 15 });
    expect(viewOf()).toEqual({ ...before, x: before.x + 20, y: before.y + 5 });
  });
  it('treats a primary press and release as a click', () => {
    fire('pointerdown');
    fire('pointerup');
    expect(cleared).toHaveBeenCalledOnce();
  });
  it('ignores a right-click', () => {
    fire('pointerdown', { button: 2 });
    fire('pointerup', { button: 2 });
    expect(cleared).not.toHaveBeenCalled();
  });
  it('ignores a release whose press began elsewhere', () => {
    fire('pointerup');
    expect(cleared).not.toHaveBeenCalled();
  });
});

describe('hover tooltip', () => {
  it.each([
    ['the pointer leaves', 'pointerleave', {}],
    ['a press starts', 'pointerdown', {}],
    ['the wheel zooms', 'wheel', { deltaY: 100 }],
  ])('hides when %s', (_name, type, props) => {
    hoverNode();
    fire(type, props);
    expect(tip().style.display).toBe('none');
  });
});
