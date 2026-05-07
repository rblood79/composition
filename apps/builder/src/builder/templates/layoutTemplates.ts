/**
 * Layout Templates
 *
 * 미리 정의된 Layout 템플릿들.
 * 사용자가 빠르게 Layout을 생성할 수 있도록 지원.
 */

import type { SlotProps } from "../../types/builder/layout.types";
import {
  FRAME_ELEMENT_MIRROR_ID_FIELD,
  withFrameElementMirrorId,
} from "../../adapters/canonical/frameMirror";

/**
 * Layout 템플릿 요소 정의
 */
export interface LayoutTemplateElement {
  /** 요소 태그 (예: "div", "Slot", "nav") */
  type: string;
  /** 요소 props */
  props: Record<string, unknown>;
  /** 자식 요소들 */
  children?: LayoutTemplateElement[];
  /** 스타일 (inline) */
  style?: React.CSSProperties;
}

/**
 * Layout 템플릿 정의
 */
export interface LayoutTemplate {
  /** 템플릿 ID */
  id: string;
  /** 템플릿 이름 */
  name: string;
  /** 템플릿 설명 */
  description: string;
  /** 카테고리 */
  category: "basic" | "dashboard" | "marketing" | "documentation";
  /** 미리보기 이미지 URL (optional) */
  previewImage?: string;
  /** 루트 요소들 */
  elements: LayoutTemplateElement[];
  /** 이 템플릿의 Slots */
  slots: SlotProps[];
}

// ===========================================
// Basic Layout Templates
// ===========================================

/**
 * 단일 콘텐츠 영역 (가장 기본)
 */
export const singleColumnTemplate: LayoutTemplate = {
  id: "single-column",
  name: "Single Column",
  description: "Simple single column layout with header, content, and footer",
  category: "basic",
  elements: [
    {
      type: "div",
      props: { className: "layout-container" },
      style: {
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
      },
      children: [
        {
          type: "Slot",
          props: {
            name: "header",
            description: "Page header area",
          } as SlotProps,
          style: { width: "100%" },
        },
        {
          type: "Slot",
          props: {
            name: "content",
            required: true,
            description: "Main content area",
          } as SlotProps,
          style: { flex: 1, width: "100%" },
        },
        {
          type: "Slot",
          props: {
            name: "footer",
            description: "Page footer area",
          } as SlotProps,
          style: { width: "100%" },
        },
      ],
    },
  ],
  slots: [
    { name: "header", description: "Page header area" },
    { name: "content", required: true, description: "Main content area" },
    { name: "footer", description: "Page footer area" },
  ],
};

/**
 * 2단 레이아웃 (사이드바 + 콘텐츠)
 */
export const twoColumnTemplate: LayoutTemplate = {
  id: "two-column",
  name: "Two Column (Sidebar + Content)",
  description: "Layout with left sidebar and main content area",
  category: "basic",
  elements: [
    {
      type: "div",
      props: { className: "layout-container" },
      style: {
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
      },
      children: [
        {
          type: "Slot",
          props: {
            name: "header",
            description: "Page header area",
          } as SlotProps,
          style: { width: "100%" },
        },
        {
          type: "div",
          props: { className: "layout-body" },
          style: {
            display: "flex",
            flexDirection: "row",
            flex: 1,
          },
          children: [
            {
              type: "Slot",
              props: {
                name: "sidebar",
                description: "Left sidebar for navigation",
              } as SlotProps,
              style: { width: "250px", flexShrink: 0 },
            },
            {
              type: "Slot",
              props: {
                name: "content",
                required: true,
                description: "Main content area",
              } as SlotProps,
              style: { flex: 1 },
            },
          ],
        },
        {
          type: "Slot",
          props: {
            name: "footer",
            description: "Page footer area",
          } as SlotProps,
          style: { width: "100%" },
        },
      ],
    },
  ],
  slots: [
    { name: "header", description: "Page header area" },
    { name: "sidebar", description: "Left sidebar for navigation" },
    { name: "content", required: true, description: "Main content area" },
    { name: "footer", description: "Page footer area" },
  ],
};

/**
 * 3단 레이아웃 (사이드바 + 콘텐츠 + 오른쪽 패널)
 */
