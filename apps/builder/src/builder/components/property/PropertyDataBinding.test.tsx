import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// collection 목록 hook mock — 단위 렌더용 (실제 hook 계약: DataTable[] 반환)
vi.mock("../../stores/data", () => ({
  useCollections: () => [
    { id: "c-users", name: "Users", description: "Users collection" },
    { id: "c-roles", name: "Roles", description: "Roles collection" },
  ],
}));

import { PropertyDataBinding } from "./PropertyDataBinding";
import type { ReactElement } from "react";
import { I18nProvider } from "@/i18n";

/** 표시 계층이 `useI18n` 을 쓰므로 provider 밑에서 그린다 (ADR-200 R7). */
const renderWithI18n = (ui: ReactElement) =>
  render(ui, { wrapper: I18nProvider });

describe("PropertyDataBinding — 죽은 오소링 표면 제거 계약 (2026-07-24)", () => {
  it("갱신 모드 / 갱신 간격 / 데이터 경로 오소링 UI 를 렌더하지 않는다", () => {
    const { container } = renderWithI18n(
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
    //   `if (!isApiBinding) return` 이라 dataTable 바인딩에서 실행 0.
    expect(container.querySelector(".binding-refresh-select")).toBeNull();
    expect(container.querySelector(".binding-refresh-row")).toBeNull();
    expect(container.querySelector(".binding-interval-row")).toBeNull();
    expect(container.textContent).not.toContain("갱신 모드");
    expect(container.textContent).not.toContain("갱신 간격");

    // 데이터 경로: 유일 해석기(preview useDataBinding)가 import 0건 dead,
    //   살아있는 소비처는 createCacheKey 캐시 키 문자열뿐.
    expect(container.querySelector(".binding-path-input")).toBeNull();
    expect(container.textContent).not.toContain("데이터 경로");

    // 남는 오소링 표면 = 컬렉션 Select 행 + (ADR-212 Phase 6) 바인딩 동선 행뿐 —
    // 갱신/경로 오소링 행은 없다.
    expect(container.querySelector(".binding-name-row")).not.toBeNull();
    expect(container.querySelector(".binding-actions")).not.toBeNull();
    expect(
      container.querySelectorAll(".property-data-binding > *"),
    ).toHaveLength(2);
  });

  it("컬렉션 선택 시 기존 path / refreshMode / refreshInterval 을 모두 보존한다", () => {
    const onChange = vi.fn();
    const { container } = renderWithI18n(
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

    // 옵션 키는 collection id (ADR-152 v2) — 저장은 collectionId + name 둘 다.
    fireEvent.change(nativeSelect as HTMLSelectElement, {
      target: { value: "c-roles" },
    });

    // 오소링 표면은 사라졌지만 값 자체는 read 호환으로 살아남아야 한다.
    //   path 는 createCacheKey 가, refreshMode/refreshInterval 은 api 바인딩 잔존
    //   문서가 읽으므로 물리 제거는 ADR-159 P4c G4 게이트 이후.
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "dataTable",
        collectionId: "c-roles",
        name: "Roles",
        path: "items[0].name",
        refreshMode: "interval",
        refreshInterval: 3000,
      }),
    );
  });
});

describe("PropertyDataBinding — fieldMap value/icon (ADR-152 Phase 2)", () => {
  // 위 mock 의 collection 은 schema 가 없어 fieldMap 행이 뜨지 않는다 (표면 1행 계약 유지).
  // schema 가 있는 collection 은 모듈 mock 을 덮어 쓴다.
  const withSchema = async () => {
    vi.doMock("../../stores/data", () => ({
      useCollections: () => [
        {
          id: "c-users",
          name: "Users",
          schema: [
            { id: "f-id", key: "id", type: "string" },
            { id: "f-name", key: "name", type: "string" },
            { id: "f-avatar", key: "avatar", type: "image" },
          ],
        },
      ],
    }));
    vi.resetModules();
    // 모듈 재로드 뒤에는 i18n context 도 같은 인스턴스여야 한다
    const [{ PropertyDataBinding: Comp }, { I18nProvider: Provider }] =
      await Promise.all([import("./PropertyDataBinding"), import("@/i18n")]);
    const renderFresh = (ui: ReactElement) =>
      render(ui, { wrapper: Provider });
    return { Comp, renderFresh };
  };

  it("schema 가 있는 collection 을 고르면 value / icon Select 가 뜨고 저장값은 fieldId", async () => {
    const { Comp, renderFresh } = await withSchema();
    const onChange = vi.fn();
    const { container } = renderFresh(
      <Comp
        value={{ source: "dataTable", collectionId: "c-users", name: "Users" }}
        onChange={onChange}
      />,
    );
    const valueSelect = container.querySelector(
      ".binding-fieldmap-select[data-role='value'] select",
    ) as HTMLSelectElement | null;
    const iconSelect = container.querySelector(
      ".binding-fieldmap-select[data-role='icon'] select",
    ) as HTMLSelectElement | null;
    expect(valueSelect).not.toBeNull();
    expect(iconSelect).not.toBeNull();
    // 옵션 = 자동 + 필드 3 (키는 fieldId)
    expect([...valueSelect!.options].map((o) => o.value)).toEqual(
      expect.arrayContaining(["f-id", "f-name", "f-avatar"]),
    );

    fireEvent.change(valueSelect!, { target: { value: "f-id" } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        collectionId: "c-users",
        fieldMap: { value: "f-id" },
      }),
    );
    // path 자유 입력은 노출하지 않는다 (2026-07-24 제거 유지 — "고급" 영역 없음)
    expect(container.querySelector(".binding-path-input")).toBeNull();
  });

  it("저장된 fieldMap (id · v1 key) 을 현재 선택으로 표시하고, 자동 선택은 키를 지운다", async () => {
    const { Comp, renderFresh } = await withSchema();
    const onChange = vi.fn();
    const { container } = renderFresh(
      <Comp
        value={{
          source: "dataTable",
          collectionId: "c-users",
          name: "Users",
          fieldMap: { value: "f-id", icon: "avatar" },
        }}
        onChange={onChange}
      />,
    );
    const valueSelect = container.querySelector(
      ".binding-fieldmap-select[data-role='value'] select",
    ) as HTMLSelectElement;
    const iconSelect = container.querySelector(
      ".binding-fieldmap-select[data-role='icon'] select",
    ) as HTMLSelectElement;
    expect(valueSelect.value).toBe("f-id");
    // v1 key 저장값도 id 로 해석돼 표시
    expect(iconSelect.value).toBe("f-avatar");

    fireEvent.change(iconSelect, { target: { value: "__auto__" } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ fieldMap: { value: "f-id" } }),
    );
  });
});
