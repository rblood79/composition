/**
 * FileUpload — 대용량 파일 업로드 compound 의 DOM consumer (ADR-201 Phase 3).
 *
 * 두 상태를 그린다:
 *   - **idle (디자인 타임 샘플 상태)**: host 가 넘긴 canonical 자식 (DropZone · FileTrigger ·
 *     ProgressBar 샘플 행 2) 을 그대로 그린다 — Skia 가 그리는 것과 같은 트리라 대칭이 자동이다 (R7).
 *   - **active (파일이 들어온 뒤)**: 입력 표면 (DropZone/FileTrigger 자식) 은 유지하고 샘플 행
 *     대신 런타임 행 — RAC `GridList` 안에 `ProgressBar` (파일명 · 크기 · 진행률 · R1 에러 코드).
 *
 * 전송 엔진 `@composition/upload/react` 는 **첫 파일 유입 시** lazy 로드한다 (HC1). 로드 실패는
 * throw 가 아니라 `E_ENGINE_UNAVAILABLE` 안전 상태 (정적 UI 유지 · console error 0). 큐 상태는
 * 전부 React 상태 — canonical 문서에 쓰지 않는다 (`selectedFiles` 채널 제거와 짝).
 *
 * `endpoint` 는 `ApiEndpointDefinition.id` 참조다 — URL·헤더는 `CollectionDataContext` 의
 * endpoint 목록에서 런타임에 해석 (`resolveUploadEndpoint`). 문서에 정적 비밀 0 (HC7).
 * `dryRun` (preview 기본 true) 은 바이트 미전송 진행률 시뮬레이션 — 실서버 전송은 publish
 * 또는 host 가 `dryRun={false}` 를 넘길 때만.
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
import {
  GridList as AriaGridList,
  GridListItem as AriaGridListItem,
} from "react-aria-components/GridList";
import type { UploadItemState, UploadQueueOptions } from "@composition/upload";

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
import { resolveUploadEndpoint } from "../upload/resolveUploadEndpoint";
import { ProgressBar } from "./ProgressBar";

/** 미리보기 `<img>` 상한 (R4 — 파일 전체를 읽지 않지만 objectURL 디코드는 브라우저 메모리다). */
export const FILE_UPLOAD_PREVIEW_MAX_BYTES = 20 * 1024 * 1024;
/** 입력 표면으로 분류하는 canonical 자식 type — active 상태에서도 유지된다. */
export const FILE_UPLOAD_INPUT_CHILD_TYPES: ReadonlySet<string> = new Set([
  "DropZone",
  "FileTrigger",
]);

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
   * 바이트 미전송 (진행률 시뮬레이션). preview 기본 true — 실서버 전송은 publish 또는
   * host 의 명시 false 만 (breakdown §3-4 "preview 안전").
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

type EngineState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; mod: UploadReactModule }
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

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function toRetryDelays(
  value: ReadonlyArray<number | string> | undefined,
): number[] | undefined {
  if (!value) return undefined;
  const out = value
    .map((v) => (typeof v === "number" ? v : Number.parseInt(String(v), 10)))
    .filter((n) => Number.isFinite(n) && n >= 0);
  return out.length > 0 ? out : undefined;
}

function itemPercent(item: UploadItemState): number {
  if (item.status === "done") return 100;
  if (item.size <= 0) return 0;
  return Math.max(
    0,
    Math.min(100, Math.round((item.offset / item.size) * 100)),
  );
}

function canPreview(file: File, showPreview: boolean): boolean {
  return (
    showPreview &&
    file.size <= FILE_UPLOAD_PREVIEW_MAX_BYTES &&
    /^image\/(png|jpeg|gif|webp|avif|bmp)$/i.test(file.type) // SVG/HTML 제외 (§3-6)
  );
}

interface UploadRuntimeProps {
  mod: UploadReactModule;
  options: UploadQueueOptions;
  pending: File[];
  onDrain: () => void;
  showPreview: boolean;
}

/**
 * 엔진 hook 을 부르는 유일한 자리 — 엔진이 로드된 뒤에만 마운트되므로 hook 규칙을 지킨다.
 * `pending` 이 들어오면 큐에 넣고 (`autoProceed` 는 엔진 옵션) host 에 비우라고 알린다.
 */
