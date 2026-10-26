import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { changedCollectionIds } from "../rowsRefresh";

/**
 * 2026-10-21 레버 3a — 빌더 mount 가 바인딩 행을 무조건 다시 해석했다 (데이터 store 는 root 를
 * 열기 전에 초기화되므로 root 가 이미 그 행을 가진 상태 · 22 페이지 문서에서 첫 프레임의 ~125 ms,
 * 4x 에서 ~520 ms). mount 는 root 가 store 를 읽은 뒤 바뀐 collection 만 새로 고친다.
 */
describe("changedCollectionIds", () => {
  const table = (id: string) => ({ id });

  it("같은 snapshot 이면 비어 있다", () => {
    const map = new Map([["a", table("a")]]);
    expect(changedCollectionIds(map, map)).toEqual([]);
    expect(changedCollectionIds(new Map(map), map)).toEqual([]);
  });

  it("ADR-284 — 바뀐 collection 을 참조하는 collection 도 돌려준다 (Teams 변경 → team.name 을 읽는 Users)", () => {
    const users = {
      id: "users",
      schema: [{ key: "teamId", reference: { collectionId: "teams" } }],
    };
    const orders = { id: "orders", schema: [{ key: "id" }] };
    const previous = new Map<string, object>([
      ["teams", table("teams")],
      ["users", users],
      ["orders", orders],
    ]);
    const next = new Map<string, object>([
      ["teams", table("teams")],
      ["users", users],
      ["orders", orders],
    ]);
    expect(changedCollectionIds(next, previous)).toEqual(["teams", "users"]);
  });

  it("바뀐 · 추가 · 지운 collection 만 돌려준다", () => {
    const a = table("a");
    const previous = new Map([
      ["a", a],
      ["b", table("b")],
      ["c", table("c")],
    ]);
    const next = new Map([
      ["a", a],
      ["b", table("b")],
      ["d", table("d")],
    ]);
    expect(changedCollectionIds(next, previous).sort()).toEqual([
      "b",
      "c",
      "d",
    ]);
  });
});

describe("CatalogBuilderCore rows refresh on mount", () => {
  it("mount 는 root 가 읽은 collections 와 다른 것만 새로 고친다 (무조건 refreshRows 금지)", async () => {
    const source = await readFile(
      resolve(__dirname, "../../main/CatalogBuilderCore.tsx"),
      "utf8",
    );
    const effect = source.slice(
      source.indexOf("// A collection's rows changed"),
      source.indexOf("// Project variables changed"),
    );
    expect(effect).not.toContain("workspace.refreshRows();");
    expect(effect.replace(/\s+/g, " ")).toContain(
      "changedCollectionIds( useDataStore.getState().collections, rowsSource, )",
    );
    // The snapshot the root resolved its rows from — read after the data store is initialized.
    const boot = source.slice(
      source.indexOf("initializeForProject(routeId)"),
      source.indexOf("opened = new CatalogWorkspace("),
    );
    expect(boot).toContain(
      "const rowsSource = useDataStore.getState().collections;",
    );
  });
});
