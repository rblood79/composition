/**
 * ADR-201 — FileUpload 런타임 층 (canonical 문서 밖). 엔진 `@composition/upload` 은 lazy 로만.
 */
export {
  loadUploadEngine,
  resetUploadEngineLoaderForTests,
  type UploadEngineLoader,
  type UploadReactModule,
} from "./loadUploadEngine";
export {
  FileUploadContext,
  useFileUploadIntake,
  filesFromDropEvent,
  type FileUploadIntake,
} from "./fileUploadContext";
export { DropZoneIntake, FileTriggerIntake } from "./intakeAdapters";
export {
  resolveUploadEndpoint,
  type UploadEndpointResolution,
} from "./resolveUploadEndpoint";
export {
  findPlaintextTokens,
  isVaultPlaceholder,
  VAULT_PLACEHOLDER_PREFIX,
  type PlaintextTokenFinding,
} from "./plaintextTokenGate";
