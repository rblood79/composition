/**
 * ADR-209 후속 F2 §10.1 rollback 프로브 — **과거 빌드 체크아웃에서** 실행한다.
 *
 * 새 빌드(58ccff2cb)의 실제 메뉴 Export(`/private/tmp/adr209-live/project.json`,
 * Series 해제 `color: ""` + data-source envelope)를 이 체크아웃의 **실제** importer ·
 * boot 정규화 · store 액션 · history · 재직렬화에 통과시킨다.
 *
 *   ROLLBACK_IMPORT=accept → 이 빌드의 strict importer 가 envelope 를 받아야 한다
 *   ROLLBACK_IMPORT=reject → 이 빌드의 strict importer 는 envelope 를 거부한다 (실제 오류를 기록)
 *
 * 어느 쪽이든 envelope 를 벗긴 문서는 boot 경로(normalizeMainDocument → setDocument →
 * canonicalDocumentToElements → hydrateProjectSnapshot)로 들어가 편집·Undo·Redo·재저장에서
 * `""` 와 binding 이 보존되고, 미편집 문서는 재직렬화되지 않아야 한다.
 *
 * 실행 절차 (2026-09-10 실측, `docs/adr/design/209-chart-followup-repair-breakdown.md` §10.5):
 *   git checkout --detach 51184c8bd            # 직전 릴리스 (Series 해제 커밋 a2afa2f4f 직전)
 *   cp apps/builder/scripts/adr209-rollback-probe.test.ts \
 *      apps/builder/src/builder/stores/utils/__tests__/adr209RollbackProbe.test.ts
 *   ROLLBACK_IMPORT=accept pnpm -F @composition/builder exec vitest run --reporter=verbose --silent=false \
 *      src/builder/stores/utils/__tests__/adr209RollbackProbe.test.ts
 *   git checkout --detach 31dff0c50            # data-source envelope(baacf782b) 직전 = 구 strict importer
 *   ROLLBACK_IMPORT=reject ... (같은 명령)
 *   rm apps/builder/src/builder/stores/utils/__tests__/adr209RollbackProbe.test.ts && git checkout main
 * 구 트리는 이후 의존성 정리로 사라진 `uuid`·`lodash`(debounce)·`nanoid` 를 import 한다 —
 *   apps/builder/node_modules 에 임시 shim/symlink 를 두고 실행 뒤 지운다 (§10.5 기록).
 * 이 파일은 `scripts/` 에 있어 vitest include(`src/**`)·type-check include(`src`) 밖이다.
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, it } from "vitest";
import {
  deriveProjectRenderModelFromDocument,
  parseProjectData,
  serializeProjectData,
} from "@composition/shared";
import { normalizeMainDocument } from "@/adapters/canonical/mainDocumentNormalization";
import { registerCanonicalMutationStoreActions } from "@/adapters/canonical/canonicalMutations";
import { canonicalDocumentToElements } from "../../canonical/canonicalElementsView";
import {
  PANEL_FIXTURE_PROJECT_ID,
  resetPanelFixture,
} from "../../../__tests__/panelFixture";
import { useStore } from "../../index";
import { useCanonicalDocumentStore } from "../../canonical/canonicalDocumentStore";
import { historyManager } from "../../history";

const EXPORT_PATH = "/private/tmp/adr209-live/project.json";
const MODE = process.env.ROLLBACK_IMPORT ?? "accept";
const raw = readFileSync(EXPORT_PATH, "utf8");
const TAG = `[rollback-probe:${MODE}]`;

type AnyNode = {
  id: string;
  type?: string;
  props?: Record<string, unknown>;
  children?: AnyNode[];
  [key: string]: unknown;
};

function collect(nodes: AnyNode[] | undefined, out: AnyNode[] = []): AnyNode[] {
  for (const node of nodes ?? []) {
    out.push(node);
    collect(node.children, out);
  }
  return out;
}

function chartsOf(doc: { children?: AnyNode[] }): AnyNode[] {
  return collect(doc.children).filter((n) => n.type === "Chart");
}

beforeEach(resetPanelFixture);
afterEach(resetPanelFixture);

it(`${TAG} 새 export envelope 에 대한 이 빌드의 strict importer 결과`, () => {
  const result = parseProjectData(raw);
  if (MODE === "reject") {
    console.log(
      TAG,
      "importer:",
      JSON.stringify({
        success: result.success,
        error: result.success ? null : result.error,
        errors: result.success ? null : result.errors,
      }),
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    const text = JSON.stringify(result.errors ?? result.error);
    expect(text).toMatch(/collections/);
  } else {
    console.log(
      TAG,
      "importer:",
      JSON.stringify({
        success: result.success,
        collections: result.success ? result.data.collections?.length : null,
      }),
    );
    expect(result.success).toBe(true);
  }
});

it(`${TAG} envelope 를 벗긴 문서는 boot 정규화·편집·Undo·Redo·재저장에서 \`""\` 와 binding 을 보존한다`, async () => {
  const json = JSON.parse(raw) as Record<string, unknown>;
  const stripped = { ...json };
  delete stripped.collections;
  delete stripped.apiEndpoints;
  const parsed = parseProjectData(JSON.stringify(stripped));
  expect(parsed.success).toBe(true);
  if (!parsed.success) return;

  const doc = parsed.data.document;
  const originalCharts = chartsOf(doc as { children?: AnyNode[] });
  expect(originalCharts.length).toBeGreaterThan(0);
  for (const chart of originalCharts) {
    expect(Object.hasOwn(chart.props ?? {}, "color")).toBe(true);
    expect(chart.props?.color).toBe("");
  }
  const originalBinding = originalCharts[0].props?.dataBinding;
  expect(originalBinding).toBeTruthy();

  // ── boot 정규화: persist-back 은 `document !== persistedDocument` 일 때만 일어난다.
  //    달라지면 어느 경로가 달라지는지 그대로 기록한다 (판정은 evidence 에서).
  const normalized = normalizeMainDocument(doc);
  const identity = normalized === doc;
  const sameJson = JSON.stringify(normalized) === JSON.stringify(doc);
  const diffs: string[] = [];
  const walk = (a: unknown, b: unknown, path: string) => {
    if (diffs.length >= 40) return;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length)
        diffs.push(`${path}.length ${a.length}→${b.length}`);
      const n = Math.min(a.length, b.length);
      for (let i = 0; i < n; i++) walk(a[i], b[i], `${path}[${i}]`);
      return;
    }
    if (a && b && typeof a === "object" && typeof b === "object") {
      const keys = new Set([
        ...Object.keys(a as object),
        ...Object.keys(b as object),
      ]);
      for (const k of keys)
        walk(
          (a as Record<string, unknown>)[k],
          (b as Record<string, unknown>)[k],
          `${path}.${k}`,
        );
      return;
    }
    if (JSON.stringify(a) !== JSON.stringify(b))
      diffs.push(
        `${path}: ${JSON.stringify(a)?.slice(0, 80)} → ${JSON.stringify(b)?.slice(0, 80)}`,
      );
  };
  walk(doc, normalized, "doc");
  console.log(TAG, "normalize:", JSON.stringify({ identity, sameJson, diffs }));

  // ── boot 경로 그대로 store 에 싣는다.
  registerCanonicalMutationStoreActions({
    getCurrentProjectId: () => PANEL_FIXTURE_PROJECT_ID,
    getCurrentLegacySnapshot: () => ({
      elements: useStore.getState().elements,
      pages: [],
      layouts: [],
    }),
  });
  const canonical = useCanonicalDocumentStore.getState();
  canonical.setCurrentProject(PANEL_FIXTURE_PROJECT_ID);
  canonical.setDocument(PANEL_FIXTURE_PROJECT_ID, normalized);
  const elements = canonicalDocumentToElements(normalized);
  useStore.getState().hydrateProjectSnapshot(elements as never);
  const pageId =
    parsed.data.currentPageId ??
    (
      elements.find((e) => (e as { page_id?: string }).page_id) as
        { page_id?: string } | undefined
    )?.page_id ??
    "page-1";
  historyManager.setCurrentPage(pageId);
  useStore.setState({ currentPageId: pageId } as never);

  const chartId = originalCharts[0].id;
  const legacy = useStore.getState().elementsMap.get(chartId);
  expect(legacy).toBeTruthy();
  console.log(
    TAG,
    "hydrated legacy chart props:",
    JSON.stringify({
      color: legacy?.props.color,
      hasColor: Object.hasOwn(legacy?.props ?? {}, "color"),
      dataBinding: legacy?.props.dataBinding,
      chartType: legacy?.props.chartType,
    }),
  );
  expect(legacy?.props.color).toBe("");

  const read = () =>
    useCanonicalDocumentStore.getState().getDocument(PANEL_FIXTURE_PROJECT_ID)!;
  const resolved = () =>
    deriveProjectRenderModelFromDocument(
      read(),
      PANEL_FIXTURE_PROJECT_ID,
      pageId,
    ).elements.find((e) => e.id === chartId)!.props as Record<string, unknown>;
  const before = resolved();
  const originalShowGrid = before.showGrid;

  // ── 실제 inspector 경로로 편집
  useStore.getState().setSelectedElement(chartId);
  useStore.getState().updateSelectedProperties({ showGrid: !originalShowGrid });
  await new Promise((r) => setTimeout(r, 20));
  const edited = resolved();
  console.log(
    TAG,
    "edited:",
    JSON.stringify({
      showGrid: edited.showGrid,
      color: edited.color,
      hasColor: Object.hasOwn(edited, "color"),
      dataBinding: edited.dataBinding,
    }),
  );
  expect(edited.showGrid).toBe(!originalShowGrid);
  expect(edited.color).toBe("");
  expect(Object.hasOwn(edited, "color")).toBe(true);
  expect(edited.dataBinding).toEqual(originalBinding);

  await useStore.getState().undo();
  const undone = resolved();
  console.log(
    TAG,
    "undo:",
    JSON.stringify({ showGrid: undone.showGrid, color: undone.color }),
  );
  expect(undone.showGrid).toBe(originalShowGrid);
  expect(undone.color).toBe("");

  await useStore.getState().redo();
  const redone = resolved();
  console.log(
    TAG,
    "redo:",
    JSON.stringify({ showGrid: redone.showGrid, color: redone.color }),
  );
  expect(redone.showGrid).toBe(!originalShowGrid);
  expect(redone.color).toBe("");

  // ── 이 빌드의 serialize → parse 재저장
  const saved = parseProjectData(
    serializeProjectData(
      "00000000-0000-0000-0000-000000000209",
      "Charts",
      read(),
      pageId,
    ),
  );
  if (!saved.success)
    console.log(
      TAG,
      "resave error:",
      JSON.stringify(saved.error),
      JSON.stringify(saved.errors),
    );
  expect(saved.success).toBe(true);
  if (!saved.success) return;
  const savedCharts = chartsOf(saved.data.document as { children?: AnyNode[] });
  console.log(
    TAG,
    "resaved charts:",
    JSON.stringify(
      savedCharts.map((c) => ({
        id: c.id,
        color: c.props?.color,
        hasColor: Object.hasOwn(c.props ?? {}, "color"),
        dataBinding: c.props?.dataBinding,
        showGrid: c.props?.showGrid,
      })),
    ),
  );
  expect(savedCharts.length).toBe(originalCharts.length);
  for (const chart of savedCharts) {
    expect(Object.hasOwn(chart.props ?? {}, "color")).toBe(true);
    expect(chart.props?.color).toBe("");
  }
  expect(savedCharts[0].props?.dataBinding).toEqual(originalBinding);

  // ── 편집하지 않은 노드는 바이트 단위로 같아야 한다 (강제 재직렬화 0)
  const originalOthers = collect(
    (doc as { children?: AnyNode[] }).children,
  ).filter((n) => n.type !== "Chart");
  const savedById = new Map(
    collect(saved.data.document.children as AnyNode[]).map((n) => [n.id, n]),
  );
  let unchanged = 0;
  let changed: string[] = [];
  for (const node of originalOthers) {
    const after = savedById.get(node.id);
    const { children: _a, ...restBefore } = node;
    const { children: _b, ...restAfter } = after ?? ({} as AnyNode);
    if (JSON.stringify(restBefore) === JSON.stringify(restAfter)) unchanged++;
    else changed.push(`${node.type}:${node.id}`);
  }
  console.log(TAG, "untouched nodes:", JSON.stringify({ unchanged, changed }));
  expect(changed).toEqual([]);
});
