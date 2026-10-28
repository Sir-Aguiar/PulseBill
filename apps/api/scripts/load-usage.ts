import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { assertLocalUsageTarget } from './local-usage-target.js';

const DEFAULT_URL = 'http://127.0.0.1:8080';
const DEFAULT_COUNT = 20;
const DEFAULT_CONCURRENCY = 10;

type LoadOptions = {
  url: string;
  count: number;
  concurrency: number;
  allowRemote: boolean;
};

type StatusKey = number | 'error';

function parsePositiveInt(raw: string, flag: string): number {
  if (!/^[1-9]\d*$/.test(raw)) {
    throw new Error(`${flag} must be a positive integer`);
  }

  return Number(raw);
}

function readFlagValue(
  argv: string[],
  index: number,
  flag: string,
): { value: string; nextIndex: number } {
  const inline = argv[index]?.slice(flag.length);
  if (inline?.startsWith('=')) {
    const value = inline.slice(1);
    if (!value) {
      throw new Error(`${flag} requires a value`);
    }
    return { value, nextIndex: index };
  }

  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }

  return { value, nextIndex: index + 1 };
}

export function parseLoadUsageArgs(argv: string[]): LoadOptions {
  const options: LoadOptions = {
    url: DEFAULT_URL,
    count: DEFAULT_COUNT,
    concurrency: DEFAULT_CONCURRENCY,
    allowRemote: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? '';

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    if (arg === '--allow-remote') {
      options.allowRemote = true;
      continue;
    }

    if (arg === '--url' || arg.startsWith('--url=')) {
      const parsed = readFlagValue(argv, index, '--url');
      options.url = parsed.value;
      index = parsed.nextIndex;
      continue;
    }

    if (arg === '--count' || arg.startsWith('--count=')) {
      const parsed = readFlagValue(argv, index, '--count');
      options.count = parsePositiveInt(parsed.value, '--count');
      index = parsed.nextIndex;
      continue;
    }

    if (arg === '--concurrency' || arg.startsWith('--concurrency=')) {
      const parsed = readFlagValue(argv, index, '--concurrency');
      options.concurrency = parsePositiveInt(parsed.value, '--concurrency');
      index = parsed.nextIndex;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp(): void {
  console.log(`Usage: npm run load:usage -- [--url <url>] [--count <n>] [--concurrency <n>] [--allow-remote]

Defaults: --url ${DEFAULT_URL} --count ${DEFAULT_COUNT} --concurrency ${DEFAULT_CONCURRENCY}
Refuses hosts other than localhost, 127.0.0.1, and ::1 unless --allow-remote is set.`);
}

function usageEndpoint(base: URL): string {
  const endpoint = new URL(base.href);
  endpoint.pathname = '/v1/usage';
  endpoint.search = '';
  endpoint.hash = '';
  return endpoint.href;
}

function usageBody(): string {
  return JSON.stringify({
    customerId: randomUUID(),
    metric: 'API_CALLS',
    quantity: 1,
    idempotencyKey: randomUUID(),
    recordedAt: new Date().toISOString(),
  });
}

async function postUsage(endpoint: string): Promise<StatusKey> {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: usageBody(),
    });
    return response.status;
  } catch {
    return 'error';
  }
}

async function burst(
  endpoint: string,
  count: number,
  concurrency: number,
): Promise<Map<StatusKey, number>> {
  const counts = new Map<StatusKey, number>();
  let next = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, count) },
    async () => {
      while (next < count) {
        const current = next;
        next += 1;
        if (current >= count) {
          return;
        }

        const status = await postUsage(endpoint);
        counts.set(status, (counts.get(status) ?? 0) + 1);
      }
    },
  );

  await Promise.all(workers);
  return counts;
}

function printStatusCounts(counts: Map<StatusKey, number>): void {
  const codes = [...counts.keys()]
    .filter((key): key is number => typeof key === 'number')
    .sort((left, right) => left - right);

  for (const code of codes) {
    console.log(`${code} ${counts.get(code)}`);
  }

  const errors = counts.get('error');
  if (errors) {
    console.log(`error ${errors}`);
  }
}

async function main(): Promise<void> {
  try {
    const options = parseLoadUsageArgs(process.argv.slice(2));
    const base = assertLocalUsageTarget(options.url, options.allowRemote);
    const counts = await burst(
      usageEndpoint(base),
      options.count,
      options.concurrency,
    );
    printStatusCounts(counts);
    if ((counts.get('error') ?? 0) === options.count) {
      process.exitCode = 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }

  return import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  await main();
}
