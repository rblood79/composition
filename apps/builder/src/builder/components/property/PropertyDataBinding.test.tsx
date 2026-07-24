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

describe("PropertyDataBinding — 죽은 오소링 표면 제거 계약 (2026-07-24)", () => {
  it("갱신 모드 / 갱신 간격 / 데이터 경로 오소링 UI 를 렌더하지 않는다", () => {
    const { container } = render(
      <PropertyDataBinding
        value={{
          source: "dataTable",
          name: "Users",
          path: "items[0].name",
          refreshMode: "interval",
        }}
        onChange={() => {}}
      />,
    );

    // 갱신 모드: RAC/RSP 미규정 + 유일 소비처(useCollectionData auto-refresh effect)가
    //   `if (!isApiBinding) return` 이라 dataTable 바인딩에서 발화 0.
    expect(container.querySelector(".binding-refresh-select")).toBeNull();
    expect(container.querySelector(".binding-refresh-row")).toBeNull();
    expect(container.querySelector(".binding-interval-row")).toBeNull();
    expect(container.textContent).not.toContain("갱신 모드");
    expect(container.textContent).not.toContain("갱신 간격");

    // 데이터 경로: 유일 해석기(preview useDataBinding)가 import 0건 dead,
    //   살아있는 소비처는 createCacheKey 캐시 키 문자열뿐.
    expect(container.querySelector(".binding-path-input")).toBeNull();
    expect(container.textContent).not.toContain("데이터 경로");

    // 남는 오소링 표면은 컬렉션 Select 1행뿐
    expect(
      container.querySelectorAll(".property-data-binding > *"),
    ).toHaveLength(1);
    expect(container.querySelector(".binding-name-row")).not.toBeNull();
  });

  it("컬렉션 선택 시 기존 path / refreshMode / refreshInterval 을 모두 보존한다", () => {
    const onChange = vi.fn();
    const { container } = render(
      <PropertyDataBinding
        value={{
          source: "dataTable",
          name: "Users",
          path: "items[0].name",
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

    // 오소링 표면은 사라졌지만 값 자체는 read 호환으로 살아남아야 한다.
    //   path 는 createCacheKey 가, refreshMode/refreshInterval 은 api 바인딩 잔존
    //   문서가 읽으므로 물리 제거는 ADR-159 P4c G4 게이트 이후.
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "dataTable",
        name: "Roles",
        path: "items[0].name",
        refreshMode: "interval",
        refreshInterval: 3000,
      }),
    );
  });
});
