export type AuditClass =
  | 'OK'
  | 'REDIRECT'
  | 'BLOCKED'
  | 'TIMEOUT'
  | 'DNS_ERROR'
  | 'TLS_ERROR'
  | 'HTTP_ERROR'
  | 'UNKNOWN';

export type RedirectHop = {
  from: string;
  status: number;
  to: string;
};

export type ClassifyInput = {
  requestedUrl: string;
  finalUrl?: string;
  statusCode?: number | null;
  redirectChain?: RedirectHop[];
  error?: string | null;
  errorCode?: string | null;
  timedOut?: boolean;
  httpMethod?: string;
  headStatusCode?: number | null;
};

export type AuditProbe = {
  source_name: string;
  requested_url: string;
  http_method: string;
  status_code: number | null;
  final_url: string | null;
  redirect_chain: RedirectHop[];
  response_time_ms: number;
  error: string | null;
  checked_at: string;
  content_type: string | null;
  server_header: string | null;
  classification: AuditClass;
  head_status_code?: number | null;
};

const BLOCKED_STATUSES = new Set([401, 403, 407]);

export function classifyHttpResult(input: ClassifyInput): AuditClass {
  const err = `${input.error ?? ''} ${input.errorCode ?? ''}`.toLowerCase();

  if (input.timedOut || /\btimeout\b|aborterror|aborted/.test(err)) {
    return 'TIMEOUT';
  }
  if (input.errorCode === 'ENOTFOUND' || input.errorCode === 'EAI_AGAIN' || err.includes('enotfound') || err.includes('getaddrinfo')) {
    return 'DNS_ERROR';
  }
  if (
    err.includes('unable to verify') ||
    err.includes('cert_') ||
    err.includes('err_tls') ||
    err.includes('certificate') ||
    (input.errorCode ?? '').startsWith('UNABLE_TO_VERIFY') ||
    (input.errorCode ?? '').includes('CERT')
  ) {
    return 'TLS_ERROR';
  }

  const status = input.statusCode ?? null;
  if (status != null && BLOCKED_STATUSES.has(status)) {
    return 'BLOCKED';
  }

  const chain = input.redirectChain ?? [];
  if (status != null && status >= 200 && status < 300) {
    return chain.length > 0 ? 'REDIRECT' : 'OK';
  }
  if (status != null && status >= 300 && status < 400) {
    return 'REDIRECT';
  }
  if (status != null && status >= 400) {
    return 'HTTP_ERROR';
  }
  return 'UNKNOWN';
}

type FetchLike = typeof fetch;

function resolveRedirect(base: string, location: string): string {
  return new URL(location, base).href;
}

export async function probeUrl(
  requestedUrl: string,
  opts?: { fetchImpl?: FetchLike; timeoutMs?: number; userAgent?: string },
): Promise<Omit<AuditProbe, 'source_name'>> {
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const timeoutMs = opts?.timeoutMs ?? 15000;
  const userAgent =
    opts?.userAgent ??
    'MonitorLicitacao-SourceAudit/1.0 (+https://github.com/monitor-licitacao/monitor-de-licitacao)';
  const checkedAt = new Date().toISOString();
  const started = Date.now();

  const attempt = async (method: 'HEAD' | 'GET') => {
    const chain: RedirectHop[] = [];
    let current = requestedUrl;
    let lastStatus: number | null = null;
    let contentType: string | null = null;
    let serverHeader: string | null = null;

    for (let hop = 0; hop < 8; hop += 1) {
      const res = await fetchImpl(current, {
        method,
        redirect: 'manual',
        headers: { 'User-Agent': userAgent, Accept: 'text/html,application/json,*/*' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      lastStatus = res.status;
      contentType = res.headers.get('content-type');
      serverHeader = res.headers.get('server');

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) break;
        const next = resolveRedirect(current, location);
        chain.push({ from: current, status: res.status, to: next });
        current = next;
        continue;
      }
      return {
        requested_url: requestedUrl,
        http_method: method,
        status_code: lastStatus,
        final_url: current,
        redirect_chain: chain,
        response_time_ms: Date.now() - started,
        error: null,
        checked_at: checkedAt,
        content_type: contentType,
        server_header: serverHeader,
        classification: classifyHttpResult({
          requestedUrl,
          finalUrl: current,
          statusCode: lastStatus,
          redirectChain: chain,
          httpMethod: method,
        }),
        head_status_code: method === 'HEAD' ? lastStatus : undefined,
      };
    }

    return {
      requested_url: requestedUrl,
      http_method: method,
      status_code: lastStatus,
      final_url: current,
      redirect_chain: chain,
      response_time_ms: Date.now() - started,
      error: null,
      checked_at: checkedAt,
      content_type: contentType,
      server_header: serverHeader,
      classification: classifyHttpResult({
        requestedUrl,
        finalUrl: current,
        statusCode: lastStatus,
        redirectChain: chain,
        httpMethod: method,
      }),
      head_status_code: method === 'HEAD' ? lastStatus : undefined,
    };
  };

  try {
    const head = await attempt('HEAD');
    const inconclusive =
      head.status_code == null ||
      head.status_code === 405 ||
      head.status_code === 501 ||
      head.status_code === 403 ||
      head.status_code === 404 ||
      head.classification === 'UNKNOWN';
    if (!inconclusive) return head;

    const get = await attempt('GET');
    return { ...get, head_status_code: head.status_code };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const errorCode = err instanceof Error && 'code' in err ? String((err as NodeJS.ErrnoException).code) : null;
    const timedOut = error.toLowerCase().includes('timeout') || error.toLowerCase().includes('abort');
    return {
      requested_url: requestedUrl,
      http_method: 'GET',
      status_code: null,
      final_url: null,
      redirect_chain: [],
      response_time_ms: Date.now() - started,
      error,
      checked_at: checkedAt,
      content_type: null,
      server_header: null,
      classification: classifyHttpResult({
        requestedUrl,
        error,
        errorCode,
        timedOut,
      }),
    };
  }
}
