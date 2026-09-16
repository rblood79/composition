/**
 * `@composition/upload` — 대용량 파일 업로드 전송 엔진 (ADR-201). 런타임 의존 0.
 *
 * - `createUploadQueue(options)` — 동시 N · 재개 · backoff · TUS/multipart
 * - `reduce` — sans-I/O 상태기계 (테스트 · Rust 이식 대조용)
 * - driver: XHR (브라우저) · fetch (Node/Electron) · dry-run (preview) · localStorage 재개 저장소
 */
export type {
  HttpDriver,
  HttpRequest,
  HttpResponse,
  ResumeRecord,
  ResumeStorage,
  UploadError,
  UploadErrorCode,
  UploadItemState,
  UploadProtocol,
  UploadQueue,
  UploadQueueOptions,
  UploadStatus,
} from "./types";
export {
  createUploadQueue,
  relativePathOf,
  withRelativePath,
} from "./core/queue";
export { initialState, reduce } from "./core/protocol";
export type {
  Command,
  HttpOp,
  ProtocolConfig,
  UploadEvent,
  UploadState,
} from "./core/protocol";
export { fingerprint } from "./core/fingerprint";
export {
  createDryRunDriver,
  createFetchDriver,
  createLocalStorageDriver,
  createMemoryStorage,
  createXhrDriver,
  resolveStorage,
} from "./core/drivers";
export { createTusAdapter, encodeMetadata } from "./adapters/tus";
export { createMultipartAdapter } from "./adapters/multipart";
export type {
  AdapterCapabilities,
  AdapterContext,
  WireAdapter,
} from "./adapters/types";
export {
  ERROR_TABLE,
  codeOfStatus,
  errorOf,
  errorOfResponse,
  statusOf,
} from "./errors";
export type { ErrorSpec, KnownErrorCode } from "./errors";
