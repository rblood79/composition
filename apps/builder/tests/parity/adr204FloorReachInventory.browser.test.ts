import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import { useStore } from "@/builder/stores";
import {
  allPaletteCreationTrees,
  layoutTree,
  type ProductionTree,
} from "./adr923ProductionTrees";

vi.mock("@/builder/factories/utils/elementCreation", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/builder/factories/utils/elementCreation")
    >();
  return { ...actual, addElementsToStore: () => [] };
});

/**
 * ADR-204 Phase 0 — **도달 인벤토리**. G0 (`adr204MinContentFloorFirstNail`) 가 원인을 가드 하나로
 * 분리했다: 주축이 definite 이고 `min-*: auto` 이며 non-scrollable 인 flex item 은 Chrome 이
 * `min(specified, content)` 를 floor 로 쓰는데 (`flex.rs:332` 의 `main_size == AUTO` 가드가 없는 절)
 * 엔진은 floor 를 0 으로 둔다.
 *
 * 그 조건이 **팔레트 production 트리에서 몇 개나 성립하는지**를 wasm 경계 값으로 센다. 세는 것은
 * 세 축이다 — ① content 공급 0 (레이아웃 자식 0) · ② non-scrollable (경계 overflow 가 없거나
 * visible/clip) · ③ 주축 크기 definite. ①은 가상화 collection 을 가려내고 (ADR-204 의 원래 대상),
 * ②③은 대안 C 가 닿는 **collection 밖 표면**의 크기다 (R1).
 *
 * 주축은 부모 문맥에 따라 갈리므로 여기서는 **양 축 각각**을 기록한다 (definiteWidth / definiteHeight) —
 * "이 노드가 flex row 의 item 이면 폭이 definite 인가 / column 이면 높이가 definite 인가".
 */

interface NodeFact {
  type: string;
  root: boolean;
  childCount: number;
  overflow: string | null;
  definiteWidth: boolean;
  definiteHeight: boolean;
}

const facts: NodeFact[] = [];
let treeCount = 0;

/** px 숫자 또는 "164px" 형태만 definite. auto/%/미지정/fit-content 는 아니다. */
function isDefinite(v: unknown): boolean {
  if (typeof v === "number") return Number.isFinite(v) && v > 0;
  if (typeof v !== "string") return false;
  return /^\d+(\.\d+)?px$/.test(v.trim());
}

/** css-overflow-3 scrollable values — clip/visible/미지정은 non-scrollable. */
function isNonScrollable(v: string | null): boolean {
  if (v == null || v === "") return true;
  const o = v.trim().toLowerCase();
  return o === "visible" || o === "clip";
}

beforeAll(async () => {
  await initCompositionEngineWasm();
  useStore.setState({ elements: [], elementsMap: new Map() });
  const trees: ProductionTree[] = await allPaletteCreationTrees("adr204-inv");
  treeCount = trees.length;
  for (const tree of trees) {
    const run = layoutTree(
      tree.root.id,
      tree.elements,
      400,
      -1,
      `adr204-inv-${tree.root.type}`,
    );
    const childCounts = new Map<string, number>();
    for (const el of tree.elements) {
      if (el.parent_id)
        childCounts.set(el.parent_id, (childCounts.get(el.parent_id) ?? 0) + 1);
    }
    for (const [id, entry] of run.batch) {
      const st = entry.style ?? {};
      const ov = (st.overflow ?? st.overflowY ?? st.overflowX) as
        string | undefined;
      facts.push({
        type: entry.type,
        root: id === tree.root.id,
        childCount: childCounts.get(id) ?? 0,
        overflow: ov ?? null,
        definiteWidth: isDefinite(st.width),
        definiteHeight: isDefinite(st.height),
      });
    }
  }
});

