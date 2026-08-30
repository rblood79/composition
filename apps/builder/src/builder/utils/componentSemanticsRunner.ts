/**
 * ADR-199 Phase 3 — 컴포넌트 시맨틱 액션의 **실행·확인 경로** 단일화.
 *
 * Phase 2 로 "무엇이 어디에 어떤 라벨로 서는가" 는 `COMPONENT_SEMANTICS_ACTIONS`
 * 하나가 됐지만, **누르면 무엇이 일어나는가** 는 아직 4곳이 각자 조립하고
 * 있었다 — Properties 패널 · 컨텍스트 메뉴 · 패널 단축키 · 전역 단축키.
 * 특히 분리 확인 다이얼로그의 표시 이름 규칙이 갈려서, 같은 인스턴스를
 * 분리해도 어느 표면에서 눌렀느냐에 따라 다이얼로그 문구가 달랐다 (R2):
 * 패널만 원본 이름까지 되짚고 나머지 3곳은 `componentName ?? customId ?? type`
 * 에서 멈췄다.
 *
 * 여기서 통일하는 것은 **규칙**이지 element 해석이 아니다. 표면마다 읽는
 * 자리가 다르고 (패널은 canonical property element, 메뉴는 캔버스 사영,
 * 단축키는 `elementsMap`) 그건 각 표면이 옳게 아는 것이므로, 가진 element 를
 * 넘기면 payload 조립과 store 호출은 이 모듈이 한 벌로 처리한다.
 */
import { useStore } from "../stores";
import type { ComponentSemanticsActionId } from "../config/componentSemanticsActions";
import {
  canDetachInstance,
  getEditingSemanticsOriginId,
} from "./editingSemantics";
import { requestEditingSemanticsDetachConfirmation } from "./editingSemanticsImpactConfirmation";

/** 표시 이름을 만들 때 읽는 필드만 — 표면별 element 타입의 공통분모. */
export interface SemanticsLabelSource {
  id?: string;
  type?: string;
  // 표면마다 element 타입이 다르고 (PanelNode 는 `string | null`, legacy Element 는
  // `string | undefined`) 표시 이름 규칙은 둘 다 "없음" 으로 다루면 된다.
  customId?: string | null;
  componentName?: string | null;
  page_id?: string | null;
  pageId?: string | null;
}

/**
 * 표면이 넘기는 element.
 *
 * 표시 이름 필드만 타입으로 적는다 — 시맨틱 판정 필드(`ref` / `masterId` /
 * `componentRole`)의 **이름**은 어댑터가 소유하고 (ADR-116 G5), 판정은
 * `unknown` 을 받는 어댑터 술어에 그대로 넘겨서 한다. 표면 element 타입이
 * 제각각(PanelNode 는 `unknown`, legacy Element 는 `string`)이라 여기서 다시
 * 좁히면 표면마다 캐스팅이 생긴다.
 */
export type ComponentSemanticsElement = SemanticsLabelSource;

export interface ComponentSemanticsRunInput {
  targetId: string;
  /** 생략 시 `elementsMap` 에서 읽는다. */
  element?: ComponentSemanticsElement | null;
  /** 생략 시 `getEditingSemanticsOriginId` → `elementsMap` 으로 해석한다. */
  originElement?: ComponentSemanticsElement | null;
  originId?: string | null;
  /**
   * `"skip"` = 확인을 부르지 않는다. agent 경로는 executor 의 confirm 게이트가
   * 이미 물으므로 (ADR-196) 여기서 또 물으면 다이얼로그가 두 번 뜬다.
   */
  confirm?: "ask" | "skip";
}

/**
 * 표시 이름 — **패널 규칙으로 통일** (R2).
 *
 * 인스턴스 자신의 이름이 없으면 원본 이름을 되짚는다. 되짚지 않으면 자동
 * 생성된 노드에서 "Button 을 분리하시겠습니까" 처럼 어느 컴포넌트인지 알 수
 * 없는 문구가 된다.
 */
export function resolveComponentSemanticsLabel(
  element: SemanticsLabelSource | null | undefined,
  originElement: SemanticsLabelSource | null | undefined,
  fallbackId: string,
): string {
  return (
    element?.componentName ??
    element?.customId ??
    originElement?.componentName ??
    originElement?.customId ??
    originElement?.type ??
    element?.type ??
    fallbackId
  );
}

function readElement(
  input: ComponentSemanticsRunInput,
): ComponentSemanticsElement | null {
  if (input.element !== undefined) return input.element;
  const found = useStore.getState().elementsMap.get(input.targetId);
  return (found as ComponentSemanticsElement | undefined) ?? null;
}

function readOrigin(
  input: ComponentSemanticsRunInput,
  element: ComponentSemanticsElement | null,
): { id: string | null; element: ComponentSemanticsElement | null } {
  const id = input.originId ?? getEditingSemanticsOriginId(element) ?? null;
  if (input.originElement !== undefined) {
    return { id, element: input.originElement };
  }
  if (!id) return { id: null, element: null };
  const found = useStore.getState().elementsMap.get(id);
  return {
    id,
    element: (found as ComponentSemanticsElement | undefined) ?? null,
  };
}

/**
 * 액션 1건을 실행한다. 반환값은 **store 를 실제로 건드렸는가** —
 * 확인 취소 · 조건 미충족은 `false` 다.
 *
 * `select-instances` 는 패널 한 표면에만 있어 통일할 상대가 없다 (다중 선택 +
 * 페이지 전환이 패널 선택 모델에 붙어 있다). 그 표면이 계속 소유한다.
 */
export async function runComponentSemanticsAction(
  id: ComponentSemanticsActionId,
  input: ComponentSemanticsRunInput,
): Promise<boolean> {
  const { targetId } = input;
  const element = readElement(input);

  switch (id) {
    case "go-to-origin": {
      const origin = readOrigin(input, element);
      // `originId` 는 element id 가 아닐 수 있다 — canonical ref 는 원본을
      // customId 나 metadata alias 로 가리키기도 하고, 표면이 그 해석 결과를
      // `originElement` 로 넘긴다. 선택은 **해석된 노드의 실 id** 로 한다.
      const originElementId = origin.element?.id ?? origin.id;
      if (!originElementId || !origin.element) return false;
      useStore
        .getState()
        .selectElementWithPageTransition(
          originElementId,
          origin.element.page_id ?? origin.element.pageId ?? null,
        );
      return true;
    }

    case "detach-instance": {
      if (!canDetachInstance(element)) return false;
      if (input.confirm !== "skip") {
        const origin = readOrigin(input, element);
        const confirmed = await requestEditingSemanticsDetachConfirmation({
          instanceId: targetId,
          instanceLabel: resolveComponentSemanticsLabel(
            element,
            origin.element,
            targetId,
          ),
          originId: origin.id,
          originLabel: origin.element
            ? resolveComponentSemanticsLabel(
                origin.element,
                null,
                origin.id ?? targetId,
              )
            : origin.id,
        });
        if (!confirmed) return false;
      }
      useStore.getState().detachInstance(targetId);
      return true;
    }

    case "toggle-component-origin": {
      await useStore.getState().toggleComponentOrigin(targetId);
      return true;
    }

    default:
      return false;
  }
}
