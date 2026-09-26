/**
 * ADR-235 Phase 4 — 프로젝트 형식 v2 (breakdown §2).
 *
 * ```
 * <name>.composition/            ← 디렉토리 (작업) 또는 같은 구조의 zip (교환)
 * ├── manifest.json              현재 세대 — manifests/<revision>.json 과 같은 내용
 * ├── manifests/<revision>.json  불변 세대 기록 (디렉토리만 · zip 은 현재 세대 1개)
 * ├── parts/<sha256>.json        불변 part — document · collections · apiEndpoints · variables · fonts
 * └── assets/<sha256>.<ext>      원본 바이트 그대로 (불변)
 * ```
 *
 * 세대 전환 (디렉토리): 없는 자산 · part 파일 쓰기 → 크기 · 해시 재확인 → `manifests/<rev>.json`
 * → `manifest.json` 교체 → 보존 세대 밖 파일 정리. 기존 파일은 덮어쓰지 않는다 (불변 경로).
 * 읽기: `manifest.json` 이 파싱 실패 · part 누락 · 해시 불일치면 `manifests/` 를 revision
 * 내림차순으로 훑어 part 가 전부 있는 첫 세대를 쓴다.
 *
 * 이 파일은 lazy 전용 서브경로 (`@composition/shared/assets`) — 값 import 는 같은 폴더만.
 */
import type { AssetRef } from "../utils/assetRef";
import { findAssetRefs, hashFromRef, sha256Hex } from "./assetBytes";

export const FORMAT_V2_VERSION = "2.0.0";

export interface V2PartRef {
  path: string;
  bytes: number;
  sha256: string;
}

export interface V2AssetEntry {
  hash: string;
  mime: string;
  bytes: number;
  ext: string;
  name?: string;
}

export type V2PartKey =
  "document" | "collections" | "apiEndpoints" | "variables" | "fonts";

export interface ManifestV2 {
  formatVersion: typeof FORMAT_V2_VERSION;
  project: { id: string; name: string };
  revision: number;
  previousRevision: number | null;
  savedAt: string;
  parts: { document: V2PartRef } & Partial<Record<V2PartKey, V2PartRef>>;
  assets: V2AssetEntry[];
  editor: { currentPageId: string | null };
  metadata?: unknown;
}

/** 형식과 무관한 프로젝트 내용 — v1 `ProjectExportData` 의 문서 · 문서 밖 상태 */
export interface ProjectContentV2 {
  project: { id: string; name: string };
  document: unknown;
  collections?: unknown[];
  apiEndpoints?: unknown[];
  variables?: unknown[];
  fontRegistry?: unknown;
  currentPageId?: string | null;
  metadata?: unknown;
}

export interface V2AssetBytes {
  bytes: Uint8Array;
  mime: string;
  ext: string;
  name?: string;
}

export class V2AssetMissingError extends Error {
  constructor(readonly ref: string) {
    super(`자산 바이트가 없어 v2 파일을 만들 수 없습니다: ${ref}`);
    this.name = "V2AssetMissingError";
  }
}

export class V2FormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "V2FormatError";
  }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function assetPath(entry: Pick<V2AssetEntry, "hash" | "ext">): string {
  return `assets/${entry.hash}.${entry.ext}`;
}

export function manifestPath(revision: number): string {
  return `manifests/${String(revision).padStart(8, "0")}.json`;
}

async function part(
  value: unknown,
): Promise<{ ref: V2PartRef; bytes: Uint8Array }> {
  const bytes = encoder.encode(JSON.stringify(value));
  const sha256 = await sha256Hex(bytes);
  return {
    ref: { path: `parts/${sha256}.json`, bytes: bytes.byteLength, sha256 },
    bytes,
  };
}

export interface V2Generation {
  manifest: ManifestV2;
  /** 이 세대가 가리키는 파일 전부 (manifest.json · manifests/ 제외) */
  files: Map<string, Uint8Array>;
}

/**
 * 내용 → v2 세대 (part · 자산 파일 + manifest). 자산 바이트는 `getAsset` 이 준다 — 없으면
 * 실패 (참조만 든 파일을 만들지 않는다, HC7).
 */
