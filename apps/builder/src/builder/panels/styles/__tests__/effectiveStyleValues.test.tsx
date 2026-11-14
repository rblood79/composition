// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  openStylesFixture,
  type StylesFixture,
} from "./support/catalogStylesFixture";
import { useLayoutValues } from "../hooks/useLayoutValues";
import { useTypographyValues } from "../hooks/useTypographyValues";
import { useStyleActions } from "../hooks/useStyleActions";
import { useFlexDirectionKeys } from "../hooks/useLayoutAuxiliary";
import { setSiteSettings } from "../../../../../../../packages/shared/src/catalog/commands";
import { catalogTextMetrics } from "../../../catalogRuntime/boxModel";

/**
 * Design 패널의 표시 값 = 선택 record 의 실효값 (2026-10-09 — Codex 판독 MEDIUM 4).
 *
 * 종전 패널은 기본값을 노드 자기 type 의 rule 로 다시 계산했다 (`specPresetResolver`). 그래서
 * 부모 part rule 이 배치하는 부품 (CheckboxButton · RadioButton · SwitchButton — 자기 rule 없음) 은
 * Block · gap 0 으로, 부모 size 전파를 받은 Label 은 자기 rule 의 md 값으로, TextField 루트는 자식
 * Input 의 size padding 12 를 루트 값처럼 보였다. 이제 작성값 → 그려진 record 의 실효 view
 * (`catalogEffectiveStyle` — Canvas · DOM 이 읽는 같은 record) → 패널 기본 순서다.
 */
let fixture: StylesFixture;

beforeAll(async () => {
  fixture = await openStylesFixture([
    { id: "cb", type: "Checkbox" },
    { id: "cbxl", type: "Checkbox", props: { size: "XL" } },
    { id: "rg", type: "RadioGroup" },
    { id: "sw", type: "Switch" },
    { id: "tf", type: "TextField" },
    { id: "sel", type: "Select" },
    { id: "sl", type: "Slider" },
    { id: "btn", type: "Button" },
    { id: "pb", type: "ProgressBar" },
    { id: "mt", type: "Meter" },
    { id: "slside", type: "Slider", props: { labelPosition: "side" } },
  ]);
});

const layoutOf = (record: string) =>
  renderHook(() => useLayoutValues(record), { wrapper: fixture.wrapper }).result
    .current;
const typographyOf = (record: string) =>
  renderHook(() => useTypographyValues(record), { wrapper: fixture.wrapper })
    .result.current;

