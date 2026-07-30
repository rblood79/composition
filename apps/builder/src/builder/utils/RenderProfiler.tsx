/**
 * React 렌더 커밋 계측 래퍼 (dev 전용).
 *
 * `<Profiler>` 의 `actualDuration` 을 perfMarks 채널에 실어 기존
 * `window.__composition_PERF__.snapshotAll()` 로 다른 라벨과 함께 읽는다.
 *
 * 활성 여부는 **모듈 상수**다 — 런타임에 바뀌지 않으므로 트리 형태가 안정적이고
 * 리마운트를 유발하지 않는다. prod 에서는 `<Profiler>` 자체가 트리에 없다.
 */
import { Profiler, type ProfilerOnRenderCallback, type ReactNode } from "react";

import { recordDuration } from "./perfMarks";

const PROFILE_ENABLED = process.env.NODE_ENV === "development";

/** 라벨별 콜백 캐시 — 렌더마다 새 함수를 만들지 않는다. */
const callbackCache = new Map<string, ProfilerOnRenderCallback>();

function getCallback(label: string): ProfilerOnRenderCallback {
  let callback = callbackCache.get(label);
  if (!callback) {
    callback = (_id, _phase, actualDuration) => {
      recordDuration(label, actualDuration);
    };
    callbackCache.set(label, callback);
  }
  return callback;
}

interface RenderProfilerProps {
  /** React DevTools 에 표시되는 식별자 */
  id: string;
  /** perfMarks 라벨 (`PERF_LABEL.REACT_RENDER_*`) */
  label: string;
  children: ReactNode;
}

export function RenderProfiler({
  id,
  label,
  children,
}: RenderProfilerProps): ReactNode {
  if (!PROFILE_ENABLED) return children;
  return (
    <Profiler id={id} onRender={getCallback(label)}>
      {children}
    </Profiler>
  );
}
