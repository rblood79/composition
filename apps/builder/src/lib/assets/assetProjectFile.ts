/**
 * ADR-235 Phase 4 — 프로젝트 파일 v2 (zip) 내보내기 · 가져오기 (builder 쪽).
 *
 * - 내보내기: 문서 · 문서 밖 상태를 v2 세대로 묶고 참조된 자산 바이트를 `assets/` 로 넣는다.
 *   자산이 없으면 실패 (HC7 — 참조만 든 파일 금지).
 * - 가져오기: zip 을 열어 (`manifest.json` 손상이면 직전 세대로 복구) 자산 바이트를 자산 저장소에
 *   저장 (pin) 한 뒤 v1 과 같은 envelope 로 돌려준다 — 적용은 기존 가져오기 경로가 한다.
 *
 * lazy 전용 모듈.
 */
import {
  buildV2Generation,
  findAssetRefs,
  hashFromRef,
  isZipBytes,
  openV2Zip,
  packV2Zip,
  readV2Generation,
  type ProjectContentV2,
} from "@composition/shared/assets";
import { readAssetRecords } from "./assetDb";
import { storeAssetBytes } from "./assetStore";
import { installIndexedDbAssetUrlResolver } from "./assetUrlResolver";

export async function exportProjectV2Zip(
  content: ProjectContentV2,
): Promise<Blob> {
  const generation = await buildV2Generation(content, async (hash) => {
    const record = (await readAssetRecords([hash])).get(hash);
    if (!record) return null;
    return {
      bytes: new Uint8Array(await record.blob.arrayBuffer()),
      mime: record.mime,
      ext: record.ext,
      ...(record.name ? { name: record.name } : {}),
    };
  });
  return packV2Zip(generation);
}

export async function isProjectZipFile(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return isZipBytes(head);
}

export interface ImportedProjectV2 {
  /** v1 `ProjectExportData` 와 같은 모양 (version 만 "2.0.0") */
  data: {
    version: string;
    exportedAt: string;
    project: { id: string; name: string };
    document: unknown;
    currentPageId: string | null;
    fontRegistry?: unknown;
    metadata?: unknown;
    collections?: unknown[];
    apiEndpoints?: unknown[];
    variables?: unknown[];
  };
  recovered: boolean;
  assets: number;
}

export async function readProjectV2Zip(file: Blob): Promise<ImportedProjectV2> {
  const read = await readV2Generation(
    await openV2Zip(new Uint8Array(await file.arrayBuffer())),
  );
  const resolver = installIndexedDbAssetUrlResolver();
  for (const [hash, asset] of read.assets) {
    const stored = await storeAssetBytes({
      bytes: asset.bytes,
      mime: asset.mime,
      name: asset.name,
    });
    // 파일의 hash 와 저장 hash 가 같아야 참조가 그대로 유효하다 (readV2Generation 이 이미 검증)
    if (hashFromRef(stored.ref) !== hash) {
      throw new Error(`자산 해시 불일치: ${hash}`);
    }
    resolver.register(stored.ref, stored.blob);
  }
  const { content } = read;
  return {
    data: {
      version: read.manifest.formatVersion,
      exportedAt: read.manifest.savedAt,
      project: content.project,
      document: content.document,
      currentPageId: content.currentPageId ?? null,
      ...(content.fontRegistry !== undefined
        ? { fontRegistry: content.fontRegistry }
        : {}),
      ...(content.metadata !== undefined ? { metadata: content.metadata } : {}),
      ...(content.collections ? { collections: content.collections } : {}),
      ...(content.apiEndpoints ? { apiEndpoints: content.apiEndpoints } : {}),
      ...(content.variables ? { variables: content.variables } : {}),
    },
    recovered: read.recovered,
    assets: read.assets.size,
  };
}

/**
 * 정적 HTML 내보내기 (`exportProject` 의 `assetFiles`) 용 — 값이 참조하는 자산을
 * `assets/<hash>.<ext>` 상대 경로 파일로. 없는 자산이 있으면 실패 (HC7).
 */
export async function collectStaticAssetFiles(
  value: unknown,
): Promise<{ ref: string; path: string; data: ArrayBuffer }[]> {
  const files: { ref: string; path: string; data: ArrayBuffer }[] = [];
  for (const ref of findAssetRefs(value)) {
    const hash = hashFromRef(ref) as string;
    const record = (await readAssetRecords([hash])).get(hash);
    if (!record) throw new Error(`자산 바이트가 없습니다: ${ref}`);
    files.push({
      ref,
      path: `assets/${hash}.${record.ext}`,
      data: await record.blob.arrayBuffer(),
    });
  }
  return files;
}