export async function buildV2Generation(
  content: ProjectContentV2,
  getAsset: (hash: string) => Promise<V2AssetBytes | null>,
  generation: {
    revision: number;
    previousRevision: number | null;
    savedAt?: string;
  } = {
    revision: 1,
    previousRevision: null,
  },
): Promise<V2Generation> {
  const files = new Map<string, Uint8Array>();
  const refs = findAssetRefs([
    content.document,
    content.collections,
    content.apiEndpoints,
    content.variables,
    content.fontRegistry,
  ]);
  const assets: V2AssetEntry[] = [];
  for (const ref of [...refs].sort()) {
    const hash = hashFromRef(ref) as string;
    const asset = await getAsset(hash);
    if (!asset) throw new V2AssetMissingError(ref);
    const entry: V2AssetEntry = {
      hash,
      mime: asset.mime,
      bytes: asset.bytes.byteLength,
      ext: asset.ext,
      ...(asset.name ? { name: asset.name } : {}),
    };
    assets.push(entry);
    files.set(assetPath(entry), asset.bytes);
  }
  const parts: ManifestV2["parts"] = {
    document: (await part(content.document)).ref,
  };
  files.set(
    parts.document.path,
    encoder.encode(JSON.stringify(content.document)),
  );
  const optional: [V2PartKey, unknown][] = [
    ["collections", content.collections],
    ["apiEndpoints", content.apiEndpoints],
    ["variables", content.variables],
    ["fonts", content.fontRegistry],
  ];
  for (const [key, value] of optional) {
    if (value === undefined) continue;
    const built = await part(value);
    parts[key] = built.ref;
    files.set(built.ref.path, built.bytes);
  }
  const manifest: ManifestV2 = {
    formatVersion: FORMAT_V2_VERSION,
    project: content.project,
    revision: generation.revision,
    previousRevision: generation.previousRevision,
    savedAt: generation.savedAt ?? new Date().toISOString(),
    parts,
    assets,
    editor: { currentPageId: content.currentPageId ?? null },
    ...(content.metadata !== undefined ? { metadata: content.metadata } : {}),
  };
  return { manifest, files };
}

export function encodeManifest(manifest: ManifestV2): Uint8Array {
  return encoder.encode(JSON.stringify(manifest, null, 2));
}

export interface V2Source {
  read(path: string): Promise<Uint8Array | null>;
  /** 디렉토리 전용 — `manifests/` 파일 이름 목록 (zip 은 없음) */
  listManifests?(): Promise<string[]>;
}

export interface V2ReadResult {
  manifest: ManifestV2;
  content: ProjectContentV2;
  assets: Map<string, V2AssetBytes>;
  /** `manifest.json` 대신 `manifests/` 의 직전 유효 세대로 복구했으면 true */
  recovered: boolean;
}

