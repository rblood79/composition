import type { ToolTranslate } from "../../../types/integrations/ai.types"; /**
 * 요소 참조 해석 — 도구가 받은 `elementId` 를 실제 id 로 바꾼다 (ADR-134 후속).
 *
 * **왜 생겼나 (2026-08-29 실물 측정)**: Ollama qwen3:14b 로 다단계 시나리오 2건을 돌렸더니
 * 도구 오류가 11건 났고 **전부 같은 원인**이었다 (3/3 재현) — 모델이 `create_element` 가
 * 돌려준 `data.elementId` 대신 자리표시자를 다음 호출에 넘겼다: `created-element-id` /
 * `gridListId` / `cardId` / `created_table_id` / `Table-123` / `Pagination-789`.
 *
 * 두 갈래로 막는다:
 * 1. **`"last-created"` 손잡이** — 방금 만든 것을 가리키는 데 UUID 를 이어 나를 필요가 없다.
 *    모델이 실패하는 지점이 바로 "불투명한 id 를 턴 넘어 옮기기" 이므로, 그 일을 안 하게 한다.
 * 2. **실패했을 때 다음 시도가 맞도록** — "요소를 찾을 수 없습니다" 로 끝내지 않고, 지어내지
 *    말라는 말과 함께 **직전에 만든 실제 id** 와 조회 도구 이름을 돌려준다.
 *
 * 기억은 세션 스코프 모듈 상태다. 페이지를 새로 열면 비는 것이 맞다 — 그때는 `get_editor_state`
 * 가 정본이다.
 */

/** 도구 인자에서 쓸 수 있는 별칭. */
export const ELEMENT_REF_ALIASES = ["selected", "last-created"] as const;

let lastCreatedId: string | null = null;

/** `create_element` 성공 시 호출 — 다음 도구가 `"last-created"` 로 집을 수 있게 한다. */
export function rememberCreatedElement(id: string): void {
  if (id) lastCreatedId = id;
}

/** 테스트·새 실행용. */
export function forgetCreatedElements(): void {
  lastCreatedId = null;
}

export interface ElementRefContext {
  selectedElementId: string | null | undefined;
  elementsById: ReadonlyMap<string, unknown>;
}

export type ElementRefResult = { id: string } | { error: string };

function recovery(ctx: ElementRefContext, t: ToolTranslate): string {
  const known =
    lastCreatedId && ctx.elementsById.has(lastCreatedId)
      ? t("aiToolError.lastCreatedIsNow", { id: lastCreatedId })
      : "";
  return `${t("aiToolError.recovery")}${known}`;
}

export function resolveElementRef(
  arg: string | undefined | null,
  ctx: ElementRefContext,
  t: ToolTranslate,
): ElementRefResult {
  if (!arg) {
    return {
      error: t("aiToolError.idEmpty", { recovery: recovery(ctx, t) }),
    };
  }

  if (arg === "selected") {
    return ctx.selectedElementId
      ? { id: ctx.selectedElementId }
      : {
          error: t("aiToolError.noSelection"),
        };
  }

  if (arg === "last-created") {
    if (!lastCreatedId) {
      return {
        error: t("aiToolError.nothingCreated"),
      };
    }
    // 만든 뒤 지워졌을 수 있다 — 기억이 문서보다 오래 남게 두지 않는다.
    if (!ctx.elementsById.has(lastCreatedId)) {
      return {
        error: t("aiToolError.lastCreatedGone", {
          id: lastCreatedId,
          recovery: recovery(ctx, t),
        }),
      };
    }
    return { id: lastCreatedId };
  }

  if (!ctx.elementsById.has(arg)) {
    return {
      error: t("aiToolError.elementNotFound", {
        id: String(arg),
        recovery: recovery(ctx, t),
      }),
    };
  }
  return { id: arg };
}
