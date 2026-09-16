/**
 * 계약 default ↔ RAC 런타임 default 동기 가드 (2026-09-16 사용자 지시 — ProgressBar · ProgressCircle
 * 의 Min/Max 가 패널에서 비어 보이던 것).
 *
 * 규칙: RAC 가 prop 생략 시 쓰는 값이 있으면 계약 `default` 도 같은 값이어야 한다 — 패널이 그 값을
 * 현재값으로 보여 주고 (resolveEditContract), 「기본값으로」 가 그 값으로 되돌리고, toRacProps 가
 * 같은 값을 emit 하므로 세 표면이 갈리지 않는다. 값의 출처는 react-aria / react-stately 3.52 / 3.50
 * 소스 (useSliderState DEFAULT_* · useProgressBar · usePopover offset 8 · useOverlayPosition ·
 * useTimeFieldState granularity 'minute' · useCalendarState pageBehavior). HTML 기본 (Link/Form
 * target · encType) 은 RAC 가 정하지 않으므로 여기 두지 않는다.
 */
import { describe, expect, it } from "vitest";
import { componentCatalog } from "../componentCatalog";

const RAC_DEFAULTS: ReadonlyArray<[type: string, key: string, value: unknown]> =
  [
    ["ProgressBar", "minValue", 0],
    ["ProgressBar", "maxValue", 100],
    ["ProgressCircle", "minValue", 0],
    ["ProgressCircle", "maxValue", 100],
    ["Meter", "minValue", 0],
    ["Meter", "maxValue", 100],
    ["Slider", "minValue", 0],
    ["Slider", "maxValue", 100],
    ["Slider", "step", 1],
    ["SliderTrack", "minValue", 0],
    ["SliderTrack", "maxValue", 100],
    ["Popover", "placement", "bottom"],
    ["Popover", "offset", 8],
    ["Popover", "crossOffset", 0],
    ["Popover", "containerPadding", 12],
    ["Tooltip", "placement", "top"],
    ["Tooltip", "offset", 0],
    ["Tooltip", "crossOffset", 0],
    ["Tooltip", "containerPadding", 12],
    ["DateField", "granularity", "day"],
    ["TimeField", "granularity", "minute"],
    ["DatePicker", "granularity", "day"],
    ["DatePicker", "pageBehavior", "visible"],
    ["DatePicker", "maxVisibleMonths", 1],
    ["DateRangePicker", "granularity", "day"],
    ["DateRangePicker", "pageBehavior", "visible"],
    ["DateRangePicker", "maxVisibleMonths", 1],
    ["Calendar", "pageBehavior", "visible"],
    ["RangeCalendar", "pageBehavior", "visible"],
    // field 가족 necessityIndicator 는 별도 커밋 (85cfa6701) — RSP 기본 icon
    ["TextField", "necessityIndicator", "icon"],
  ];

describe("catalog 계약 default ↔ RAC 런타임 default", () => {
  it.each(RAC_DEFAULTS)("%s.%s default = %j", (type, key, value) => {
    const entry = componentCatalog.find((e) => e.type === type);
    if (!entry || entry.kind !== "primitive")
      throw new Error(`${type} primitive 없음`);
    const contract = entry.binding.props.accepts[key];
    expect(contract, `${type}.${key} 계약 없음`).toBeDefined();
    expect(contract!.default).toEqual(value);
  });
});
