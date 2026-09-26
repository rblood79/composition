/**
 * ADR-235 Phase 2 writer — 업로드 (이미지 채우기 · 사용자 폰트) 가 원본 바이트를 자산 저장소에
 * 저장하고 `asset:` 참조를 돌려준다. 저장과 이 세션 pin 은 한 트랜잭션 (§3.1) 이고, 바이트는
 * 이 실행 문맥 해석기에 바로 등록해 IndexedDB 왕복 없이 그린다.
 *
 * lazy 전용 — `isAssetWriterEnabled()` 일 때 호출부가 dynamic import 한다.
 */
import { storeAssetBytes, type StoredAsset } from "./assetStore";
import { installIndexedDbAssetUrlResolver } from "./assetUrlResolver";

export async function storeUploadedFile(file: File): Promise<StoredAsset> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const stored = await storeAssetBytes({
    bytes,
    mime: file.type || "application/octet-stream",
    name: file.name,
  });
  installIndexedDbAssetUrlResolver().register(stored.ref, stored.blob);
  return stored;
}
