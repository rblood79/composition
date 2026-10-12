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

import {
  buildUploadQueueOptions,
  canPreview,
  FileUploadActiveProps,
  formatFileSize,
  itemPercent,
} from "./FileUploadActive.runtime";
import { ProgressBar } from "./ProgressBar";

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
  const [previews, setPreviews] = useState<ReadonlyMap<string, string>>(
    () => new Map(),
  );

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
      const nextPreviews = new Map(previewsRef.current);
      setPreviews(nextPreviews);
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
        const preview = previews.get(item.id);
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
              size="M"
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
