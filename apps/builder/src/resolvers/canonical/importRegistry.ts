import type {
  CompositionDocument,
  ImportResolverContext,
} from "@composition/shared";
import {
  assertCompositionImportKey,
  isValidCompositionImportKey,
} from "./importNamespace";
import { normalizeCompositionImportPayload } from "./importPayloadAdapter";

export { normalizeCompositionImportPayload } from "./importPayloadAdapter";

export type ImportDocumentFetcher = (
  importKey: string,
  source: string,
) => Promise<CompositionDocument> | CompositionDocument;

export interface ImportFailure {
  importKey: string;
  source: string;
  error: Error;
}

export interface PrefetchDocumentImportsResult {
  loaded: Array<{ importKey: string; source: string }>;
  failed: ImportFailure[];
}

export type ImportLoadStatus = "idle" | "loading" | "loaded" | "failed";

export interface CanonicalImportRegistry extends ImportResolverContext {
  prefetchDocumentImports(
    doc: CompositionDocument,
  ): Promise<PrefetchDocumentImportsResult>;
  prefetchImport(
    importKey: string,
    source: string,
  ): Promise<CompositionDocument>;
  getStatus(importKey: string, source: string): ImportLoadStatus;
  getError(importKey: string, source: string): Error | undefined;
  retainDocumentImports(doc: CompositionDocument): void;
  invalidateImport(importKey: string, source: string): void;
  clear(): void;
}

const KEY_SEPARATOR = "\u0001";
const FALLBACK_IMPORT_BASE_URL = "http://localhost/";

