import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// collection 목록 hook mock — 단위 렌더용 (실제 hook 계약: DataTable[] 반환)
vi.mock("../../stores/data", () => ({
  useCollections: () => [
    { name: "Users", description: "Users collection" },
    { name: "Roles", description: "Roles collection" },
  ],
}));

import { PropertyDataBinding } from "./PropertyDataBinding";

describe("PropertyDataBinding — 갱신 모드 오소링 제거 계약 (2026-07-24)", () => {
  it("갱신 모드 / 갱신 간격 오소링 UI 를 렌더하지 않는다", () => {
    const { container } = render(
      <PropertyDataBinding
        value={{ source: "dataTable", name: "Users", refreshMode: "interval" }}
        onChange={() => {}}
      />,
    );

    // RAC/RSP collection 레퍼런스에 없는 개념 + 유일 소비처(useCollectionData
    // auto-refresh effect)가 `if (!isApiBinding) return` 이라 dataTable 바인딩에서
    // 발화 0 → 오소링 표면 제거.
    expect(container.querySelector(".binding-refresh-select")).toBeNull();
    expect(container.querySelector(".binding-refresh-row")).toBeNull();
    expect(container.querySelector(".binding-interval-row")).toBeNull();
    expect(container.textContent).not.toContain("갱신 모드");
    expect(container.textContent).not.toContain("갱신 간격");
  });

  it("기존 저장 문서의 refreshMode / refreshInterval 은 경로 편집 시에도 보존한다", () => {
    const onChange = vi.fn();
    const { container } = render(
      <PropertyDataBinding
        value={{
          source: "dataTable",
          name: "Users",
          refreshMode: "interval",
          refreshInterval: 3000,
        }}
        onChange={onChange}
      />,
    );

    const pathInput = container.querySelector(".binding-path-input");
    expect(pathInput).not.toBeNull();

    fireEvent.blur(pathInput as HTMLInputElement, {
      target: { value: "items[0].name" },
    });

    // 오소링 UI 는 사라졌지만 값 자체는 read 호환으로 살아남아야 한다 —
    // 물리 제거는 ADR-159 P4c G4(저장 문서 전수 실측) 게이트 이후.
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "dataTable",
        name: "Users",
        path: "items[0].name",
        refreshMode: "interval",
        refreshInterval: 3000,
      }),
    );
  });

  it("컬렉션 선택 시에도 기존 refreshMode 를 유지한다", () => {
    const onChange = vi.fn();
    const { container } = render(
      <PropertyDataBinding
        value={{
          source: "dataTable",
          name: "Users",
          refreshMode: "interval",
          refreshInterval: 3000,
        }}
        onChange={onChange}
      />,
    );

    // RAC Select 의 hidden native select 로 선택 변경을 재현
    const nativeSelect = container.querySelector(
      ".binding-name-select select",
    ) as HTMLSelectElement | null;
    expect(nativeSelect).not.toBeNull();

    fireEvent.change(nativeSelect as HTMLSelectElement, {
      target: { value: "Roles" },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "dataTable",
        name: "Roles",
        refreshMode: "interval",
        refreshInterval: 3000,
      }),
    );
  });
});
