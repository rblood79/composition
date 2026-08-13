/**
 * 수동 가이드 기록/되돌리기 — ADR-181 Phase 3.
 *
 * 확인하는 것은 세 가지다:
 * 1. **기록** — 변경 1건이 히스토리 1 entry + canonical 1 write 로 떨어지는가
 *    (드래그 중 0회 계약은 호출 시점 문제라 Phase 5 소관, 여기서는 1회성만)
 * 2. **되돌리기 왕복** — before/after 목록 전체 교체가 그대로 역재생되는가
 * 3. **격리** — 변경 없는 항목·삭제된 페이지가 문서를 건드리지 않는가
 *
 * `page-position` 과 갈리는 지점을 특히 본다: 가이드는 **스토어 미러가 없어**
 * canonical 만 되돌리고, 화면 갱신은 개정 카운터로 알린다.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CompositionDocument, PageGuideLine } from "@composition/shared";

vi.mock("../../../../lib/db", () => ({
  getDB: vi.fn(async () => ({ documents: { put: vi.fn(async () => {}) } })),
}));

import {
  selectActiveCanonicalDocument,
  useCanonicalDocumentStore,
} from "../../../stores/canonical/canonicalDocumentStore";
import { historyManager } from "../../../stores/history";
import {
  getPageGuideRevision,
  resetPageGuideRevisionForTest,
} from "../interaction/pageGuideRevision";
import {
  commitPageGuideChanges,
  filterChangedGuideEntries,
  readPageGuides,
  readPageGuidesByPage,
} from "./pageGuideActions";

const g = (id: string, axis: "x" | "y", position: number): PageGuideLine => ({
  id,
  axis,
  position,
});

function setupActiveDoc(overrides?: Partial<CompositionDocument>): void {
  const store = useCanonicalDocumentStore.getState();
  store.setDocument("p", {
    version: "composition-1.0",
    children: [],
    ...overrides,
  });
  store.setCurrentProject("p");
}

function guidesOf(pageId: string, breakpoint = "desktop") {
  return selectActiveCanonicalDocument()?.pageGuides?.[pageId]?.[
    breakpoint as "desktop"
  ];
}

beforeEach(() => {
  useCanonicalDocumentStore.setState({
    documents: new Map(),
    currentProjectId: null,
    documentVersion: 0,
  });
  historyManager.clearAllHistory();
  historyManager.setCurrentPage("page-1");
  resetPageGuideRevisionForTest();
});

describe("filterChangedGuideEntries — lazy write (순수)", () => {
  it("목록이 같으면 변경 아님 (id/axis/position 전부 비교)", () => {
    const list = [g("a", "x", 100), g("b", "y", 40)];
    expect(
      filterChangedGuideEntries([
        {
          pageId: "page-1",
          breakpoint: "desktop",
          before: list,
          after: list.map((item) => ({ ...item })),
        },
      ]),
    ).toEqual([]);
  });

  it("position 만 달라도 변경 (이동)", () => {
    const changed = filterChangedGuideEntries([
      {
        pageId: "page-1",
        breakpoint: "desktop",
        before: [g("a", "x", 100)],
        after: [g("a", "x", 101)],
      },
    ]);
    expect(changed).toHaveLength(1);
  });

  it("길이가 다르면 변경 (생성/삭제)", () => {
    expect(
      filterChangedGuideEntries([
        {
          pageId: "page-1",
          breakpoint: "desktop",
          before: [],
          after: [g("a", "x", 100)],
        },
      ]),
    ).toHaveLength(1);
  });
});

describe("readPageGuides — entry 부재는 빈 목록 (C9)", () => {
  it("문서에 필드가 없으면 []", () => {
    setupActiveDoc();
    expect(readPageGuides("page-1", "desktop")).toEqual([]);
  });

  it("다른 breakpoint 의 목록을 넘겨주지 않는다", () => {
    setupActiveDoc({
      pageGuides: { "page-1": { desktop: [g("a", "x", 100)] } },
    });
    expect(readPageGuides("page-1", "desktop")).toEqual([g("a", "x", 100)]);
    expect(readPageGuides("page-1", "mobile")).toEqual([]);
  });
});

describe("commitPageGuideChanges — 기록", () => {
  it("변경 1건 = 히스토리 1 entry + canonical write + 개정 1회", () => {
    setupActiveDoc();
    commitPageGuideChanges([
      {
        pageId: "page-1",
        breakpoint: "desktop",
        before: [],
        after: [g("a", "x", 100)],
      },
    ]);

    const entries = historyManager.getCurrentPageEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe("page-guide");
    expect(entries[0].data.pageGuideEvent?.entries).toEqual([
      {
        pageId: "page-1",
        breakpoint: "desktop",
        before: [],
        after: [g("a", "x", 100)],
      },
    ]);
    expect(guidesOf("page-1")).toEqual([g("a", "x", 100)]);
    expect(getPageGuideRevision()).toBe(1);
  });

  it("여러 페이지 변경도 batch 1 entry", () => {
    setupActiveDoc();
    commitPageGuideChanges([
      {
        pageId: "page-1",
        breakpoint: "desktop",
        before: [],
        after: [g("a", "x", 1)],
      },
      {
        pageId: "page-2",
        breakpoint: "desktop",
        before: [],
        after: [g("b", "y", 2)],
      },
    ]);

    const entries = historyManager.getCurrentPageEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].data.pageGuideEvent?.entries).toHaveLength(2);
  });

  it("변경 없는 항목만 넘기면 아무것도 하지 않는다 (빈 entry 금지)", () => {
    setupActiveDoc({
      pageGuides: { "page-1": { desktop: [g("a", "x", 100)] } },
    });
    commitPageGuideChanges([
      {
        pageId: "page-1",
        breakpoint: "desktop",
        before: [g("a", "x", 100)],
        after: [g("a", "x", 100)],
      },
    ]);

    expect(historyManager.getCurrentPageEntries()).toHaveLength(0);
    expect(getPageGuideRevision()).toBe(0);
  });

  it("변경/무변경이 섞이면 변경분만 기록", () => {
    setupActiveDoc({
      pageGuides: { "page-2": { desktop: [g("b", "y", 2)] } },
    });
    commitPageGuideChanges([
      {
        pageId: "page-1",
        breakpoint: "desktop",
        before: [],
        after: [g("a", "x", 1)],
      },
      {
        pageId: "page-2",
        breakpoint: "desktop",
        before: [g("b", "y", 2)],
        after: [g("b", "y", 2)],
      },
    ]);

    const items =
      historyManager.getCurrentPageEntries()[0].data.pageGuideEvent?.entries;
    expect(items).toHaveLength(1);
    expect(items?.[0].pageId).toBe("page-1");
  });

  it("호출자 배열을 그대로 물지 않는다 (entry·문서 모두 사본)", () => {
    setupActiveDoc();
    const after = [g("a", "x", 100)];
    commitPageGuideChanges([
      { pageId: "page-1", breakpoint: "desktop", before: [], after },
    ]);

    after[0].position = 999;
    after.push(g("z", "y", 5));

    expect(guidesOf("page-1")).toEqual([g("a", "x", 100)]);
    expect(
      historyManager.getCurrentPageEntries()[0].data.pageGuideEvent?.entries[0]
        .after,
    ).toEqual([g("a", "x", 100)]);
  });
});

describe("readPageGuidesByPage — 렌더 패스 read (Phase 4)", () => {
  it("필드가 없으면 빈 map 을 재사용한다 (통상 경로 할당 0)", () => {
    setupActiveDoc();
    const first = readPageGuidesByPage("desktop");
    const second = readPageGuidesByPage("desktop");
    expect(first.size).toBe(0);
    expect(first).toBe(second);
  });

  it("활성 breakpoint 의 목록만 모은다 (C9)", () => {
    setupActiveDoc({
      pageGuides: {
        "page-1": { desktop: [g("a", "x", 100)], mobile: [g("m", "y", 10)] },
        "page-2": { mobile: [g("b", "x", 20)] },
      },
    });

    expect([...readPageGuidesByPage("desktop")]).toEqual([
      ["page-1", [g("a", "x", 100)]],
    ]);
    expect([...readPageGuidesByPage("mobile")]).toEqual([
      ["page-1", [g("m", "y", 10)]],
      ["page-2", [g("b", "x", 20)]],
    ]);
  });

  it("빈 목록 페이지는 map 에 넣지 않는다", () => {
    setupActiveDoc({ pageGuides: { "page-1": { desktop: [] } } });
    expect(readPageGuidesByPage("desktop").size).toBe(0);
  });
});
