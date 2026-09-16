/**
 * ADR-201 — DropZone / FileTrigger 의 큐 유입 어댑터.
 *
 * `renderDropZone` / `renderFileTrigger` 는 plain 함수라 hook 을 부를 수 없다. 이 두 컴포넌트가
 * 대신 `FileUploadContext` 를 읽어, 가장 가까운 `FileUpload` 가 있으면 드롭·선택 파일을
 * `addFiles` 로 넘긴다. FileUpload 밖 (단독 DropZone/FileTrigger) 에서는 컨텍스트가 null 이라
 * 종전과 **동일하게** 동작한다 — 기존 규칙 위임 (`onDrop`/`onSelect` 핸들러) 은 그대로 먼저 호출.
 */
import { DropZone, type DropZoneProps } from "../components/DropZone";
import { FileTrigger, type FileTriggerProps } from "../components/FileTrigger";
import { filesFromDropEvent, useFileUploadIntake } from "./fileUploadContext";

export function DropZoneIntake({ onDrop, ...props }: DropZoneProps) {
  const intake = useFileUploadIntake();
  return (
    <DropZone
      {...props}
      isDisabled={props.isDisabled || intake?.isDisabled}
      onDrop={(event) => {
        onDrop?.(event);
        if (intake && !intake.isDisabled) {
          void filesFromDropEvent(event).then((files) => {
            if (files.length > 0) intake.addFiles(files);
          });
        }
      }}
    />
  );
}

export function FileTriggerIntake({
  onSelect,
  children,
  ...props
}: FileTriggerProps) {
  const intake = useFileUploadIntake();
  return (
    <FileTrigger
      {...props}
      onSelect={(files) => {
        onSelect?.(files);
        if (intake && !intake.isDisabled && files && files.length > 0) {
          intake.addFiles(Array.from(files));
        }
      }}
    >
      {children}
    </FileTrigger>
  );
}
