/**
 * ADR-201 — FileUpload 큐 유입 컨텍스트.
 *
 * canonical 자식 DropZone(`onDrop`) · FileTrigger(`onSelect`) 는 각자의 렌더러가 그린다
 * (`renderDropZone` / `renderFileTrigger`). 부모 `FileUpload` 가 이 컨텍스트로 `addFiles` 를
 * 내려주면 자식 렌더러가 ADR-158 규칙 위임 (`createEventHandlerMap`) **과 함께** 파일을 큐로
 * 넘긴다. 문서 write 0 — 파일은 React 상태로만 흐른다.
 */
import { createContext, useContext } from "react";
import type { DropZoneProps } from "react-aria-components";

/** RAC `DropZoneProps.onDrop` 의 이벤트/항목 타입 — `@react-types/shared` 직접 의존 없이 파생. */
export type DropEvent = Parameters<NonNullable<DropZoneProps["onDrop"]>>[0];
type DropItem = DropEvent["items"][number];

export interface FileUploadIntake {
  /** 선택·드롭된 파일을 업로드 큐에 넣는다 (부모 FileUpload 소유). */
  addFiles: (files: File[]) => void;
  isDisabled: boolean;
}

export const FileUploadContext = createContext<FileUploadIntake | null>(null);

/** 가장 가까운 FileUpload 의 유입 핸들 — FileUpload 밖이면 null. */
export function useFileUploadIntake(): FileUploadIntake | null {
  return useContext(FileUploadContext);
}

async function collectDropItem(item: DropItem, out: File[]): Promise<void> {
  if (item.kind === "file") {
    out.push(await item.getFile());
    return;
  }
  if (item.kind === "directory") {
    for await (const entry of item.getEntries()) {
      await collectDropItem(entry, out);
    }
  }
  // "text" item 은 파일이 아니다 — 무시.
}

/**
 * RAC `DropEvent` 의 file/directory item 을 `File[]` 로 편다 (directory 는 재귀).
 * 파일 내용은 읽지 않는다 (`File` 핸들만 — HC2 GB 메모리 계약).
 */
export async function filesFromDropEvent(event: DropEvent): Promise<File[]> {
  const out: File[] = [];
  for (const item of event.items) await collectDropItem(item, out);
  return out;
}
