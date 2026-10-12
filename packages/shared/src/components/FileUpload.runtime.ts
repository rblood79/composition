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
import React, { Children, isValidElement, type ReactNode } from "react";

import { type UploadEngineLoader } from "../upload/loadUploadEngine";

/** 입력 표면으로 분류하는 canonical 자식 type — active 상태에서도 유지된다. */
export const FILE_UPLOAD_INPUT_CHILD_TYPES: ReadonlySet<string> = new Set([
  "DropZone",
  "FileTrigger",
]);

export type ActiveModule = typeof import("./FileUploadActive");

let cachedActive: Promise<ActiveModule | null> | null = null;

/** active 분기 lazy 로더 — 실패도 캐시 (엔진 로더와 같은 규약). */
export function loadActiveModule(): Promise<ActiveModule | null> {
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

export type LazyState<T> =
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

export function partitionChildren(children: ReactNode): {
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
