import { describe, expect, it } from "vitest";

import {
  DELEGATING_RAC_RENDERERS,
  DELEGATING_INTERNAL_RENDERERS,
} from "../CanonicalNodeRenderer";

/**
 * 회귀 방지 — Switch/Checkbox 위임 등록 (ADR-913 slice 3, 2026-06-18).
 *
 * composition 의 Switch/Checkbox 시각 모델은 indicator 를 그릴 DOM 자식 노드가 CSS selector 의
 * 타겟이다 — Switch.css `.react-aria-Switch .indicator`(track) + 그 안 `::before`(thumb),
 * Checkbox.css `.react-aria-Checkbox .checkbox`(box) + svg(checkmark). shared Switch.tsx/
 * Checkbox.tsx 가 `<div className="indicator">`/`<div className="checkbox">` 를 자기완결 합성하는데,
 * generic rac 경로(toRacProps→RAC `<Switch>`/`<Checkbox>` 직접)는 그 자식 div 를 안 만든다 →
 * indicator 시각 완전 누락(track/handle/checkmark 미렌더, live DOM 측정으로 확인 2026-06-18).
 *
 * 미등록 시 indicator DOM 자식 0개 = builder Preview 에서 Switch track/thumb·Checkbox box/checkmark
 * 가 안 보임(Skia canvas 는 switch_toggle/checkbox skiaPrimitive 가 그려 비대칭). DateField/TimeField
 * 동형(render function 이 아니라 정적 자식 div 라는 점만 다름)의 self-compose 위임 누락.
 *
 * Radio 는 제외 — `.react-aria-Radio::before` pseudo-element ring 모델이라 DOM 자식 불요, RAC
 * `<Radio>` 직접 렌더로도 indicator 정상(live 확인). 등록하면 불필요한 위임(surface 증가)이라 제외.
 */
describe("CanonicalNodeRenderer — Switch/Checkbox 위임 등록 (ADR-913 slice 3 회귀 방지)", () => {
  it("Switch 는 DELEGATING_RAC_RENDERERS 에 등록 (.indicator div self-compose)", () => {
    expect(DELEGATING_RAC_RENDERERS.has("Switch")).toBe(true);
  });

  it("Checkbox 는 DELEGATING_RAC_RENDERERS 에 등록 (.checkbox div + svg self-compose)", () => {
    expect(DELEGATING_RAC_RENDERERS.has("Checkbox")).toBe(true);
  });

  it("Radio 는 DELEGATING_RAC_RENDERERS 에 미등록 (::before pseudo ring — DOM 자식 불요)", () => {
    // Radio 는 RAC `<Radio>` 직접 렌더로도 ::before ring 정상. 위임은 불필요한 surface 증가.
    expect(DELEGATING_RAC_RENDERERS.has("Radio")).toBe(false);
  });

  it("DateField/TimeField/NumberField/SearchField 동형 멤버 보존 (회귀 0)", () => {
    // Switch/Checkbox 추가가 기존 self-compose 멤버를 깨지 않음을 확증.
    expect(DELEGATING_RAC_RENDERERS.has("DateField")).toBe(true);
    expect(DELEGATING_RAC_RENDERERS.has("TimeField")).toBe(true);
    expect(DELEGATING_RAC_RENDERERS.has("NumberField")).toBe(true);
    expect(DELEGATING_RAC_RENDERERS.has("SearchField")).toBe(true);
    expect(DELEGATING_RAC_RENDERERS.has("Slider")).toBe(true);
  });

  it("CheckboxGroup/RadioGroup 그룹 위임 보존 (자식 Checkbox/Radio 는 그룹 위임 안에서 렌더)", () => {
    expect(DELEGATING_RAC_RENDERERS.has("CheckboxGroup")).toBe(true);
    expect(DELEGATING_RAC_RENDERERS.has("RadioGroup")).toBe(true);
  });

  it("Switch/Checkbox 는 internal 위임 집합에 미포함 (rac source — RAC 경로)", () => {
    // source.kind="rac" 라 isDelegatingRac 분기. internal 집합엔 들어가면 안 됨.
    expect(DELEGATING_INTERNAL_RENDERERS.has("switch")).toBe(false);
    expect(DELEGATING_INTERNAL_RENDERERS.has("checkbox")).toBe(false);
  });
});
