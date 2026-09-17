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
import React, {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { useCollectionDataServices } from "../hooks/collectionDataContext";
import {
  FileUploadContext,
  type FileUploadIntake,
} from "../upload/fileUploadContext";
import {
  loadUploadEngine,
  type UploadEngineLoader,
  type UploadReactModule,
} from "../upload/loadUploadEngine";

/** 입력 표면으로 분류하는 canonical 자식 type — active 상태에서도 유지된다. */
export const FILE_UPLOAD_INPUT_CHILD_TYPES: ReadonlySet<string> = new Set([
  "DropZone",
  "FileTrigger",
]);

type ActiveModule = typeof import("./FileUploadActive");

let cachedActive: Promise<ActiveModule | null> | null = null;
/** active 분기 lazy 로더 — 실패도 캐시 (엔진 로더와 같은 규약). */
function loadActiveModule(): Promise<ActiveModule | null> {
  if (!cachedActive) {
    cachedActive = import("./FileUploadActive").catch(() => null);
  }
  return cachedActive;
}

export interface FileUploadProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children"
> {
  /** `ApiEndpointDefinition.id` 참조 (Data 패널 API endpoint). */
  endpoint?: string;
  chunkSize?: number;
  parallelUploads?: number;
  /** ms 배열 — Properties 패널 `string-array` 라 문자열도 받는다. */
  retryDelays?: ReadonlyArray<number | string>;
  /** 바이트, 0 = 무제한 */
  maxFileSize?: number;
  acceptedFileTypes?: string[];
  allowsMultiple?: boolean;
  acceptDirectory?: boolean;
  autoProceed?: boolean;
  showPreview?: boolean;
  isDisabled?: boolean;
  variant?: string;
  size?: string;
  /**
   * 바이트 미전송 (진행률 시뮬레이션). 미지정 = endpoint 정의의 `uploadDryRun` (기본 true).
   * publish 는 false 명시 (breakdown §3-4 "preview 안전" + Phase 4 토글).
   */
  dryRun?: boolean;
  /** 엔진 로더 주입 (테스트 · 통합). 기본 = lazy `import("@composition/upload/react")`. */
  loadEngine?: UploadEngineLoader;
  /**
   * host 가 canonical 자식을 이미 분류해 넘기는 경로 (builder Preview `renderFileUpload`).
   * 없으면 `children` 을 element type 으로 분류한다 (publish `ElementRenderer`).
   */
  inputSurface?: ReactNode;
  sampleRows?: ReactNode;
  children?: ReactNode;
}

type LazyState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; mod: T }
  | { status: "unavailable" };

/** host 자식 요소의 canonical type — publish `ElementRenderer` 는 `element`, preview 는 `node`. */
function hostChildType(child: ReactNode): string | null {
  if (!isValidElement(child)) return null;
  const props = child.props as Record<string, unknown>;
  const element = props.element as { type?: unknown } | undefined;
  const node = props.node as { type?: unknown } | undefined;
  const type =
    element?.type ?? node?.type ?? (props["data-element-type"] as unknown);
  return typeof type === "string" ? type : null;
}

function partitionChildren(children: ReactNode): {
  input: ReactNode[];
  rows: ReactNode[];
} {
  const input: ReactNode[] = [];
  const rows: ReactNode[] = [];
  Children.forEach(children, (child) => {
    const type = hostChildType(child);
    if (type && FILE_UPLOAD_INPUT_CHILD_TYPES.has(type)) input.push(child);
    else rows.push(child);
  });
  return { input, rows };
}

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
  size = "md",
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

  const [active, setActive] = useState<LazyState<ActiveModule>>({
    status: "idle",
  });
  const [engine, setEngine] = useState<LazyState<UploadReactModule>>({
    status: "idle",
  });
  const [pending, setPending] = useState<File[]>([]);
  const [hasIntake, setHasIntake] = useState(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  const engineRef = useRef(engine);
  engineRef.current = engine;

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
      setPending((prev) => [...prev, ...files]);
      if (activeRef.current.status === "idle") {
        setActive({ status: "loading" });
        void loadActiveModule().then((mod) => {
          setActive(mod ? { status: "ready", mod } : { status: "unavailable" });
        });
      }
    },
    [isDisabled],
  );

  // active 모듈 도착 → endpoint 가 열려 있을 때만 엔진 로드 (막힌 경우 상태 줄에 코드만, m4).
  useEffect(() => {
    if (!hasIntake || resolution === null) return;
    if (transportBlocked) {
      setPending([]);
      return;
    }
    if (engineRef.current.status !== "idle") return;
    setEngine({ status: "loading" });
    void loadEngine().then((mod) => {
      setEngine(mod ? { status: "ready", mod } : { status: "unavailable" });
    });
  }, [hasIntake, resolution, transportBlocked, loadEngine]);

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

  const drain = useCallback(() => setPending([]), []);

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