export const threeColumnTemplate: LayoutTemplate = {
  id: "three-column",
  name: "Three Column",
  description: "Layout with left sidebar, main content, and right panel",
  category: "basic",
  elements: [
    {
      type: "div",
      props: { className: "layout-container" },
      style: {
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
      },
      children: [
        {
          type: "Slot",
          props: {
            name: "header",
            description: "Page header area",
          } as SlotProps,
          style: { width: "100%" },
        },
        {
          type: "div",
          props: { className: "layout-body" },
          style: {
            display: "flex",
            flexDirection: "row",
            flex: 1,
          },
          children: [
            {
              type: "Slot",
              props: {
                name: "sidebar",
                description: "Left sidebar for navigation",
              } as SlotProps,
              style: { width: "220px", flexShrink: 0 },
            },
            {
              type: "Slot",
              props: {
                name: "content",
                required: true,
                description: "Main content area",
              } as SlotProps,
              style: { flex: 1 },
            },
            {
              type: "Slot",
              props: {
                name: "aside",
                description: "Right panel for additional info",
              } as SlotProps,
              style: { width: "280px", flexShrink: 0 },
            },
          ],
        },
        {
          type: "Slot",
          props: {
            name: "footer",
            description: "Page footer area",
          } as SlotProps,
          style: { width: "100%" },
        },
      ],
    },
  ],
  slots: [
    { name: "header", description: "Page header area" },
    { name: "sidebar", description: "Left sidebar for navigation" },
    { name: "content", required: true, description: "Main content area" },
    { name: "aside", description: "Right panel for additional info" },
    { name: "footer", description: "Page footer area" },
  ],
};

// ===========================================
// Dashboard Layout Templates
// ===========================================

/**
 * 대시보드 레이아웃 (고정 헤더 + 사이드바)
 */
export const dashboardTemplate: LayoutTemplate = {
  id: "dashboard",
  name: "Dashboard",
  description: "Fixed header and sidebar with scrollable content area",
  category: "dashboard",
  elements: [
    {
      type: "div",
      props: { className: "layout-dashboard" },
      style: {
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
      },
      children: [
        {
          type: "Slot",
          props: {
            name: "topbar",
            description: "Fixed top navigation bar",
          } as SlotProps,
          style: { height: "56px", flexShrink: 0, width: "100%" },
        },
        {
          type: "div",
          props: { className: "layout-dashboard-body" },
          style: {
            display: "flex",
            flexDirection: "row",
            flex: 1,
            overflow: "hidden",
          },
          children: [
            {
              type: "Slot",
              props: {
                name: "navigation",
                description: "Side navigation menu",
              } as SlotProps,
              style: {
                width: "240px",
                flexShrink: 0,
                overflowY: "auto",
              },
            },
            {
              type: "Slot",
              props: {
                name: "content",
                required: true,
                description: "Main dashboard content",
              } as SlotProps,
              style: { flex: 1, overflowY: "auto", padding: "24px" },
            },
          ],
        },
      ],
    },
  ],
  slots: [
    { name: "topbar", description: "Fixed top navigation bar" },
    { name: "navigation", description: "Side navigation menu" },
    { name: "content", required: true, description: "Main dashboard content" },
  ],
};

/**
 * 대시보드 + 오른쪽 패널
 */
export const dashboardWithPanelTemplate: LayoutTemplate = {
  id: "dashboard-with-panel",
  name: "Dashboard with Right Panel",
  description: "Dashboard layout with additional right panel for details",
  category: "dashboard",
  elements: [
    {
      type: "div",
      props: { className: "layout-dashboard" },
      style: {
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
      },
      children: [
        {
          type: "Slot",
          props: {
            name: "topbar",
            description: "Fixed top navigation bar",
          } as SlotProps,
          style: { height: "56px", flexShrink: 0, width: "100%" },
        },
        {
          type: "div",
          props: { className: "layout-dashboard-body" },
          style: {
            display: "flex",
            flexDirection: "row",
            flex: 1,
            overflow: "hidden",
          },
          children: [
            {
              type: "Slot",
              props: {
                name: "navigation",
                description: "Side navigation menu",
              } as SlotProps,
              style: {
                width: "240px",
                flexShrink: 0,
                overflowY: "auto",
              },
            },
            {
              type: "Slot",
              props: {
                name: "content",
                required: true,
                description: "Main dashboard content",
              } as SlotProps,
              style: { flex: 1, overflowY: "auto", padding: "24px" },
            },
            {
              type: "Slot",
              props: {
                name: "details",
                description: "Right panel for item details",
              } as SlotProps,
              style: {
                width: "320px",
                flexShrink: 0,
                overflowY: "auto",
              },
            },
          ],
        },
      ],
    },
  ],
  slots: [
    { name: "topbar", description: "Fixed top navigation bar" },
    { name: "navigation", description: "Side navigation menu" },
    { name: "content", required: true, description: "Main dashboard content" },
    { name: "details", description: "Right panel for item details" },
  ],
};

// ===========================================
// Marketing Layout Templates
// ===========================================

/**
 * 랜딩 페이지 레이아웃
 */
