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
  resolveBodyArtboardStyle,
  type Element,
} from "@composition/shared";
import { getComponent } from "../registry/ComponentRegistry";
import {
  useElementInteractionHandlers,
  useElementInteractionOverride,
} from "./InteractionRuntime";

// ============================================
// Types
// ============================================

export interface ElementRendererProps {
  element: Element;
  elements: Element[];
  depth?: number;
}

// ============================================
// Element Renderer Component
// ============================================

export const ElementRenderer = memo(function ElementRenderer({
  element,
  elements,
  depth = 0,
}: ElementRendererProps) {
  // 인터랙션 규칙 트리거 (onPress 등) — 규칙 없는 요소는 공유 빈 객체.
  const eventHandlers = useElementInteractionHandlers(element.id);
  // capability 실행 결과 (show/hide/toggle, prop patch) — 런타임 override 층.
  const interactionOverride = useElementInteractionOverride(element.id);

  const adaptedElement = useMemo(() => {
    const adapted = adaptElementStyle(element);
    if (!interactionOverride) return adapted;
    const baseProps = (adapted.props ?? {}) as Record<string, unknown>;
    const merged: Record<string, unknown> = {
      ...baseProps,
      ...interactionOverride,
    };
    if (
      interactionOverride.style &&
      typeof interactionOverride.style === "object"
    ) {
      merged.style = {
        ...((baseProps.style as Record<string, unknown> | undefined) ?? {}),
        ...(interactionOverride.style as Record<string, unknown>),
      };
    }
    return { ...adapted, props: merged as Element["props"] };
  }, [element, interactionOverride]);

  // 자식 요소들 찾기. render model 입력 순서가 canonical child order이다.
  const children = useMemo(() => {
    return elements.filter(
      (el) => el.parent_id === adaptedElement.id && !el.deleted,
    );
  }, [elements, adaptedElement.id]);

  // 컴포넌트 가져오기
  const componentEntry = getComponent(adaptedElement.type);

  // 등록되지 않은 컴포넌트는 div로 fallback
  if (!componentEntry) {
    console.warn(`[ElementRenderer] Unknown component: ${adaptedElement.type}`);
    // 자식 Element가 있으면 재귀 렌더링, 없으면 props.children(텍스트 등) 사용
    const fallbackContent =
      children.length > 0
        ? children.map((child) => (
            <ElementRenderer
              key={child.id}
              element={child}
              elements={elements}
              depth={depth + 1}
            />
          ))
        : ((adaptedElement.props as Record<string, unknown>)
            ?.children as React.ReactNode);
    return (
      <div
        id={resolveAuthoredDomId(adaptedElement.type, adaptedElement.customId)}
        data-element-id={adaptedElement.id}
        data-element-type={adaptedElement.type}
        style={adaptedElement.props?.style as React.CSSProperties}
        {...eventHandlers}
      >
        {fallbackContent}
      </div>
    );
  }

  const Component = componentEntry.component;

  // Props 추출 (style 제외한 나머지)
  const {
    style,
    children: propsChildren,
    accentColor,
    ...restProps
  } = adaptedElement.props as Record<string, unknown>;

  // D3 대칭 정합: canonical body 노드를 Skia 아트보드 높이에 맞춘다(shared 단일 소스 —
  //   builder Preview `CanonicalNodeRenderer` 와 동일 로직). 근거는 resolveBodyArtboardStyle 참조.
  const resolvedStyle = resolveBodyArtboardStyle(
    adaptedElement.type,
    style as React.CSSProperties | undefined,
  );

  // Card: structural children 감지 (Preview renderCard와 동일 로직)
  const STRUCTURAL_CARD_TAGS = new Set([
    "CardHeader",
    "CardContent",
    "CardPreview",
    "CardFooter",
  ]);
  if (
    adaptedElement.type === "Card" &&
    children.some((c) => STRUCTURAL_CARD_TAGS.has(c.type))
  ) {
    (restProps as Record<string, unknown>).structuralChildren = true;
  }

  // ADR-912 후속(2026-06-09): Slider 는 런타임 사용자 드래그를 위해 RAC uncontrolled
  //   (defaultValue)로 렌더한다. element.props.value(디자인 초기값)를 controlled `value`로
  //   넘기면 onChange 가 없어 RAC 가 매 렌더 초기값으로 복원 → 드래그 silently 실패
  //   (react-aria.adobe.com/Slider 레퍼런스). value → defaultValue 매핑으로 RAC 내부 state
  //   드래그 관리. (Preview renderSlider 와 동일 정책)
  if (adaptedElement.type === "Slider" && "value" in restProps) {
    const props = restProps as Record<string, unknown>;
    if (props.defaultValue === undefined) props.defaultValue = props.value;
    delete props.value;
  }

  // 자식이 있으면 재귀 렌더링, 없으면 props.children 사용
  const renderedChildren =
    children.length > 0
      ? children.map((child) => (
          <ElementRenderer
            key={child.id}
            element={child}
            elements={elements}
            depth={depth + 1}
          />
        ))
      : propsChildren;

  // 사용자가 지정한 id 를 DOM 에 싣는다 (CSS `#id`/앵커/외부 스크립트). catalog prop 으로 이미
  // id 가 투영된 경우와 RAC collection key 타입은 resolveAuthoredDomId 가 걸러 낸다.
  const authoredDomId = resolveAuthoredDomId(
    adaptedElement.type,
    adaptedElement.customId,
    (restProps as Record<string, unknown>).id,
  );

  return (
    <Component
      {...restProps}
      {...(authoredDomId ? { id: authoredDomId } : {})}
      {...eventHandlers}
      data-element-id={adaptedElement.id}
      data-accent={accentColor ? String(accentColor) : undefined}
      style={resolvedStyle}
    >
      {renderedChildren}
    </Component>
  );
});

export default ElementRenderer;
