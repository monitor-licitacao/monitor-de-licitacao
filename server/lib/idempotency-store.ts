export type IdempotencyStatus = 'pending' | 'sending' | 'sent' | 'failed';

export interface IdempotencyRecord {
  idempotencyKey: string;
  collectionBatchId: string;
  payloadHash: string;
  status: IdempotencyStatus;
  amplitudeEventId: string | null;
  retryAttempt: number;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
}

export interface IdempotencyStore {
  get(key: string): Promise<IdempotencyRecord | null>;
  upsert(record: IdempotencyRecord): Promise<void>;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<string, IdempotencyRecord>();

  async get(key: string): Promise<IdempotencyRecord | null> {
    return this.records.get(key) ?? null;
  }

  async upsert(record: IdempotencyRecord): Promise<void> {
    this.records.set(record.idempotencyKey, record);
  }

  clear(): void {
    this.records.clear();
  }
}
