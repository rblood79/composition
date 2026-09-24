/**
 * ADR-013 Quick Connect — Properties Data 행에서 연 Creator 의 **연결 대상** 처리.
 *
 * 세 단계가 같은 두 자리 (`props.dataBinding` · `x-composition.dataBinding`) 를 본다:
 * 1. `captureQuickConnectTarget` — 진입 시점에 element/page/project 식별자와 바인딩 스냅샷을
 *    직렬화 가능한 값으로 캡처 (요소 객체 · 콜백 보관 0).
 * 2. `precheckQuickConnectTarget` — 실행 직전. 대상이 없어졌거나 (삭제) 다른 페이지/프로젝트
 *    문맥이거나 그 사이 바인딩이 바뀌었으면 **무변경 중단** 사유를 돌려준다. 비동기 저장 뒤의
 *    같은 검사는 적용기 `expectBindings` 가 commit 경계에서 한다.
 * 3. `readBackQuickConnect` — 성공 판정. 원래 대상의 `props.dataBinding.collectionId` 가 새
 *    collection 이고 extension 바인딩이 비었는지 확인한 뒤에만 성공을 알린다.
 *
 * 선택이 바뀌어도 대상은 캡처된 요소다 — 현재 선택 요소로 갈아타지 않는다 (HC2).
 */
import { useStore } from "../../../stores";
import { useDataStore } from "../../../stores/data";
import { useCanonicalDocumentStore } from "../../../stores/canonical/canonicalDocumentStore";
import {
  readDataBindingSnapshot,
  type DataChangeHistoryPayload,
} from "../../../stores/utils/dataChange";
import { historyManager } from "../../../stores/history";
import {
  buildCanonicalInsertEvents,
  buildCanonicalRemoveEvents,
  buildCanonicalReplaceEvents,
  captureCanonicalReplaceSources,
  type CanonicalHistoryNodeEvent,
} from "../../../stores/history/canonicalHistoryEvents";
import { runCanonicalMutation } from "@/adapters/canonical/canonicalMutationRunner";
import {
  mergeElementsCanonicalPrimary,
  updateCanonicalNodeFromElementPrimary,
} from "@/adapters/canonical/canonicalMutations";
import { COMPONENT_DESCENDANTS_MIRROR_FIELD } from "@/adapters/canonical/componentSemanticsMirror";
import { getActiveCanonicalDocument } from "../../../stores/canonical/canonicalElementsBridge";
import {
  indexNodes,
  resolveChainEnd,
} from "../../../components/staticCollectionMigration";
import {
  planTableColumnInsert,
  readTableHeaderColumns,
  resolveTableHeaderHostId,
  type TableColumnSpec,
} from "../../../components/tableColumnInsert";
import { ElementUtils } from "../../../../utils/element/elementUtils";
import { generateCustomId } from "../../../utils/idGeneration";
import type { Element } from "../../../../types/core/store.types";
import type {
  DataField,
  DataTable,
  DataTableCreate,
} from "../../../../types/builder/data.types";
import type { QuickConnectTarget } from "../types/editorTypes";

export type QuickConnectPrecheck =
  | { ok: true }
  | { ok: false; reason: "missing" | "context" | "binding-changed" };

function sameSnapshot(
  a: { props?: unknown; extension?: unknown },
  b: { props?: unknown; extension?: unknown },
): boolean {
  return (
    JSON.stringify(a.props ?? null) === JSON.stringify(b.props ?? null) &&
    JSON.stringify(a.extension ?? null) === JSON.stringify(b.extension ?? null)
  );
}

export function captureQuickConnectTarget(
  elementId: string,
): QuickConnectTarget | null {
  const element = useStore.getState().elementsMap.get(elementId);
  if (!element) return null;
  const binding = readDataBindingSnapshot(elementId);
  if (!binding) return null;
  return {
    elementId,
    pageId: element.page_id ?? null,
    elementType: element.type,
    elementLabel:
      typeof element.customId === "string" && element.customId.length > 0
        ? element.customId
        : element.type,
    binding: { props: binding.props, extension: binding.extension },
  };
}

