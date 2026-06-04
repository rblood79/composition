/**
 * @fileoverview Canonical Node Renderer — ADR-903 P2 옵션 C
 *
 * `resolveCanonicalDocument` 가 반환하는 `ResolvedNode` 트리를
 * DOM/CSS 요소로 렌더링하는 React 컴포넌트.
 *
 * 역할:
 * - ResolvedNode.props 에서 canonical props 추출
 * - canonical props 에서 type + props 복원 → 기존 rendererMap 위임
 * - 재귀 children 렌더링
 * - DOM 마커: data-canonical-id + data-element-id
 *
 * feature flag `?canonical=1` 시에만 활성화됨.
 * legacy 경로(App.tsx hybrid 분기)는 feature flag 기본 false 상태에서 무변경 보존.
 *
 * @see docs/adr/903-ref-descendants-slot-composition-format-migration-plan.md
 */

import React from "react";
import * as RAC from "react-aria-components";
import { rendererMap } from "@composition/shared/renderers";
import {
  adaptElementFillStyle,
  getPrimitiveBinding,
  toRacProps,
  toReactStyle,
} from "@composition/shared";
import { Badge } from "@composition/shared/components/Badge";
import { Calendar } from "@composition/shared/components/Calendar";
import { ComboBox } from "@composition/shared/components/ComboBox";
import { DatePicker } from "@composition/shared/components/DatePicker";
import { DateRangePicker } from "@composition/shared/components/DateRangePicker";
import { Dialog } from "@composition/shared/components/Dialog";
import { DropZone } from "@composition/shared/components/DropZone";
import { GridList } from "@composition/shared/components/GridList";
import { Icon } from "@composition/shared/components/Icon";
import { ListBox } from "@composition/shared/components/ListBox";
import { MenuButton } from "@composition/shared/components/Menu";
import { Modal } from "@composition/shared/components/Modal";
import { Popover } from "@composition/shared/components/Popover";
import { RangeCalendar } from "@composition/shared/components/RangeCalendar";
import { Select } from "@composition/shared/components/Select";
import { Skeleton } from "@composition/shared/components/Skeleton";
import Table from "@composition/shared/components/Table";
import { Tabs } from "@composition/shared/components/Tabs";
import { TagGroup } from "@composition/shared/components/TagGroup";
import { Tooltip } from "@composition/shared/components/Tooltip";
import { Tree } from "@composition/shared/components/Tree";
import {
  isSpecOrCatalogBacked,
  resolveBackedDefaultSize,
} from "../utils/specCatalogBacked";
import type { ResolvedNode } from "@composition/shared";
import type {
  RenderContext as SharedRenderContext,
  PreviewElement as SharedPreviewElement,
} from "@composition/shared/types";
import { extractCanonicalPropsFromResolved } from "../../resolvers/canonical/storeBridge";
import type { RenderContext } from "../types/index";
import type { PreviewElement } from "../types/index";
import {
  getFrameElementMirrorId,
  withFrameElementMirrorId,
} from "../../adapters/canonical/frameMirror";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CanonicalNodeRendererProps {
  /** resolve 완료된 단일 노드 */
  node: ResolvedNode;
  /** Preview RenderContext — rendererMap 위임 시 전달 */
  renderContext: RenderContext;
  /** 부모 경로 (디버그 + DOM 마커용) */
  parentPath?: string;
  /**
   * ADR-142 — catalog generic 렌더 경로로 cutover 된 component type 집합.
   * 포함된 type 은 per-component `rendererMap` 대신 `toRacProps`→RAC primitive 로 렌더.
   * 기본 미지정(undefined) → 전부 legacy `rendererMap` 경로 (live 회귀 0, G2 fallback 규율).
   * family cutover(Phase 6) 가 type 을 catalog 로 옮기면 caller 가 이 집합에 추가한다.
   */
  cutoverPrimitives?: ReadonlySet<string>;
}

/**
 * ADR-142 — internal source primitive(RAC raw 가 아닌 composition wrapper)의 DOM 렌더러.
 * `PrimitiveBinding.source.renderer` 식별자 → shared 컴포넌트.
 *
 * - leaf(Icon=Lucide SVG, Badge=styled span): RAC controller 없는 D1 탈출구.
 * - collection(ListBox/Menu/Select/ComboBox/Tabs/TagGroup/GridList, family ④): RAC raw 가 아니라
 *   composition wrapper 가 D1 담당 — wrapper 가 `useCollectionData`(dataBinding → items, ADR-132)로
 *   데이터를 채우고 RAC collection + Item 을 자체 합성한다. cutover DOM 경로가 `toRacProps` 로
 *   dataBinding 등 wrapper props 를 통과시키면 wrapper 가 items 를 렌더(자식 재귀 불필요). Skia 는
 *   skiaLegacy(render.shapes 유지) — items 순회 Skia generic 미지원(전 family 후 일괄).
 */
