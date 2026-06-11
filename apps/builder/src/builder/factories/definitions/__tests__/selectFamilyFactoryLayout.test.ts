import { describe, expect, it } from "vitest";

import {
  createSelectDefinition,
  createComboBoxDefinition,
} from "../SelectionComponents";
import {
  createNumberFieldDefinition,
  createSearchFieldDefinition,
} from "../FormComponents";
import type { ComponentCreationContext } from "../../types";
import type { ComponentDefinition } from "../../types";

/**
 * ADR-912 R1 후속 fix (2026-06-12) — Select family factory layout 회귀 가드.
 *
 * **회귀 근본**: R1 에서 SelectTrigger.spec 을 삭제하면서 그 containerStyles
 * (display:flex/flexDirection:row/alignItems:center) 와 부모의 column flex 를
 * 어느 SSOT 에도 명시하지 않았다. DOM 은 generated CSS(.react-aria-Select 등)로
 * 정상이지만, Skia/Taffy 는 props.style 만 읽고 layout 엔진은 rule table 을 import
 * 하지 않으므로(ADR-907 Layer B), props.style 에 display 가 없으면
 * buildNodeStyle/getElementDisplay 가 display:"block" 으로 떨어져(taffyDisplayAdapter
 * fallback) Select/ComboBox/NumberField/SearchField + SelectTrigger 가 Skia 에서
 * 찌부러진다(2026-06-12 live 적발 → factory props.style 로 layout 이관).
 *
 * 본 가드는 factory 가 부모 column flex + SelectTrigger row flex 를 props.style 로
 * emit 하는지 검증한다. 누락 시 Skia↔CSS 비대칭 재발.
 */
function makeContext(): ComponentCreationContext {
  return {
    parentElement: null,
    pageId: "page-home",
    elements: [],
    doc: { version: "composition-1.0", children: [] },
  };
}

type StyleRec = Record<string, unknown>;

function parentStyle(def: ComponentDefinition): StyleRec {
  return (def.parent.props as { style?: StyleRec }).style ?? {};
}

function findChildStyle(
  def: ComponentDefinition,
  type: string,
): StyleRec | undefined {
  const child = def.children?.find((c) => c?.type === type);
  return child
    ? ((child.props as { style?: StyleRec }).style ?? {})
    : undefined;
}

const CASES: Array<{
  name: string;
  make: (ctx: ComponentCreationContext) => ComponentDefinition;
}> = [
  { name: "Select", make: createSelectDefinition },
  { name: "ComboBox", make: createComboBoxDefinition },
  { name: "NumberField", make: createNumberFieldDefinition },
  { name: "SearchField", make: createSearchFieldDefinition },
];

describe("ADR-912 R1 Select family — factory layout props.style 회귀 가드", () => {
  it.each(CASES)(
    "$name 부모는 column flex 를 props.style 로 emit",
    ({ make }) => {
      const def = make(makeContext());
      const ps = parentStyle(def);
      expect(ps.display, "부모 display 누락 → Skia block 으로 떨어짐").toBe(
        "flex",
      );
      expect(
        ps.flexDirection,
        "부모 flexDirection 누락 → 자식 stacking 무너짐",
      ).toBe("column");
    },
  );

  it.each(CASES)(
    "$name 의 SelectTrigger 자식은 row flex 를 props.style 로 emit",
    ({ make }) => {
      const def = make(makeContext());
      const ts = findChildStyle(def, "SelectTrigger");
      expect(ts, "SelectTrigger 자식 부재").toBeTruthy();
      expect(ts?.display, "SelectTrigger display 누락 → Skia block").toBe(
        "flex",
      );
      expect(
        ts?.flexDirection,
        "SelectTrigger flexDirection 누락 → Value/Icon 가로배치 무너짐",
      ).toBe("row");
      expect(ts?.alignItems).toBe("center");
    },
  );
});