export function precheckQuickConnectTarget(
  target: QuickConnectTarget,
  projectId: string,
): QuickConnectPrecheck {
  const element = useStore.getState().elementsMap.get(target.elementId);
  if (!element) return { ok: false, reason: "missing" };
  if ((element.page_id ?? null) !== target.pageId)
    return { ok: false, reason: "context" };
  if (useCanonicalDocumentStore.getState().currentProjectId !== projectId)
    return { ok: false, reason: "context" };
  const current = readDataBindingSnapshot(target.elementId);
  if (!current) return { ok: false, reason: "missing" };
  if (!sameSnapshot(current, target.binding))
    return { ok: false, reason: "binding-changed" };
  return { ok: true };
}

/** 성공 read-back — props 가 새 collection 을 가리키고 extension 바인딩은 비어 있어야 한다. */
export function readBackQuickConnect(
  elementId: string,
  collectionId: string,
): boolean {
  const current = readDataBindingSnapshot(elementId);
  if (!current) return false;
  const props = current.props as { collectionId?: unknown } | undefined;
  return (
    props?.collectionId === collectionId && current.extension === undefined
  );
}

// ============================================
// Table 컬럼 (ADR-013 Phase 2 · breakdown §4)
// ============================================

export interface TableColumnPlan {
  tableId: string;
  /** plain Table 의 TableHeader id · ref instance 는 `<instance>/<origin 안 경로>` (ADR-241) */
  tableHeaderId: string;
  pageId: string | null;
  /** 기존 Column 자식 — 순서 그대로 (instance 는 자기 열 · 없으면 origin 열) */
  existing: { id: string; key: string; label: string }[];
  /** ADR-241 Phase 2 — ref instance Table: 열은 instance 자기 열 (`descendants` mode C) 로 쓴다 */
  instance?: boolean;
}

/**
 * Table 의 컬럼 계획. 직접 Table 노드는 TableHeader 자식으로, ref instance (팔레트로 놓은 Table — ADR-228) 는 instance
 * 자기 열 (`descendants[TableHeader 경로].children`) 로 쓴다 — 공유 origin 은 수정하지 않는다 (§3, ADR-241 Phase 2).
 * TableHeader 가 없으면 null (바인딩만).
 */
export function planTableColumns(
  target: QuickConnectTarget,
): TableColumnPlan | null {
  if (target.elementType === "ref") return planInstanceTableColumns(target);
  if (target.elementType !== "Table") return null;
  const elements = useStore.getState().elements;
  const header = elements.find(
    (e) => e.parent_id === target.elementId && e.type === "TableHeader",
  );
  if (!header) return null;
  const existing = elements
    .filter((e) => e.parent_id === header.id && e.type === "Column")
    .map((e) => ({
      id: e.id,
      key: String(e.props?.key ?? ""),
      label: String(e.props?.label ?? e.props?.children ?? e.props?.key ?? ""),
    }));
  return {
    tableId: target.elementId,
    tableHeaderId: header.id,
    pageId: target.pageId,
    existing,
  };
}

function planInstanceTableColumns(
  target: QuickConnectTarget,
): TableColumnPlan | null {
  const document = getActiveCanonicalDocument();
  if (!document) return null;
  const byId = indexNodes(document);
  const instance = byId.get(target.elementId) as
    { type: string; ref?: string } | undefined;
  if (instance?.type !== "ref") return null;
  if (String(resolveChainEnd(instance.ref, byId)?.type) !== "Table") {
    return null;
  }
  const hostId = resolveTableHeaderHostId(document, target.elementId);
  const existing = hostId ? readTableHeaderColumns(document, hostId) : null;
  if (!hostId || !existing) return null;
  return {
    tableId: target.elementId,
    tableHeaderId: hostId,
    pageId: target.pageId,
    existing,
    instance: true,
  };
}

/** schema → 열 spec (plain 경로 `buildColumnElements` 와 같은 props). */
function schemaColumnSpecs(schema: readonly DataField[]): TableColumnSpec[] {
  return schema.map((field) => {
    const label = field.label ?? field.key;
    return {
      key: field.key,
      label,
      props: {
        label,
        allowsSorting: true,
        enableResizing: true,
        width: 150,
        align: "left",
      },
    };
  });
}

/** instance 자기 열 쓰기 — history 는 여기서 만들지 않는다 (호출자가 data entry 에 replace event 로 싣는다). */
function writeInstanceElement(next: Element): void {
  runCanonicalMutation({
    canonical: () => updateCanonicalNodeFromElementPrimary(next),
    store: () => {
      useStore.setState((prev) => ({
        elements: prev.elements.map((e) => (e.id === next.id ? next : e)),
        layoutVersion: prev.layoutVersion + 1,
      }));
    },
    history: {
      skip: "ADR-241 — instance 열은 생성+연결 data entry 하나에 canonicalEvents 로 실린다",
    },
  });
}

