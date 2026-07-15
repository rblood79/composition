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

  // D3 대칭 정합(2026-07-15): canonical body 노드는 중첩 <div> 로 렌더되며 height 없는 style 만
  //   얹어 display content-fit 로 collapse → Skia 아트보드(페이지 프레임 높이) 와 body 박스 비대칭.
  //   실제 <body> 주입(useBodyElement)은 배경만 마스킹하고, 세로 중앙정렬/자식 full-height 는
  //   중첩 body div 높이에 의존해 발산한다(라이브 실측: flex-center body 자식이 뷰포트 중앙 대신
  //   collapse 박스 최상단에 갇힘). preview CanonicalNodeRenderer 와 동일하게 min-height:100vh 로
  //   body 박스를 뷰포트(=publish 페이지=Skia artboard)에 정합한다. height/minHeight 명시 시 보존.
  const bodyStyle = style as React.CSSProperties | undefined;
  const resolvedStyle: React.CSSProperties | undefined =
    adaptedElement.type === "body" &&
    bodyStyle?.height == null &&
    bodyStyle?.minHeight == null
      ? { ...bodyStyle, minHeight: "100vh" }
      : bodyStyle;

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

  return (
    <Component
      {...restProps}
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
