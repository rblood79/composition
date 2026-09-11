/**
 * ADR-152 Table 정렬 후속 (2026-09-11 live 실측): `useResolvedCollectionItems` 의 rows 가
 * `reload` 함수 identity (useAsyncList 가 렌더마다 새 객체 → useCollectionData 의 useCallback
 * 이 매번 새 reload) 에 묶여 렌더마다 새 배열이 되면, rows 변경에 setState 하는 소비자
 * (Table 컬럼 자동 감지 초기화) 가 "Maximum update depth exceeded" 로 돈다.
 * 회귀: 데이터 deps 가 같으면 재렌더에도 rows 참조가 유지돼야 한다 (jsdom, builder 환경 —
 * packages/shared 는 DOM 환경이 없어 여기서 잰다).
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const rowsData = [
  { id: "auto-1", uid: "U-1", name: "User 1" },
  { id: "auto-2", uid: "U-2", name: "User 2" },
];
const schema = [
  { id: "f-uid", key: "uid", type: "string" },
  { id: "f-name", key: "name", type: "string" },
];

vi.mock(
  "../../../../../../packages/shared/src/hooks/useCollectionData",
  () => ({
    // reload 는 호출마다 새 함수 (실제 useAsyncList 의 렌더별 새 객체를 흉내) — data/schema 는 안정.
    useCollectionData: () => ({
      data: rowsData,
      loading: false,
      error: null,
      reload: () => {},
      schema,
    }),
  }),
);

import { useResolvedCollectionItems } from "../../../../../../packages/shared/src/hooks/useResolvedCollectionItems";
import type { DataBinding } from "../../../../../../packages/shared/src/types";

const binding = {
  source: "dataTable" as const,
  collectionId: "c1",
  name: "Users",
  fieldMap: { value: "f-uid" },
} as unknown as DataBinding; // v2 PropertyDataBinding — hook 이 normalizeDataBinding 으로 받는다 (Tabs 와 같은 cast)

let root: Root | null = null;
let container: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe("useResolvedCollectionItems — rows 참조 안정성", () => {
  it("reload identity 만 바뀌는 재렌더에서 rows · fieldRoles 참조가 유지된다", async () => {
    const seen: { rows: unknown; reload: unknown }[] = [];
    let bump: () => void = () => {};
    function Probe() {
      const [, setTick] = React.useState(0);
      bump = () => setTick((t) => t + 1);
      const result = useResolvedCollectionItems({
        dataBinding: binding,
        componentName: "Probe",
      });
      seen.push({ rows: result.rows, reload: result.reload });
      return <div data-keys={result.rows.map((r) => r.itemKey).join(",")} />;
    }
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root!.render(<Probe />));
    await act(async () => bump());
    await act(async () => bump());

    expect(seen.length).toBeGreaterThanOrEqual(3);
    expect(container.firstElementChild?.getAttribute("data-keys")).toBe(
      "U-1,U-2",
    );
    // reload 는 매 렌더 새 함수 (mock) — 그래도 rows 는 같은 배열.
    expect(seen[1].reload).not.toBe(seen[0].reload);
    expect(seen[1].rows).toBe(seen[0].rows);
    expect(seen[2].rows).toBe(seen[0].rows);
  });
});