/** 기존 컬럼 중 새 schema 에 같은 key 가 없는 것 — 실행 전에 사용자에게 보인다 (§4 재연결). */
export function unmatchedColumnKeys(
  plan: TableColumnPlan,
  schema: readonly Pick<DataField, "key">[],
): string[] {
  const keys = new Set(schema.map((f) => f.key));
  return plan.existing.filter((c) => !keys.has(c.key)).map((c) => c.key);
}

/** schema → Column 노드 (Preview ingress `ADD_COLUMN_ELEMENTS` 가 만드는 것과 같은 props 형상). */
function buildColumnElements(
  plan: TableColumnPlan,
  schema: readonly DataField[],
): Element[] {
  const all = [...useStore.getState().elements];
  const stamp = new Date().toISOString();
  return schema.map((field) => {
    const label = field.label ?? field.key;
    const column: Element = {
      id: ElementUtils.generateId(),
      customId: generateCustomId("Column", all),
      type: "Column",
      parent_id: plan.tableHeaderId,
      page_id: plan.pageId,
      props: {
        key: field.key,
        label,
        children: label,
        allowsSorting: true,
        enableResizing: true,
        width: 150,
        align: "left",
      },
      created_at: stamp,
      updated_at: stamp,
    };
    all.push(column);
    return column;
  });
}

/** Column 노드 삽입 — history 는 여기서 만들지 않는다 (호출자가 data entry 에 같이 싣는다). */
function insertColumns(columns: Element[]): CanonicalHistoryNodeEvent[] {
  if (columns.length === 0) return [];
  runCanonicalMutation({
    canonical: () => mergeElementsCanonicalPrimary(columns),
    store: () => {
      useStore.setState((prev) => ({
        elements: [...prev.elements, ...columns],
        layoutVersion: prev.layoutVersion + 1,
      }));
    },
    history: {
      skip: "ADR-013 — Table Column 삽입은 생성+연결 data entry 하나에 canonicalEvents 로 실린다",
    },
  });
  return buildCanonicalInsertEvents(columns);
}

export type QuickConnectColumnMode = "none" | "create" | "preserve" | "replace";

export function resolveColumnMode(
  plan: TableColumnPlan | null,
  replaceColumns: boolean,
): QuickConnectColumnMode {
  if (!plan) return "none";
  if (plan.existing.length === 0) return "create";
  return replaceColumns ? "replace" : "preserve";
}

export interface ExecuteQuickConnectInput {
  input: DataTableCreate;
  target: QuickConnectTarget;
  projectId: string;
  /** Table 재연결 — 기존 컬럼을 새 schema 로 전면 교체 (명시적 선택일 때만 true) */
  replaceColumns?: boolean;
}

/**
 * 생성 + 연결 (+ Table 컬럼) 을 **한 사용자 실행 · History entry 1** 로.
 *
 * 순서 — ① 컬럼 (canonical, history 0) → ② `applyDataChange` (`create_collection` 사전 UUID +
 * `bind_element`, `record:false`, `expectBindings`) → ③ `type:"data"` entry 에 dataChangeEvent +
 * canonicalEvents. 컬럼을 **먼저** 넣는 이유: 바인딩이 먼저 Preview 에 닿으면 Column 0 인
 * Table 이 `onColumnsDetected` 로 `ADD_COLUMN_ELEMENTS` 를 보내 Builder 컬럼과 중복될 수 있다
 * (§4 늦은 ingress). 컬럼 있는 문서가 먼저 가면 감지 자체가 없다. ② 가 실패하면 ① 을 되돌린다
 * (삽입 제거 · 제거 복원) — 실패를 성공으로 알리지 않는다 (HC4 · R4).
 */
