import { describe, expect, it } from "vitest";

import type { BreakpointName } from "@composition/shared";

import { LAYOUT_PRESETS } from "../../../properties/editors/LayoutPresetSelector/presetDefinitions";
import { toResponsiveConfig } from "../../../properties/editors/LayoutPresetSelector/presetResponsive";
import { computeDirtyStyleProps } from "../useResetStyles";

/**
 * **프리셋이 심은 값은 사용자 편집이 아니다** — 갓 적용한 프레임 프리셋의 슬롯/컨테이너는
 * 어느 breakpoint 에서도 dirty 가 0 이어야 한다 (Transform 리셋 버튼 비활성).
 *
 * Why: 프리셋 적용은 슬롯의 `props.style`(base)과 `responsive`(BP override)에 **inline 으로**
 * 값을 심는다. baseline 이 프리셋을 모르면 그 값이 전부 "수정됨" 으로 읽힌다 — 실측
 * (2026-07-27): 26 슬롯 **전부** Transform dirty (모두 `minHeight`, 고정폭 슬롯은
 * `width`/`flexShrink` 추가), tablet 에서는 프리셋이 심은 `width` override 까지 dirty.
 * 사용자 보고: "초기값인데도 수정값이 들어가서 리셋 버튼이 활성화되어있다".
 *
 * 이 테스트는 프리셋 정의를 **직접 순회**하므로, 새 프리셋을 추가하면 baseline 누락이
 * 자동으로 잡힌다 (프리셋별 케이스를 손으로 늘릴 필요 없음).
 */

/** TransformSection.TRANSFORM_PROPS 미러 — 리셋 버튼 표시 범위. */
const TRANSFORM_PROPS = [
  "width",
  "height",
  "top",
  "left",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "alignSelf",
  "justifySelf",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "aspectRatio",
];

const BREAKPOINTS: BreakpointName[] = ["desktop", "tablet", "mobile"];

/** `usePresetApply` 가 슬롯 노드를 만드는 형태 그대로 (usePresetApply.ts:362-385). */
function buildAppliedSlotNode(presetKey: string, slotName: string) {
  const slotDef = LAYOUT_PRESETS[presetKey].slots.find(
    (slot) => slot.name === slotName,
  )!;
  const responsive = toResponsiveConfig(slotDef.responsiveStyle);
  return {
    type: "Slot",
    props: {
      name: slotDef.name,
      required: slotDef.required,
      description: slotDef.description,
      style: slotDef.defaultStyle,
    },
    ...(responsive ? { responsive } : {}),
  };
}

const presetEntries = Object.entries(LAYOUT_PRESETS);

describe("프리셋 적용 직후 dirty 판정", () => {
  it.each(
    presetEntries.flatMap(([key, preset]) =>
      preset.slots.map((slot) => [key, slot.name] as const),
    ),
  )("%s / %s 슬롯은 Transform dirty 0", (presetKey, slotName) => {
    const node = buildAppliedSlotNode(presetKey, slotName);

    for (const breakpoint of BREAKPOINTS) {
      const dirty = computeDirtyStyleProps(
        node,
        { parentType: "body", parentAppliedPreset: presetKey },
        TRANSFORM_PROPS,
        breakpoint,
      );
      expect(
        dirty,
        `${presetKey}/${slotName} @${breakpoint} 에서 프리셋 authoring 값이 수정됨으로 잡힘`,
      ).toEqual([]);
    }
  });

  it("프리셋을 모르면(부모 appliedPreset 부재) 종전대로 dirty — baseline 이 프리셋에서만 온다", () => {
    // 같은 슬롯이라도 프리셋 컨텍스트가 없으면 그 값의 출처를 알 수 없으므로 편집으로 본다.
    //   이 단언이 위 테스트의 통과가 "전부 무조건 clean" 이 아님을 보장한다.
    const node = buildAppliedSlotNode("sidebar-left", "sidebar");
    const dirty = computeDirtyStyleProps(
      node,
      { parentType: "body" },
      TRANSFORM_PROPS,
      "desktop",
    );
    expect(dirty).toContain("minHeight");
    expect(dirty).toContain("width");
  });

  it("사용자가 실제로 고친 값은 dirty 로 잡힌다 (base)", () => {
    const node = buildAppliedSlotNode("sidebar-left", "sidebar");
    const edited = {
      ...node,
      props: { ...node.props, style: { ...node.props.style, width: "300px" } },
    };
    const dirty = computeDirtyStyleProps(
      edited,
      { parentType: "body", parentAppliedPreset: "sidebar-left" },
      TRANSFORM_PROPS,
      "desktop",
    );
    expect(dirty).toEqual(["width"]);
  });

  it("사용자가 실제로 고친 breakpoint override 도 dirty 로 잡힌다", () => {
    const node = buildAppliedSlotNode("sidebar-left", "sidebar");
    const edited = {
      ...node,
      responsive: { styles: { width: { tablet: "180px", mobile: "100%" } } },
    };
    const dirty = computeDirtyStyleProps(
      edited,
      { parentType: "body", parentAppliedPreset: "sidebar-left" },
      TRANSFORM_PROPS,
      "tablet",
    );
    expect(dirty).toEqual(["width"]);
  });

  it("프리셋 컨테이너(body)도 base/override 양축 모두 dirty 0", () => {
    // body 는 base baseline 이 이미 있었지만 responsive 축은 없었다 (mobile flexDirection).
    for (const [presetKey, preset] of presetEntries) {
      const responsive = toResponsiveConfig(preset.responsiveContainerStyle);
      const body = {
        type: "body",
        props: {
          appliedPreset: presetKey,
          style: { ...preset.containerStyle, minHeight: undefined },
        },
        ...(responsive ? { responsive } : {}),
      };
      for (const breakpoint of BREAKPOINTS) {
        const dirty = computeDirtyStyleProps(
          body,
          {},
          [
            "display",
            "flexDirection",
            "gridTemplateColumns",
            "gridTemplateRows",
          ],
          breakpoint,
        );
        expect(dirty, `${presetKey} body @${breakpoint}`).toEqual([]);
      }
    }
  });
});
