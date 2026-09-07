/**
 * Smoke helpers (manual). Run after deploy:
 *   curl -I https://licitacoes.getgymsite.com.br/api/health
 *   curl -I https://licitacoes-origin.getgymsite.com.br/api/health
 */

export const examples = {
  healthPublic: "https://licitacoes.getgymsite.com.br/api/health",
  healthOrigin: "https://licitacoes-origin.getgymsite.com.br/api/health",
  expected: { status: 200, contentType: "application/json" },
};