export async function executeQuickConnect({
  input,
  target,
  projectId,
  replaceColumns = false,
}: ExecuteQuickConnectInput): Promise<DataTable> {
  const plan = planTableColumns(target);
  const mode = resolveColumnMode(plan, replaceColumns);
  const schema = (input.schema ?? []) as DataField[];

  // ① 컬럼
  const canonicalEvents: CanonicalHistoryNodeEvent[] = [];
  let inserted: Element[] = [];
  let removed: Element[] = [];
  // ADR-241 Phase 2 — ref instance: 자기 열 (mode C) 을 쓰고 replace event 쌍을 data entry 에 싣는다. event 는 바인딩
  //   **뒤** 현재 문서에서 만든다 (post-mutation 모드) — 열 쓰기 직후 스냅샷을 쓰면 redo 가 그 노드 (바인딩 전) 를 다시
  //   넣어 바인딩을 지운다 (live 실측).
  let instanceBefore: Element | null = null;
  let instanceNext: Element | null = null;
  let instanceCaptures: ReturnType<
    typeof captureCanonicalReplaceSources
  > | null = null;
  if (plan?.instance && (mode === "create" || mode === "replace")) {
    const document = getActiveCanonicalDocument();
    const columnPlan = document
      ? planTableColumnInsert({
          document,
          hostId: plan.tableHeaderId,
          columns: schemaColumnSpecs(schema),
          replace: mode === "replace",
        })
      : null;
    const before = useStore.getState().elementsMap.get(plan.tableId);
    if (columnPlan?.kind === "instance" && before) {
      const captures = captureCanonicalReplaceSources([plan.tableId]);
      const next = {
        ...before,
        [COMPONENT_DESCENDANTS_MIRROR_FIELD]: columnPlan.descendants,
      } as Element;
      writeInstanceElement(next);
      instanceBefore = before;
      instanceNext = next;
      instanceCaptures = captures;
    }
  } else if (plan && (mode === "create" || mode === "replace")) {
    if (mode === "replace") {
      const elements = useStore.getState().elements;
      removed = plan.existing
        .map((c) => elements.find((e) => e.id === c.id))
        .filter((e): e is Element => Boolean(e));
      // undo 는 이벤트를 역순 재생 (remove ↔ insert) — 형제 전부를 지울 때 index 내림차순으로
      // 적어 두어야 되돌릴 때 0, 1, 2… 순으로 다시 들어가 컬럼 순서가 보존된다.
      const removeEvents = buildCanonicalRemoveEvents(removed, removed).sort(
        (a, b) =>
          (b.type === "remove" ? b.index : 0) -
          (a.type === "remove" ? a.index : 0),
      );
      canonicalEvents.push(...removeEvents);
      await useStore.getState().removeElements(
        removed.map((e) => e.id),
        { skipHistory: true },
      );
    }
    inserted = buildColumnElements(plan, schema);
    canonicalEvents.push(...insertColumns(inserted));
  }

  // ② collection + 바인딩
  const collectionId = crypto.randomUUID();
  let result: Awaited<
    ReturnType<ReturnType<typeof useDataStore.getState>["applyDataChange"]>
  >;
  try {
    result = await useDataStore.getState().applyDataChange(
      {
        ops: [
          {
            op: "create_collection",
            id: collectionId,
            projectId: input.project_id,
            name: input.name,
            schema,
            rows: input.mockData ?? [],
            source: (input.useMockData ?? true) ? "manual" : "api",
          },
          { op: "bind_element", elementId: target.elementId, collectionId },
        ],
        origin: "user",
      },
      {
        record: false,
        projectId,
        expectBindings: { [target.elementId]: target.binding },
      },
    );
  } catch (error) {
    // ① 되돌리기 — instance 자기 열 원복 · 삽입 제거 · 제거 복원 (history 0)
    if (instanceBefore) writeInstanceElement(instanceBefore);
    if (inserted.length > 0) {
      await useStore.getState().removeElements(
        inserted.map((e) => e.id),
        { skipHistory: true },
      );
    }
    if (removed.length > 0) insertColumns(removed);
    throw error;
  }

  if (instanceBefore && instanceNext && instanceCaptures) {
    canonicalEvents.push(
      ...buildCanonicalReplaceEvents(
        [instanceBefore],
        [instanceNext],
        instanceCaptures,
      ),
    );
  }

  // ③ History entry 1 — 두 축
  const payload: DataChangeHistoryPayload = {
    change: { ops: result.applied, origin: "user" },
    inverse: result.inverse,
  };
  historyManager.addEntry({
    type: "data",
    elementId: target.elementId,
    elementIds: [
      collectionId,
      target.elementId,
      ...inserted.map((e) => e.id),
      ...removed.map((e) => e.id),
    ],
    data: {
      dataChangeEvent: payload,
      ...(canonicalEvents.length > 0 ? { canonicalEvents } : {}),
    },
  });

  const created = useDataStore.getState().collections.get(collectionId);
  if (!created)
    throw new Error("생성된 collection 을 store 에서 찾을 수 없습니다");
  return created;
}
