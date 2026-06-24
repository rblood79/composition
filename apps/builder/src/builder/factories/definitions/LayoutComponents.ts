import { ComponentElementProps } from "../../../types/core/store.types";
import { ElementUtils } from "../../../utils/element/elementUtils";
import { ComponentDefinition, ComponentCreationContext } from "../types";

/**
 * Tabs 컴포넌트 정의
 */
export function createTabsDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  // ADR-066: items SSOT — Tab element 소멸, TabPanel만 유지 (itemId 페어링)
  const item1Id = ElementUtils.generateId();
  const item2Id = ElementUtils.generateId();
  const items = [
    { id: item1Id, title: "Tab 1" },
    { id: item2Id, title: "Tab 2" },
  ];

  // ⭐ Layout/Slot System

  return {
    type: "Tabs",
    parent: {
      type: "Tabs",
      props: {
        items,
        defaultSelectedKey: item1Id,
        orientation: "horizontal",
        showIndicator: true,
        style: {
          width: "100%",
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "TabList",
        props: {} as ComponentElementProps,
      },
      {
        type: "TabPanels",
        props: {} as ComponentElementProps,
        children: [
          {
            type: "TabPanel",
            props: {
              itemId: item1Id,
            } as ComponentElementProps,
          },
          {
            type: "TabPanel",
            props: {
              itemId: item2Id,
            } as ComponentElementProps,
          },
        ],
      },
    ],
  };
}

/**
 * Card 컴포넌트 정의
 *
 * Card를 복합 컴포넌트로 생성하여 title(Heading)과 description(p)을
 * 별도 Element로 관리합니다.
 * → 더블클릭으로 자식 선택, 레이어 트리에서 계층 구조 확인 가능
 */
