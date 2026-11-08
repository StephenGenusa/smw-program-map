import type { Rect } from '../../core/layout';
import type { MapNode } from '../../core/types';
import type { Detail } from './detail';
import type { Scene } from './scene';
import { KIND_STYLE, TEXT } from './theme';
import { sx, sy, type Transform } from './view';

const HEADER = 24;

/** The body and title shared by boxes and symbols. */
export function drawBody(s: Scene, n: MapNode, r: Rect, t: Transform, detail: Detail, alpha: number): void {
  const style = KIND_STYLE[n.kind];
  const x = sx(t, r.x);
  const y = sy(t, r.y);
  const w = r.w * t.k;
  const h = r.h * t.k;
  const dim = n.disabled ? alpha * 0.45 : alpha;
  s.shapes.rect(x, y, w, h).fill({ color: style.fill, alpha: dim }).stroke({ color: style.border, width: style.width, alpha: dim });
  if (detail === 'box' && !n.children.length) return;
  const headerH = Math.min(HEADER * t.k, h);
  s.shapes.rect(x, y, w, headerH).fill({ color: style.header, alpha: dim });
  const px = Math.max(11, Math.min(HEADER * t.k * 0.6, 18));
  if (headerH >= px) {
    if (w > 60) s.text(n.name, x + 5, y + (headerH - px) / 2, px, TEXT, dim, w - 10);
  } else if (n.children.length && w > 90 && h > 34) {
    const titleW = Math.min(w, n.name.length * px * 0.56 + 10);
    if (s.claimTitle(x, y, titleW, px + 4)) {
      s.shapes.rect(x, y, titleW, px + 4).fill({ color: style.header, alpha: dim });
      s.text(n.name, x + 5, y + 2, px, TEXT, dim, w - 10);
    }
  }
}
