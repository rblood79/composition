/**
 * ADR-198 Phase 0 — 문서 형태 후보 (test-only)
 *
 * Skia leg 과 Preview leg 이 요구하는 문서 형태가 달라서 G0 가 막혀 있다.
 * 어느 축이 갈리는지 알려면 **한 번에 한 축만 바꾼 형태들**을 두 leg 에 각각
 * 먹여야 한다. 후보는 두 축의 조합이다:
 *
 *   축 A — page 노드의 `metadata: { type: "legacy-page", pageId }` 유무
 *   축 B — 컨테이너 위의 `Body` 래퍼 유무
 *
 * S1 은 **대조군** 이다: Preview 가 3/3 을 칠한다는 것이 이미 확인된 형태
 * (reference-parity-grid-needs-control-arm — 대조군 없는 인벤토리는 판정 불가).
 */

import type { CompositionDocument } from "@composition/shared";

export const SHAPE_PAGE_ID = "adr198-page";
export const SHAPE_BODY_ID = "adr198-body";
export const SHAPE_OUTER_ID = "adr198-outer";
export const SHAPE_INNER_ID = "adr198-inner";

export const SHAPE_ARTBOARD = { width: 240, height: 180 } as const;

export const SHAPE_COLORS = {
  body: "#FFFFFF",
  outer: "#2F6FED",
  inner: "#E8443F",
  border: "#102A5C",
} as const;

interface ShapeOptions {
  /** page 노드에 legacy-page metadata 를 붙일지 (축 A) */
  legacyPageMetadata: boolean;
  /** 컨테이너 위에 Body 래퍼를 둘지 (축 B) */
  bodyWrapper: boolean;
  /** Body 노드 타입 — canonical 은 소문자 "body" 만 인식한다 (S5 축) */
  bodyType?: string;
  /** Body 를 page 자식이 아니라 document 루트에 둘지 (S6 축) */
  bodyAtRoot?: boolean;
}

function containerStyle(): Record<string, string> {
  return {
    display: "block",
    width: `${SHAPE_ARTBOARD.width}px`,
    height: `${SHAPE_ARTBOARD.height}px`,
    paddingTop: "20px",
    paddingRight: "20px",
    paddingBottom: "20px",
    paddingLeft: "20px",
    backgroundColor: SHAPE_COLORS.body,
    boxSizing: "border-box",
  };
}

function subtree(): unknown {
  return {
    id: SHAPE_OUTER_ID,
    type: "frame",
    props: {
      style: {
        display: "block",
        width: "160px",
        height: "110px",
        paddingTop: "24px",
        paddingRight: "24px",
        paddingBottom: "24px",
        paddingLeft: "24px",
        backgroundColor: SHAPE_COLORS.outer,
        borderRadius: "12px",
        borderTopWidth: "2px",
        borderRightWidth: "2px",
        borderBottomWidth: "2px",
        borderLeftWidth: "2px",
        borderTopStyle: "solid",
        borderRightStyle: "solid",
        borderBottomStyle: "solid",
        borderLeftStyle: "solid",
        borderTopColor: SHAPE_COLORS.border,
        borderRightColor: SHAPE_COLORS.border,
        borderBottomColor: SHAPE_COLORS.border,
        borderLeftColor: SHAPE_COLORS.border,
        boxSizing: "border-box",
      },
    },
    children: [
      {
        id: SHAPE_INNER_ID,
        type: "frame",
        props: {
          style: {
            display: "block",
            width: "60px",
            height: "40px",
            backgroundColor: SHAPE_COLORS.inner,
            boxSizing: "border-box",
          },
        },
      },
    ],
  };
}

export function makeShape(opts: ShapeOptions): CompositionDocument {
  const inner = subtree();
  const bodyNode = {
    id: SHAPE_BODY_ID,
    type: opts.bodyType ?? "Body",
    props: { style: containerStyle() },
    children: [inner],
  };

  const pageChildren = opts.bodyWrapper
    ? opts.bodyAtRoot
      ? []
      : [bodyNode]
    : [inner];

  const page: Record<string, unknown> = {
    id: SHAPE_PAGE_ID,
    type: "frame",
    children: pageChildren,
  };
  if (opts.legacyPageMetadata) {
    page.metadata = { type: "legacy-page", pageId: SHAPE_PAGE_ID };
  }
  if (!opts.bodyWrapper) {
    page.props = { style: containerStyle() };
  }

  const roots: unknown[] = [page];
  if (opts.bodyWrapper && opts.bodyAtRoot) roots.push(bodyNode);

  return {
    version: "composition-1.0",
    children: roots,
  } as unknown as CompositionDocument;
}

export const SHAPES = [
  {
    id: "S1",
    label: "page(style) > frame > frame        [대조군 — Preview 3/3 확인됨]",
    opts: { legacyPageMetadata: false, bodyWrapper: false },
  },
  {
    id: "S2",
    label: "page(style,meta) > frame > frame   [축 A 만]",
    opts: { legacyPageMetadata: true, bodyWrapper: false },
  },
  {
    id: "S3",
    label: "page > Body > frame > frame        [축 B 만]",
    opts: { legacyPageMetadata: false, bodyWrapper: true },
  },
  {
    id: "S4",
    label: "page(meta) > Body > frame > frame  [축 A+B — 현 통합 fixture]",
    opts: { legacyPageMetadata: true, bodyWrapper: true },
  },
  {
    id: "S5",
    label: "page(meta) > body(소문자) > frame  [타입 케이스 교정]",
    opts: { legacyPageMetadata: true, bodyWrapper: true, bodyType: "body" },
  },
  {
    id: "S6",
    label: "page(meta) + body(소문자, 루트) > frame [케이스+위치 교정]",
    opts: {
      legacyPageMetadata: true,
      bodyWrapper: true,
      bodyType: "body",
      bodyAtRoot: true,
    },
  },
] as const;
