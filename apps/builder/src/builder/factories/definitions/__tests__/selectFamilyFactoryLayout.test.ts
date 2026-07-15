import { describe, expect, it } from "vitest";
import { resolveComponentRule } from "@composition/shared";

import {
  createSelectDefinition,
  createComboBoxDefinition,
} from "../SelectionComponents";
import {
  createNumberFieldDefinition,
  createSearchFieldDefinition,
} from "../FormComponents";
import {
  createDatePickerDefinition,
  createDateRangePickerDefinition,
} from "../DateColorComponents";
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
  // 부모 column flex 의 SSOT 는 catalog `composition.layout: "flex-column"` 이다.
  //
  // 구 버전은 factory 가 이를 `props.style` 로 inline emit 하는지 검사했으나, 그 inline 은
  // 2026-06-30(ee83644c1) 에 **의도적으로 제거**됐다 — inline flexDirection:column 의 specificity
  // (1-0-0) 가 generated CSS 의 `[data-label-position="side"]`(@layer components) 를 이겨
  // labelPosition="side" 를 무력화했고, Skia 쪽도 getSideLabelParentStyle 의 rawParentStyle
  // 마지막 spread 가 row 를 column 으로 덮었다. top 모드 기본 column 은 catalog +
  // Skia specFallback(implicitStyles resolveCatalogContainerBase) 이 담당한다.
  //
  // 그래서 가드를 양방향으로 다시 앵커한다: catalog 가 column 을 공급하는가 + factory 가
  // inline 으로 되살리지 않는가. (자식 SelectTrigger 의 row flex 는 여전히 factory inline —
  // 아래 케이스에서 그대로 검증.)
  it.each(CASES)("$name 부모 column flex 는 catalog 가 공급", ({ name }) => {
    const rule = resolveComponentRule(name) as
      | { structure?: { composition?: { layout?: string } } }
      | undefined;
    expect(
      rule?.structure?.composition?.layout,
      `${name} catalog composition.layout 누락 → Skia block 으로 떨어짐`,
    ).toBe("flex-column");
  });

  it.each(CASES)(
    "$name 부모는 display/flexDirection 을 props.style 로 inline emit 하지 않는다",
    ({ make, name }) => {
      const ps = parentStyle(make(makeContext()));
      expect(
        ps.display,
        `${name} inline display 부활 → labelPosition="side" 무력화 (ee83644c1 회귀)`,
      ).toBeUndefined();
      expect(
        ps.flexDirection,
        `${name} inline flexDirection 부활 → side selector 를 specificity 로 이김`,
      ).toBeUndefined();
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

/**
 * 그룹 A↔B 통일 (field-trigger canonical 자식 통일, 2026-06-23):
 * DatePicker/DateRangePicker 의 DateInput + calendar icon 을 NumberField/SearchField 처럼
 * SelectTrigger 래퍼 안의 DateInput + SelectIcon 자식으로 둔다. 트리/Skia/CSS 가 canonical
 * 단일 source 로 일관되고, calendar icon 이 flex 자식이라 box폭에 결합되지 않는다(발산 차단).
 *
 * **회귀 가드**: picker factory 가 SelectTrigger 래퍼 + DateInput + SelectIcon(calendar) 을
 * 생성하는지 검증. 누락 시 DateInput 이 picker 직속으로 복귀 → 트리/Skia 비일관 + box폭 결합 재발.
 */
const PICKER_CASES: Array<{
  name: string;
  make: (ctx: ComponentCreationContext) => ComponentDefinition;
  parentTag: string;
}> = [
  {
    name: "DatePicker",
    make: createDatePickerDefinition,
    parentTag: "DatePicker",
  },
  {
    name: "DateRangePicker",
    make: createDateRangePickerDefinition,
    parentTag: "DateRangePicker",
  },
];

function findChild(def: ComponentDefinition, type: string) {
  return def.children?.find((c) => c?.type === type);
}

describe("그룹 A↔B 통일 — DatePicker/DateRangePicker field-trigger canonical 자식", () => {
  it.each(PICKER_CASES)(
    "$name 은 SelectTrigger 래퍼 > [DateInput, SelectIcon] canonical 자식을 생성",
    ({ make, parentTag }) => {
      const def = make(makeContext());
      const trigger = findChild(def, "SelectTrigger");
      expect(
        trigger,
        "SelectTrigger 래퍼 부재 → DateInput picker 직속 복귀",
      ).toBeTruthy();

      // SelectTrigger row flex (Value/Icon 가로 배치)
      const ts = (trigger?.props as { style?: StyleRec }).style ?? {};
      expect(ts.display).toBe("flex");
      expect(ts.flexDirection).toBe("row");
      expect(ts.alignItems).toBe("center");

      // SelectTrigger 자식 = DateInput(segment) + SelectIcon(calendar)
      const grandTypes = (trigger?.children ?? []).map((c) => c?.type);
      expect(grandTypes).toContain("DateInput");
      expect(grandTypes).toContain("SelectIcon");

      // DateInput 은 picker _parentTag 전파 (datefield_segments segment text 생성용)
      const dateInput = trigger?.children?.find((c) => c?.type === "DateInput");
      expect(
        (dateInput?.props as { _parentTag?: string })._parentTag,
        "_parentTag 누락 → segment placeholder 텍스트 미생성",
      ).toBe(parentTag);

      // iconName SSOT 는 부모 picker.props.iconName (D2, Select 동형). SelectIcon 자식은
      //   iconName 미지정 — Skia resolveIconDelegation 이 조부모(picker) iconName 위임,
      //   Preview self-compose 는 element.props.iconName 소비 → Skia/Preview 대칭.
      expect(
        (def.parent.props as { iconName?: string }).iconName,
        "부모 picker.props.iconName SSOT 누락 → Preview self-compose 가 소비할 값 없음",
      ).toBe("calendar");
      const selectIcon = trigger?.children?.find(
        (c) => c?.type === "SelectIcon",
      );
      expect(
        (selectIcon?.props as { iconName?: string }).iconName,
        "SelectIcon 자식은 iconName 미지정(조부모 위임) — 직접 지정 시 SSOT 이원화",
      ).toBeUndefined();

      // DateInput 이 picker 직속 자식으로 남아있으면 안 됨 (SelectTrigger 안으로 이동)
      expect(
        findChild(def, "DateInput"),
        "DateInput 이 picker 직속에 잔존 → 이중/비일관",
      ).toBeUndefined();
    },
  );
});
