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
  const { parentElement } = context;
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
  const { parentElement } = context;
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
        //   Nav.css(.react-aria-Nav)로 보이나 Skia/레이아웃 엔진 은 props.style 만 읽어 gap/padding 0 → 자식
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
  const { parentElement } = context;
  const parentId = parentElement?.id || null;

  return {
    type: "Pagination",
    parent: {
      type: "Pagination",
      props: {
        totalPages: 5,
        currentPage: 1,
        style: {
          // ADR-171 Phase 4 (2026-07-29): `display:flex` 제거 — 두 채널 모두 flex 보유.
          //   `flexDirection`/`alignItems` 는 **유지** — 실효 DOM 은 row/center 인데 catalog
          //   resolver 는 두 키를 공급하지 않아, 빼면 캔버스가 값을 잃는다.
          flexDirection: "row",
          alignItems: "center",
          // ADR-171 Phase 3 (2026-07-29): `gap: 6` 제거. 실효 DOM 은 `Table.css` 의
          //   `.react-aria-Pagination { gap: var(--spacing-sm) }` = 8px 인데 인라인 6 이
          //   catalog 를 가려 Skia 만 6 이었다(인라인 우선 규칙). Phase 1 이 그 8 을
          //   catalog 로 이관했고 Phase 3 이 전달을 열었으므로 인라인은 틀린 사본이다.
          //   나머지 layout 인라인 일괄 제거는 Phase 5 fixture 도입 후 Phase 4 에서 한다.
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
  const { parentElement } = context;
  const parentId = parentElement?.id || null;

  // ⭐ Layout/Slot System

  return {
    type: "Disclosure",
    parent: {
      type: "Disclosure",
      props: {
        // ADR-171 Phase 4 (2026-07-29): `display:block` 인라인 제거 — 두 채널 모두 block 을
        //   자기 것으로 갖는다(실측 DOM `.react-aria-Disclosure` block = catalog resolver block).
        style: {},
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
  const { parentElement } = context;
  const parentId = parentElement?.id || null;

  // ⭐ Layout/Slot System

  return {
    type: "DisclosureGroup",
    parent: {
      type: "DisclosureGroup",
      props: {
        // CSS 정본 — .react-aria-DisclosureGroup flex/column (Disclosure 세로 스택). factory(block)가
        //   CSS 와 시각 비대칭 + false dirty 였음 (2026-06-23 layout 방향 정정). createDefault 와 정합.
        // ADR-171 Phase 4 (2026-07-29): 그 정본이 이제 두 채널 모두에 있으므로 인라인 사본 제거
        //   (실측 DOM flex/column = catalog resolver flex/column).
        style: {},
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "Disclosure",
        props: {
          // ADR-171 Phase 4: 위 단독 Disclosure 와 동일 사유로 인라인 제거.
          style: {},
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
          // ADR-171 Phase 4: 위 단독 Disclosure 와 동일 사유로 인라인 제거.
          style: {},
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
