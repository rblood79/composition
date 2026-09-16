/**
 * `@composition/upload/react` — react 는 optional peer (이 entry 한정).
 * 시그니처는 ADR-201 공용 API 계약 그대로.
 */
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { createUploadQueue } from "../core/queue";
import type {
  UploadItemState,
  UploadQueue,
  UploadQueueOptions,
} from "../types";

export type {
  UploadItemState,
  UploadQueue,
  UploadQueueOptions,
} from "../types";

const EMPTY: UploadItemState[] = [];

/**
 * 큐 1개를 컴포넌트 수명에 묶는다. `endpoint` / `protocol` / `dryRun` 이 바뀌면 큐를 새로 만든다
 * (진행 중 항목은 abort) — 그 외 옵션은 최초 값 고정.
 */
export function useUploadQueue(options: UploadQueueOptions): {
  items: UploadItemState[];
  queue: UploadQueue;
  add: UploadQueue["add"];
  start: UploadQueue["start"];
  pause: UploadQueue["pause"];
  resume: UploadQueue["resume"];
  cancel: UploadQueue["cancel"];
  remove: UploadQueue["remove"];
} {
  const latest = useRef(options);
  latest.current = options;
  const queue = useMemo(
    () => createUploadQueue(latest.current),
    // 의도적으로 세 키만 — 나머지 옵션은 latest ref 로 최초 생성 시점 값 고정
    [options.endpoint, options.protocol, options.dryRun],
  );
  useEffect(() => () => queue.destroy(), [queue]);
  const items = useSyncExternalStore(
    queue.subscribe,
    queue.getItems,
    () => EMPTY,
  );
  return {
    items,
    queue,
    add: queue.add,
    start: queue.start,
    pause: queue.pause,
    resume: queue.resume,
    cancel: queue.cancel,
    remove: queue.remove,
  };
}

export function useUploadItem(
  queue: UploadQueue,
  id: string,
): UploadItemState | undefined {
  return useSyncExternalStore(
    queue.subscribe,
    () => queue.getItems().find((it) => it.id === id),
    () => undefined,
  );
}
