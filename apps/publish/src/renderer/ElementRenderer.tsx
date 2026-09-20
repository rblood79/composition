/**
 * Element Renderer
 *
 * 🚀 Phase 10 B2.3: 단일 Element 렌더링 컴포넌트
 *
 * @since 2025-12-11 Phase 10 B2.3
 * @since 2026-01-02 Phase 3 Event Handling (legacy)
 * @since 2026-08-17 ADR-158 후속 — 인터랙션 규칙 실행로 교체
 *
 * 이벤트 축: 종전 legacy `element.events` + `ActionExecutor` 경로는 ADR-158
 * Phase 1 에서 mirror 파생이 끊겨 입력이 영구 empty(무동작)였다. 지금은
 * canonical `document.events` 의 인터랙션 규칙을 preview 와 같은 shared
 * dispatcher 로 실행한다 (`InteractionRuntime.tsx`).
 */

import { memo, useMemo } from "react";
import {
  adaptElementStyle,
  resolveAuthoredDomId,
  resolveBodyDomClassName,
  resolveBodyDomPresentation,
  type Element,
} from "@composition/shared";
import { getComponent } from "../registry/ComponentRegistry";
import {
  mergeInteractionOverride,
  useElementInteractionHandlers,
  useElementInteractionOverride,
} from "./InteractionRuntime";
import { useResolvedStateProps } from "./RuntimeStateRuntime";

// ============================================
// Types
// ============================================

/**
 * parent_id → 자식 (render model 입력 순서 = canonical child order). 루트는 `null` 키 —
 * `parent_id` 가 undefined 인 요소는 종전 `buildElementTree(…, null)` 과 같이 루트가 아니다.
 */
export type ChildrenByParent = ReadonlyMap<
  string | null | undefined,
  Element[]
>;

/** 페이지 요소를 한 번 순회해 부모별 자식 표를 만든다 — 요소마다 filter 하면 O(n²). */
export function groupChildrenByParent(elements: Element[]): ChildrenByParent {
  const map = new Map<string | null | undefined, Element[]>();
  for (const el of elements) {
    if (el.deleted) continue;
    const bucket = map.get(el.parent_id);
    if (bucket) bucket.push(el);
    else map.set(el.parent_id, [el]);
  }
  return map;
}

const NO_CHILDREN: Element[] = [];

export interface ElementRendererProps {
  element: Element;
  childrenByParent: ChildrenByParent;
}

// Card: structural children 감지 (Preview renderCard와 동일 로직)
const STRUCTURAL_CARD_TAGS = new Set([
  "CardHeader",
  "CardContent",
  "CardPreview",
  "CardFooter",
]);

// 미등록 타입 경고는 타입당 1회 — 렌더마다 찍으면 patch/write 때마다 되풀이된다.
const warnedUnknownTypes = new Set<string>();

// ============================================
// Element Renderer Component
// ============================================

export const ElementRenderer = memo(function ElementRenderer({
  element,
  childrenByParent,
}: ElementRendererProps) {
  // 인터랙션 규칙 트리거 (onPress 등) — 규칙 없는 요소는 공유 빈 객체.
  const eventHandlers = useElementInteractionHandlers(element.id);
  // capability 실행 결과 (show/hide/toggle, prop patch) — 런타임 override 층.
  const interactionOverride = useElementInteractionOverride(element.id);

  // ADR-214 Phase 3 — `{{ }}` 런타임 값 해석 (참조 없는 요소는 같은 참조)
  const stateResolvedProps = useResolvedStateProps(
    (element.props ?? {}) as Record<string, unknown>,
    element.id,
    element.page_id ?? null,
  );
  const stateResolvedElement = useMemo(
    () =>
      stateResolvedProps === element.props
        ? element
        : ({ ...element, props: stateResolvedProps } as Element),
    [element, stateResolvedProps],
  );

  const adaptedElement = useMemo(() => {
    const adapted = adaptElementStyle(stateResolvedElement);
    if (!interactionOverride) return adapted;
    const merged = mergeInteractionOverride(
      (adapted.props ?? {}) as Record<string, unknown>,
      interactionOverride,
    );
    return { ...adapted, props: merged as Element["props"] };
  }, [stateResolvedElement, interactionOverride]);

  const children = childrenByParent.get(adaptedElement.id) ?? NO_CHILDREN;

  // Props 추출 (style 제외한 나머지)
  const {
    style,
    className: authoredClassName,
    children: propsChildren,
    accentColor,
    ...restProps
  } = adaptedElement.props as Record<string, unknown>;

  // 자식이 있으면 재귀 렌더링, 없으면 props.children 사용
  const renderedChildren =
    children.length > 0
      ? children.map((child) => (
          <ElementRenderer
            key={child.id}
            element={child}
            childrenByParent={childrenByParent}
          />
        ))
      : (propsChildren as React.ReactNode);

  const Component = getComponent(adaptedElement.type);

  // 등록되지 않은 컴포넌트는 div로 fallback
  if (!Component) {
    if (!warnedUnknownTypes.has(adaptedElement.type)) {
      warnedUnknownTypes.add(adaptedElement.type);
      console.warn(
        `[ElementRenderer] Unknown component: ${adaptedElement.type}`,
      );
    }
    return (
      <div
        id={resolveAuthoredDomId(adaptedElement.type, adaptedElement.customId)}
        data-element-id={adaptedElement.id}
        data-element-type={adaptedElement.type}
        style={style as React.CSSProperties}
        {...eventHandlers}
      >
        {renderedChildren}
      </div>
    );
  }

  // D3 대칭 정합: Body 기본 시각은 generated CSS가 소유하고 DOM에는 사용자 override만 싣는다.
  const bodyPresentation = resolveBodyDomPresentation(
    adaptedElement.type,
    style as React.CSSProperties | undefined,
  );
  const resolvedClassName = resolveBodyDomClassName(
    adaptedElement.type,
    authoredClassName as string | undefined,
  );

  if (
    adaptedElement.type === "Card" &&
    children.some((c) => STRUCTURAL_CARD_TAGS.has(c.type))
  ) {
    restProps.structuralChildren = true;
  }

  // ADR-912 후속(2026-06-09): Slider 는 런타임 사용자 드래그를 위해 RAC uncontrolled
  //   (defaultValue)로 렌더한다. element.props.value(디자인 초기값)를 controlled `value`로
  //   넘기면 onChange 가 없어 RAC 가 매 렌더 초기값으로 복원 → 드래그 silently 실패
  //   (react-aria.adobe.com/Slider 레퍼런스). value → defaultValue 매핑으로 RAC 내부 state
  //   드래그 관리. (Preview renderSlider 와 동일 정책)
  if (adaptedElement.type === "Slider" && "value" in restProps) {
    if (restProps.defaultValue === undefined)
      restProps.defaultValue = restProps.value;
    delete restProps.value;
  }

  // 사용자가 지정한 id 를 DOM 에 싣는다 (CSS `#id`/앵커/외부 스크립트). catalog prop 으로 이미
  // id 가 투영된 경우와 RAC collection key 타입은 resolveAuthoredDomId 가 걸러 낸다.
  const authoredDomId = resolveAuthoredDomId(
    adaptedElement.type,
    adaptedElement.customId,
    restProps.id,
  );

  return (
    <Component
      {...restProps}
      {...(authoredDomId ? { id: authoredDomId } : {})}
      {...eventHandlers}
      data-element-id={adaptedElement.id}
      data-accent={accentColor ? String(accentColor) : undefined}
      className={resolvedClassName}
      style={bodyPresentation.style}
    >
      {renderedChildren}
    </Component>
  );
});

export default ElementRenderer;
