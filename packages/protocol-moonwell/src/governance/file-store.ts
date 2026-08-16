import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type {
  GovernanceStore,
  IndexCursor,
  NormalizedIndexedChange,
  RawGovernanceEvent,
} from "@fork/governance-core";
import { MemoryGovernanceStore } from "@fork/governance-core";

const BIGINT_KEYS = new Set([
  "lastProcessedBlock",
  "lastProposalId",
  "blockNumber",
  "valueRaw",
  "suppliedRaw",
  "borrowedRaw",
]);

function revive(value: unknown, key?: string): unknown {
  if (typeof value === "string" && key && BIGINT_KEYS.has(key) && /^-?\d+$/.test(value)) {
    return BigInt(value);
  }
  if (Array.isArray(value)) return value.map((entry) => revive(entry));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [childKey, entry] of Object.entries(value)) {
      if (childKey.endsWith("At") && typeof entry === "string") {
        out[childKey] = new Date(entry);
      } else {
        out[childKey] = revive(entry, childKey);
      }
    }
    return out;
  }
  return value;
}

export class JsonFileGovernanceStore implements GovernanceStore {
  private memory = new MemoryGovernanceStore();
  private loaded = false;

  constructor(private readonly filePath: string) {}

  private async hydrate() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = JSON.parse(readFileSync(this.filePath, "utf8")) as {
        cursors?: IndexCursor[];
        events?: RawGovernanceEvent[];
        changes?: NormalizedIndexedChange[];
      };
      for (const cursor of raw.cursors ?? []) {
        const revived = revive(cursor) as IndexCursor;
        await this.memory.saveCursor(revived);
      }
      for (const event of raw.events ?? []) {
        await this.memory.upsertRawEvent(revive(event) as RawGovernanceEvent);
      }
      for (const change of raw.changes ?? []) {
        await this.memory.upsertIndexedChange(revive(change) as NormalizedIndexedChange);
      }
    } catch {
      return;
    }
  }

  private async persist() {
    const payload = {
      cursors: [await this.memory.getCursor("moonwell-ethereum-governor")].filter(Boolean),
      events: [],
      changes: await this.memory.listIndexedChanges(),
    };
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(payload, (_, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ));
  }

  async getCursor(sourceId: string) {
    await this.hydrate();
    return this.memory.getCursor(sourceId);
  }

  async saveCursor(cursor: IndexCursor) {
    await this.hydrate();
    await this.memory.saveCursor(cursor);
    await this.persist();
  }

  async upsertRawEvent(event: RawGovernanceEvent) {
    await this.hydrate();
    await this.memory.upsertRawEvent(event);
  }

  async getRawEvent(id: string) {
    await this.hydrate();
    return this.memory.getRawEvent(id);
  }

  async upsertIndexedChange(record: NormalizedIndexedChange) {
    await this.hydrate();
    await this.memory.upsertIndexedChange(record);
    await this.persist();
  }

  async getIndexedChange(id: string) {
    await this.hydrate();
    return this.memory.getIndexedChange(id);
  }

  async listIndexedChanges() {
    await this.hydrate();
    return this.memory.listIndexedChanges();
  }
}
