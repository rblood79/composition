/**
 * Element Renderer
 *
 * 🚀 Phase 10 B2.3: 단일 Element 렌더링 컴포넌트
 * 🚀 Phase 3: 이벤트 핸들링 추가
 *
 * @since 2025-12-11 Phase 10 B2.3
 * @since 2026-01-02 Phase 3 Event Handling
 */

import { memo, useMemo } from "react";
import { adaptElementFillStyle, type Element } from "@composition/shared";
import { getComponent } from "../registry/ComponentRegistry";
import { ActionExecutor } from "@composition/shared";
import type { EventRuntimeContext } from "@composition/shared";

// 이벤트 타입 정의
interface ElementEvent {
  trigger: string;
  actions: Array<{
    type: string;
    payload?: Record<string, unknown>;
  }>;
}

// 기본 런타임 컨텍스트 생성
function createDefaultContext(): EventRuntimeContext {
  return {
    navigateToPage: (pageId: string) => {
      window.location.hash = `page-${pageId}`;
    },
    state: new Map<string, unknown>(),
    currentPageId: window.location.hash.replace("#page-", "") || null,
  };
}

// ActionExecutor 싱글톤 인스턴스
const actionExecutor = new ActionExecutor(createDefaultContext());

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
  const adaptedElement = useMemo(
    () => adaptElementFillStyle(element),
    [element],
  );

  // 자식 요소들 찾기. render model 입력 순서가 canonical child order이다.
  const children = useMemo(() => {
    return elements.filter(
      (el) => el.parent_id === adaptedElement.id && !el.deleted,
    );
  }, [elements, adaptedElement.id]);

  // 이벤트 핸들러 생성
  const eventHandlers = useMemo(() => {
    const events = (adaptedElement as Element & { events?: ElementEvent[] })
      .events;
    if (!events || events.length === 0) return {};

    const handlers: Record<string, (e: React.SyntheticEvent) => void> = {};

    for (const event of events) {
      const handlerName = event.trigger; // 'onClick', 'onMouseEnter', etc.
      handlers[handlerName] = async (e: React.SyntheticEvent) => {
        e.stopPropagation();
        console.log(`[Event] ${adaptedElement.id} - ${handlerName} triggered`);

        // 모든 액션 순차 실행
        for (const action of event.actions) {
          try {
            await actionExecutor.execute({
              type: action.type,
              config: action.payload || {},
            } as import("@composition/shared").Action);
          } catch (error) {
            console.error(`[Event] Action ${action.type} failed:`, error);
          }
        }
      };
    }

    return handlers;
  }, [adaptedElement]);

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

  return (
    <Component
      {...restProps}
      {...eventHandlers}
      data-element-id={adaptedElement.id}
      data-accent={accentColor ? String(accentColor) : undefined}
      style={style as React.CSSProperties}
    >
      {renderedChildren}
    </Component>
  );
});

export default ElementRenderer;
