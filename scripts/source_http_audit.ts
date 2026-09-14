import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { probeUrl, type AuditProbe } from '../server/lib/sourceHttpAudit.js';

type InventoryUrl = { role: string; url: string };
type InventorySource = {
  id: string;
  source_name: string;
  official_url: string;
  urls?: InventoryUrl[];
  http_status?: number | null;
  http_final_url?: string | null;
  http_redirect_chain?: unknown;
  http_checked_at?: string;
  http_error?: string | null;
  http_classification?: string;
};

type Inventory = {
  schema_version: number;
  issue: number;
  updated_at: string;
  sources: InventorySource[];
};

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const inventoryPath = join(root, 'data', 'source-inventory.json');
const auditDir = join(root, 'data', 'source_http_audit');

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const inventory = JSON.parse(await readFile(inventoryPath, 'utf8')) as Inventory;
  const probes: AuditProbe[] = [];

  for (const source of inventory.sources) {
    const urls = source.urls?.length
      ? source.urls
      : [{ role: 'official', url: source.official_url }];

    for (const entry of urls) {
      if (!entry.url || !/^https?:\/\//i.test(entry.url)) continue;
      const probe = await probeUrl(entry.url);
      probes.push({ ...probe, source_name: `${source.source_name} [${entry.role}]` });
      await sleep(300);
    }

    const official = probes.find((p) => p.source_name === `${source.source_name} [official]`);
    if (official) {
      source.http_status = official.status_code;
      source.http_final_url = official.final_url;
      source.http_redirect_chain = official.redirect_chain;
      source.http_checked_at = official.checked_at;
      source.http_error = official.error;
      source.http_classification = official.classification;
    }
  }

  const counts = probes.reduce<Record<string, number>>((acc, probe) => {
    acc[probe.classification] = (acc[probe.classification] ?? 0) + 1;
    return acc;
  }, {});

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const snapshot = {
    generated_at: new Date().toISOString(),
    issue: 80,
    user_agent: 'MonitorLicitacao-SourceAudit/1.0',
    counts,
    probes,
  };

  await mkdir(join(auditDir, 'snapshots'), { recursive: true });
  await writeFile(join(auditDir, 'snapshots', `${stamp}.json`), JSON.stringify(snapshot, null, 2));
  await writeFile(join(auditDir, 'latest.json'), JSON.stringify(snapshot, null, 2));

  inventory.updated_at = new Date().toISOString();
  await writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);

  console.log(JSON.stringify({ written: join(auditDir, 'latest.json'), counts, probes: probes.length }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
