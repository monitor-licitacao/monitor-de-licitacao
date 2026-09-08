/**
 * Paradigma Connector — HTTP Direct (no Playwright)
 * Interacts with Sistema S portals (SEST/SENAT, SESC-SP, etc) via WebService/Servicos.asmx
 *
 * Gate A: Bootstrap session + list processes
 * Gates B-F: Download + parse items, documents, bids (future)
 */

interface SessionConfig {
  baseUrl: string;
  timeout?: number;
}

interface PaginationDto {
  iNrPagina: number;
  iQtRegistroPagina: number;
}

interface ProcessoDto {
  nCdProcesso: number;
  sNrProcesso: string;
  nCdEdital: number;
  nCdOrigem: number;
  sNmUnidade: string;
  sNmModalidade: string;
  dtInicioPropostas: string;
  dtTerminoPropostas: string;
  sNmFase: string;
  sSituacao: string;
  vValorEstimado: number;
  sLinkCanonico: string;
}

class ParadigmaSession {
  baseUrl: string;
  cookies: string = '';
  sessionId?: string;
  timeout: number;

  constructor(config: SessionConfig) {
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeout || 10000;
  }

  async bootstrap(): Promise<void> {
    console.log(`[Paradigma] Bootstrap ${this.baseUrl}/Mural.aspx`);

    try {
      const res = await fetch(`${this.baseUrl}/Mural.aspx`, {
        method: 'GET',
        headers: { 'User-Agent': 'ParadigmaConnector/1.0' },
        redirect: 'follow',
      });

      const setCookie = res.headers.get('set-cookie') || '';
      this.cookies = setCookie;

      // Extract ASP.NET_SessionId if present
      const match = setCookie.match(/ASP\.NET_SessionId=([^;]+)/);
      if (match) {
        this.sessionId = match[1];
        console.log(`[Paradigma] Session ID: ${this.sessionId.substring(0, 8)}...`);
      }
    } catch (err) {
      console.error('[Paradigma] Bootstrap failed:', err);
      throw err;
    }
  }

  async pesquisarProcessos(payload: {
    dtoPaginacao: PaginationDto;
    nCdProcesso?: number;
    sNrProcesso?: string;
  }): Promise<ProcessoDto[]> {
    if (!this.cookies) {
      throw new Error('Session not bootstrapped. Call bootstrap() first.');
    }

    console.log(`[Paradigma] PesquisarProcessos (page ${payload.dtoPaginacao.iNrPagina})`);

    try {
      const res = await fetch(
        `${this.baseUrl}/WebService/Servicos.asmx/PesquisarProcessos`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': this.cookies,
            'User-Agent': 'ParadigmaConnector/1.0',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();

      // ASP.NET AJAX typically wraps result in .d property
      const results = data.d || data;

      if (!Array.isArray(results)) {
        console.warn('[Paradigma] Expected array, got:', typeof results);
        return [];
      }

      return results.map((p) => this.normalizeProcesso(p));
    } catch (err) {
      console.error('[Paradigma] PesquisarProcessos failed:', err);
      throw err;
    }
  }

  private normalizeProcesso(p: any): ProcessoDto {
    return {
      nCdProcesso: parseSentinel(p.nCdProcesso),
      sNrProcesso: p.sNrProcesso || '',
      nCdEdital: parseSentinel(p.nCdEdital),
      nCdOrigem: parseSentinel(p.nCdOrigem),
      sNmUnidade: p.sNmUnidade || '',
      sNmModalidade: p.sNmModalidade || '',
      dtInicioPropostas: parseParadigmaDate(p.dtInicioPropostas),
      dtTerminoPropostas: parseParadigmaDate(p.dtTerminoPropostas),
      sNmFase: p.sNmFase || '',
      sSituacao: p.sSituacao || '',
      vValorEstimado: parseSentinel(p.vValorEstimado),
      sLinkCanonico: p.sLinkCanonico || '',
    };
  }
}

// Helpers: parse Paradigma/ASP.NET sentinels

/**
 * Parse .NET date format: /Date(milliseconds)/
 * Returns ISO date string (YYYY-MM-DD) or null
 */
function parseParadigmaDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;

  const match = dateStr.match(/\/Date\((\d+)\)\//);
  if (!match) return dateStr; // already ISO or other format

  const ms = parseInt(match[1], 10);
  if (isNaN(ms)) return null;

  return new Date(ms).toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * Parse .NET null sentinels to null
 * -2147483648 = int.MinValue
 * ~-7.922816251426434e+28 = float sentinel
 */
function parseSentinel(val: any): any {
  if (val === -2147483648) return null;
  if (typeof val === 'number' && Math.abs(val) > 1e28) return null;
  return val;
}

export { ParadigmaSession, SessionConfig, ProcessoDto, PaginationDto };
export { parseParadigmaDate, parseSentinel };
