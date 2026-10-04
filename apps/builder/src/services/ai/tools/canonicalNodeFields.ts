/**
 * AI 도구 `canonical` 인자의 1차 필드 어휘 (ADR-134 Phase 3, D2/R4 — 인자 이름은 도구 계약이라 유지).
 *
 * 도구가 다룰 수 있는 것은 이 1차 필드 뿐이다:
 * `clip` / `placeholder` (frame 전용) · `slot` / `reusable` (모든 노드).
 * 쓰기는 AI write host 가 catalog 명령으로 바꾼다 (`catalogRuntime/aiHost.ts`
 * `catalogCanonicalCommands`) — 도구가 store 를 직접 만지지 않는다 (R4 회귀 gate).
 *
 * **`componentSemantics` 는 어휘에 넣지 않는다** (Phase 3 실측): 그 이름의 1차 필드는
 * schema 에 없다 (legacy component-instance mirror metadata 는 ADR-248 4e-13-3 에서
 * 구 adapter 와 함께 제거됐다).
 * 컴포넌트 의미의 1차 필드는 `reusable` / `ref` / `descendants` 이며, 그중 이 Phase 가
 * 여는 것은 **`reusable` 하나**다 — `ref` 인스턴스 생성은 ADR-161 의 표면이라 도구에
 * 열지 않는다 (열면 도구가 인스턴스 규칙을 재구현하게 된다).
 */
import type { ToolTranslate } from "../../../types/integrations/ai.types";
import { getAiReadHost } from "../aiReadHost";

/** 도구가 읽고 쓰는 canonical 1차 필드. */
export interface CanonicalFieldPatch {
  /** children clipping — `type: "frame"` 전용. */
  clip?: boolean;
  /** 빈 frame UI hint — `type: "frame"` 전용. */
  placeholder?: boolean;
  /** slot 선언: `false` (비활성) 또는 삽입 가능한 reusable component id 배열. */
  slot?: false | string[];
  /**
   * 이 노드를 재사용 가능한 원본 (컴포넌트) 으로 표시.
   *
   * 쓰기 host 는 노드를 컴포넌트로 만들고 그 자리에 인스턴스를 둔다 (`reusable: false` 는 거부).
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
  t: ToolTranslate,
  raw: unknown,
  nodeType: string | undefined,
): CanonicalFieldParseResult {
  const patch: CanonicalFieldPatch = {};
  const rejected: CanonicalFieldParseResult["rejected"] = [];

  if (raw == null) return { patch, rejected };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return {
      patch,
      rejected: [
        { field: "canonical", reason: t("aiToolError.canonicalMustBeObject") },
      ],
    };
  }

  const isFrame = nodeType === "frame";

  for (const [field, value] of Object.entries(raw as Record<string, unknown>)) {
    if (field === "clip" || field === "placeholder") {
      if (!isFrame) {
        rejected.push({
          field,
          reason: t("aiToolError.frameOnly", {
            type: nodeType ?? "unknown",
          }),
        });
        continue;
      }
      if (typeof value !== "boolean") {
        rejected.push({ field, reason: t("aiToolError.mustBeBoolean") });
        continue;
      }
      patch[field] = value;
      continue;
    }

    if (field === "reusable") {
      if (typeof value !== "boolean") {
        rejected.push({ field, reason: t("aiToolError.mustBeBoolean") });
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
        reason: t("aiToolError.slotShape"),
      });
      continue;
    }

    rejected.push({
      field,
      reason: t("aiToolError.unknownCanonicalField"),
    });
  }

  return { patch, rejected };
}

/**
 * 노드의 현재 canonical 1차 필드 — 도구 응답에 싣는 읽기 표면. ADR-248 4e-7: the read host's
 * (only the old store host has them).
 */
export function readCanonicalFields(
  nodeId: string,
): CanonicalFieldPatch | undefined {
  return getAiReadHost()?.canonicalFields?.(nodeId) as
    CanonicalFieldPatch | undefined;
}

/** frame 전용 필드 목록 — 도구 스키마 설명과 검증이 같은 출처를 쓴다. */
export const FRAME_ONLY_CANONICAL_FIELDS: readonly string[] = FRAME_ONLY_FIELDS;
