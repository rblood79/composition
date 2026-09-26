/**
 * ADR-235 자산 저장소 스키마 — IndexedDB `composition` DB 의 `assets` · `asset_gc` store.
 *
 * 생성은 `lib/db/indexedDB/adapter.ts` 의 upgrade (DB_VERSION 23) 한 곳이 맡는다.
 * 이 파일은 store 이름·레코드 모양만 둔다 — 소형 reader (Preview · publish) 가
 * adapter 전체를 import 하지 않도록 (HC2).
 */

export const ASSET_DB_NAME = "composition";
export const ASSETS_STORE = "assets";
export const ASSET_GC_STORE = "asset_gc";

/**
 * IndexedDB 에 저장하는 모양 — 바이트는 ArrayBuffer (`data`). Blob 은 WebKit 비공개 (임시) 저장소가
 * IndexedDB 에 넣기를 거부해 (Playwright WebKit 26.5 실측 — ArrayBuffer 는 정상) Safari 에서 데이터를
 * 잃는 경로가 된다 (HC5). `blob` 은 초기 (2026-09-26 Phase 1~6) 레코드 호환 읽기용.
 */
export interface StoredAssetRecord extends Omit<AssetRecord, "blob"> {
  data?: ArrayBuffer;
  blob?: Blob;
}

/** 읽은 뒤의 모양 — 바이트를 Blob 으로 준다. keyPath `hash`. 원본 바이트 그대로 (재인코딩 없음). */
export interface AssetRecord {
  /** 내용 SHA-256 hex */
  hash: string;
  mime: string;
  /** 바이트 수 */
  bytes: number;
  /** 파일 형식 v2 의 `assets/<hash>.<ext>` 확장자 */
  ext: string;
  /** 원본 파일 이름 (표시용, 선택) */
  name?: string;
  blob: Blob;
  createdAt: number;
}

/**
 * GC 메타데이터 (breakdown §3.1). 문서의 쓰기 원본이 아니다 — root 는 문서·history·
 * 백업·폰트에서 수집한다. 바이트가 지워져도 레코드는 남겨 epoch 를 재사용하지 않는다.
 */
export interface AssetGcRecord {
  hash: string;
  /** 참조 공개 · pin 해제 · 삭제마다 증가 (단조) */
  referenceEpoch: number;
  /** 참조를 공개한 세션 (탭) id — 메모리 전용 참조 · 미완료 영속화 보호 */
  pins: string[];
  /** 미참조 후보 — 관측 epoch 와 첫 관측 시각 */
  candidate?: { epoch: number; since: number };
  /** 바이트가 지워졌으면 삭제 시각 (tombstone) */
  deletedAt?: number;
}
