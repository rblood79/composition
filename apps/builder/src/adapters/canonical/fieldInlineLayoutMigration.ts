/**
 * @fileoverview field family + ComboBox/Select inline display/flexDirection strip hydration
 *   migration (ADR-913 후속 — labelPosition="side" CSS↔Skia 대칭 복구, 2026-06-19;
 *   ComboBox/Select 확장 2026-06-30).
 *
 * 배경: ADR-912 R1 후속 fix(2026-06-12)가 NumberField/SearchField/Select/ComboBox factory 에
 *   inline `display:flex` + `flexDirection:column` 을 박았다. 그러나 이
 *   inline 충돌 값이 labelPosition="side" 전환을 양쪽 경로에서 차단했다:
 *   - CSS: inline(specificity 1-0-0)이 generated CSS `[data-label-position="side"]`(0-2-0)를
 *     이겨 flex-row(또는 grid) selector 무력화 → Label 위로 쌓임.
 *   - Skia: getSideLabelParentStyle 의 `...rawParentStyle` 마지막 spread 가 side 의 row 를
 *     column 으로 덮음(이쪽은 layout 시점 strip 으로 별도 해소).
 *
 *   factory 신규 분은 inline display/flexDirection 을 제거했으나, **기존 직렬화 프로젝트의
 *   field element 는 inline 잔재를 보유**한다. 본 migration 은 hydration 시점에 field family
 *   element 의 inline `display`/`flexDirection` 을 strip 하여 layout 결정권을 labelPosition +
 *   catalog rule + generated CSS 로 되돌린다(top 기본 column 은 catalog/CSS 가 담당).
 *
 * 적용 대상: labelPosition prop 으로 레이아웃이 결정되는 field family. inline display/
 *   flexDirection 은 이들에게 잔재이므로 strip 안전. 그 외 inline(width/gap/padding 등)은 보존.
 *
 * 멱등 — strip 할 게 없으면 동일 참조를 반환한다. 선례: migrateCheckboxRadioItemsStructure
 *   (DFS 멱등 patch 패턴).
 */

import type { CanonicalNode, CompositionDocument } from "@composition/shared";

/**
 * inline display/flexDirection 잔재를 strip 할 type 집합.
 * labelPosition 으로 그룹 root layout 이 결정되는 컴포넌트 — factory inline(display:flex +
 * flexDirection:column)이 side 전환을 CSS specificity 로 차단했던 군.
 *
 * field family(TextField~ColorField)는 ADR-913(2026-06-19)에서 추가. ComboBox/Select 는
 * 2026-06-30 추가 — 같은 factory inline 잔재 보유(SelectionComponents.ts 가 과거 주입,
 * 이후 inline 제거). DatePicker/DateRangePicker/DateField/TimeField 는 아래 `legacyLayoutResidueKeys` 가 factory 형태
 * 일 때만 지운다 (2026-09-25 — 옛 판단 "잔재 없음" 은 factory 이력과 어긋났다).
 */
const FIELD_FAMILY_TAGS: ReadonlySet<string> = new Set([
  "TextField",
  "TextArea",
  "NumberField",
  "SearchField",
  "ColorField",
  "ComboBox",
  "Select",
]);

/**
 * 옛 factory 가 root 인라인에 넣던 layout 값 (2026-09-25 확장). field 가족과 달리 **factory 가 쓰던 형태일
 * 때만** 지운다 — 같은 키라도 다른 값은 사용자가 쓴 것일 수 있다.
 *  - 날짜 필드 4종: `display: flex` + `flexDirection: column` (DateField/TimeField `35347982a` ·
 *    DatePicker/DateRangePicker `4f557528e` 이전 factory). 위 "잔재 없음" 판단은 이 이력과 어긋났다.
 *  - ProgressBar · Meter · Slider: `display: grid` + gridTemplate* (`68c567dd0` · `c85d4dc25` 이전 factory).
 * Canvas 가 labelPosition side 에서도 인라인을 따르게 되며 (DOM cascade 와 같게) 잔재가 두 렌더 모두에서
 * side 를 막았다.
 */
const DATE_FIELD_TAGS: ReadonlySet<string> = new Set([
  "DateField",
  "TimeField",
  "DatePicker",
  "DateRangePicker",
]);
const TRACK_GRID_TAGS: ReadonlySet<string> = new Set([
  "ProgressBar",
  "Meter",
  "Slider",
]);
const GRID_TEMPLATE_KEYS = [
  "gridTemplateColumns",
  "gridTemplateRows",
  "gridTemplateAreas",
] as const;

function legacyLayoutResidueKeys(
  type: string,
  style: Record<string, unknown>,
): string[] | null {
  if (DATE_FIELD_TAGS.has(type)) {
    return style.display === "flex" && style.flexDirection === "column"
      ? ["display", "flexDirection"]
      : null;
  }
  if (TRACK_GRID_TAGS.has(type)) {
    return style.display === "grid"
      ? ["display", ...GRID_TEMPLATE_KEYS.filter((key) => key in style)]
      : null;
  }
  return null;
}

/**
 * field family element 의 inline display/flexDirection 을 strip 한다.
 *
 * @param document - canonical CompositionDocument
 * @returns strip 대상이 있었으면 새 document, 없었으면 동일 참조 (멱등)
 */
export function migrateFieldInlineLayout(
  document: CompositionDocument,
): CompositionDocument {
  function migrateNode(node: CanonicalNode): CanonicalNode {
    const children = node.children?.map(migrateNode);

    let props = node.props;
    const style = (node.props as Record<string, unknown> | undefined)
      ?.style as Record<string, unknown> | undefined;
    if (FIELD_FAMILY_TAGS.has(node.type)) {
      if (style && ("display" in style || "flexDirection" in style)) {
        const { display: _d, flexDirection: _fd, ...restStyle } = style;
        props = { ...node.props, style: restStyle };
      }
    } else if (style) {
      const residueKeys = legacyLayoutResidueKeys(node.type, style);
      if (residueKeys) {
        const restStyle = { ...style };
        for (const key of residueKeys) delete restStyle[key];
        props = { ...node.props, style: restStyle };
      }
    }

    if (props === node.props) {
      return children ? { ...node, children } : node;
    }
    return children ? { ...node, props, children } : { ...node, props };
  }

  const next: CompositionDocument = {
    ...document,
    children: document.children.map(migrateNode),
  };

  return JSON.stringify(document) === JSON.stringify(next) ? document : next;
}
