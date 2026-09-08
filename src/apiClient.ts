/**
 * HTTP Client centralizado para o Monitor de Licitações.
 * Suporta autenticação via Bearer JWT (localStorage / sessionStorage / window).
 * Em produção: apenas Authorization Bearer é enviado.
 * Em desenvolvimento local: injeta x-api-key somente se VITE_MONITOR_API_KEY
 * for explicitamente definido via env (sem qualquer fallback hardcoded).
 */

const TOKEN_STORAGE_KEY = 'auth_token';

/**
 * Retorna o token de autenticação JWT ativo, caso exista no storage ou contexto da aplicação.
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem(TOKEN_STORAGE_KEY) ||
    sessionStorage.getItem(TOKEN_STORAGE_KEY) ||
    (window as any).__AUTH_TOKEN__ ||
    null
  );
}

/**
 * Salva o token JWT de autenticação no storage local.
 */
export function setAuthToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    (window as any).__AUTH_TOKEN__ = token;
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    delete (window as any).__AUTH_TOKEN__;
  }
}

/**
 * Realiza logout: limpa token e redireciona para login.
 */
export function logout(): void {
  setAuthToken(null);
  window.location.href = '/';
}

/**
 * Lança um erro se a resposta HTTP não for bem-sucedida (status 2xx).
 */
export async function assertOk(res: Response): Promise<void> {
  if (!res.ok) {
    let errorDetail = '';
    try {
      const data = await res.json();
      errorDetail = data?.error || data?.message || JSON.stringify(data);
    } catch {
      errorDetail = await res.text();
    }
    throw new Error(`API Error ${res.status}: ${res.statusText} - ${errorDetail}`);
  }
}

/**
 * Wrapper sobre fetch para chamadas à API.
 * 1. Injeta Bearer JWT para todas as chamadas autenticadas quando disponível no storage.
 * 2. Em ambiente de desenvolvimento local (DEV only), se VITE_MONITOR_API_KEY estiver
 *    explicitamente configurado, pode enviá-lo como x-api-key. Caso contrário, nenhum
 *    cabeçalho x-api-key é injetado.
 * 3. Se resposta for 401, faz logout automático.
 */
export async function apiClient(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers || {});

  // 1. Injeta Bearer JWT se disponível (Regra 3 / login)
  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // 2. Local DEV ONLY: se VITE_MONITOR_API_KEY foi explicitamente setado em import.meta.env
  // Sem qualquer string hardcoded ou fallback default.
  if (import.meta.env?.DEV && import.meta.env?.VITE_MONITOR_API_KEY) {
    const explicitDevKey = import.meta.env.VITE_MONITOR_API_KEY.trim();
    if (explicitDevKey && !headers.has('x-api-key')) {
      headers.set('x-api-key', explicitDevKey);
    }
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  // 3. Se 401 (Unauthorized), logout automático
  if (response.status === 401) {
    logout();
  }

  return response;
}
