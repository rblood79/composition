import { describe, expect, it } from "vitest";

import { resolveSelectDisplayValue } from "../selectDisplayValue";

/**
 * Select/ComboBox 표시값 단일 소스 (2026-08-22, design-data 감사 §1-1).
 *
 * DOM 은 RAC SelectValue 가 내부 selection state 에서 라벨을 직접 그려 늘 맞았지만, Skia 는
 * placeholder 만 받아 옵션을 골라도 캔버스가 placeholder 를 계속 그렸다. 두 consumer 가 같은
 * 문서를 다르게 그리던 D3 비대칭이라, Skia 가 읽을 판정식을 여기 한 곳에 둔다.
 */

const items = [
  { id: "opt-1", value: "us-west-2", label: "US West (Oregon)" },
  { id: "opt-2", value: "eu-central-1", label: "EU (Frankfurt)" },
];

describe("resolveSelectDisplayValue", () => {
  it("선택이 없으면 placeholder", () => {
    expect(
      resolveSelectDisplayValue({ ownerProps: { items }, placeholder: "선택" }),
    ).toBe("선택");
  });

  it("선택된 항목의 **라벨** 을 보여준다 (value 는 코드값일 수 있다)", () => {
    expect(
      resolveSelectDisplayValue({
        ownerProps: { items, selectedKey: "opt-1", selectedValue: "us-west-2" },
        placeholder: "선택",
      }),
    ).toBe("US West (Oregon)");
  });

  it("id 가 안 맞으면 value 로도 찾는다 (legacy 문서의 RAC 내부 id)", () => {
    expect(
      resolveSelectDisplayValue({
        ownerProps: {
          items,
          selectedKey: "react-aria-3",
          selectedValue: "eu-central-1",
        },
        placeholder: "선택",
      }),
    ).toBe("EU (Frankfurt)");
  });

  it("items 를 못 찾으면(dataBinding 문서) 저장된 value 로 떨어진다", () => {
    // Skia 는 async 데이터를 기다리지 않는다 — placeholder 를 계속 보여주는 것보다
    // 값이라도 보여주는 쪽이 실제 상태에 가깝다.
    expect(
      resolveSelectDisplayValue({
        ownerProps: { selectedKey: "opt-9", selectedValue: "ap-south-1" },
        placeholder: "선택",
      }),
    ).toBe("ap-south-1");
  });

  it("ComboBox 자유 입력이 선택보다 우선한다", () => {
    expect(
      resolveSelectDisplayValue({
        ownerProps: { items, selectedKey: "opt-1", inputValue: "직접 입력" },
        placeholder: "선택",
      }),
    ).toBe("직접 입력");
  });

  it("빈 문자열은 선택으로 치지 않는다", () => {
    expect(
      resolveSelectDisplayValue({
        ownerProps: {
          items,
          selectedKey: "",
          selectedValue: "",
          inputValue: "",
        },
        placeholder: "선택",
      }),
    ).toBe("선택");
  });

  it("placeholder 도 없으면 null (텍스트 미주입)", () => {
    expect(resolveSelectDisplayValue({ ownerProps: { items } })).toBeNull();
    expect(resolveSelectDisplayValue({ ownerProps: undefined })).toBeNull();
  });
});
