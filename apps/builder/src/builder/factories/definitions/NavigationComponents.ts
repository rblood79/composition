import { ComponentElementProps } from "../../../types/core/store.types";
import { ComponentDefinition, ComponentCreationContext } from "../types";
import type { StoredMenuItem } from "@composition/specs";

/**
 * Menu 컴포넌트 정의 (ADR-068 P4)
 *
 * items prop 으로 MenuItem 데이터를 직렬화 가능한 StoredMenuItem[] 형태로 관리.
 * MenuItem 자식 element는 더 이상 생성하지 않는다.
 */
export function createMenuDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  // ⭐ Layout/Slot System

  const items: StoredMenuItem[] = [
    { id: crypto.randomUUID(), label: "Menu Item 1" },
    { id: crypto.randomUUID(), label: "Menu Item 2" },
    { id: crypto.randomUUID(), label: "Menu Item 3" },
  ];

  return {
    type: "Menu",
    parent: {
      type: "Menu",
      props: {
        "aria-label": "Menu",
        label: "Menu",
        children: "Menu",
        variant: "primary",
        size: "md",
        selectionMode: "none",
        items,
        // ADR-151 B7 (2026-07-16 사용자 결정): 캔버스 Menu 표현 = 트리거 버튼 통일.
        //   구 list-era style(display:flex/column/width:100%, 2026-06-23 결정)은 Skia 만 소비해
        //   390px 전폭 바 vs DOM 트리거 버튼(fit-content) 표현 발산 — 제거. layout 기본값은
        //   catalog top-level containerStyles(트리거 박스)가 공급 (factory inline 금지 원칙).
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [],
  };
}

/**
 * Nav 컴포넌트 정의
 *
 * CSS DOM 구조 대응:
 *   Nav (parent, type="Nav")
 *     ├─ Link (type="Link", children="Home", href="/")
 *     ├─ Link (type="Link", children="About", href="/about")
 *     └─ Link (type="Link", children="Contact", href="/contact")
 */
export function createNavDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  return {
    type: "Nav",
    parent: {
      type: "Nav",
      props: {
        label: "Navigation",
        // ADR-912 Nav catalog cutover 후속 (2026-06-11): 자식(Link/Button) 가로 배치 layout 을
        //   props.style 로 명시 — container layout(flex/gap/padding)은 ADR-907 Layer B 로 props.style
        //   이 SSOT (catalog rule 의 gap/padding 은 leaf inset 전용, layout 제외). 미주입 시 CSS 는
        //   Nav.css(.react-aria-Nav)로 보이나 Skia/Taffy 는 props.style 만 읽어 gap/padding 0 → 자식
        //   붙음(Skia↔CSS 비대칭). Pagination definition 동형 패턴. gap/padding = Nav.css md size 미러
        //   (gap 12 / padding 12px 16px), store longhand 정책으로 rowGap/columnGap + padding 4-way.
        style: {
          width: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          rowGap: 12,
          columnGap: 12,
          paddingTop: 12,
          paddingRight: 16,
          paddingBottom: 12,
          paddingLeft: 16,
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "Link",
        props: {
          children: "Home",
          href: "/",
          variant: "primary",
        } as ComponentElementProps,
      },
      {
        type: "Link",
        props: {
          children: "About",
          href: "/about",
          variant: "primary",
        } as ComponentElementProps,
      },
      {
        type: "Link",
        props: {
          children: "Contact",
          href: "/contact",
          variant: "primary",
        } as ComponentElementProps,
      },
    ],
  };
}

/**
 * Pagination 컴포넌트 정의
 *
 * CSS DOM 구조 대응:
 *   Pagination (parent, type="Pagination", flex row)
 *     ├─ Button ("←", Prev)
 *     ├─ Button ("1")
 *     ├─ Button ("2")
 *     ├─ Button ("3")
 *     └─ Button ("→", Next)
 */
export function createPaginationDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  return {
    type: "Pagination",
    parent: {
      type: "Pagination",
      props: {
        totalPages: 5,
        currentPage: 1,
        style: {
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "Button",
        props: {
          children: "←",
          variant: "secondary",
          fillStyle: "outline",
          size: "sm",
        } as ComponentElementProps,
      },
      {
        type: "Button",
        props: {
          children: "1",
          variant: "accent",
          size: "sm",
        } as ComponentElementProps,
      },
      {
        type: "Button",
        props: {
          children: "2",
          variant: "secondary",
          fillStyle: "outline",
          size: "sm",
        } as ComponentElementProps,
      },
      {
        type: "Button",
        props: {
          children: "3",
          variant: "secondary",
          fillStyle: "outline",
          size: "sm",
        } as ComponentElementProps,
      },
      {
        type: "Button",
        props: {
          children: "→",
          variant: "secondary",
          fillStyle: "outline",
          size: "sm",
        } as ComponentElementProps,
      },
    ],
  };
}

/**
 * Disclosure 컴포넌트 정의
 *
 * CSS DOM 구조 대응:
 *   Disclosure (parent, type="Disclosure")
 *     ├─ DisclosureHeader (type="DisclosureHeader", children="Section Title")
 *     └─ DisclosureContent (type="DisclosureContent", children="Section content goes here.")
 */
export function createDisclosureDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  // ⭐ Layout/Slot System

  return {
    type: "Disclosure",
    parent: {
      type: "Disclosure",
      props: {
        style: {
          display: "block",
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "DisclosureHeader",
        props: {
          children: "Section Title",
          headingLevel: 3,
          // 레퍼런스(starter .disclosure-button: width 100% + flex start) 정합 (2026-06-25).
          //   width 미지정 시 Skia DisclosureHeader leaf 가 콘텐츠 폭(auto)으로 렌더 → DOM(button
          //   width:100%) / 레퍼런스(100%)와 발산. width:100% 명시로 Skia 가 부모 폭을 소비.
          style: {
            width: "100%",
            display: "flex",
            flexDirection: "row",
            justifyContent: "flex-start",
            alignItems: "center",
          },
        } as ComponentElementProps,
      },
      {
        type: "DisclosureContent",
        props: {
          children: "Section content goes here.",
        } as ComponentElementProps,
      },
    ],
  };
}

/**
 * DisclosureGroup 컴포넌트 정의
 *
 * CSS DOM 구조 대응 (3-level 중첩):
 *   DisclosureGroup (parent, type="DisclosureGroup")
 *     ├─ Disclosure (type="Disclosure", style: display block)
 *     │    ├─ DisclosureHeader (type="DisclosureHeader", children="Section 1")
 *     │    └─ DisclosureContent (type="DisclosureContent", children="Content 1")
 *     └─ Disclosure (type="Disclosure", style: display block)
 *          ├─ DisclosureHeader (type="DisclosureHeader", children="Section 2")
 *          └─ DisclosureContent (type="DisclosureContent", children="Content 2")
 *
 * ChildDefinition.children 재귀 필드로 3레벨 중첩 표현
 */
export function createDisclosureGroupDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  // ⭐ Layout/Slot System

  return {
    type: "DisclosureGroup",
    parent: {
      type: "DisclosureGroup",
      props: {
        // CSS 정본 — .react-aria-DisclosureGroup flex/column (Disclosure 세로 스택). factory(block)가
        //   CSS 와 시각 비대칭 + false dirty 였음 (2026-06-23 layout 방향 정정). createDefault 와 정합.
        style: {
          display: "flex",
          flexDirection: "column",
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "Disclosure",
        props: {
          style: {
            display: "block",
          },
        } as ComponentElementProps,
        children: [
          {
            type: "DisclosureHeader",
            props: {
              children: "Section 1",
              headingLevel: 3,
              style: {
                width: "100%",
                display: "flex",
                flexDirection: "row",
                justifyContent: "flex-start",
                alignItems: "center",
              },
            } as ComponentElementProps,
          },
          {
            type: "DisclosureContent",
            props: {
              children: "Content 1",
            } as ComponentElementProps,
          },
        ],
      },
      {
        type: "Disclosure",
        props: {
          style: {
            display: "block",
          },
        } as ComponentElementProps,
        children: [
          {
            type: "DisclosureHeader",
            props: {
              children: "Section 2",
              headingLevel: 3,
              style: {
                width: "100%",
                display: "flex",
                flexDirection: "row",
                justifyContent: "flex-start",
                alignItems: "center",
              },
            } as ComponentElementProps,
          },
          {
            type: "DisclosureContent",
            props: {
              children: "Content 2",
            } as ComponentElementProps,
          },
        ],
      },
    ],
  };
}