afterAll(async () => {
  const { server } = await import("vitest/browser");
  // 조건 성립 집합 — 축별로 나눈다 (주축은 부모 flex-direction 이 정한다).
  const reachRow = facts.filter(
    (f) => isNonScrollable(f.overflow) && f.definiteWidth,
  );
  const reachColumn = facts.filter(
    (f) => isNonScrollable(f.overflow) && f.definiteHeight,
  );
  const supplyZero = facts.filter((f) => f.childCount === 0);
  const collectionCandidates = facts.filter(
    (f) =>
      f.childCount === 0 &&
      isNonScrollable(f.overflow) &&
      (f.definiteWidth || f.definiteHeight),
  );
  const byType = (rows: NodeFact[]): Record<string, number> => {
    const m: Record<string, number> = {};
    for (const r of rows) m[r.type] = (m[r.type] ?? 0) + 1;
    return m;
  };
  await server.commands.writeFile(
    "tests/parity/.artifacts/adr204-floor-reach-inventory.json",
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        treeCount,
        nodeCount: facts.length,
        reachRowCount: reachRow.length,
        reachRowByType: byType(reachRow),
        reachColumnCount: reachColumn.length,
        reachColumnByType: byType(reachColumn),
        supplyZeroCount: supplyZero.length,
        collectionCandidateByType: byType(collectionCandidates),
        collectionRoots: facts
          .filter(
            (f) =>
              f.root &&
              ["ListBox", "GridList", "Table", "TableView", "Tree"].includes(
                f.type,
              ),
          )
          .map((f) => ({
            type: f.type,
            childCount: f.childCount,
            overflow: f.overflow,
            definiteWidth: f.definiteWidth,
            definiteHeight: f.definiteHeight,
          })),
      },
      null,
      2,
    ),
  );
});

describe("ADR-204 Phase 0 — floor 도달 인벤토리", () => {
  it("팔레트 전수 트리가 경계에 도달했다", () => {
    expect(treeCount).toBeGreaterThan(30);
    expect(facts.length).toBeGreaterThan(treeCount);
  });

  it("행 투영으로 자식이 0 인 collection 은 ListBox·GridList 둘뿐이다 (Table 은 자식 2)", () => {
    const root = (t: string): NodeFact => {
      const f = facts.find((x) => x.root && x.type === t);
      if (!f) throw new Error(`${t} root 미도달`);
      return f;
    };
    // 공급 0 (§4.5 content 제안 0) — ADR-204 가 대상으로 삼은 형태.
    expect(root("ListBox").childCount, "ListBox 자식").toBe(0);
    expect(root("GridList").childCount, "GridList 자식").toBe(0);
    // Table 은 투영 대상 (A2_WINDOWED_COLLECTION_TAGS) 이지만 레이아웃 자식을 갖는다 —
    // 공급 0 이 아니므로 이 형태의 격차 원인은 가드 하나다 (대안 C 단독으로 닫힌다).
    expect(root("Table").childCount, "Table 자식").toBeGreaterThan(0);
  });

  it("기본 상태에서 격차 조건을 만족하는 collection 은 Table 하나다", () => {
    const root = (t: string): NodeFact => {
      const f = facts.find((x) => x.root && x.type === t);
      if (!f) throw new Error(`${t} root 미도달`);
      return f;
    };
    // Table — non-scrollable + 주축(높이) definite → 가드가 floor 를 죽인다.
    const table = root("Table");
    expect(isNonScrollable(table.overflow), "Table non-scrollable").toBe(true);
    expect(table.definiteHeight, "Table 높이 definite").toBe(true);
    // ListBox/GridList — 기본 overflow 가 scrollable 이라 Chrome 도 floor 0 → 기본 상태는 정합.
    expect(isNonScrollable(root("ListBox").overflow), "ListBox 기본").toBe(
      false,
    );
    expect(isNonScrollable(root("GridList").overflow), "GridList 기본").toBe(
      false,
    );
  });

  it("대안 C 가 닿는 표면은 collection 밖이 훨씬 크다 (R1 의 크기)", () => {
    const reachColumn = facts.filter(
      (f) => isNonScrollable(f.overflow) && f.definiteHeight,
    );
    const reachRow = facts.filter(
      (f) => isNonScrollable(f.overflow) && f.definiteWidth,
    );
    // 팔레트 64 트리 210 노드 기준 실측 — 값 자체를 고정하지 않고 자릿수만 고정한다
    // (팔레트가 늘면 같이 는다. 게이트의 뜻은 "collection 한 줌이 아니다").
    expect(reachColumn.length, "세로축 도달 후보").toBeGreaterThan(50);
    expect(reachRow.length, "가로축 도달 후보").toBeGreaterThan(20);
  });
});