export const landingPageTemplate: LayoutTemplate = {
  id: "landing-page",
  name: "Landing Page",
  description: "Full-width sections for marketing landing pages",
  category: "marketing",
  elements: [
    {
      type: "div",
      props: { className: "layout-landing" },
      style: {
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
      },
      children: [
        {
          type: "Slot",
          props: {
            name: "header",
            description: "Site header with navigation",
          } as SlotProps,
          style: { width: "100%" },
        },
        {
          type: "Slot",
          props: {
            name: "hero",
            description: "Hero section with main CTA",
          } as SlotProps,
          style: { width: "100%" },
        },
        {
          type: "Slot",
          props: {
            name: "content",
            required: true,
            description: "Main page content sections",
          } as SlotProps,
          style: { flex: 1, width: "100%" },
        },
        {
          type: "Slot",
          props: {
            name: "cta",
            description: "Call-to-action section",
          } as SlotProps,
          style: { width: "100%" },
        },
        {
          type: "Slot",
          props: {
            name: "footer",
            description: "Site footer",
          } as SlotProps,
          style: { width: "100%" },
        },
      ],
    },
  ],
  slots: [
    { name: "header", description: "Site header with navigation" },
    { name: "hero", description: "Hero section with main CTA" },
    {
      name: "content",
      required: true,
      description: "Main page content sections",
    },
    { name: "cta", description: "Call-to-action section" },
    { name: "footer", description: "Site footer" },
  ],
};

// ===========================================
// Documentation Layout Templates
// ===========================================

/**
 * 문서 레이아웃 (사이드 네비게이션 + TOC)
 */
export const documentationTemplate: LayoutTemplate = {
  id: "documentation",
  name: "Documentation",
  description: "Layout for documentation sites with nav and table of contents",
  category: "documentation",
  elements: [
    {
      type: "div",
      props: { className: "layout-docs" },
      style: {
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
      },
      children: [
        {
          type: "Slot",
          props: {
            name: "header",
            description: "Docs header with search",
          } as SlotProps,
          style: { width: "100%" },
        },
        {
          type: "div",
          props: { className: "layout-docs-body" },
          style: {
            display: "flex",
            flexDirection: "row",
            flex: 1,
          },
          children: [
            {
              type: "Slot",
              props: {
                name: "sidebar",
                description: "Documentation navigation",
              } as SlotProps,
              style: { width: "280px", flexShrink: 0 },
            },
            {
              type: "Slot",
              props: {
                name: "content",
                required: true,
                description: "Documentation content",
              } as SlotProps,
              style: { flex: 1, maxWidth: "800px" },
            },
            {
              type: "Slot",
              props: {
                name: "toc",
                description: "Table of contents",
              } as SlotProps,
              style: { width: "200px", flexShrink: 0 },
            },
          ],
        },
      ],
    },
  ],
  slots: [
    { name: "header", description: "Docs header with search" },
    { name: "sidebar", description: "Documentation navigation" },
    { name: "content", required: true, description: "Documentation content" },
    { name: "toc", description: "Table of contents" },
  ],
};

// ===========================================
// All Templates Export
// ===========================================

/**
 * 모든 Layout 템플릿
 */
export const layoutTemplates: LayoutTemplate[] = [
  // Basic
  singleColumnTemplate,
  twoColumnTemplate,
  threeColumnTemplate,
  // Dashboard
  dashboardTemplate,
  dashboardWithPanelTemplate,
  // Marketing
  landingPageTemplate,
  // Documentation
  documentationTemplate,
];

/**
 * 카테고리별 템플릿 그룹화
 */
export const layoutTemplatesByCategory = {
  basic: layoutTemplates.filter((t) => t.category === "basic"),
  dashboard: layoutTemplates.filter((t) => t.category === "dashboard"),
  marketing: layoutTemplates.filter((t) => t.category === "marketing"),
  documentation: layoutTemplates.filter((t) => t.category === "documentation"),
};

/**
 * 템플릿 ID로 찾기
 */
export function getLayoutTemplateById(id: string): LayoutTemplate | undefined {
  return layoutTemplates.find((t) => t.id === id);
}

/**
 * 템플릿에서 Element 생성 (Layout 요소 생성용 헬퍼)
 */
export function createElementsFromTemplate(
  template: LayoutTemplate,
  layoutId: string,
  generateId: () => string,
): Array<
  {
    id: string;
    type: string;
    props: Record<string, unknown>;
    style?: React.CSSProperties;
    parent_id: string | null;
  } & Record<typeof FRAME_ELEMENT_MIRROR_ID_FIELD, string>
> {
  type LegacyTemplateElement = {
    id: string;
    type: string;
    props: Record<string, unknown>;
    style?: React.CSSProperties;
    parent_id: string | null;
  } & Record<typeof FRAME_ELEMENT_MIRROR_ID_FIELD, string>;

  const elements: LegacyTemplateElement[] = [];

  function processElement(
    templateEl: LayoutTemplateElement,
    parentId: string | null,
  ): string {
    const id = generateId();
    elements.push(
      withFrameElementMirrorId(
        {
          id,
          type: templateEl.type,
          props: templateEl.props,
          style: templateEl.style,
          parent_id: parentId,
        },
        layoutId,
      ) as LegacyTemplateElement,
    );

    if (templateEl.children) {
      templateEl.children.forEach((child) => {
        processElement(child, id);
      });
    }

    return id;
  }

  template.elements.forEach((el) => {
    processElement(el, null);
  });

  return elements;
}

export default layoutTemplates;
