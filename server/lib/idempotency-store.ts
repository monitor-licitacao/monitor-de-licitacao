export type IdempotencyStatus = 'pending' | 'sending' | 'sent' | 'failed';

export interface IdempotencyRecord {
  tenantId: number;
  idempotencyKey: string;
  collectionBatchId: string;
  payloadHash: string;
  status: IdempotencyStatus;
  amplitudeEventId: string | null;
  retryAttempt: number;
  actorUserId: string | null;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
}

export interface IdempotencyStore {
  get(tenantId: number, key: string): Promise<IdempotencyRecord | null>;
  upsert(record: IdempotencyRecord): Promise<void>;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<string, IdempotencyRecord>();

  private mapKey(tenantId: number, key: string): string {
    return `${tenantId}:${key}`;
  }

  async get(tenantId: number, key: string): Promise<IdempotencyRecord | null> {
    return this.records.get(this.mapKey(tenantId, key)) ?? null;
  }

  async upsert(record: IdempotencyRecord): Promise<void> {
    this.records.set(this.mapKey(record.tenantId, record.idempotencyKey), record);
  }

  clear(): void {
    this.records.clear();
  }
}
