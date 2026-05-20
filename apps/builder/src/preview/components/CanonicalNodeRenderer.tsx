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
import { rendererMap } from "@composition/shared/renderers";
import {
  adaptElementFillStyle,
  getPrimitiveBinding,
  type BreadcrumbRacProps,
  type BreadcrumbsRacProps,
  type ButtonRacProps,
  type ColorFieldRacProps,
  type DateFieldRacProps,
  type LinkRacProps,
  type NumberFieldRacProps,
  type SearchFieldRacProps,
  type SeparatorRacProps,
  type TextFieldRacProps,
  type TimeFieldRacProps,
  type ToolbarRacProps,
  type ToggleButtonGroupRacProps,
  type ToggleButtonRacProps,
} from "@composition/shared";
import {
  Breadcrumb,
  Breadcrumbs,
  Button,
  ColorField,
  DateField,
  Link,
  NumberField,
  SearchField,
  Separator,
  TextField,
  TimeField,
  Toolbar,
  ToggleButton,
  ToggleButtonGroup,
} from "@composition/shared/components";
import type { ResolvedNode } from "@composition/shared";
import type {
  PreviewElement as SharedPreviewElement,
  RenderContext as SharedRenderContext,
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
}

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
}: CanonicalNodeRendererProps): React.ReactElement | null {
  const currentPath = parentPath ? `${parentPath}/${node.id}` : node.id;

  // ── canonical props 추출 ──────────────────────────────────────────────────
  const canonicalProps = extractCanonicalPropsFromResolved(node);

  // ── type 복원 ─────────────────────────────────────────────────────────────
  // node.type 이 component tag SSOT 이다. canonical props 의 `type` 은 Button/TextField
  // 같은 primitive 의 HTML/input type 일 수 있으므로 component tag fallback 으로
  // 먼저 쓰면 안 된다.
  const type =
    (canonicalProps._tag as string | undefined) ??
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

  const primitiveBinding = getPrimitiveBinding(adaptedEl.type);
  if (primitiveBinding) {
    const primitiveElement = renderPrimitiveNode({
      node,
      adaptedEl,
      renderContext,
      parentPath: currentPath,
      markerProps,
    });
    if (primitiveElement) return primitiveElement;
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

  return React.createElement(
    resolveGenericHtmlTag(adaptedEl.type),
    {
      key: node.id,
      ...markerProps,
      style: adaptedEl.props?.style as React.CSSProperties | undefined,
      className: adaptedEl.props?.className as string | undefined,
    },
    children.length > 0
      ? children.map((child) => (
          <CanonicalNodeRenderer
            key={child.id}
            node={child}
            renderContext={renderContext}
            parentPath={currentPath}
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

function renderPrimitiveNode({
  node,
  adaptedEl,
  renderContext,
  parentPath,
  markerProps,
}: {
  node: ResolvedNode;
  adaptedEl: PreviewElement;
  renderContext: RenderContext;
  parentPath: string;
  markerProps: Record<"data-canonical-id" | "data-element-id", string>;
}): React.ReactElement | null {
  const binding = getPrimitiveBinding(adaptedEl.type);
  if (!binding) return null;

  if (adaptedEl.type === "Separator") {
    const separatorProps = binding.toRacProps(
      adaptedEl.props as Record<string, unknown>,
    ) as SeparatorRacProps;

    return <Separator key={node.id} {...separatorProps} {...markerProps} />;
  }

  if (adaptedEl.type === "Breadcrumb") {
    const { children: racChildren, ...breadcrumbProps } = binding.toRacProps(
      adaptedEl.props as Record<string, unknown>,
    ) as BreadcrumbRacProps;

    return (
      <Breadcrumb key={node.id} {...breadcrumbProps} {...markerProps}>
        {racChildren}
      </Breadcrumb>
    );
  }

  if (adaptedEl.type === "Breadcrumbs") {
    const breadcrumbsProps = binding.toRacProps(
      adaptedEl.props as Record<string, unknown>,
    ) as BreadcrumbsRacProps;
    const renderedChildren = node.children?.map((child) => (
      <CanonicalNodeRenderer
        key={child.id}
        node={child}
        renderContext={renderContext}
        parentPath={parentPath}
      />
    ));

    return (
      <Breadcrumbs key={node.id} {...breadcrumbsProps} {...markerProps}>
        {renderedChildren}
      </Breadcrumbs>
    );
  }

  if (adaptedEl.type === "Link") {
    const { children: racChildren, ...linkProps } = binding.toRacProps(
      adaptedEl.props as Record<string, unknown>,
    ) as LinkRacProps;
    const renderedChildren = node.children?.length
      ? node.children.map((child) => (
          <CanonicalNodeRenderer
            key={child.id}
            node={child}
            renderContext={renderContext}
            parentPath={parentPath}
          />
        ))
      : racChildren;

    return (
      <Link key={node.id} {...linkProps} {...markerProps}>
        {renderedChildren}
      </Link>
    );
  }

  if (adaptedEl.type === "ToggleButton") {
    const { children: racChildren, ...toggleButtonProps } = binding.toRacProps(
      adaptedEl.props as Record<string, unknown>,
    ) as ToggleButtonRacProps;
    const renderedChildren = node.children?.length
      ? node.children.map((child) => (
          <CanonicalNodeRenderer
            key={child.id}
            node={child}
            renderContext={renderContext}
            parentPath={parentPath}
          />
        ))
      : racChildren;

    return (
      <ToggleButton key={node.id} {...toggleButtonProps} {...markerProps}>
        {renderedChildren}
      </ToggleButton>
    );
  }

  if (adaptedEl.type === "TextField") {
    const textFieldProps = binding.toRacProps(
      adaptedEl.props as Record<string, unknown>,
    ) as TextFieldRacProps;

    return <TextField key={node.id} {...textFieldProps} {...markerProps} />;
  }

  if (adaptedEl.type === "NumberField") {
    const numberFieldProps = binding.toRacProps(
      adaptedEl.props as Record<string, unknown>,
    ) as NumberFieldRacProps;

    return <NumberField key={node.id} {...numberFieldProps} {...markerProps} />;
  }

  if (adaptedEl.type === "SearchField") {
    const searchFieldProps = binding.toRacProps(
      adaptedEl.props as Record<string, unknown>,
    ) as SearchFieldRacProps;

    return <SearchField key={node.id} {...searchFieldProps} {...markerProps} />;
  }

  if (adaptedEl.type === "DateField") {
    const dateFieldProps = binding.toRacProps(
      adaptedEl.props as Record<string, unknown>,
    ) as DateFieldRacProps;

    return <DateField key={node.id} {...dateFieldProps} {...markerProps} />;
  }

  if (adaptedEl.type === "TimeField") {
    const timeFieldProps = binding.toRacProps(
      adaptedEl.props as Record<string, unknown>,
    ) as TimeFieldRacProps;

    return <TimeField key={node.id} {...timeFieldProps} {...markerProps} />;
  }

  if (adaptedEl.type === "ColorField") {
    const colorFieldProps = binding.toRacProps(
      adaptedEl.props as Record<string, unknown>,
    ) as ColorFieldRacProps;

    return <ColorField key={node.id} {...colorFieldProps} {...markerProps} />;
  }

  if (adaptedEl.type === "ToggleButtonGroup") {
    const toggleButtonGroupProps = binding.toRacProps({
      ...adaptedEl.props,
      selectedKeys: collectSelectedToggleButtonKeys(node),
    } as Record<string, unknown>) as ToggleButtonGroupRacProps;
    const renderedChildren = node.children?.map((child) => (
      <CanonicalNodeRenderer
        key={child.id}
        node={child}
        renderContext={renderContext}
        parentPath={parentPath}
      />
    ));

    return (
      <ToggleButtonGroup
        key={node.id}
        {...toggleButtonGroupProps}
        {...markerProps}
      >
        {renderedChildren}
      </ToggleButtonGroup>
    );
  }

  if (adaptedEl.type === "Toolbar") {
    const toolbarProps = binding.toRacProps(
      adaptedEl.props as Record<string, unknown>,
    ) as ToolbarRacProps;
    const renderedChildren = node.children?.map((child) => (
      <CanonicalNodeRenderer
        key={child.id}
        node={child}
        renderContext={renderContext}
        parentPath={parentPath}
      />
    ));

    return (
      <Toolbar key={node.id} {...toolbarProps} {...markerProps}>
        {renderedChildren}
      </Toolbar>
    );
  }

  if (adaptedEl.type !== "Button") return null;

  const { children: racChildren, ...buttonProps } = binding.toRacProps(
    adaptedEl.props as Record<string, unknown>,
  ) as ButtonRacProps;
  const renderedChildren = node.children?.length
    ? node.children.map((child) => (
        <CanonicalNodeRenderer
          key={child.id}
          node={child}
          renderContext={renderContext}
          parentPath={parentPath}
        />
      ))
    : racChildren;

  return (
    <Button key={node.id} {...buttonProps} {...markerProps}>
      {renderedChildren}
    </Button>
  );
}

function collectSelectedToggleButtonKeys(node: ResolvedNode): string[] {
  return (node.children ?? [])
    .filter(
      (child) =>
        child.type === "ToggleButton" && child.props?.isSelected === true,
    )
    .map((child) => child.id);
}