describe("Layout 탭 — 부모 part rule 이 배치하는 부품", () => {
  // (ADR-295 Phase 3c-3: the gap is S2 `text-to-control` — M font 14 × 10 / 14 = 10.)
  // (2026-11-15: S2 `CenterBaseline` — 행은 위 정렬, indicator 가 첫 줄 위치를 갖는다 · `toggleS2Layout.test.tsx`)
  it("CheckboxButton 은 Checkbox rule 의 `.react-aria-CheckboxButton` 블록 (inline-flex · flex-start · gap 10) 을 보인다", () => {
    const values = layoutOf(fixture.descendantRecord("cb", "CheckboxButton"));
    expect(values?.display).toBe("inline-flex");
    expect(values?.alignItems).toBe("flex-start");
    expect(values?.gap).toBe("10px");
  });

  it("RadioButton (gap 10) · SwitchButton (gap 10) 도 같다", () => {
    const radio = layoutOf(fixture.descendantRecord("rg", "RadioButton"));
    expect(radio?.display).toBe("inline-flex");
    expect(radio?.gap).toBe("10px");
    const toggle = layoutOf(fixture.descendantRecord("sw", "SwitchButton"));
    expect(toggle?.display).toBe("inline-flex");
    expect(toggle?.gap).toBe("10px");
  });

  it("Direction 토글도 record 의 display 를 따른다 (CheckboxButton = row)", () => {
    const record = fixture.descendantRecord("cb", "CheckboxButton");
    const keys = renderHook(() => useFlexDirectionKeys(record), {
      wrapper: fixture.wrapper,
    }).result.current;
    expect(keys).toEqual(["row"]);
  });

  it("정렬 토글은 실효 display 가 inline-flex 면 `display: flex` 를 쓰지 않는다 (block 부모에서 줄이 떨어지지 않게)", () => {
    const record = fixture.descendantRecord("cb", "CheckboxButton");
    fixture.workspace.selectRecords([record]);
    const actions = renderHook(() => useStyleActions(), {
      wrapper: fixture.wrapper,
    }).result.current;
    act(() => actions.handleVerticalAlignment("align-vertical-end"));
    const authored = fixture.host.readSelectedTarget().style;
    expect(authored.alignItems).toBe("flex-end");
    expect(authored.display).toBeUndefined();
  });

  it("다중 선택은 대상마다 판정한다 — CheckboxButton 은 inline-flex 유지, 함께 고른 Frame 은 flex 가 된다 (Codex 판독 2026-10-09)", async () => {
    const multi = await openStylesFixture([
      { id: "cb", type: "Checkbox" },
      { id: "fr", type: "Frame" },
      { id: "fr-a", type: "Frame", parent: "fr" },
      { id: "fr-b", type: "Frame", parent: "fr" },
    ]);
    const button = multi.descendantRecord("cb", "CheckboxButton");
    const frame = multi.recordOf("fr");
    multi.workspace.selectRecords([button, frame]);
    const actions = renderHook(() => useStyleActions(), {
      wrapper: multi.wrapper,
    }).result.current;
    act(() => actions.handleFlexDirection("row"));
    multi.workspace.selectRecords([button]);
    const buttonStyle = multi.host.readSelectedTarget();
    expect(buttonStyle.style.display).toBeUndefined();
    expect(buttonStyle.effective?.display).toBe("inline-flex");
    expect(buttonStyle.style.flexDirection).toBe("row");
    multi.workspace.selectRecords([frame]);
    const frameStyle = multi.host.readSelectedTarget().style;
    expect(frameStyle.display).toBe("flex");
    expect(frameStyle.flexDirection).toBe("row");
  });
});

describe("Layout 탭 — 루트가 받지 않는 size 값", () => {
  it("TextField · Select 루트의 padding 은 0 (size 의 paddingX 12 는 Input 의 것)", () => {
    for (const id of ["tf", "sel"]) {
      const values = layoutOf(fixture.recordOf(id));
      expect(values?.paddingLeft).toBe("0px");
      expect(values?.paddingRight).toBe("0px");
      expect(values?.padding).toBe("0px");
    }
  });

  it("Slider 의 grid 간격은 record 의 rowGap longhand (4px) — 상자 모델 밖의 채널도 읽는다", () => {
    const values = layoutOf(fixture.recordOf("sl"));
    expect(values?.display).toBe("grid");
    expect(values?.gap).toBe("4px");
  });

  // (ADR-295 Phase 3: the block padding is the S2 centring padding — M (32 − 18 − 2) / 2 = 6.)
  // (ADR-295 Phase 3c-3: S2 `pill` padding 32 / 2 = 16 · `text-to-visual` gap 14 × 6 / 14 = 6.)
  // (`20388ea2e`: S2 fill 테두리 0 → 세로 padding (32 − 18) / 2 = 7.)
  it("자기 rule 이 있는 Button 은 inline-flex · gap 6 · padding 7 / 16", () => {
    const values = layoutOf(fixture.recordOf("btn"));
    expect(values?.display).toBe("inline-flex");
    expect(values?.gap).toBe("6px");
    expect(values?.paddingTop).toBe("7px");
    expect(values?.paddingLeft).toBe("16px");
  });
});

