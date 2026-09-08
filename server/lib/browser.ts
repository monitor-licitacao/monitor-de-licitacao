import puppeteer, { Page, Browser } from 'puppeteer';

/**
 * Helper para executar ações dentro de uma página do Puppeteer.
 * Garante que o browser e a página sejam criados com configurações consistentes
 * e fechados corretamente, evitando vazamento de recursos (zombie processes).
 *
 * @param action Função callback que recebe a página aberta para navegação/raspagem.
 * @returns O resultado retornado pela função callback.
 */
export async function withBrowserPage<T>(action: (page: Page, browser: Browser) => Promise<T>): Promise<T> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    // Default User Agent para evitar bloqueios simples
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36');
    
    // Opcional: configurar interceptadores, timeouts, etc, que sejam comuns a todos os workers
    
    return await action(page, browser);
  } finally {
    if (browser) {
      await browser.close().catch(err => console.error('Erro ao fechar o browser no withBrowserPage:', err));
    }
  }
}
