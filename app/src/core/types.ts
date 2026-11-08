export type RawBlock = Map<string, string>;

export type Classified =
  | { status: 'ok'; blocks: RawBlock[] }
  | { status: 'protected'; name: string | null }
  | { status: 'unreadable' };
