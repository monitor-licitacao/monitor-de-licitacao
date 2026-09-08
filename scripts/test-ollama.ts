import 'dotenv/config';
import { generateTextWithFallback, checkOllamaHealth } from '../server/lib/ai';

async function main() {
  const health = await checkOllamaHealth();
  console.log('ollama health:', health);

  const result = await generateTextWithFallback({
    system: 'Responda em uma palavra.',
    prompt: 'Diga apenas: ok',
    maxOutputTokens: 32,
    temperature: 0,
  });
  console.log('generateText:', result.text);
}

main().catch((err) => {
  console.error('FAILED:', err?.message || err);
  process.exit(1);
});
