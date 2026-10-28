const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function isLocalUsageHost(hostname: string): boolean {
  const normalized = hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');

  return LOCAL_HOSTS.has(normalized);
}

export function assertLocalUsageTarget(
  rawUrl: string,
  allowRemote: boolean,
): URL {
  let target: URL;

  try {
    target = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }

  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }

  if (!allowRemote && !isLocalUsageHost(target.hostname)) {
    throw new Error(
      `Refusing non-local target ${target.hostname}. Pass --allow-remote to send the burst elsewhere.`,
    );
  }

  return target;
}