function parseManifest(bytes: Uint8Array | null): ManifestV2 | null {
  if (!bytes) return null;
  try {
    const value = JSON.parse(decoder.decode(bytes)) as ManifestV2;
    if (value?.formatVersion !== FORMAT_V2_VERSION || !value.parts?.document) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

/** 한 세대를 읽는다 — part 누락 · 해시 불일치 · 자산 누락이면 null */
async function readGeneration(
  source: V2Source,
  manifest: ManifestV2,
): Promise<Omit<V2ReadResult, "recovered"> | null> {
  const values: Partial<Record<V2PartKey, unknown>> = {};
  for (const [key, ref] of Object.entries(manifest.parts) as [
    V2PartKey,
    V2PartRef,
  ][]) {
    const bytes = await source.read(ref.path);
    if (!bytes || bytes.byteLength !== ref.bytes) return null;
    if ((await sha256Hex(bytes)) !== ref.sha256) return null;
    try {
      values[key] = JSON.parse(decoder.decode(bytes));
    } catch {
      return null;
    }
  }
  const assets = new Map<string, V2AssetBytes>();
  for (const entry of manifest.assets) {
    const bytes = await source.read(assetPath(entry));
    if (!bytes || (await sha256Hex(bytes)) !== entry.hash) return null;
    assets.set(entry.hash, {
      bytes,
      mime: entry.mime,
      ext: entry.ext,
      ...(entry.name ? { name: entry.name } : {}),
    });
  }
  return {
    manifest,
    assets,
    content: {
      project: manifest.project,
      document: values.document,
      ...(values.collections !== undefined
        ? { collections: values.collections as unknown[] }
        : {}),
      ...(values.apiEndpoints !== undefined
        ? { apiEndpoints: values.apiEndpoints as unknown[] }
        : {}),
      ...(values.variables !== undefined
        ? { variables: values.variables as unknown[] }
        : {}),
      ...(values.fonts !== undefined ? { fontRegistry: values.fonts } : {}),
      currentPageId: manifest.editor?.currentPageId ?? null,
      ...(manifest.metadata !== undefined
        ? { metadata: manifest.metadata }
        : {}),
    },
  };
}

/**
 * v2 읽기 — `manifest.json` 이 유효하지 않으면 `manifests/` 를 revision 내림차순으로 훑어
 * 파일이 전부 있는 첫 세대를 쓴다. 어느 세대도 없으면 `V2FormatError`.
 */
export async function readV2Generation(
  source: V2Source,
): Promise<V2ReadResult> {
  const current = parseManifest(await source.read("manifest.json"));
  if (current) {
    const read = await readGeneration(source, current);
    if (read) return { ...read, recovered: false };
  }
  const names = (await source.listManifests?.()) ?? [];
  for (const name of [...names].sort().reverse()) {
    const manifest = parseManifest(await source.read(`manifests/${name}`));
    if (!manifest) continue;
    const read = await readGeneration(source, manifest);
    if (read) return { ...read, recovered: true };
  }
  throw new V2FormatError(
    "유효한 v2 세대가 없습니다 (manifest.json · manifests/ 모두 읽을 수 없음)",
  );
}

/** v2 자산 참조 ↔ 파일 경로 (정적 HTML · publish 상대 경로 해석) */
export function v2AssetPathMap(manifest: ManifestV2): Map<AssetRef, string> {
  return new Map(
    manifest.assets.map((entry) => [
      `asset:sha256-${entry.hash}` as AssetRef,
      assetPath(entry),
    ]),
  );
}

// ============================================
// zip (교환) — 같은 구조, 현재 세대 1개
// ============================================

/** v2 zip 판정 — ZIP 로컬 헤더 매직 `PK\x03\x04` */
export function isZipBytes(bytes: Uint8Array): boolean {
  return (
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}

export async function packV2Zip(generation: V2Generation): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  zip.file("manifest.json", encodeManifest(generation.manifest));
  for (const [path, bytes] of generation.files) {
    // 이미지 · 폰트는 이미 압축된 형식이라 STORE, JSON part 만 DEFLATE
    zip.file(path, bytes, {
      compression: path.startsWith("parts/") ? "DEFLATE" : "STORE",
    });
  }
  return zip.generateAsync({ type: "blob", mimeType: "application/zip" });
}

export async function openV2Zip(
  data: Blob | Uint8Array | ArrayBuffer,
): Promise<V2Source> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(data);
  // zip 안에 최상위 폴더 하나로 묶인 경우 (`<name>.composition/manifest.json`) 도 읽는다
  const manifestEntry = Object.keys(zip.files).find(
    (name) => name === "manifest.json" || /^[^/]+\/manifest\.json$/.test(name),
  );
  const prefix = manifestEntry?.includes("/")
    ? manifestEntry.slice(0, manifestEntry.indexOf("/") + 1)
    : "";
  return {
    async read(path) {
      const file = zip.file(`${prefix}${path}`);
      return file ? new Uint8Array(await file.async("uint8array")) : null;
    },
    async listManifests() {
      return Object.keys(zip.files)
        .filter(
          (name) =>
            name.startsWith(`${prefix}manifests/`) && name.endsWith(".json"),
        )
        .map((name) => name.slice(`${prefix}manifests/`.length));
    },
  };
}

/** 이미 받은 파일 map (디렉토리 선택 · 테스트) 을 source 로 */
export function mapV2Source(files: ReadonlyMap<string, Uint8Array>): V2Source {
  return {
    async read(path) {
      return files.get(path) ?? null;
    },
    async listManifests() {
      return [...files.keys()]
        .filter((name) => name.startsWith("manifests/"))
        .map((name) => name.slice("manifests/".length));
    },
  };
}
