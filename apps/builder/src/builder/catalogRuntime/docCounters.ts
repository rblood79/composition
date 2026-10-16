/**
 * ADR-265 Phase 0 — 문서 층 카운터의 dev 전역 핸들 (`__composition_DOC_COUNTERS__`). 카운터 객체는
 * shared (`catalog/docCounters.ts`) 에 있다 — graph · transaction · composition root 가 shared 라서.
 * 프레임 하니스가 부류마다 reset → snapshot 해 `counts.doc` 로 싣는다 (ADR-263 render 카운터와 같은 형태).
 */
import {
  resetDocCounters,
  snapshotDocCounters,
} from "../../../../../packages/shared/src/catalog/docCounters";

export {
  docCounters,
  resetDocCounters,
  snapshotDocCounters,
} from "../../../../../packages/shared/src/catalog/docCounters";

if (process.env.NODE_ENV === "development" && typeof window !== "undefined")
  (
    window as unknown as {
      __composition_DOC_COUNTERS__?: {
        snapshot: typeof snapshotDocCounters;
        reset: typeof resetDocCounters;
      };
    }
  ).__composition_DOC_COUNTERS__ = {
    snapshot: snapshotDocCounters,
    reset: resetDocCounters,
  };
