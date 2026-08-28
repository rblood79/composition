/**
 * canonical 1차 필드 어휘 — AI 도구용 (ADR-134 Phase 3, D2/R4).
 *
 * 도구가 다룰 수 있는 것은 **canonical schema 의 1차 필드** 뿐이다:
 * `clip` / `placeholder` (FrameNode 전용) · `slot` / `reusable` (CanonicalNode 공통).
 * 값은 `useCanonicalDocumentStore.updateNode` 로 patch 한다 — `elementsMap` /
 * `childrenMap` 직접 접근은 하지 않는다 (R4 회귀 gate).
 *
 * **`componentSemantics` 는 어휘에 넣지 않는다** (Phase 3 실측): 그 이름의 1차 필드는
 * schema 에 없고, `adapters/canonical/componentSemanticsMirror.ts` 의 legacy
 * component-instance mirror metadata 가 adapter quarantine 으로 남아 있을 뿐이다.
 * 컴포넌트 의미의 1차 필드는 `reusable` / `ref` / `descendants` 이며, 그중 이 Phase 가
 * 여는 것은 **`reusable` 하나**다 — `ref` 인스턴스 생성은 ADR-161 의 표면이라 도구에
 * 열지 않는다 (열면 도구가 인스턴스 규칙을 재구현하게 된다).
 */
import type { CanonicalNode } from "@composition/shared";
import { useCanonicalDocumentStore } from "../../../builder/stores/canonical/canonicalDocumentStore";
import { getNodeMap } from "../../../builder/stores/canonical/canonicalTraversalHelpers";

/** 도구가 읽고 쓰는 canonical 1차 필드. */
export interface CanonicalFieldPatch {
  /** children clipping — `type: "frame"` 전용. */
  clip?: boolean;
  /** 빈 frame UI hint — `type: "frame"` 전용. */
  placeholder?: boolean;
  /** slot 선언: `false` (비활성) 또는 삽입 가능한 reusable component id 배열. */
  slot?: false | string[];
  /**
   * 이 노드를 재사용 가능한 원본으로 표시.
   *
   * **구조적 부작용 (Phase 3 실측)**: `type: "frame"` 에 켜면 그 노드는 page scope 를
   * 벗어나 layout 정의가 된다 (`canonicalElementsView.getNodeScope`) — 페이지 요소
   * 목록·트리에서 사라진다. 노드가 지워지는 것은 아니다.
   */
  reusable?: boolean;
}

const FRAME_ONLY_FIELDS = ["clip", "placeholder"] as const;

export interface CanonicalFieldParseResult {
  patch: CanonicalFieldPatch;
  /** 무시된 필드와 사유 — 도구 결과에 실어 모델이 다음 호출을 고칠 수 있게 한다. */
  rejected: Array<{ field: string; reason: string }>;
}

/**
 * 도구 인자의 `canonical` 객체를 검증한다.
 *
 * 모르는 필드·타입 불일치·frame 아닌 노드의 frame 전용 필드는 **조용히 통과시키지 않고**
 * `rejected` 로 돌려준다 (잘못된 patch 가 문서에 들어가는 것보다 낫다).
 */
export function parseCanonicalFields(
  raw: unknown,
  nodeType: string | undefined,
): CanonicalFieldParseResult {
  const patch: CanonicalFieldPatch = {};
  const rejected: CanonicalFieldParseResult["rejected"] = [];

  if (raw == null) return { patch, rejected };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return {
      patch,
      rejected: [{ field: "canonical", reason: "객체여야 합니다." }],
    };
  }

  const isFrame = nodeType === "frame";

  for (const [field, value] of Object.entries(raw as Record<string, unknown>)) {
    if (field === "clip" || field === "placeholder") {
      if (!isFrame) {
        rejected.push({
          field,
          reason: `type: "frame" 노드에만 쓸 수 있습니다 (현재 ${nodeType ?? "unknown"}).`,
        });
        continue;
      }
      if (typeof value !== "boolean") {
        rejected.push({ field, reason: "boolean 이어야 합니다." });
        continue;
      }
      patch[field] = value;
      continue;
    }

    if (field === "reusable") {
      if (typeof value !== "boolean") {
        rejected.push({ field, reason: "boolean 이어야 합니다." });
        continue;
      }
      patch.reusable = value;
      continue;
    }

    if (field === "slot") {
      if (value === false) {
        patch.slot = false;
        continue;
      }
      if (
        Array.isArray(value) &&
        value.every((entry) => typeof entry === "string")
      ) {
        patch.slot = value as string[];
        continue;
      }
      rejected.push({
        field,
        reason: "false 또는 문자열 배열이어야 합니다.",
      });
      continue;
    }

    rejected.push({
      field,
      reason: `알 수 없는 canonical 필드입니다 (가능: clip, placeholder, slot, reusable).`,
    });
  }

  return { patch, rejected };
}

/** patch 를 canonical document 에 적용. 빈 patch 면 아무 것도 하지 않는다. */
export function applyCanonicalFields(
  nodeId: string,
  patch: CanonicalFieldPatch,
): boolean {
  const keys = Object.keys(patch);
  if (keys.length === 0) return false;
  useCanonicalDocumentStore
    .getState()
    .updateNode(nodeId, patch as Partial<CanonicalNode>);
  return true;
}

/** 노드의 현재 canonical 1차 필드 — 도구 응답에 싣는 읽기 표면. */
export function readCanonicalFields(
  nodeId: string,
): CanonicalFieldPatch | undefined {
  const node = getNodeMap().get(nodeId) as
    (CanonicalNode & CanonicalFieldPatch) | undefined;
  if (!node) return undefined;

  const fields: CanonicalFieldPatch = {};
  if (node.type === "frame") {
    if (typeof node.clip === "boolean") fields.clip = node.clip;
    if (typeof node.placeholder === "boolean") {
      fields.placeholder = node.placeholder;
    }
  }
  if (node.slot !== undefined) fields.slot = node.slot;
  if (typeof node.reusable === "boolean") fields.reusable = node.reusable;

  return Object.keys(fields).length > 0 ? fields : undefined;
}

/** frame 전용 필드 목록 — 도구 스키마 설명과 검증이 같은 출처를 쓴다. */
export const FRAME_ONLY_CANONICAL_FIELDS: readonly string[] = FRAME_ONLY_FIELDS;
