export type RawBlock = Map<string, string>;

export type Classified =
  | { status: 'ok'; blocks: RawBlock[] }
  | { status: 'protected'; name: string | null }
  | { status: 'unreadable' };

export type SignalKind = 'digital' | 'analog' | 'serial';
export type NodeKind = 'folder' | 'device' | 'logic' | 'macro' | 'simplplus';
export interface Signal {
  id: number;
  name: string;
  kind: SignalKind;
}
export interface Pin {
  side: 'in' | 'out';
  index: number;
  signalId: number | null;
  constant: '0' | '1' | 'local' | null;
}
export interface MapNode {
  id: number;
  parent: number | null;
  children: number[];
  kind: NodeKind;
  name: string;
  typeCode: string;
  typeLabel: string;
  pins: Pin[];
  disabled: boolean;
}
export interface PinAt {
  nodeId: number;
  pin: Pin;
}
export interface Program {
  title: string;
  nodes: Map<number, MapNode>;
  roots: number[];
  order: number[];
  signals: Map<number, Signal>;
  signalPins: Map<number, PinAt[]>;
}
