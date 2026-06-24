// @vitest-environment jsdom
/**
 * Reusable composite origin(ADR-912 R-5) 트리 ↔ Style Panel dirty baseline 정합 회귀 가드 (2026-06-24).
 *
 * Form / Toolbar 는 `createXxxDefinition`(factory) 이 아니라 **reusable composite origin 문서**
 * (`formTemplateOrigins.createFormOrigin` / `toolbarTemplateOrigins.createToolbarOrigin`)에서 생성된다.
 * palette-add 는 origin 의 `type:"ref"` instance 만 만들고, 시각은 origin 트리 노드의 props.style 을
 * 그대로 투영한다. 따라서 origin 트리의 각 노드 style 이 dirty baseline(getDefaultProps / spec preset /
 * subpart)과 어긋나면 **신규 Form/Toolbar 가 손대지 않아도 reset 버튼·"modify N" 뱃지가 오활성**된다
 * (Form root width:100% / FormField display·gap·width / Separator(<Toolbar) width·height — 2026-06-24).
 *
 * 본 가드는 `ensureXxxTemplateOrigins` 로 origin 트리를 추출해 전 노드를 `computeDirtyStyleProps`
 * (reset/modify 와 동일 baseline resolver)에 통과시켜 **false dirty 0건**을 강제한다. origin 멤버
 * 추가(REUSABLE_COMPOSITE_ORIGINS) 시 ENSURERS 배열에 1줄만 더하면 동일 Gate 가 자동 적용된다.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import {
  computeDirtyStyleProps,
  PANEL_STYLE_PROPS,
} from "../../panels/styles/hooks/useResetStyles";
import { ensureFormTemplateOrigins } from "../form/formTemplateOrigins";
import { ensureToolbarTemplateOrigins } from "../toolbar/toolbarTemplateOrigins";

// Style Panel 4섹션(Transform/Typography/Layout/Appearance)이 reset/modify 로 검사하는 prop 합집합.
//   SSOT 단일 출처(useResetStyles.PANEL_STYLE_PROPS) 재사용.
const PANEL_PROPS = [...PANEL_STYLE_PROPS];

type Ensurer = (doc: CompositionDocument) => CompositionDocument;

const ENSURERS: Record<string, Ensurer> = {
  Form: ensureFormTemplateOrigins,
  Toolbar: ensureToolbarTemplateOrigins,
};

function emptyDocument(): CompositionDocument {
  return { version: "composition-1.0", children: [] };
}

/** origin id(component-form/component-toolbar)를 재귀로 찾아 그 노드 서브트리를 반환. */
function findOriginNode(
  nodes: readonly CanonicalNode[],
  originId: string,
): CanonicalNode | undefined {
  for (const node of nodes) {
    if (node.id === originId) return node;
    const found = findOriginNode(node.children ?? [], originId);
    if (found) return found;
  }
  return undefined;
}

/** 노드 트리를 (node, parentType, grandParentType) 튜플로 평탄화. */
function flattenWithContext(
  node: CanonicalNode,
  parentType?: string,
  grandParentType?: string,
): Array<{
  node: CanonicalNode;
  parentType?: string;
  grandParentType?: string;
}> {
  const self = { node, parentType, grandParentType };
  const children = (node.children ?? []).flatMap((child) =>
    flattenWithContext(child, node.type, parentType),
  );
  return [self, ...children];
}

const ORIGIN_IDS: Record<string, string> = {
  Form: "component-form",
  Toolbar: "component-toolbar",
};

describe("reusable composite origin 트리 ↔ dirty baseline 정합 (false dirty 0)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(Object.keys(ENSURERS))(
    "%s origin 트리는 false dirty 0건",
    (family) => {
      const doc = ENSURERS[family](emptyDocument());
      const origin = findOriginNode(doc.children, ORIGIN_IDS[family]);
      expect(
        origin,
        `${family} origin(${ORIGIN_IDS[family]}) 미발견`,
      ).toBeTruthy();

      const flat = flattenWithContext(origin as CanonicalNode);
      const dirty: string[] = [];
      for (const { node, parentType, grandParentType } of flat) {
        const style = (node.props?.style as Record<string, unknown>) || {};
        if (Object.keys(style).length === 0) continue;
        const dirtyKeys = computeDirtyStyleProps(
          { type: node.type, props: node.props },
          { parentType, grandParentType },
          PANEL_PROPS,
        );
        if (dirtyKeys.length > 0) {
          const label = `${node.type}${parentType ? ` (<${parentType})` : ""}`;
          dirty.push(`${label} → ${dirtyKeys.join(", ")}`);
        }
      }

      expect(
        dirty,
        `${family} origin 트리 false dirty:\n  ${dirty.join("\n  ")}`,
      ).toEqual([]);
    },
  );
});