const INTERNAL_RENDERERS: Readonly<
  Record<string, React.ElementType | undefined>
> = {
  icon: Icon,
  badge: Badge,
  // ADR-912 단계 5 선행-1: loading placeholder internal leaf
  skeleton: Skeleton,
  // family ④ collections — composition wrapper (useCollectionData 포함)
  listbox: ListBox,
  menu: MenuButton,
  select: Select,
  combobox: ComboBox,
  tabs: Tabs,
  taggroup: TagGroup,
  gridlist: GridList,
  // family ⑤ Tree·Table — composition wrapper (재귀/2D collection, useCollectionData)
  tree: Tree,
  table: Table,
  // family ⑥ overlays — composition wrapper (portal/overlay, skiaLegacy)
  dialog: Dialog,
  modal: Modal,
  popover: Popover,
  tooltip: Tooltip,
  dropzone: DropZone,
  // family ⑦ date — composition wrapper (날짜 grid/portal, skiaLegacy). color 는 사용자 지시 제외.
  calendar: Calendar,
  rangecalendar: RangeCalendar,
  datepicker: DatePicker,
  daterangepicker: DateRangePicker,
};

// ─────────────────────────────────────────────────────────────────────────────
// CanonicalNodeRenderer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 단일 `ResolvedNode` 를 DOM 요소로 렌더링한다.
 *
 * 렌더링 순서:
 * 1. `extractCanonicalPropsFromResolved` 로 canonical props 추출
 * 2. props 에서 `type` 복원 (metadata.type → node.type fallback)
 * 3. rendererMap 위임 (기존 shared renderer 재사용)
 * 4. rendererMap 미등록 시 generic div 렌더링 + children 재귀
 * 5. DOM 마커: `data-canonical-id` + `data-element-id`
 */
