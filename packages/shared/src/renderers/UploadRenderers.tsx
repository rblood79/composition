/**
 * FileUpload 렌더러 (ADR-201 Phase 3) — legacy `rendererMap` 경로 (preview · publish 공용 shell).
 *
 * cutover 경로 (CanonicalNodeRenderer → delegating-internal "fileupload") 가 이 함수로 위임한다.
 * canonical 자식을 type 으로 분류해 shared `FileUpload` 에 넘긴다 — 입력 표면 (DropZone ·
 * FileTrigger) 과 샘플 행 (그 외). 런타임 큐 상태는 `FileUpload` 내부 React 상태 — 문서 write 0.
 *
 * preview 의 dry-run 여부는 endpoint 정의의 `uploadDryRun` (Data 패널 토글, 기본 true — breakdown
 * §3-4 "preview 안전", Phase 4) 이 정한다 — 여기서는 `dryRun` 을 넘기지 않는다. publish 만 `dryRun={false}`.
 */
import type React from "react";
import type { PreviewElement, RenderContext } from "../types";
import {
  FileUpload,
  FILE_UPLOAD_INPUT_CHILD_TYPES,
} from "../components/FileUpload";

export const renderFileUpload = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;
  const props = element.props as Record<string, unknown>;
  const children = context.childrenByParent.get(element.id) ?? [];
  const input = children.filter((child) =>
    FILE_UPLOAD_INPUT_CHILD_TYPES.has(child.type),
  );
  const rows = children.filter(
    (child) => !FILE_UPLOAD_INPUT_CHILD_TYPES.has(child.type),
  );

  return (
    <FileUpload
      key={element.id}
      data-element-id={element.id}
      data-custom-id={element.customId}
      endpoint={props.endpoint as string | undefined}
      chunkSize={props.chunkSize as number | undefined}
      parallelUploads={props.parallelUploads as number | undefined}
      retryDelays={props.retryDelays as Array<number | string> | undefined}
      maxFileSize={props.maxFileSize as number | undefined}
      acceptedFileTypes={props.acceptedFileTypes as string[] | undefined}
      allowsMultiple={props.allowsMultiple as boolean | undefined}
      acceptDirectory={props.acceptDirectory as boolean | undefined}
      autoProceed={props.autoProceed as boolean | undefined}
      showPreview={props.showPreview as boolean | undefined}
      isDisabled={Boolean(props.isDisabled)}
      variant={props.variant as string | undefined}
      size={props.size as string | undefined}
      className={props.className as string | undefined}
      style={props.style as React.CSSProperties | undefined}
      inputSurface={input.map((child) => renderElement(child, child.id))}
      sampleRows={rows.map((child) => renderElement(child, child.id))}
    />
  );
};
