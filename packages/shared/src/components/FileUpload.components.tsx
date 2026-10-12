import { useSyncExternalStore } from "react";
import {
  FileUploadInbox,
  FileUploadModuleResource,
} from "./fileUploadResources";
/**
 * FileUpload — 대용량 파일 업로드 compound 의 DOM consumer (ADR-201 Phase 3).
 *
 * 두 상태를 그린다:
 *   - **idle (디자인 타임 샘플 상태)**: host 가 넘긴 canonical 자식 (DropZone · FileTrigger ·
 *     ProgressBar 샘플 행 2) 을 그대로 그린다 — Skia 가 그리는 것과 같은 트리라 대칭이 자동이다 (R7).
 *   - **active (파일이 들어온 뒤)**: 입력 표면 (DropZone/FileTrigger 자식) 은 유지하고 샘플 행
 *     대신 런타임 행 — RAC `GridList` 안에 `ProgressBar` (파일명 · 크기 · 진행률 · R1 에러 코드).
 *
 * 이 파일은 **idle 껍데기**만이다 (ADR-201 후속 번들 축소) — active 분기 (endpoint 해석 · CSRF ·
 * 런타임 행) 는 `./FileUploadActive` 를 첫 파일 유입 때 `import()` 하고, 전송 엔진
 * `@composition/upload/react` 는 그 뒤 `loadEngine` 으로 따로 가져온다 (HC1). 둘 다 initial chunk 밖.
 * 로드 실패는 throw 가 아니라 `E_ENGINE_UNAVAILABLE` 안전 상태 (정적 UI 유지 · console error 0).
 * 큐 상태는 전부 React 상태 — canonical 문서에 쓰지 않는다 (`selectedFiles` 채널 제거와 짝).
 *
 * `endpoint` 는 `ApiEndpointDefinition.id` 참조다 — URL·헤더는 `CollectionDataContext` 의
 * endpoint 목록에서 런타임에 해석 (`resolveUploadEndpoint`). 문서에 정적 비밀 0 (HC7).
 * `dryRun` 은 바이트 미전송 진행률 시뮬레이션. 미지정이면 endpoint 정의의 `uploadDryRun` (Data 패널
 * 토글, 기본 true) 을 따르고, publish 는 `dryRun={false}` 를 명시해 항상 실전송한다 (ADR-201 Phase 4).
 * CSRF: 서버 계약 §5 — `XSRF-TOKEN` 쿠키 (HttpOnly 아님) 가 있으면 요청마다 `X-CSRF-TOKEN` 헤더로 되돌린다.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";

import { useCollectionDataServices } from "../hooks/collectionDataContext";

import {
  FileUploadContext,
  type FileUploadIntake,
} from "../upload/fileUploadContext";

import { loadUploadEngine } from "../upload/loadUploadEngine";
import {
  FileUploadProps,
  loadActiveModule,
  partitionChildren,
} from "./FileUpload.runtime";

export function FileUpload({
  endpoint,
  chunkSize,
  parallelUploads,
  retryDelays,
  maxFileSize,
  acceptedFileTypes: _acceptedFileTypes,
  allowsMultiple: _allowsMultiple,
  acceptDirectory: _acceptDirectory,
  autoProceed = true,
  showPreview = false,
  isDisabled = false,
  variant = "default",
  size = "M",
  dryRun: dryRunProp,
  loadEngine = loadUploadEngine,
  inputSurface,
  sampleRows,
  children,
  className,
  style,
  ...rest
}: FileUploadProps) {
  // acceptedFileTypes/allowsMultiple/acceptDirectory 는 canonical 자식 FileTrigger 가 자기
  //   props 로 갖고 RAC 가 소비한다 — 여기서는 D2 표면 (Properties 패널) 으로만 존재.
  void _acceptedFileTypes;
  void _allowsMultiple;
  void _acceptDirectory;

  const services = useCollectionDataServices();
  const endpoints = useMemo(
    () => services.apiEndpointService?.getApiEndpoints() ?? [],
    [services.apiEndpointService],
  );

  const [activeSource] = useState(
    () => new FileUploadModuleResource(loadActiveModule),
  );
  const engineSource = useMemo(
    () => new FileUploadModuleResource(loadEngine),
    [loadEngine],
  );
  const [inbox] = useState(() => new FileUploadInbox());
  const active = useSyncExternalStore(
    activeSource.subscribe,
    activeSource.getSnapshot,
    activeSource.getSnapshot,
  );
  const engine = useSyncExternalStore(
    engineSource.subscribe,
    engineSource.getSnapshot,
    engineSource.getSnapshot,
  );
  const pending = useSyncExternalStore(
    inbox.subscribe,
    inbox.getSnapshot,
    inbox.getSnapshot,
  );
  const [hasIntake, setHasIntake] = useState(false);

  // endpoint 해석은 active 모듈이 온 뒤에만 (그 전엔 파일이 pending 에 쌓인다).
  const resolution = useMemo(
    () =>
      active.status === "ready"
        ? active.mod.resolveUploadEndpoint(endpoint, endpoints)
        : null,
    [active, endpoint, endpoints],
  );
  const dryRun =
    dryRunProp ?? (resolution?.ok ? resolution.uploadDryRun : true);
  const transportBlocked = resolution !== null && !dryRun && !resolution.ok;

  const addFiles = useCallback(
    (files: File[]) => {
      if (isDisabled || files.length === 0) return;
      setHasIntake(true);
      inbox.add(files);
      activeSource.load();
    },
    [isDisabled, inbox, activeSource],
  );

  // active 모듈 도착 → endpoint 가 열려 있을 때만 엔진 로드 (막힌 경우 상태 줄에 코드만, m4).
  useEffect(() => {
    if (!hasIntake || resolution === null) return;
    if (transportBlocked) {
      inbox.drain();
      return;
    }
    engineSource.load();
  }, [hasIntake, resolution, transportBlocked, engineSource, inbox]);

  const intake = useMemo<FileUploadIntake>(
    () => ({ addFiles, isDisabled }),
    [addFiles, isDisabled],
  );

  const config = useMemo(
    () =>
      resolution
        ? {
            resolution,
            dryRun,
            chunkSize,
            parallelUploads,
            retryDelays,
            maxFileSize,
            autoProceed,
          }
        : null,
    [
      resolution,
      dryRun,
      chunkSize,
      parallelUploads,
      retryDelays,
      maxFileSize,
      autoProceed,
    ],
  );

  const drain = useCallback(() => inbox.drain(), [inbox]);

  const partitioned = useMemo(
    () =>
      inputSurface !== undefined || sampleRows !== undefined
        ? { input: [inputSurface], rows: [sampleRows] }
        : partitionChildren(children),
    [inputSurface, sampleRows, children],
  );

  const isActive =
    hasIntake &&
    active.status === "ready" &&
    engine.status === "ready" &&
    config !== null &&
    !transportBlocked;
  const statusCode = transportBlocked
    ? (resolution as { code: string }).code
    : active.status === "unavailable" || engine.status === "unavailable"
      ? "E_ENGINE_UNAVAILABLE"
      : null;

  return (
    <FileUploadContext.Provider value={intake}>
      <div
        {...rest}
        className={["react-aria-FileUpload", className]
          .filter(Boolean)
          .join(" ")}
        data-variant={variant}
        data-size={size}
        data-disabled={isDisabled || undefined}
        data-upload-state={isActive ? "active" : "idle"}
        style={style as CSSProperties | undefined}
      >
        {partitioned.input}
        {isActive && active.status === "ready" && engine.status === "ready" ? (
          <active.mod.FileUploadActive
            mod={engine.mod}
            config={config}
            pending={pending}
            onDrain={drain}
            showPreview={showPreview}
          />
        ) : (
          partitioned.rows
        )}
        {hasIntake && statusCode ? (
          <span
            className="react-aria-FileUpload-status"
            role="status"
            data-code={statusCode}
          >
            {statusCode}
          </span>
        ) : null}
      </div>
    </FileUploadContext.Provider>
  );
}