describe("Text 탭 — 부모 size 전파", () => {
  it.each([
    "TextField",
    "TextArea",
    "SearchField",
    "NumberField",
    "ColorField",
    "DateField",
    "TimeField",
    "DatePicker",
    "DateRangePicker",
    "Select",
    "ComboBox",
    "CheckboxGroup",
    "RadioGroup",
  ])(
    "%s Label 본문은 실제 14px/21px를 표시하고 px 편집·복원을 같은 크기로 환산한다",
    async (type) => {
      const local = await openStylesFixture([{ id: "field", type }]);
      local.workspace.execute(setSiteSettings({ patch: { lang: "ko-KR" } }));
      const id = local.descendantRecord("field", "Text");
      local.workspace.selectRecords([id]);
      const view = renderHook(() => useTypographyValues(id), {
        wrapper: local.wrapper,
      });
      expect(view.result.current?.fontSize).toBe("14px");
      expect(view.result.current?.lineHeight).toBe("21px");
      const metrics = () => {
        const node = local.workspace.root.domInputs.get(id)!;
        return catalogTextMetrics(node, undefined);
      };
      act(() => local.host.updateStyle("lineHeight", "28px"));
      expect(metrics().lineHeight).toBe(2);
      expect(view.result.current?.lineHeight).toBe("28px");
      act(() => local.workspace.undo());
      expect(view.result.current?.lineHeight).toBe("21px");
      act(() => local.workspace.redo());
      expect(view.result.current?.lineHeight).toBe("28px");
      act(() => local.host.resetStyles(["lineHeight"]));
      expect(view.result.current?.lineHeight).toBe("21px");
      act(() => local.host.updateStyle("fontSize", "20px"));
      act(() => local.host.updateStyle("lineHeight", "28px"));
      expect(metrics().fontSize).toBe(20);
      expect(metrics().lineHeight).toBe(1.4);
      expect(view.result.current?.lineHeight).toBe("28px");
      view.unmount();
    },
  );

  // (ADR-295 Phase 3: the line is the S2 formula — 18 → 22, 14 → 18.)
  it("size xl Checkbox 의 Label 은 18px · 줄 높이 22px (record 의 비율 1.222 × 18)", () => {
    const values = typographyOf(fixture.descendantRecord("cbxl", "Label"));
    expect(values?.fontSize).toBe("18px");
    expect(values?.lineHeight).toBe("22px");
    expect(values?.isFontSizeFromPreset).toBe(true);
  });

  it("md Checkbox 의 Label 은 14px · 18px", () => {
    const values = typographyOf(fixture.descendantRecord("cb", "Label"));
    expect(values?.fontSize).toBe("14px");
    expect(values?.lineHeight).toBe("18px");
    // (`3ca03f661`: Label 원본 굵기 = S2 1.8.2 fieldLabel controlFont regular 400.)
    expect(values?.fontWeight).toBe("400");
    expect(values?.fontWeightBase).toBe("400");
  });
});

describe("Layout 탭 Display — top 이 grid 인 라벨 위치 컨테이너", () => {
  // 사용자 보고 2026-10-27: catalog 가 grid (`"label value" "bar bar"`) 인데 Display 는 flex column 으로
  // 보였다 — 토글이 prop 고정 규칙 (top = column) 을 읽었다. 이제 record 의 grid 를 그대로 보인다.
  const keysOf = (record: string) =>
    renderHook(() => useFlexDirectionKeys(record), { wrapper: fixture.wrapper })
      .result.current;

  it.each(["pb", "mt", "sl"])("%s 의 top 은 grid 로 표시한다", (id) => {
    expect(layoutOf(fixture.recordOf(id))?.display).toBe("grid");
    expect(keysOf(fixture.recordOf(id))).toEqual(["grid"]);
  });

  it("side 는 flex row 로 표시한다", () => {
    expect(keysOf(fixture.recordOf("slside"))).toEqual(["row"]);
  });
});
