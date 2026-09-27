import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { USER_AGENT } from "./catalog.ts";

export class HttpStatusError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(status: number, url: string) {
    super(`${status} ${url}`);
    this.status = status;
    this.url = url;
  }
}

export class EmptyAssetError extends Error {
  readonly url: string;

  constructor(url: string) {
    super(`empty response for ${url}`);
    this.url = url;
  }
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchText(url: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": USER_AGENT, accept: "text/html,*/*" },
      });
      if (!response.ok) throw new HttpStatusError(response.status, url);
      return await response.text();
    } catch (error) {
      if (error instanceof HttpStatusError && error.status === 404) throw error;
      lastError = error;
      await sleep(400 * attempt);
    }
  }
  throw lastError;
}

export async function downloadToFile(url: string, destination: string): Promise<number> {
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.partial`;
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": USER_AGENT, accept: "*/*" },
      });
      if (!response.ok) throw new HttpStatusError(response.status, url);
      const body = Buffer.from(await response.arrayBuffer());
      if (body.length === 0) throw new EmptyAssetError(url);
      await writeFile(temporary, body);
      const size = body.length;
      await rm(destination, { force: true });
      await rename(temporary, destination);
      return size;
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => undefined);
      if (error instanceof EmptyAssetError) throw error;
      if (error instanceof HttpStatusError && error.status === 404) throw error;
      lastError = error;
      await sleep(500 * attempt);
    }
  }
  throw lastError;
}

export async function mapPool<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

export interface RemoteEntry {
  name: string;
  mtime: string;
  isDirectory: boolean;
}

const ROW_PATTERN =
  /<a class="row" href="\.\/([^"]+)">[\s\S]*?<code class="filename">\s*([^<\s]+)\s*<\/code>\s*<em class="filesize">\s*([^<]*?)\s*<\/em>\s*<small class="filemtime">\s*([^<]*?)\s*<\/small>/g;

export function parseDirectoryListing(html: string): RemoteEntry[] {
  const entries: RemoteEntry[] = [];
  for (const match of html.matchAll(ROW_PATTERN)) {
    const name = match[2].trim();
    if (!name || name === ".." || name === "../") continue;
    entries.push({
      name,
      mtime: match[4].trim(),
      isDirectory: !/\.[a-z0-9]{2,5}$/i.test(name),
    });
  }
  return entries;
}

export function extensionOf(name: string) {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

export function stemOf(name: string) {
  const dot = name.lastIndexOf(".");
  return (dot === -1 ? name : name.slice(0, dot)).toLowerCase();
}
