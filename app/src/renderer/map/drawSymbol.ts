import type { Connections, Tag } from '../../core/connections';
import { HEADER_H, PIN_PREVIEW, ROW_H, type Rect } from '../../core/layout';
import type { MapNode, Pin, Program } from '../../core/types';
import { tagDisplay } from './detail';
import type { Scene } from './scene';
import { HIGHLIGHT, MUTED, SIGNAL_COLOR, TAG } from './theme';
import { sx, sy, type Transform } from './view';

export function pinLabel(p: Program, pin: Pin): string {
  if (pin.constant) return pin.constant;
  return pin.signalId === null ? '?' : p.signals.get(pin.signalId)!.name;
}

export function tagsFor(c: Connections, n: MapNode, side: 'in' | 'out'): Map<number, Tag> {
  return new Map((c.tagsByNode.get(n.id) ?? []).filter((t) => t.pin.side === side).map((t) => [t.pin.index, t]));
}

export function drawPins(
  s: Scene, p: Program, c: Connections, n: MapNode, r: Rect, t: Transform,
  alpha: number, highlighted: number | null, showTags: boolean,
): void {
  const px = Math.max(8, ROW_H * t.k * 0.72);
  const halfWidth = (r.w * t.k) / 2 - 8;
  const top = sy(t, r.y + HEADER_H);
  const rowH = ROW_H * t.k;
  const dim = n.disabled ? alpha * 0.45 : alpha;

  for (const side of ['in', 'out'] as const) {
    const pins = n.pins.filter((x) => x.side === side);
    const tags = showTags ? tagsFor(c, n, side) : new Map<number, Tag>();
    const isIn = side === 'in';
    const edge = sx(t, isIn ? r.x : r.x + r.w);
    const textX = isIn ? edge + 5 : edge - 5;
    pins.slice(0, PIN_PREVIEW).forEach((pin, row) => {
      const y = top + row * rowH;
      const on = highlighted !== null && pin.signalId === highlighted;
      const kind = pin.signalId === null ? null : p.signals.get(pin.signalId)!.kind;
      const color = on ? HIGHLIGHT : kind ? SIGNAL_COLOR[kind] : MUTED;
      const tag = tags.get(pin.index);
      const tagText = tag ? tagDisplay(p, tag) : '';
      const tagRoom = tag ? Math.min(halfWidth * 0.55, tagText.length * px * 0.56) : 0;
      const nameRoom = halfWidth - tagRoom - (tag ? 6 : 0);
      s.shapes.circle(edge, y + rowH / 2, Math.max(1.5, 2.5 * t.k)).fill({ color, alpha: dim });
      s.text(pinLabel(p, pin), textX, y + (rowH - px) / 2, px, color, dim, nameRoom, !isIn);
      if (tag) {
        const tagX = isIn ? textX + nameRoomUsed(p, pin, px, nameRoom) + 6 : textX - nameRoomUsed(p, pin, px, nameRoom) - 6;
        s.text(tagText, tagX, y + (rowH - px) / 2, px, on ? HIGHLIGHT : TAG, dim, tagRoom, !isIn);
      }
    });
    if (pins.length > PIN_PREVIEW) {
      const y = top + PIN_PREVIEW * rowH;
      s.text(`+${pins.length - PIN_PREVIEW} more`, textX, y + (rowH - px) / 2, px, MUTED, dim, halfWidth, !isIn);
    }
  }
}

function nameRoomUsed(p: Program, pin: Pin, px: number, room: number): number {
  return Math.min(pinLabel(p, pin).length * px * 0.56, room);
}
