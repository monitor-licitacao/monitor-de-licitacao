export type AllowedOutboundUrlPolicy = {
  httpsHosts: readonly string[];
  httpHosts: readonly string[];
};

export type AllowedOutboundUrlResult =
  | { ok: true; url: URL }
  | { ok: false; reason: string };

export const OLLAMA_OUTBOUND_URL_POLICY: AllowedOutboundUrlPolicy = {
  httpsHosts: ['ollama.com'],
  httpHosts: ['127.0.0.1', 'localhost'],
};

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, '');
}

export function hostnameMatchesAllowlist(hostname: string, allowedBase: string): boolean {
  const host = normalizeHostname(hostname);
  const base = normalizeHostname(allowedBase);
  if (!host || !base) {
    return false;
  }
  return host === base || host.endsWith(`.${base}`);
}

function hostAllowedForProtocol(
  hostname: string,
  protocol: string,
  policy: AllowedOutboundUrlPolicy,
): boolean {
  const hosts = protocol === 'https:' ? policy.httpsHosts : policy.httpHosts;
  return hosts.some((allowed) => hostnameMatchesAllowlist(hostname, allowed));
}

export function validateAllowedOutboundUrl(
  urlStr: string,
  policy: AllowedOutboundUrlPolicy,
): AllowedOutboundUrlResult {
  if (!urlStr || typeof urlStr !== 'string') {
    return { ok: false, reason: 'Invalid URL' };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlStr.trim());
  } catch {
    return { ok: false, reason: 'Invalid URL' };
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (!hostname) {
    return { ok: false, reason: 'Empty hostname' };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'Embedded credentials are not allowed' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, reason: `Invalid protocol: ${parsed.protocol}` };
  }

  if (!hostAllowedForProtocol(hostname, parsed.protocol, policy)) {
    return { ok: false, reason: `Host not allowed: ${hostname}` };
  }

  return { ok: true, url: parsed };
}
