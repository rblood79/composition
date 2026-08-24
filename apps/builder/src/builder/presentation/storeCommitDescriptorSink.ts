/**
 * ADR-190 Phase 1 — canonical store → commit lane 단방향 sink.
 *
 * store (`elementUpdate.ts`) 는 Skia 렌더 계층을 import 할 수 없으므로,
 * `SkiaCanvas` 가 mount 시 sink 를 등록하고 store 는 descriptor 만 흘려보낸다.
 * `onLayoutPublished` 와 같은 관용구지만 **소비자가 하나**뿐이라 (commit lane)
 * listener Set 이 아니라 단일 슬롯이다 — 둘 이상 등록되면 어느 쪽이 patch 를
 * 소유하는지 모호해지고, 그 모호함이 곧 revision 원자성 훼손이다.
 */

import type { EditorMutationDescriptor } from "./editorPresentationTypes";

export type StoreCommitDescriptorSink = (
  descriptors: readonly EditorMutationDescriptor[],
  revision: number,
) => void;

let sink: StoreCommitDescriptorSink | null = null;

/**
 * 진단 카운터. "descriptor 가 안 만들어졌다" / "sink 가 없다" / "sink 가
 * 던졌다" 는 런타임 증상이 모두 `queueCount=0` 으로 똑같이 보이기 때문에,
 * G1 게이트가 셋을 구분하려면 이 층에서 세어야 한다.
 */
const diagnostics = {
  delivered: 0,
  failed: 0,
  published: 0,
  /** descriptor 화가 거부돼 full rebuild 로 간 commit 수 (축별). */
  rejectedStructure: 0,
  rejectedStyle: 0,
  unsinked: 0,
};

/**
 * 거부를 센다. 거부 자체는 정상 동작(fail-closed)이지만, **조용히** 늘어나면
 * 성능이 서서히 옛 경로로 되돌아간다 — 특히 effect registry 에 등재하지 않은
 * style 키를 새로 도입하면 그 요소는 영구히 lane 밖에 남는다 (ADR-190 Phase 1).
 * 화면에는 아무 증상이 없으므로 세지 않으면 발견 수단이 없다.
 */
export function recordStoreCommitDescriptorRejection(
  axis: "structure" | "style",
): void {
  if (axis === "style") diagnostics.rejectedStyle += 1;
  else diagnostics.rejectedStructure += 1;
}

export function readStoreCommitDescriptorDiagnostics(): Readonly<
  typeof diagnostics
> {
  return { ...diagnostics };
}

export function resetStoreCommitDescriptorDiagnostics(): void {
  diagnostics.delivered = 0;
  diagnostics.failed = 0;
  diagnostics.published = 0;
  diagnostics.rejectedStructure = 0;
  diagnostics.rejectedStyle = 0;
  diagnostics.unsinked = 0;
}

/** commit lane 소비자 등록. `null` 로 해제한다 (unmount). */
export function setStoreCommitDescriptorSink(
  next: StoreCommitDescriptorSink | null,
): void {
  sink = next;
}

/**
 * descriptor 를 commit lane 에 전달한다.
 *
 * sink 미등록(Skia canvas 미마운트)과 sink 실패는 **호출자 mutation 을 막지
 * 않는다** — 이 경로는 렌더 최적화이지 상태 변경의 일부가 아니다. 전달이
 * 실패하면 commit lane 이 pending 없이 sync 를 돌아 기존 full rebuild 로
 * 수렴한다 (ADR-190 HC3 fail-closed).
 */
export function publishStoreCommitDescriptors(
  descriptors: readonly EditorMutationDescriptor[],
  revision: number,
): void {
  if (descriptors.length === 0) return;
  diagnostics.published += 1;
  if (!sink) {
    diagnostics.unsinked += 1;
    return;
  }
  try {
    sink(descriptors, revision);
    diagnostics.delivered += 1;
  } catch {
    // full rebuild 로 수렴 — 여기서 throw 하면 편집 자체가 롤백된다.
    diagnostics.failed += 1;
  }
}

// commit lane 계측(`renderCommands.ts` 의 `adr189MetricsEnabled`)과 **같은**
// 조건이어야 한다. 둘이 어긋나면 `__composition_COMMIT_LANE_DEBUG__` 는 있는데
// 이 카운터만 없는 상태가 생겨, queue 가 0인 이유를 구분하려던 목적이 그
// 상황에서 무너진다 (2026-08-24 live 검증에서 실제로 겪음).
const debugSurfaceEnabled =
  typeof window !== "undefined" &&
  (import.meta.env?.DEV ||
    new URLSearchParams(window.location.search).has("adr189Metrics"));

if (debugSurfaceEnabled) {
  (
    window as typeof window & {
      __composition_STORE_COMMIT_SINK_DEBUG__?: {
        read: typeof readStoreCommitDescriptorDiagnostics;
        reset: typeof resetStoreCommitDescriptorDiagnostics;
      };
    }
  ).__composition_STORE_COMMIT_SINK_DEBUG__ = {
    read: readStoreCommitDescriptorDiagnostics,
    reset: resetStoreCommitDescriptorDiagnostics,
  };
}
