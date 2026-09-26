/**
 * ADR-235 HC7 — 내보낸 파일은 자립적이다. v1 JSON 내보내기는 `asset:` 참조를 자산 바이트의
 * dataURL 로 되살려 인라인한다 (문서 · 폰트 레지스트리 · collections · 변수 모두).
 * 자산을 찾지 못하면 실패 — 참조만 든 파일을 만들지 않는다.
 */
import type { AssetRef } from "@composition/shared";
import {
  encodeDataUrl,
  findAssetRefs as collectAssetRefs,
  hashFromRef as assetHashFromRef,
  mapAssetRefs,
} from "@composition/shared/assets";
import { readAssetRecords } from "./assetDb";
import { AssetMissingError } from "./assetStore";

export async function inlineAssetRefs<T>(value: T): Promise<T> {
  const refs = collectAssetRefs(value);
  if (refs.size === 0) return value;
  const records = await readAssetRecords(
    [...refs].map((ref) => assetHashFromRef(ref) as string),
  );
  const dataUrls = new Map<AssetRef, string>();
  for (const ref of refs) {
    const record = records.get(assetHashFromRef(ref) as string);
    if (!record) throw new AssetMissingError(ref);
    const bytes = new Uint8Array(await record.blob.arrayBuffer());
    dataUrls.set(ref, encodeDataUrl(record.mime, bytes));
  }
  return mapAssetRefs(value, (ref) => dataUrls.get(ref) as string);
}
