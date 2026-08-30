import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("historyActions canonical compatibility sync contract", () => {
  it("uses active canonical document traversal before legacy store map for cloud compatibility upsert", async () => {
    const source = await readFile(
      resolve(__dirname, "historyActions.ts"),
      "utf-8",
    );

    expect(source).toContain("visitCanonicalDocumentElements");
    expect(source).toContain("getActiveCanonicalHistoryElements");
    expect(source).toContain("function getHistorySourceElements");
    expect(source).toContain("type HistoryCompatibilityElementMap");
    expect(source).not.toContain("canonicalElementSnapshot");
    expect(source).toContain("getHistoryCompatibilityElementsMap(get)");
    expect(source).toContain(
      "getActiveCanonicalHistoryElements() ?? legacyElements",
    );
    expect(source).toContain("applySerializedHistoryDiff");
    expect(source).toContain("applySerializedHistoryDiffs");
    expect(source).toContain("entry.data.diff");
    expect(source).toContain("entry.data.diffs");
    expect(source).toContain("syncHistoryElementsToCanonical(updatedElements)");
    expect(source).not.toContain(
      "syncHistoryElementsToCanonical(get().elements)",
    );
    const staleMapLookup = ["get()", "elementsMap"].join(".");
    expect(source).not.toContain(`const elementsMap = ${staleMapLookup};`);
    expect(source).not.toContain(staleMapLookup);
    expect(source).not.toContain(
      "function getHistoryCompatibilityElementsMap(\n  get: GetState,\n): Map<string, Element>",
    );
  });

  it("HC#2: legacy fallback 의 canonical sync 가 set() 보다 선행 (undo/redo/goToIndex 3곳)", async () => {
    const source = await readFile(
      resolve(__dirname, "historyActions.ts"),
      "utf-8",
    );

    // sync 호출 (정의 제외) 이 3곳 존재
    const syncCalls = [
      ...source.matchAll(/syncHistoryElementsToCanonical\(updatedElements\)/g),
    ];
    expect(syncCalls).toHaveLength(3);

    // 각 sync 호출 직후 canonical 재파생 → 그 다음에야 set({ elements 등장
    // (sync 가 set 보다 뒤면 위반 — HC#2 canonical 1차 계약)
    for (const match of syncCalls) {
      const after = source.slice(
        match.index,
        source.indexOf("set({", match.index),
      );
      expect(after).toContain(
        "getActiveCanonicalHistoryElements() ?? updatedElements",
      );
    }

    // 과거 위반 패턴 (set 이후 sync) 부재: set({...}) 뒤 30줄 안에 sync 없음
    const setBlocks = [
      ...source.matchAll(/set\(\{\s*\n\s*elements: updatedElements,/g),
    ];
    expect(setBlocks.length).toBeGreaterThanOrEqual(3);
    for (const block of setBlocks) {
      const windowAfter = source
        .slice(block.index)
        .split("\n")
        .slice(0, 30)
        .join("\n");
      expect(windowAfter).not.toContain("syncHistoryElementsToCanonical");
    }
  });
});

describe("ADR-177: page-position entry 소비 분기 (element 노드 경로 미진입 계약)", () => {
  it("undo/redo/goToIndex 3 진입점 + syncDatabaseForEntries 에 page-position 분기 존재", async () => {
    const source = await readFile(
      resolve(__dirname, "historyActions.ts"),
      "utf-8",
    );

    // 적용 헬퍼 정의 (스토어 스냅샷 + canonical setPagePositions + persist)
    expect(source).toContain("function applyPagePositionHistoryEntry");
    expect(source).toContain(".setPagePositions(");

    // 진입점 분기 — undo/redo 는 early-return, goToIndex 는 continue,
    // syncDatabaseForEntries 는 skip. 최소 4곳.
    const branches = [...source.matchAll(/entry\.type === "page-position"/g)];
    expect(branches.length).toBeGreaterThanOrEqual(4);

    // undo/redo early-branch 는 element 경로 진입 전 (historyManager.undo/redo
    // 획득 직후 30줄 안)에 있어야 한다.
    for (const acquire of ["historyManager.undo()", "historyManager.redo()"]) {
      const idx = source.indexOf(acquire);
      expect(idx).toBeGreaterThan(-1);
      const windowAfter = source.slice(idx).split("\n").slice(0, 30).join("\n");
      expect(windowAfter).toContain('entry.type === "page-position"');
      expect(windowAfter).toContain("applyPagePositionHistoryEntry");
    }
  });
});

describe("ADR-180: snapshot-restore entry 소비 분기 (문서 전체 교체 계약)", () => {
  it("undo/redo/goToIndex 3 진입점 + syncDatabaseForEntries 에 snapshot-restore 분기 존재", async () => {
    const source = await readFile(
      resolve(__dirname, "historyActions.ts"),
      "utf-8",
    );

    expect(source).toContain("applySnapshotRestoreHistoryEntry");

    // 진입점 분기 — undo/redo 는 early-return, goToIndex 는 store 재취득 후
    // continue, syncDatabaseForEntries 는 skip. 최소 4곳.
    const branches = [
      ...source.matchAll(/entry\.type === "snapshot-restore"/g),
    ];
    expect(branches.length).toBeGreaterThanOrEqual(4);

    // undo/redo early-branch 는 element 경로 진입 전 (page-position 분기 직후)
    for (const acquire of ["historyManager.undo()", "historyManager.redo()"]) {
      const idx = source.indexOf(acquire);
      expect(idx).toBeGreaterThan(-1);
      const windowAfter = source.slice(idx).split("\n").slice(0, 40).join("\n");
      expect(windowAfter).toContain('entry.type === "snapshot-restore"');
      expect(windowAfter).toContain("applySnapshotRestoreHistoryEntry");
    }
  });

  it("snapshotRestore.ts — 복원 시퀀스 계약 (boot hydrate 동형 + allowShrink + 순환 차단)", async () => {
    const source = await readFile(
      resolve(__dirname, "snapshotRestore.ts"),
      "utf-8",
    );

    // canonical 1차 → mirror 재파생 → 페이지 위치 → 페이지 재정합 조립 심볼
    // (usePageManager boot hydrate 동형 — G2 근거)
    expect(source).toContain(".setDocument(projectId, docCopy)");
    expect(source).toContain("deriveProjectEditorPageModelFromDocument");
    expect(source).toContain("hydrateProjectSnapshot");
    expect(source).toContain("initializePagePositions");
    expect(source).toContain("setPages(storePages)");
    expect(source).toContain("activatePage");

    // 복원 persist 는 의도된 문서 교체 — 급감 가드 명시 escape + 출처 기록
    expect(source).toContain("allowShrink: true");
    expect(source).toContain('reason: "snapshot-restore"');

    // R4 — 타 페이지 히스토리 clear / entry 는 스냅샷 참조 id 만 (직렬화 본 금지)
    // clear 는 프로젝트 페이지 전수 (복원 전/후 합집합) 전달 — 메모리 로드
    // 페이지만 지우면 lazy 미로드 페이지의 IndexedDB 잔존분이 재방문 시 부활
    // (2026-08-13 live 실측)
    expect(source).toContain("clearOtherPageHistories(currentPageId, [");
    expect(source).toContain("const prevPageIds");
    expect(source).toContain("beforeSnapshotId: before.id");

    // 순환 차단 — useStore 직접 import 금지 (get 주입 계약, ADR-116 G6-2 축)
    expect(source).not.toContain('from "../index"');
    expect(source).not.toContain("import { useStore }");
  });
});

/**
 * ADR-181 §2 C4 — 비-element 히스토리 kind 의 소비 지점은 **6곳**이다.
 *
 * 초안은 "undo/redo/goToIndex 3 진입점" 으로 잡았으나 `page-position`/
 * `snapshot-restore` 두 전례의 실측이 6곳이었다. 6곳은 파일 3개에 흩어져 있고
 * 그중 타입 시스템이 잡아 주는 것은 패널 아이콘 맵(Record 완전성) 하나뿐이라,
 * 나머지 5곳을 여기서 정적으로 고정한다.
 */
describe("ADR-181: page-guide entry 소비 지점 6곳 (C4 커버리지)", () => {
  const readSource = (relativePath: string) =>
    readFile(resolve(__dirname, relativePath), "utf-8");

  it("C4 #1~#3 — undo/redo/goToIndex early-branch (element 경로 진입 전)", async () => {
    const source = await readSource("historyActions.ts");

    expect(source).toContain("function applyPageGuideHistoryEntry");
    expect(source).toContain(".setPageGuides(");

    // undo/redo 는 early-return, goToIndex 는 continue, syncDatabaseForEntries
    // 는 skip — 최소 4곳
    const branches = [...source.matchAll(/entry\.type === "page-guide"/g)];
    expect(branches.length).toBeGreaterThanOrEqual(4);

    // undo/redo 분기는 entry 획득 직후 40줄 안 (page-position/snapshot-restore
    // 분기와 같은 구역) — element 경로보다 뒤로 밀리면 legacy fallback 진입
    for (const acquire of ["historyManager.undo()", "historyManager.redo()"]) {
      const idx = source.indexOf(acquire);
      expect(idx).toBeGreaterThan(-1);
      const windowAfter = source.slice(idx).split("\n").slice(0, 40).join("\n");
      expect(windowAfter).toContain('entry.type === "page-guide"');
      expect(windowAfter).toContain("applyPageGuideHistoryEntry");
    }

    // goToIndex 루프 분기 — 적용 후 continue (element 누적 경로 미진입)
    expect(source).toContain(
      'if (entry.type === "page-guide") {\n          applyPageGuideHistoryEntry(get, entry, direction);\n          continue;\n        }',
    );
  });

  it("C4 #4 — syncDatabaseForEntries skip (elementId=pageId 오인 차단)", async () => {
    const source = await readSource("historyActions.ts");
    expect(source).toContain('if (entry.type === "page-guide") continue;');
  });

  it("C4 #5 — addEntry DEV guard 면제 (비-element 축은 canonicalEvents 없음이 정상)", async () => {
    const source = await readSource("../history.ts");
    expect(source).toContain('entry.type !== "page-guide"');
    // 면제 3종이 한 조건에 모여 있어야 한다 (하나만 빠지면 콘솔 경고 오탐)
    const guardIdx = source.indexOf("import.meta.env?.DEV &&");
    expect(guardIdx).toBeGreaterThan(-1);
    const guardBlock = source.slice(guardIdx, guardIdx + 400);
    for (const kind of ["page-position", "page-guide", "snapshot-restore"]) {
      expect(guardBlock).toContain(`entry.type !== "${kind}"`);
    }
  });

  it("C4 #6 — 패널 라벨/아이콘 (라벨 없는 entry 방지)", async () => {
    const label = await readSource("../../panels/history/historyEntryLabel.ts");
    expect(label).toContain('case "page-guide"');
    // 목록 전체 교체라 길이 차로 생성/삭제/이동을 가른다. 문구 자체는
    // 카탈로그가 고르므로 (ADR-200) 여기서는 세 갈래의 키를 고정한다.
    expect(label).toContain("history.entryGuideAdd");
    expect(label).toContain("history.entryGuideRemove");
    expect(label).toContain("history.entryGuideMove");

    const panel = await readSource("../../panels/history/HistoryPanel.tsx");
    // ENTRY_TYPE_ICONS 는 Record<HistoryEntry["type"], LucideIcon> 이라 누락 시
    // type-check 가 먼저 잡지만, 아이콘 선택 자체를 계약으로 고정한다.
    // 2026-08-16: 눈금자 아이콘은 `ACTION_ICONS.toggleRulers` 정본 경유로 바뀌었다
    // (`config/actionIcons.ts`) — 컨텍스트 메뉴·Settings 패널과 한 소스를 읽는다.
    // 여기서 확인할 것은 "가이드 entry 가 눈금자 그림을 쓴다" 이지 특정 lucide
    // 심볼명이 아니므로, 정본 키로 고정한다.
    expect(panel).toContain('"page-guide": ACTION_ICONS.toggleRulers');
  });

  it("C11 — 가이드 무효화는 overlay 만 (content surface 미관여)", async () => {
    const canvas = await readSource(
      "../../workspace/canvas/skia/SkiaCanvas.tsx",
    );
    const idx = canvas.indexOf("subscribePageGuideRevision(");
    expect(idx).toBeGreaterThan(-1);
    const block = canvas.slice(idx, canvas.indexOf("}, []);", idx));
    expect(block).toContain("overlayVersionRef.current++");
    // pagePositionPresentation 구독과 갈리는 지점 — content 는 그대로다
    expect(block).not.toContain("invalidateContent");
  });
});
