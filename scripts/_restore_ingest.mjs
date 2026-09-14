import fs from 'node:fs';
import path from 'node:path';

const transcript = path.join(
  process.env.USERPROFILE ?? '',
  '.cursor/projects/c-Users-marce-monitor-de-licitacao/agent-transcripts/456af7f8-dd79-4b69-83be-b7a4bfd24fb0/456af7f8-dd79-4b69-83be-b7a4bfd24fb0.jsonl',
);
const out = path.join(process.cwd(), 'server/lib/pncp/ingest.ts');
const lines = fs.readFileSync(transcript, 'utf8').split('\n');
let content = null;
for (const line of lines) {
  if (!line.includes('ingest.ts') || !line.includes('"Write"')) continue;
  try {
    const j = JSON.parse(line);
    for (const block of j.message?.content ?? []) {
      if (block.input?.path?.includes('ingest.ts') && block.input?.contents) {
        content = block.input.contents;
      }
    }
  } catch {
    /* skip */
  }
}
if (!content) {
  console.error('not found');
  process.exit(1);
}
fs.writeFileSync(out, content);
console.log('restored bytes', content.length);