function UploadRuntime({
  mod,
  options,
  pending,
  onDrain,
  showPreview,
}: UploadRuntimeProps) {
  const { items, add } = mod.useUploadQueue(options);
  const previewsRef = useRef(new Map<string, string>());
  const [, bump] = useState(0);

  useEffect(() => {
    if (pending.length === 0) return;
    const added = add(pending);
    if (showPreview) {
      added.forEach((item, index) => {
        const file = pending[index];
        if (file && canPreview(file, showPreview)) {
          previewsRef.current.set(item.id, URL.createObjectURL(file));
        }
      });
      bump((n) => n + 1);
    }
    onDrain();
  }, [pending, add, onDrain, showPreview]);

  useEffect(() => {
    const previews = previewsRef.current;
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
      previews.clear();
    };
  }, []);

  return (
    <AriaGridList
      aria-label="Upload queue"
      className="react-aria-FileUpload-list"
      items={items}
      selectionMode="none"
    >
      {(item) => {
        const pct = itemPercent(item);
        const preview = previewsRef.current.get(item.id);
        return (
          <AriaGridListItem
            id={item.id}
            textValue={item.name}
            className="react-aria-FileUpload-item"
            data-status={item.status}
          >
            {preview ? (
              <img
                className="react-aria-FileUpload-thumb"
                src={preview}
                alt=""
                width={40}
                height={40}
              />
            ) : null}
            <ProgressBar
              label={item.name}
              value={pct}
              valueLabel={`${formatFileSize(item.size)} · ${pct}%`}
              showValueLabel
              isIndeterminate={item.status === "creating"}
              variant="default"
              size="md"
              style={{ width: "100%" }}
            />
            {item.lastError ? (
              <span
                className="react-aria-FileUpload-error"
                role="status"
                data-code={item.lastError.code}
              >
                {item.lastError.code}
              </span>
            ) : null}
          </AriaGridListItem>
        );
      }}
    </AriaGridList>
  );
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
  dryRun = true,
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
  const resolution = useMemo(
    () => resolveUploadEndpoint(endpoint, endpoints),
    [endpoint, endpoints],
  );

  const [engine, setEngine] = useState<EngineState>({ status: "idle" });
  const [pending, setPending] = useState<File[]>([]);
  const [hasIntake, setHasIntake] = useState(false);
  const engineRef = useRef(engine);
  engineRef.current = engine;

  const transportBlocked = !dryRun && !resolution.ok;

  const addFiles = useCallback(
    (files: File[]) => {
      if (isDisabled || files.length === 0) return;
      setHasIntake(true);
      if (transportBlocked) return; // 상태 줄에 코드만 — 엔진도 로드하지 않는다
      setPending((prev) => [...prev, ...files]);
      if (engineRef.current.status === "idle") {
        setEngine({ status: "loading" });
        void loadEngine().then((mod) => {
          setEngine(mod ? { status: "ready", mod } : { status: "unavailable" });
        });
      }
    },
    [isDisabled, transportBlocked, loadEngine],
  );

  const intake = useMemo<FileUploadIntake>(
    () => ({ addFiles, isDisabled }),
    [addFiles, isDisabled],
  );

  const options = useMemo<UploadQueueOptions>(
    () => ({
      endpoint: resolution.ok ? resolution.url : "dry-run:",
      headers: resolution.ok ? resolution.headers : undefined,
      chunkSize,
      parallelUploads,
      retryDelays: toRetryDelays(retryDelays),
      maxFileSize: maxFileSize && maxFileSize > 0 ? maxFileSize : undefined,
      autoProceed,
      withCredentials: true,
      dryRun,
    }),
    [
      resolution,
      chunkSize,
      parallelUploads,
      retryDelays,
      maxFileSize,
      autoProceed,
      dryRun,
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

  const active = hasIntake && engine.status === "ready" && !transportBlocked;
  const statusCode = transportBlocked
    ? (resolution as { code: string }).code
    : engine.status === "unavailable"
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
        data-upload-state={active ? "active" : "idle"}
        style={style as CSSProperties | undefined}
      >
        {partitioned.input}
        {active && engine.status === "ready" ? (
          <UploadRuntime
            mod={engine.mod}
            options={options}
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
