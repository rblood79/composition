/**
 * ADR-235 Phase 4 — publish 의 형식 v2 로더 (lazy).
 *
 * - v2 디렉토리: `manifest.json` URL (또는 그 폴더 URL) — part · 자산을 **manifest 위치 기준 상대
 *   경로**로 읽는다 (`loadProjectFromUrl` 은 base 를 모르고 페이지 URL 기준으로 풀었다, G0 (c)).
 *   자산 참조는 같은 상대 경로의 절대 URL 로 해석한다.
 * - v2 zip: 파일 · URL 의 zip 바이트 — 자산은 `blob:` URL 로.
 *
 * v2 가 아니면 `null` — 호출자가 v1 JSON 경로로 계속한다. 해석기는 이 실행 문맥 (publish 탭) 에
 * 정적 표로 설치한다.
 */
import {
  assetPath,
  isZipBytes,
  openV2Zip,
  readV2Generation,
  type V2ReadResult,
  type V2Source,
} from "@composition/shared/assets";
import type {
  AssetRef,
  AssetUrlResolver,
  ProjectExportData,
} from "@composition/shared";
import { setAssetUrlResolver } from "@composition/shared/utils";

export interface LoadedProjectV2 {
  data: ProjectExportData;
  recovered: boolean;
}

function toExportData(read: V2ReadResult): ProjectExportData {
  const { content, manifest } = read;
  return {
    version: manifest.formatVersion,
    exportedAt: manifest.savedAt,
    project: content.project,
    document: content.document,
    currentPageId: content.currentPageId ?? null,
    ...(content.fontRegistry ? { fontRegistry: content.fontRegistry } : {}),
    ...(content.metadata ? { metadata: content.metadata } : {}),
    ...(content.collections ? { collections: content.collections } : {}),
    ...(content.apiEndpoints ? { apiEndpoints: content.apiEndpoints } : {}),
    ...(content.variables ? { variables: content.variables } : {}),
  } as ProjectExportData;
}

function installStaticResolver(urls: Map<AssetRef, string>): void {
  const resolver: AssetUrlResolver = {
    resolveSync: (ref) => urls.get(ref) ?? null,
    ensure: async () => {},
    subscribe: () => () => {},
  };
  setAssetUrlResolver(resolver);
}

async function fromZip(bytes: Uint8Array): Promise<LoadedProjectV2> {
  const read = await readV2Generation(await openV2Zip(bytes));
  const urls = new Map<AssetRef, string>();
  for (const [hash, asset] of read.assets) {
    urls.set(
      `asset:sha256-${hash}` as AssetRef,
      URL.createObjectURL(
        new Blob([asset.bytes as BlobPart], { type: asset.mime }),
      ),
    );
  }
  installStaticResolver(urls);
  return { data: toExportData(read), recovered: read.recovered };
}

async function fromDirectory(manifestUrl: URL): Promise<LoadedProjectV2> {
  const source: V2Source = {
    async read(path) {
      const response = await fetch(new URL(path, manifestUrl));
      return response.ok ? new Uint8Array(await response.arrayBuffer()) : null;
    },
  };
  const read = await readV2Generation(source);
  const urls = new Map<AssetRef, string>(
    read.manifest.assets.map((entry) => [
      `asset:sha256-${entry.hash}` as AssetRef,
      new URL(assetPath(entry), manifestUrl).href,
    ]),
  );
  installStaticResolver(urls);
  return { data: toExportData(read), recovered: read.recovered };
}

/** URL 이 v2 (zip · manifest · 폴더) 면 읽는다. 아니면 null. */
export async function loadProjectV2FromUrl(
  url: string,
): Promise<LoadedProjectV2 | null> {
  const base = new URL(url, window.location.href);
  const candidates = base.pathname.endsWith("/")
    ? [new URL("manifest.json", base)]
    : [base];
  for (const candidate of candidates) {
    const response = await fetch(candidate).catch(() => null);
    if (!response?.ok) continue;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (isZipBytes(bytes)) return fromZip(bytes);
    try {
      const json = JSON.parse(new TextDecoder().decode(bytes)) as {
        formatVersion?: string;
      };
      if (json?.formatVersion === "2.0.0") return fromDirectory(candidate);
    } catch {
      /* JSON 이 아니면 v2 아님 */
    }
  }
  return null;
}

export async function loadProjectV2FromFile(
  file: File,
): Promise<LoadedProjectV2 | null> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return isZipBytes(bytes) ? fromZip(bytes) : null;
}
