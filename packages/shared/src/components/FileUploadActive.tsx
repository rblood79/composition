/**
 * FileUpload 의 **active 분기** — ADR-201 후속 (번들 축소). `FileUpload` 껍데기가 첫 파일 유입 때
 * `import("./FileUploadActive")` 로 한 번만 가져온다. 여기에 있는 것은 idle (디자인 타임) 에는
 * 필요 없는 것 전부다:
 *   - endpoint 해석 (`resolveUploadEndpoint` → vault placeholder 게이트 포함)
 *   - 서버 계약 §5 CSRF 쿠키 → 헤더
 *   - 엔진 옵션 조립 · 런타임 행 (RAC `GridList` + `ProgressBar` · 미리보기 · R1 에러 코드)
 *
 * 엔진 `@composition/upload/react` 는 여기서도 정적 import 하지 않는다 — 껍데기가 `loadEngine`
 * (기본 `loadUploadEngine`, 테스트 주입 가능) 으로 따로 가져와 `mod` 로 넘긴다. 그래서 endpoint 가
 * 막힌 경우 (E_UNAUTHORIZED · E_NO_ENDPOINT) 엔진은 로드되지 않는다 (m4).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  GridList as AriaGridList,
  GridListItem as AriaGridListItem,
} from "react-aria-components/GridList";
import type { UploadItemState, UploadQueueOptions } from "@composition/upload";

import type { UploadReactModule } from "../upload/loadUploadEngine";
import {
  resolveUploadEndpoint,
  type UploadEndpointResolution,
} from "../upload/resolveUploadEndpoint";
import { ProgressBar } from "./ProgressBar";

export { resolveUploadEndpoint };
export type { UploadEndpointResolution };

/** 미리보기 `<img>` 상한 (R4 — 파일 전체를 읽지 않지만 objectURL 디코드는 브라우저 메모리다). */
export const FILE_UPLOAD_PREVIEW_MAX_BYTES = 20 * 1024 * 1024;

/**
 * 서버 계약 §5 "토큰 획득" — 세션 CSRF 토큰을 `XSRF-TOKEN` 쿠키 (Spring Security
 * CookieCsrfTokenRepository 관례, HttpOnly 아님) 로 받은 경우 `X-CSRF-TOKEN` 헤더로 되돌린다.
 * 쿠키가 없으면 헤더 0 — 서버가 CSRF 를 요구하면 403 → `E_UNAUTHORIZED` 로 드러난다.
 */
export function csrfHeadersFromCookie(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const match = /(?:^|;\s*)XSRF-TOKEN=([^;]+)/.exec(document.cookie ?? "");
  if (!match) return {};
  try {
    return { "X-CSRF-TOKEN": decodeURIComponent(match[1]) };
  } catch {
    return { "X-CSRF-TOKEN": match[1] };
  }
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

/** 껍데기가 D2 props 그대로 넘기는 전송 설정 — 옵션 조립은 여기서. */
export interface UploadTransportConfig {
  resolution: UploadEndpointResolution;
  dryRun: boolean;
  chunkSize?: number;
  parallelUploads?: number;
  retryDelays?: ReadonlyArray<number | string>;
  maxFileSize?: number;
  autoProceed: boolean;
}

export function buildUploadQueueOptions(
  config: UploadTransportConfig,
): UploadQueueOptions {
  const { resolution } = config;
  return {
    endpoint: resolution.ok ? resolution.url : "dry-run:",
    headers: resolution.ok ? resolution.headers : undefined,
    chunkSize: config.chunkSize,
    parallelUploads: config.parallelUploads,
    retryDelays: toRetryDelays(config.retryDelays),
    maxFileSize:
      config.maxFileSize && config.maxFileSize > 0
        ? config.maxFileSize
        : undefined,
    autoProceed: config.autoProceed,
    withCredentials: true,
    getHeaders: csrfHeadersFromCookie,
    dryRun: config.dryRun,
  };
}

export interface FileUploadActiveProps {
  mod: UploadReactModule;
  config: UploadTransportConfig;
  pending: File[];
  onDrain: () => void;
  showPreview: boolean;
}

/**
 * 엔진 hook 을 부르는 유일한 자리 — 엔진이 로드된 뒤에만 마운트되므로 hook 규칙을 지킨다.
 * `pending` 이 들어오면 큐에 넣고 (`autoProceed` 는 엔진 옵션) host 에 비우라고 알린다.
 */
export function FileUploadActive({
  mod,
  config,
  pending,
  onDrain,
  showPreview,
}: FileUploadActiveProps) {
  const options = useMemo(() => buildUploadQueueOptions(config), [config]);
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
