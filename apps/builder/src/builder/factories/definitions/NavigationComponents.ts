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
        children: "Menu",
        variant: "primary",
        size: "md",
        selectionMode: "none",
        items,
        style: {
          width: "fit-content",
          display: "block",
        },
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
        style: {
          width: "100%",
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
        style: {
          display: "block",
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
