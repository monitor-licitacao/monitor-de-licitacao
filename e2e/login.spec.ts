import { test, expect } from '@playwright/test';

test.describe('E2E Login & Auth Flow', () => {
  test('Fluxo Completo de Autenticação: Tela de Login, Validação de Erro, Login com Sucesso e Logout', async ({ page }) => {
    // 1. Limpa storage inicial
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');

    // 2. Cenário: Usuário não autenticado vê a tela de Login (Route Guard ativo)
    await expect(page.getByRole('heading', { name: 'Monitor de Licitações' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Senha')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Conectar' })).toBeVisible();
    await page.screenshot({ path: 'test-results/01-tela-login-inicial.png' });
    await page.waitForTimeout(1000); // Pausa visual para a gravação

    // 3. Cenário: Tentativa com credenciais inválidas exibe erro
    await page.getByLabel('Email').fill('usuario.invalido@exemplo.com');
    await page.getByLabel('Senha').fill('senha-incorreta-999');
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Conectar' }).click();
    await expect(page.locator('.bg-rose-50')).toBeVisible();
    await page.screenshot({ path: 'test-results/02-erro-credenciais-invalidas.png' });
    await page.waitForTimeout(1000); // Pausa visual para gravação da mensagem de erro

    // 4. Cenário: Login com credenciais válidas
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Senha').fill('password123');
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Conectar' }).click();

    // 5. Cenário: Redirecionamento e carga da aplicação autenticada
    await page.waitForFunction(() => !!localStorage.getItem('auth_token'));
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(token).toBeTruthy();

    await expect(page.getByRole('heading', { name: 'Monitor de Editais Municipais' })).toBeVisible();
    await expect(page.getByText('Vectra Cargo')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();
    await page.screenshot({ path: 'test-results/03-dashboard-autenticado.png' });
    await page.waitForTimeout(1500); // Pausa visual para registrar a visão autenticada no vídeo

    // 6. Cenário: Logout com limpeza de token e retorno à tela de login
    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page.getByRole('heading', { name: 'Monitor de Licitações' })).toBeVisible();
    await page.screenshot({ path: 'test-results/04-apos-logout.png' });
    const tokenAposLogout = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(tokenAposLogout).toBeNull();
    await page.waitForTimeout(1000); // Pausa final para a gravação
  });
});
