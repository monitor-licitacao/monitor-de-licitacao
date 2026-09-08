/**
 * HTTP Client centralizado para o Monitor de Licitações.
 * Autenticação via Bearer JWT (localStorage / sessionStorage / window).
 * MONITOR_API_KEY fica só no servidor (Regra 3) — nunca prefixo VITE_.
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
 * 1. Injeta Bearer JWT quando disponível.
 * 2. Em 401, faz logout automático.
 */
export async function apiClient(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers || {});

  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401) {
    logout();
  }

  return response;
}
