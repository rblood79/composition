/**
 * Dashboard Types
 *
 * 대시보드에서 사용하는 프로젝트 관련 타입 정의.
 *
 * (ADR-128) cloud data layer dead 정책 — 모든 ProjectListItem 은 local-only.
 * cloud/sync/conflict 관련 필드는 호환 보존을 위해 type 만 유지하고 실 값은
 * 항상 `{ local: true, cloud: false }` / `{ status: "local-only" }`.
 */

/**
 * 프로젝트 저장 위치
 */
export interface ProjectStorage {
  local: boolean; // IndexedDB에 존재
  cloud: boolean; // (deprecated) — ADR-128 이후 항상 false
  filePath?: string; // .composition 파일 경로 (있는 경우)
}

/**
 * 프로젝트 동기화 상태 (ADR-128 이후 사실상 "local-only" 만 사용)
 */
export type SyncStatus = "local-only" | "cloud-only" | "synced" | "conflict";

/**
 * 프로젝트 동기화 정보
 */
export interface ProjectSync {
  status: SyncStatus;
  lastSyncAt?: Date;
  localUpdatedAt?: Date;
  cloudUpdatedAt?: Date;
}

/**
 * 대시보드 프로젝트 목록 아이템
 */
export interface ProjectListItem {
  id: string;
  name: string;

  storage: ProjectStorage;
  sync: ProjectSync;

  thumbnail?: string;
  pageCount?: number;
  elementCount?: number;
  createdAt: Date;
  lastModified: Date;
}

/**
 * 프로젝트 필터 타입 (ADR-128 이후 "all" / "local" 만 의미 있음)
 */
export type ProjectFilter = "all" | "local" | "cloud";

/**
 * 저장 위치 뱃지 정보
 */
export interface StorageBadge {
  icon: string;
  label: string;
  className: string;
}

/**
 * 사용 가능한 액션 정보
 */
export interface ProjectActions {
  canSync: boolean;
  canDownload: boolean;
  canOpen: boolean;
  canExport: boolean;
}
