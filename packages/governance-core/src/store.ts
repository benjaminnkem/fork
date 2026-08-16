import type { Hex, ProtocolChange } from "@fork/shared";

export interface IndexCursor {
  sourceId: string;
  chainId: number;
  lastProcessedBlock: bigint;
  lastProcessedBlockHash: Hex;
  lastProposalId: bigint;
  updatedAt: Date;
}

export interface RawGovernanceEvent {
  id: string;
  chainId: number;
  sourceId: string;
  blockNumber: bigint;
  blockHash: Hex;
  txHash?: Hex;
  logIndex?: number;
  topic0?: Hex;
  raw: Record<string, unknown>;
}

export interface NormalizedIndexedChange {
  change: ProtocolChange;
  sourceStatus: ProtocolChange["status"];
  destinationStatus: ProtocolChange["status"];
  rawGovernorState: number;
  forVotesRaw: string;
  againstVotesRaw: string;
  abstainVotesRaw: string;
}

export interface GovernanceStore {
  getCursor(sourceId: string): Promise<IndexCursor | undefined>;
  saveCursor(cursor: IndexCursor): Promise<void>;
  listCursors(): Promise<IndexCursor[]>;
  upsertRawEvent(event: RawGovernanceEvent): Promise<void>;
  getRawEvent(id: string): Promise<RawGovernanceEvent | undefined>;
  upsertIndexedChange(record: NormalizedIndexedChange): Promise<void>;
  getIndexedChange(id: string): Promise<NormalizedIndexedChange | undefined>;
  listIndexedChanges(): Promise<NormalizedIndexedChange[]>;
}

export class MemoryGovernanceStore implements GovernanceStore {
  private cursors = new Map<string, IndexCursor>();
  private events = new Map<string, RawGovernanceEvent>();
  private changes = new Map<string, NormalizedIndexedChange>();

  async getCursor(sourceId: string) {
    return this.cursors.get(sourceId);
  }

  async saveCursor(cursor: IndexCursor) {
    this.cursors.set(cursor.sourceId, cursor);
  }

  async listCursors() {
    return [...this.cursors.values()];
  }

  async upsertRawEvent(event: RawGovernanceEvent) {
    this.events.set(event.id, event);
  }

  async getRawEvent(id: string) {
    return this.events.get(id);
  }

  async upsertIndexedChange(record: NormalizedIndexedChange) {
    this.changes.set(record.change.id, record);
  }

  async getIndexedChange(id: string) {
    return this.changes.get(id);
  }

  async listIndexedChanges() {
    return [...this.changes.values()];
  }
}