export function CanonicalNodeRenderer({
  node,
  renderContext,
  parentPath = "",
  cutoverPrimitives,
}: CanonicalNodeRendererProps): React.ReactElement | null {
  const currentPath = parentPath ? `${parentPath}/${node.id}` : node.id;

  // ── canonical props 추출 ──────────────────────────────────────────────────
  const canonicalProps = extractCanonicalPropsFromResolved(node);

  // ── type 복원 ─────────────────────────────────────────────────────────────
  // node.type 이 ComponentTag (예: "button", "text", "frame") 이므로
  // type 은 canonical props marker → metadata.originalTag → node.type 순으로 fallback
  const type =
    (canonicalProps._tag as string | undefined) ??
    (canonicalProps.type as string | undefined) ??
    ((node.metadata as Record<string, unknown> | undefined)?.originalTag as
      | string
      | undefined) ??
    String(node.type);

  // ── PreviewElement 재구성 (rendererMap 시그니처 맞춤) ────────────────────
  const elementId = node.id;

  const previewEl: PreviewElement = withFrameElementMirrorId(
    {
      id: elementId,
      type,
      props: canonicalProps as PreviewElement["props"],
      parent_id: null,
      page_id: null,
      fills: [],
    },
    getFrameElementMirrorId(canonicalProps),
  );

  // fills + style 변환 (adaptElementFillStyle)
  const adaptedEl = adaptElementFillStyle(previewEl);

  // DOM 마커 props
  const markerProps = {
    "data-canonical-id": node.id,
    "data-element-id": elementId,
  };

  // ── ADR-142: catalog generic 렌더 경로 (cutover 된 primitive 한정) ────────
  // per-component rendererMap 대신 generic toRacProps → primitive 로 렌더.
  // cutoverPrimitives 에 포함된 type 만 해당 — 미지정 시 아래 legacy 경로 보존(회귀 0).
  // source.kind 분기: rac → RAC[component] / internal → INTERNAL_RENDERERS[renderer].
  if (cutoverPrimitives?.has(type)) {
    const binding = getPrimitiveBinding(type);
    const PrimitiveComponent: React.ElementType | undefined = !binding
      ? undefined
      : binding.source.kind === "rac"
        ? (RAC as unknown as Record<string, React.ElementType | undefined>)[
            binding.source.component
          ]
        : INTERNAL_RENDERERS[binding.source.renderer];
    if (binding && PrimitiveComponent) {
      const { children: racChildren, ...racRest } = toRacProps(node, binding);
      const childNodes = node.children ?? [];
      // ADR-912 1A-(b): catalog generic(cutover) 경로의 props.style override 상실 seam 닫기.
      // base 색/size 는 generated CSS(react-aria-{Type}[data-*])가 적용 — toReactStyle 은
      // override(props.style) 전용. data-* 변형/사이즈는 racRest(toRacProps)가 emit.
      const overrideStyle = toReactStyle(node) as
        | React.CSSProperties
        | undefined;
      return (
        <PrimitiveComponent
          key={node.id}
          {...markerProps}
          {...racRest}
          style={overrideStyle}
        >
          {childNodes.length > 0
            ? childNodes.map((child) => (
                <CanonicalNodeRenderer
                  key={child.id}
                  node={child}
                  renderContext={renderContext}
                  parentPath={currentPath}
                  cutoverPrimitives={cutoverPrimitives}
                />
              ))
            : (racChildren as React.ReactNode)}
        </PrimitiveComponent>
      );
    }
  }

  // ── rendererMap 위임 ──────────────────────────────────────────────────────
  const renderer = rendererMap[adaptedEl.type];
  if (renderer) {
    // shared renderer 는 RenderContext.renderElement 를 통해 자식을 렌더링하므로
    // 여기서는 rendererMap 에 그대로 위임. DOM 마커는 wrapper div 로 감쌈.
    return (
      <div key={node.id} {...markerProps} style={{ display: "contents" }}>
        {renderer(
          adaptedEl as unknown as SharedPreviewElement,
          renderContext as unknown as SharedRenderContext,
        )}
      </div>
    );
  }

  // ── generic 렌더링 (rendererMap 미등록 태그) ─────────────────────────────
  const children = node.children ?? [];

  // spec-backed 컴포넌트(Text/Heading/Paragraph/Description 등 rendererMap 미등록 leaf)는
  // legacy App.tsx fallback 과 동일하게 `react-aria-{Type}` className + data-size/variant 를
  // 주입해야 한다. 누락 시 generated CSS selector(`.react-aria-Text[data-size="lg"]`)가
  // 매칭되지 않아 Preview 가 size/variant 변화를 전혀 반영하지 못한다(브라우저 기본 폰트 고정).
  // ADR-912 선행-6(2026-06-04): catalog 등록 type 도 spec-backed 로 간주(isSpecOrCatalogBacked).
  //   spec 삭제(step 4) 후에도 className/data-size 가 catalog 기준으로 유지되어 컴포넌트 CSS
  //   selector(generated 또는 수동 .react-aria-Label) 매칭 보존.
  const specBacked = isSpecOrCatalogBacked(type);
  const specClassName = specBacked ? `react-aria-${type}` : undefined;
  const userClassName = adaptedEl.props?.className as string | undefined;
  const mergedClassName =
    [specClassName, userClassName].filter(Boolean).join(" ") || undefined;
  const specDataAttrs: Record<string, string> = {};
  if (specBacked) {
    const sizeProp = adaptedEl.props?.size as string | undefined;
    specDataAttrs["data-size"] =
      sizeProp ?? resolveBackedDefaultSize(type) ?? "md";
    const variantProp = adaptedEl.props?.variant as string | undefined;
    if (variantProp) specDataAttrs["data-variant"] = variantProp;
  }

  return React.createElement(
    resolveGenericHtmlTag(adaptedEl.type),
    {
      key: node.id,
      ...markerProps,
      style: adaptedEl.props?.style as React.CSSProperties | undefined,
      className: mergedClassName,
      ...specDataAttrs,
    },
    children.length > 0
      ? children.map((child) => (
          <CanonicalNodeRenderer
            key={child.id}
            node={child}
            renderContext={renderContext}
            parentPath={currentPath}
            cutoverPrimitives={cutoverPrimitives}
          />
        ))
      : (adaptedEl.props?.children as React.ReactNode),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 커스텀 태그를 표준 HTML 태그로 변환한다.
 * rendererMap 미등록 태그에 대한 최소 fallback 경로.
 */
function resolveGenericHtmlTag(type: string): string {
  const KNOWN_HTML: Record<string, string> = {
    body: "div",
    Slot: "div",
    Section: "section",
    Heading: "h2",
    Text: "p",
    Description: "p",
    Icon: "span",
    Group: "div",
    FormField: "div",
    FieldError: "span",
    frame: "div",
    ref: "div",
  };
  return KNOWN_HTML[type] ?? type.toLowerCase();
}
