/**
 * Canonical and Rejected URLs for Sistema S (SEST/SENAT, SESC DN)
 * Task: Desmock URLs (Sistema S)
 */

export const CANONICAL_SISTEMA_S_URLS = {
  SEST_SENAT: 'https://compras.sestsenat.org.br/portal/Mural.aspx',
  SESC_DN: 'https://egov-br.paradigmabs.com.br/sescdn/portal/Mural.aspx',
} as const;

export const REJECTED_SISTEMA_S_PATTERNS = [
  'licitacoes.sesc.com.br',
  'sestsenat.org.br/licitacoes-e-compras',
] as const;

export interface UrlRejectionResult {
  rejected: boolean;
  reason?: string;
  canonicalSuggestion?: string;
}

export function isRejectedSistemaSUrl(urlStr: string): UrlRejectionResult {
  if (!urlStr || typeof urlStr !== 'string') {
    return { rejected: false };
  }

  try {
    const trimmed = urlStr.trim();
    // Allow parsing relative or pseudo URLs if necessary
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();
    const pathname = url.pathname.toLowerCase();

    // 1. licitacoes.sesc.com.br
    if (host === 'licitacoes.sesc.com.br' || host.endsWith('.licitacoes.sesc.com.br')) {
      return {
        rejected: true,
        reason: 'Domínio "licitacoes.sesc.com.br" é mock/descontinuado e foi rejeitado.',
        canonicalSuggestion: CANONICAL_SISTEMA_S_URLS.SESC_DN,
      };
    }

    // 2. sestsenat.org.br/licitacoes-e-compras
    if (host.includes('sestsenat.org.br') && pathname.includes('/licitacoes-e-compras')) {
      return {
        rejected: true,
        reason: 'Endpoint "sestsenat.org.br/licitacoes-e-compras" é mock/desatualizado e foi rejeitado.',
        canonicalSuggestion: CANONICAL_SISTEMA_S_URLS.SEST_SENAT,
      };
    }

    // 3. Invented /editais/*.pdf for Sistema S
    if (
      (host.includes('sesc.com.br') || host.includes('sestsenat.org.br')) &&
      pathname.includes('/editais/') &&
      pathname.endsWith('.pdf')
    ) {
      return {
        rejected: true,
        reason: 'Links inventados de PDFs sob /editais/*.pdf são rejeitados.',
        canonicalSuggestion: host.includes('sesc')
          ? CANONICAL_SISTEMA_S_URLS.SESC_DN
          : CANONICAL_SISTEMA_S_URLS.SEST_SENAT,
      };
    }

    return { rejected: false };
  } catch {
    return { rejected: false };
  }
}

export const CANONICAL_URL_REWRITE_RULES = [
  {
    source: 'sesc-dn',
    pattern: '^https?:\\/\\/(?:cdn\\.sesc\\.com\\.br|licitacoes\\.sesc\\.com\\.br|www\\.sesc\\.com\\.br\\/portal\\/sesc\\/departamentonacional\\/licitacoes).*',
    replacement: CANONICAL_SISTEMA_S_URLS.SESC_DN,
    priority: 1,
    description: 'Canonicalização SESC DN para portal Mural Paradigma (https://egov-br.paradigmabs.com.br/sescdn/portal/Mural.aspx)',
  },
  {
    source: 'sest-senat',
    pattern: '^https?:\\/\\/(?:cdn\\.sestsenat\\.org\\.br|sestsenat\\.org\\.br\\/licitacoes-e-compras).*',
    replacement: CANONICAL_SISTEMA_S_URLS.SEST_SENAT,
    priority: 1,
    description: 'Canonicalização SEST SENAT para portal Mural Paradigma (https://compras.sestsenat.org.br/portal/Mural.aspx)',
  },
];