function makeImportCacheKey(importKey: string, source: string): string {
  return `${importKey}${KEY_SEPARATOR}${source}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function assertCompositionDocument(
  value: unknown,
  source: string,
): CompositionDocument {
  if (
    !isRecord(value) ||
    typeof value.version !== "string" ||
    !Array.isArray(value.children)
  ) {
    throw new Error(
      `[ADR-116] Invalid import document from ${source}: expected CompositionDocument`,
    );
  }

  return value as unknown as CompositionDocument;
}

function getDefaultImportBaseUrl(): string {
  if (typeof document !== "undefined" && document.baseURI) {
    return document.baseURI;
  }
  if (typeof location !== "undefined" && location.href) {
    return location.href;
  }
  return FALLBACK_IMPORT_BASE_URL;
}

export function resolveCompositionImportSource(
  source: string,
  baseUrl: string = getDefaultImportBaseUrl(),
): string {
  const trimmedSource = source.trim();
  if (!trimmedSource) {
    throw new Error("[ADR-116] Import source must be a non-empty URL/path");
  }

  let base: URL;
  let resolved: URL;
  try {
    base = new URL(baseUrl);
    resolved = new URL(trimmedSource, base);
  } catch (error: unknown) {
    throw new Error(
      `[ADR-116] Invalid import source ${source}: ${toError(error).message}`,
    );
  }

  if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
    throw new Error(
      `[ADR-116] Unsupported import source protocol ${resolved.protocol}`,
    );
  }

  if (base.origin !== resolved.origin) {
    throw new Error(
      `[ADR-116] Import source must be same-origin: ${resolved.href}`,
    );
  }

  return resolved.href;
}

export async function fetchCompositionDocumentFromSource(
  _importKey: string,
  source: string,
  baseUrl?: string,
): Promise<CompositionDocument> {
  if (typeof fetch !== "function") {
    throw new Error(
      `[ADR-116] Cannot fetch import document ${source}: fetch is unavailable`,
    );
  }

  const resolvedSource = resolveCompositionImportSource(source, baseUrl);
  const response = await fetch(resolvedSource);
  if (!response.ok) {
    throw new Error(
      `[ADR-116] Failed to fetch import document ${resolvedSource}: ${response.status} ${response.statusText}`,
    );
  }

  return assertCompositionDocument(
    normalizeCompositionImportPayload(await response.json(), resolvedSource),
    resolvedSource,
  );
}

export function createCanonicalImportRegistry(
  fetcher: ImportDocumentFetcher = fetchCompositionDocumentFromSource,
): CanonicalImportRegistry {
  const loaded = new Map<string, CompositionDocument>();
  const pending = new Map<string, Promise<CompositionDocument>>();
  const failures = new Map<string, Error>();
  const requestTokens = new Map<string, number>();
  let requestSequence = 0;

  function getDocumentImportCacheKeys(doc: CompositionDocument): Set<string> {
    return new Set(
      Object.entries(doc.imports ?? {}).map(([importKey, source]) =>
        makeImportCacheKey(importKey, source),
      ),
    );
  }

  function retainDocumentImports(doc: CompositionDocument): void {
    const retainedKeys = getDocumentImportCacheKeys(doc);
    const knownKeys = new Set([
      ...loaded.keys(),
      ...pending.keys(),
      ...failures.keys(),
      ...requestTokens.keys(),
    ]);

    for (const cacheKey of knownKeys) {
      if (retainedKeys.has(cacheKey)) continue;
      loaded.delete(cacheKey);
      pending.delete(cacheKey);
      failures.delete(cacheKey);
      requestTokens.delete(cacheKey);
    }
  }

  function resolveImportDocument(
    importKey: string,
    source: string,
  ): CompositionDocument | undefined {
    if (!isValidCompositionImportKey(importKey)) return undefined;
    return loaded.get(makeImportCacheKey(importKey, source));
  }

  async function prefetchImport(
    importKey: string,
    source: string,
  ): Promise<CompositionDocument> {
    const cacheKey = makeImportCacheKey(importKey, source);
    const cached = loaded.get(cacheKey);
    if (cached) return cached;

    const inflight = pending.get(cacheKey);
    if (inflight) return inflight;

    try {
      assertCompositionImportKey(importKey);
    } catch (error: unknown) {
      const normalized = toError(error);
      failures.set(cacheKey, normalized);
      return Promise.reject(normalized);
    }

    const token = ++requestSequence;
    requestTokens.set(cacheKey, token);

    const request = Promise.resolve(fetcher(importKey, source))
      .then((doc) => assertCompositionDocument(doc, source))
      .then((doc) => {
        if (requestTokens.get(cacheKey) === token) {
          loaded.set(cacheKey, doc);
          failures.delete(cacheKey);
        }
        return doc;
      })
      .catch((error: unknown) => {
        const normalized = toError(error);
        if (requestTokens.get(cacheKey) === token) {
          failures.set(cacheKey, normalized);
        }
        throw normalized;
      })
      .finally(() => {
        if (requestTokens.get(cacheKey) === token) {
          pending.delete(cacheKey);
          requestTokens.delete(cacheKey);
        }
      });

    pending.set(cacheKey, request);
    return request;
  }

  async function prefetchDocumentImports(
    doc: CompositionDocument,
  ): Promise<PrefetchDocumentImportsResult> {
    retainDocumentImports(doc);

    const entries = Object.entries(doc.imports ?? {});
    if (entries.length === 0) {
      return { loaded: [], failed: [] };
    }

    const results = await Promise.allSettled(
      entries.map(async ([importKey, source]) => ({
        importKey,
        source,
        doc: await prefetchImport(importKey, source),
      })),
    );

    const loadedImports: Array<{ importKey: string; source: string }> = [];
    const failed: ImportFailure[] = [];

    results.forEach((result, index) => {
      const [importKey, source] = entries[index]!;
      if (result.status === "fulfilled") {
        loadedImports.push({ importKey: result.value.importKey, source });
        return;
      }
      failed.push({ importKey, source, error: toError(result.reason) });
    });

    return { loaded: loadedImports, failed };
  }

  function getStatus(importKey: string, source: string): ImportLoadStatus {
    const cacheKey = makeImportCacheKey(importKey, source);
    if (loaded.has(cacheKey)) return "loaded";
    if (pending.has(cacheKey)) return "loading";
    if (failures.has(cacheKey)) return "failed";
    return "idle";
  }

  function getError(importKey: string, source: string): Error | undefined {
    return failures.get(makeImportCacheKey(importKey, source));
  }

  function invalidateImport(importKey: string, source: string): void {
    const cacheKey = makeImportCacheKey(importKey, source);
    loaded.delete(cacheKey);
    pending.delete(cacheKey);
    failures.delete(cacheKey);
    requestTokens.delete(cacheKey);
  }

  function clear(): void {
    loaded.clear();
    pending.clear();
    failures.clear();
    requestTokens.clear();
  }

  return {
    resolveImportDocument,
    prefetchDocumentImports,
    prefetchImport,
    getStatus,
    getError,
    retainDocumentImports,
    invalidateImport,
    clear,
  };
}

let sharedImportRegistry: CanonicalImportRegistry | null = null;

export function getSharedImportRegistry(): CanonicalImportRegistry {
  if (!sharedImportRegistry) {
    sharedImportRegistry = createCanonicalImportRegistry();
  }
  return sharedImportRegistry;
}

export function resetSharedImportRegistry(): void {
  sharedImportRegistry = null;
}