export function createCardDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  // ⭐ Layout/Slot System

  return {
    type: "Card",
    parent: {
      type: "Card",
      props: {
        // ADR-912 R6 (2026-06-15): S2 variant 모델(구 cardType/isQuiet 대체). primary = 기본 표면.
        variant: "primary",
        size: "md",
        orientation: "vertical",
        title: "Card Title",
        description: "Card description text goes here.",
        style: {
          display: "flex",
          flexDirection: "column",
          width: "100%",
          padding: "16px",
          borderWidth: "1px",
          // gap=12px catalog(sizes.md.gap=12) 정본 (2026-06-23 전수 정정 — factory 8px ≠ CSS 12px).
          gap: "12px",
          // S2 Card 정본: root 가 overflow:clip + radius.lg(catalog sizes.md.borderRadius={radius.lg}=12px)
          //   로 자식을 단일 radius 로 clip 한다. CardPreview 상단 모서리는 이 root clip 이 처리 →
          //   CardPreview 자체 borderRadius 불필요(2026-06-24 S2 정합). CSS Preview 는 둥근 상단 이미지,
          //   Skia 는 clipRect 만 지원(radius-clip 미지원)이라 직각 — 양 consumer 공통 제약.
          overflow: "hidden",
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "CardPreview",
        // ADR-912 childSpec→catalog cutover (2026-06-15): CardPreview layout 은 factory props.style 가
        //   직접 read(spec 삭제 후 Skia/Taffy). flexDirection:column 명시(다른 Card 자식 컨테이너 일관).
        // 2026-06-24 S2 정합: borderRadius("8px 8px 0 0") 제거. S2 Card 비-quiet 메커니즘은 CardPreview 에
        //   radius 를 주지 않고 root overflow:clip + radius.lg 가 상단 모서리를 처리한다. 구 8px 는
        //   ① Card root radius(12px=radius.lg)와 불일치 ② Skia clipRect(radius 무시)라 CSS 에서만 둥글어
        //   이미 비대칭이었다. 제거하면 catalog sizes.*.borderRadius={radius.none} 과 일치 → reset dirty=0.
        props: {
          style: {
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "fit-content",
            overflow: "hidden",
          },
        } as ComponentElementProps,
        children: [
          {
            type: "Image",
            props: {
              src: "",
              alt: "Card preview",
              style: {
                width: "100%",
                height: 200,
                objectFit: "cover",
              },
            } as ComponentElementProps,
          },
        ],
      },
      {
        // ADR-912 childSpec→catalog cutover (2026-06-15): CardHeader layout 을 factory props.style
        //   복귀. ADR-092 Phase 4/5 가 CardHeaderSpec.containerStyles(display/flexDirection/alignItems/
        //   width) + sizes.md.gap 으로 이관했던 것을, spec 삭제(catalog 전환) 대비 factory 로 되돌림
        //   — Skia/Taffy 가 props.style 을 직접 read(ADR-907 Layer B container layout SSOT). FormField/
        //   DialogFooter 동형. gap 4px = CardHeaderSpec.sizes.md.gap.
        type: "CardHeader",
        props: {
          style: {
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: "4px",
            width: "100%",
          },
        } as ComponentElementProps,
        children: [
          {
            type: "Heading",
            props: {
              children: "Card Title",
              level: 3,
              className: "card-title",
              // 2026-06-24: inline fontSize/lineHeight → size prop 전환 (catalog 토큰 정합). size="md"
              //   → catalog Heading.sizes.md fontSize 16(text-base) + lineHeight 24. fontWeight 600
              //   inline 유지 — CSS 가 textWeight(Skia-only 채널)를 emit 안 해 DOM <h3> 기본 700 ↔
              //   Skia 600 발산 방지. 비-typography(margin/flex — Card 헤더 레이아웃) 유지.
              size: "md",
              style: {
                display: "block",
                fontWeight: "600",
                margin: "0",
                flex: 1,
              },
            } as ComponentElementProps,
          },
        ],
      },
      {
        // ADR-912 childSpec→catalog cutover (2026-06-15): CardContent layout 을 factory props.style
        //   복귀. ADR-092 가 CardContentSpec.containerStyles(display/flexDirection/width) + sizes.md.gap
        //   으로 이관했던 것을 spec 삭제 대비 factory 로 되돌림 — Skia/Taffy 직접 read. gap 8px =
        //   CardContentSpec.sizes.md.gap.
        type: "CardContent",
        props: {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            width: "100%",
          },
        } as ComponentElementProps,
        children: [
          {
            type: "Description",
            props: {
              children: "Card description text goes here.",
              // 2026-06-24: inline fontSize/fontWeight/lineHeight → size prop 전환 (catalog 토큰 정합).
              //   size="lg" → catalog Description.sizes.lg fontSize 14(text-sm) + lineHeight 20
              //   + textWeight 400. 비-typography(width — Description containerStyles SSOT) 유지.
              //   color #49454f 는 별도 사안(catalog text 토큰 미정합, typography scope 외)으로 유지.
              size: "lg",
              style: {
                display: "block",
                width: "100%",
                color: "#49454f",
              },
            } as ComponentElementProps,
          },
        ],
      },
      {
        // ADR-912 childSpec→catalog cutover (2026-06-15): CardFooter layout 을 factory props.style
        //   복귀. ADR-092 Phase 4 가 CardFooterSpec.containerStyles(display/flexDirection/alignItems/
        //   justifyContent/width) + sizes.md.gap 으로 이관했던 것을 spec 삭제 대비 factory 로 되돌림 —
        //   Skia/Taffy 직접 read. paddingTop/borderTopWidth 는 시각적 구분선으로 기존 보존. gap 4px =
        //   CardFooterSpec.sizes.md.gap. DialogFooter(justifyContent:flex-end) 동일 정렬.
        type: "CardFooter",
        props: {
          style: {
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "4px",
            width: "100%",
            paddingTop: "8px",
            borderTopWidth: "1px",
          },
        } as ComponentElementProps,
      },
    ],
  };
}

/**
 * Tree 컴포넌트 정의
 */
export function createTreeDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  // ⭐ Layout/Slot System

  return {
    type: "Tree",
    parent: {
      type: "Tree",
      props: {
        "aria-label": "Tree",
        selectionMode: "single",
        selectionBehavior: "replace",
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "TreeItem",
        props: {
          children: "Node 1",
        } as ComponentElementProps,
      },
      {
        type: "TreeItem",
        props: {
          children: "Node 2",
        } as ComponentElementProps,
      },
    ],
  };
}
