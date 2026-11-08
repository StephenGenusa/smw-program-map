import type { NodeKind, SignalKind } from '../../core/types';

export const BACKGROUND = 0xfbfbf9;
export const TEXT = 0x1f2933;
export const MUTED = 0x6b7280;
export const TAG = 0xb45309;
export const HIGHLIGHT = 0xea580c;
export const LINE = 0x7a8797;

export const KIND_STYLE: Record<NodeKind, { fill: number; border: number; header: number; width: number }> = {
  folder: { fill: 0xf1f3f5, border: 0x9aa5b1, header: 0xdfe4ea, width: 1 },
  device: { fill: 0xe6f6f4, border: 0x0f766e, header: 0xbfe8e2, width: 2 },
  logic: { fill: 0xffffff, border: 0x2563eb, header: 0xdbe7fe, width: 1 },
  macro: { fill: 0xf5f0ff, border: 0x7c3aed, header: 0xe4d8fd, width: 1.5 },
  simplplus: { fill: 0xfff1f4, border: 0xbe185d, header: 0xfbd5e0, width: 1.5 },
};

export const SIGNAL_COLOR: Record<SignalKind, number> = {
  digital: 0x1d4ed8,
  analog: 0x15803d,
  serial: 0x7e22ce,
};
