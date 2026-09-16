/**
 * `@composition/upload` 공용 타입 (ADR-201 §3-2).
 *
 * 이 파일은 브라우저 API 를 참조하지 않는다 — `File`/`Blob` 은 TS lib.dom 의 타입만 쓰고
 * 런타임 접근은 driver 층에서만 일어난다.
 */

export type UploadStatus =
  "queued" | "creating" | "uploading" | "paused" | "done" | "error";

/** R1 에러 코드 표 — README §에러 코드 참조 */
export type UploadErrorCode =
  | "E_PATCH_BLOCKED"
  | "E_PROXY_TIMEOUT"
  | "E_OFFSET_MISMATCH"
  | "E_TOO_LARGE"
  | "E_NETWORK"
  | "E_UNAUTHORIZED"
  | "E_EXPIRED"
  | "E_CHECKSUM"
  | "E_REJECTED"
  | "E_SERVER"
  | "E_CANCELLED"
  | (string & {});

export interface UploadError {
  code: UploadErrorCode;
  status?: number;
  message: string;
  retryable: boolean;
}

export interface UploadItemState {
  id: string;
  /** `sha256(name|size|lastModified|endpoint)` hex — 계산 전에는 `""` */
  fingerprint: string;
  name: string;
  size: number;
  type: string;
  /** 폴더 선택 시 `webkitRelativePath` — 평탄화된 상대 경로 */
  relativePath?: string;
  /** 진행 힌트 (서버 커밋 offset + 전송 중 바이트). 진실은 서버 `Upload-Offset` */
  offset: number;
  url?: string;
  status: UploadStatus;
  attempt: number;
  lastError?: UploadError;
}

export type UploadProtocol = "tus" | "cloud" | "multipart";

/** driver 가 실행하는 HTTP 요청 — body 는 `File.slice` 결과를 그대로 넘긴다 (전체 읽기 0) */
export interface HttpRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: Blob | FormData | null;
  withCredentials?: boolean;
  /** 업로드 진행 (누적 loaded 바이트). XHR 만 지원, Fetch 는 호출 없음 */
  onProgress?: (loaded: number) => void;
  signal?: AbortSignal;
  /** ms — 0/undefined 면 driver 기본값 */
  timeout?: number;
}

export interface HttpResponse {
  status: number;
  header(name: string): string | null;
  text?: string;
}

/** 네트워크 실패는 reject — `code` 로 분류 (`E_NETWORK` / `E_PROXY_TIMEOUT` / `E_ABORTED`) */
export interface HttpDriver {
  send(request: HttpRequest): Promise<HttpResponse>;
}

/** 재개 정보 저장소 — fingerprint → url 만. 파일명·내용은 절대 저장하지 않는다 */
export interface ResumeStorage {
  get(fingerprint: string): Promise<ResumeRecord | null> | ResumeRecord | null;
  set(fingerprint: string, record: ResumeRecord): Promise<void> | void;
  remove(fingerprint: string): Promise<void> | void;
}

export interface ResumeRecord {
  url: string;
  /** epoch ms — `Upload-Expires` */
  expires?: number;
}

export interface UploadQueueOptions {
  endpoint: string;
  protocol?: UploadProtocol;
  /** 기본 8MB. `Infinity` = 단일 PATCH */
  chunkSize?: number;
  /** 기본 3 */
  parallelUploads?: number;
  /** 기본 `[0, 1000, 3000, 5000]` — 길이 = 최대 재시도 횟수 */
  retryDelays?: number[];
  maxFileSize?: number;
  headers?: Record<string, string>;
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
  /** 기본 true — 쿠키 세션 */
  withCredentials?: boolean;
  /** 기본 true */
  autoUpload?: boolean;
  metadata?: Record<string, string>;
  /** PATCH 차단 환경 — `POST + X-HTTP-Method-Override: PATCH`. 405 수신 시 1회 자동 전환 */
  overridePatchMethod?: boolean;
  /** 바이트 미전송 — preview 기본. 진행률은 시뮬레이션, 저장소는 메모리 */
  dryRun?: boolean;
  driver?: HttpDriver;
  storage?: ResumeStorage;
  /** `checksum` 확장 자동 활성 (서버가 광고할 때). 기본 true */
  checksum?: boolean;
  /** 요청 timeout ms (XHR). 기본 0 = 무제한 (Apache 60s 는 서버 쪽 knob) */
  requestTimeout?: number;
}

export interface UploadQueue {
  add(files: File[]): UploadItemState[];
  start(id?: string): void;
  pause(id?: string): void;
  resume(id?: string): void;
  cancel(id?: string): void;
  remove(id: string): void;
  getItems(): UploadItemState[];
  subscribe(listener: (items: UploadItemState[]) => void): () => void;
  destroy(): void;
}
