const AMPLITUDE_HTTP_API_URL = 'https://api2.amplitude.com/2/httpapi';

export interface AmplitudePublishResult {
  eventId?: string;
  insertId?: string;
}

export interface AmplitudeHttpPublisher {
  publish(
    eventType: string,
    eventProperties: Record<string, unknown>,
    options?: { userId?: string; insertId?: string; timeMs?: number }
  ): Promise<AmplitudePublishResult>;
}

export class AmplitudeHttpClient implements AmplitudeHttpPublisher {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async publish(
    eventType: string,
    eventProperties: Record<string, unknown>,
    options: { userId?: string; insertId?: string; timeMs?: number } = {}
  ): Promise<AmplitudePublishResult> {
    if (!this.apiKey) {
      throw new Error('AMPLITUDE_API_KEY missing');
    }

    const response = await this.fetchImpl(AMPLITUDE_HTTP_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: this.apiKey,
        events: [
          {
            event_type: eventType,
            user_id: options.userId ?? 'system',
            event_properties: eventProperties,
            insert_id: options.insertId,
            time: options.timeMs ?? Date.now(),
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Amplitude HTTP ${response.status}: ${body.slice(0, 200)}`);
    }

    const payload = (await response.json()) as {
      code?: number;
      events_ingested?: number;
      server_upload_time?: number;
    };

    if (payload.code !== 200) {
      throw new Error(`Amplitude rejected payload (code=${payload.code ?? 'unknown'})`);
    }

    return {
      eventId: options.insertId,
      insertId: options.insertId,
    };
  }
}

export class MockAmplitudeHttpPublisher implements AmplitudeHttpPublisher {
  readonly events: Array<{
    eventType: string;
    eventProperties: Record<string, unknown>;
    userId?: string;
    insertId?: string;
    timeMs?: number;
  }> = [];

  async publish(
    eventType: string,
    eventProperties: Record<string, unknown>,
    options: { userId?: string; insertId?: string; timeMs?: number } = {}
  ): Promise<AmplitudePublishResult> {
    this.events.push({
      eventType,
      eventProperties,
      userId: options.userId,
      insertId: options.insertId,
      timeMs: options.timeMs,
    });
    return { eventId: options.insertId ?? `mock-${this.events.length}`, insertId: options.insertId };
  }

  clear(): void {
    this.events.length = 0;
  }
}
