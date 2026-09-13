/**
 * Documento gerado por assistência de IA. Revisão humana obrigatória.
 * Test double mock para simular a HTTP API v2 do Amplitude em testes unitários e de integração
 */

export interface CapturedAmplitudeRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: {
    api_key?: string;
    events?: Array<{
      user_id?: string;
      event_type: string;
      event_properties?: Record<string, unknown>;
      time?: number;
      insert_id?: string;
    }>;
  };
}

export class MockAmplitudeHttpApi {
  public capturedRequests: CapturedAmplitudeRequest[] = [];
  public failNextCount = 0;
  public failStatus = 500;
  public failMessage = 'Internal Server Error';
  private originalFetch: typeof globalThis.fetch | null = null;

  public install(): void {
    if (this.originalFetch) return;
    this.originalFetch = globalThis.fetch;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes('api.amplitude.com') || url.includes('/2/httpapi')) {
        let parsedBody: any = {};
        if (init?.body) {
          try {
            parsedBody = JSON.parse(String(init.body));
          } catch {
            parsedBody = {};
          }
        }

        const headersObj: Record<string, string> = {};
        if (init?.headers) {
          if (init.headers instanceof Headers) {
            init.headers.forEach((val, key) => {
              headersObj[key] = val;
            });
          } else if (Array.isArray(init.headers)) {
            for (const [k, v] of init.headers) headersObj[k] = v;
          } else {
            Object.assign(headersObj, init.headers);
          }
        }

        this.capturedRequests.push({
          url,
          method: init?.method || 'GET',
          headers: headersObj,
          body: parsedBody,
        });

        if (this.failNextCount > 0) {
          this.failNextCount--;
          return new Response(JSON.stringify({ error: this.failMessage }), {
            status: this.failStatus,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return new Response(
          JSON.stringify({
            code: 200,
            events_ingested: parsedBody.events?.length || 1,
            server_upload_time: Date.now(),
            event_id: `amp-mock-${this.capturedRequests.length}`,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      if (this.originalFetch) {
        return this.originalFetch(input, init);
      }
      throw new Error(`Unhandled fetch call to ${url}`);
    }) as typeof fetch;
  }

  public restore(): void {
    if (this.originalFetch) {
      globalThis.fetch = this.originalFetch;
      this.originalFetch = null;
    }
  }

  public reset(): void {
    this.capturedRequests = [];
    this.failNextCount = 0;
    this.failStatus = 500;
    this.failMessage = 'Internal Server Error';
  }

  public getEvents(eventType?: string): Array<CapturedAmplitudeRequest['body']['events'] extends (infer E)[] | undefined ? E : never> {
    const events: any[] = [];
    for (const req of this.capturedRequests) {
      if (req.body?.events) {
        for (const ev of req.body.events) {
          if (!eventType || ev.event_type === eventType) {
            events.push(ev);
          }
        }
      }
    }
    return events;
  }
}
