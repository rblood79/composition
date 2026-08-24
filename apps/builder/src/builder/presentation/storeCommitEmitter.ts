/**
 * ADR-190 — canonical store mutation → commit lane emitter 진입점.
 *
 * store 쪽 mutation 액션들이 공유하는 얇은 층이다. 각 액션은 "무엇이 바뀌었나"
 * 만 넘기고, descriptor 변환의 fail-closed 판정과 revision 읽기는 여기서 한다.
 *
 * **호출 위치 계약**: canonical document 갱신 **뒤**, `set()` **앞**.
 * - canonical 갱신 뒤라야 `documentVersion` 이 post-commit revision 이다.
 * - `set()` 앞이라야 store 구독 sync 가 pending commit 을 보고 patch 를 태운다.
 *   뒤로 밀리면 sync 가 `pendingCommit` 없이 changedIds 를 소비해버려
 *   뒤늦은 patch 가 stale revision 이 된다.
 *
 * 한 사용자 편집이 여러 canonical mutation 을 만들면 **한 번에 배열로** 넘긴다
 * (ADR-190 R6). commit lane 의 `pendingCommit` 은 단일 슬롯이라 mutation 마다
 * 따로 queue 하면 앞선 patch 가 조용히 유실된다.
 */

import { useCanonicalDocumentStore } from "../stores/canonical/canonicalDocumentStore";
import type { EditorMutationDescriptor } from "./editorPresentationTypes";
import { createStoreStyleCommitDescriptor } from "./storeCommitDescriptor";
import { publishStoreCommitDescriptors } from "./storeCommitDescriptorSink";
import {
  createStoreStructureCommitDescriptor,
  type StoreStructureOperation,
} from "./storeStructureCommitDescriptor";

function publish(descriptors: readonly EditorMutationDescriptor[]): void {
  if (descriptors.length === 0) return;
  publishStoreCommitDescriptors(
    descriptors,
    useCanonicalDocumentStore.getState().documentVersion,
  );
}

/** `updateElementProps` 의 props patch (style 축). */
export function emitStoreStyleCommitDescriptor(
  elementId: string,
  patch: Readonly<Record<string, unknown>>,
): void {
  const descriptor = createStoreStyleCommitDescriptor({ elementId, patch });
  if (!descriptor) return;
  publish([descriptor]);
}

export interface StoreStructureCommitEntry {
  readonly elementId: string;
  readonly parentId: string | null | undefined;
}

/**
 * 자식 추가/제거/순서 변경 (structure 축).
 *
 * **부분 emit 금지**: 한 entry 라도 descriptor 화에 실패하면 전체를 버린다.
 * 일부만 patch 하고 나머지를 full rebuild 로 남기면 한 프레임에 두 경로가 섞여
 * revision 원자성이 깨진다 (ADR-189 HC4).
 */
export function emitStoreStructureCommitDescriptors(
  entries: readonly StoreStructureCommitEntry[],
  operation: StoreStructureOperation = "add",
): void {
  if (entries.length === 0) return;
  const descriptors: EditorMutationDescriptor[] = [];
  for (const entry of entries) {
    const descriptor = createStoreStructureCommitDescriptor({
      elementId: entry.elementId,
      operation,
      parentId: entry.parentId,
    });
    if (!descriptor) return;
    descriptors.push(descriptor);
  }
  publish(descriptors);
}
