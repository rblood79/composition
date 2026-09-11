/**
 * DATA_COMMAND_META — `data.*` agent 명령의 정적 metadata 표 (ADR-213 Phase 5, AX-4).
 *
 * ADR-196 `COMMAND_META` 와 같은 세 층 분리 (정의 · 정적 사실 · adapter) 를 따르되 id 축이
 * 다르다 — 이 넷은 키보드 단축키가 아니라 `ShortcutId` 표 (allowlist 40, HC2 상한) 에
 * 들어가지 않고 별도 표를 둔다. executor (`executeAgentCommand`) 가 두 표를 같은 게이트
 * (allowlist → precondition → confirm → adapter → 기록) 로 지난다.
 *
 * - precondition 은 사람 경로의 앞단 조건 그대로: 프로젝트 로드 (데이터 store 초기화) ·
 *   대상 collection/endpoint 존재 (id 또는 이름) · `importPaste` 는 본문이 있어야 한다.
 * - `importPaste` 의 승인은 executor 게이트가 아니라 데이터 proposal dispatcher 가 묻는다
 *   (`data.propose` diff 다이얼로그 — 스키마 · 샘플 행이 보인다). 그래서 `confirm:false`,
 *   `provenance:"dispatcher"` (기록 1건은 dispatcher 가 남긴다 — 호출 1건 = 기록 1건).
 * - `runEndpoint` 는 정의된 요청을 실제로 내보낸다 — GET 은 사람의 Test 버튼과 같이 승인
 *   없이, 그 밖의 method (POST/PUT/PATCH/DELETE) 는 바깥 상태를 바꿀 수 있어 승인을 묻는다
 *   (breakdown 의 "importPaste 만 confirm" 에서 한 칸 보수적으로).
 */
import type {
  JsonSchema,
  MutationScope,
  PreconditionResult,
  UndoKind,
} from "./commandMeta";

export const DATA_AGENT_COMMAND_IDS = [
  "data.openTable",
  "data.openEndpoint",
  "data.runEndpoint",
  "data.importPaste",
] as const;

export type DataAgentCommandId = (typeof DATA_AGENT_COMMAND_IDS)[number];

export function isDataAgentCommandId(id: string): id is DataAgentCommandId {
  return (DATA_AGENT_COMMAND_IDS as readonly string[]).includes(id);
}

/** executor 가 데이터 store 에서 조립해 precondition 에 넘기는 읽기 모델. */
export interface DataAgentReadModel {
  /** `useDataStore.initialize(projectId)` 가 끝났는가 */
  projectLoaded: boolean;
  collections: readonly { id: string; name: string }[];
  endpoints: readonly { id: string; name: string; method: string }[];
}

export interface DataCommandMeta {
  /** `listAgentCommands` descriptor 의 description — `SHORTCUT_DEFINITIONS` 와 같이 영문 고정 */
  description: string;
  mutation: MutationScope;
  undo: UndoKind;
  /** 정적 승인 — 또는 인자로 판정 (runEndpoint: method 가 GET 이 아니면 승인) */
  confirm: boolean | ((s: DataAgentReadModel, args: DataCommandArgs) => boolean);
  /** 기록 1건을 누가 남기는가 — dispatcher 면 executor 는 ok 기록을 생략한다 */
  provenance: "executor" | "dispatcher";
  args: JsonSchema;
  precondition: (s: DataAgentReadModel, args: DataCommandArgs) => PreconditionResult;
}

export type DataCommandArgs = Record<string, unknown>;

const OK: PreconditionResult = { ok: true };
const fail = (reason: string): PreconditionResult => ({ ok: false, reason });

function str(args: DataCommandArgs, key: string): string | null {
  const value = args[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** id 또는 이름 (대소문자 무시) — 읽기 tool `findCollection`/`findEndpoint` 와 같은 규칙 */
export function resolveDataRef<T extends { id: string; name: string }>(
  items: readonly T[],
  args: DataCommandArgs,
  idKey: string,
): T | null {
  const id = str(args, idKey);
  const name = str(args, "name");
  if (id) {
    const byId = items.find((item) => item.id === id);
    if (byId) return byId;
    const byName = items.find((item) => item.name === id);
    if (byName) return byName;
  }
  if (name) {
    return (
      items.find((item) => item.name === name) ??
      items.find((item) => item.name.toLowerCase() === name.toLowerCase()) ??
      null
    );
  }
  return null;
}

const requireProject = (s: DataAgentReadModel) =>
  s.projectLoaded ? OK : fail("no-project");
const requireCollection = (s: DataAgentReadModel, args: DataCommandArgs) => {
  const project = requireProject(s);
  if (!project.ok) return project;
  if (!str(args, "collectionId") && !str(args, "name"))
    return fail("collection-ref-required");
  return resolveDataRef(s.collections, args, "collectionId")
    ? OK
    : fail("collection-not-found");
};
const requireEndpoint = (s: DataAgentReadModel, args: DataCommandArgs) => {
  const project = requireProject(s);
  if (!project.ok) return project;
  if (!str(args, "endpointId") && !str(args, "name"))
    return fail("endpoint-ref-required");
  return resolveDataRef(s.endpoints, args, "endpointId")
    ? OK
    : fail("endpoint-not-found");
};

const collectionRefArgs: JsonSchema = {
  type: "object",
  properties: {
    collectionId: { type: "string", description: "collection id (or name)" },
    name: { type: "string", description: "collection name" },
  },
};
const endpointRefArgs: JsonSchema = {
  type: "object",
  properties: {
    endpointId: { type: "string", description: "endpoint id (or name)" },
    name: { type: "string", description: "endpoint name" },
  },
};

export const DATA_COMMAND_META: Readonly<
  Record<DataAgentCommandId, DataCommandMeta>
> = {
  "data.openTable": {
    description: "Open a data table in the DataTable editor",
    mutation: "view",
    undo: "none",
    confirm: false,
    provenance: "executor",
    args: collectionRefArgs,
    precondition: requireCollection,
  },
  "data.openEndpoint": {
    description: "Open an API endpoint in the DataTable editor",
    mutation: "view",
    undo: "none",
    confirm: false,
    provenance: "executor",
    args: {
      type: "object",
      properties: {
        ...endpointRefArgs.properties,
        tab: {
          type: "string",
          enum: ["basic", "headers", "body", "response", "run"],
          description: "editor tab to open (default basic)",
        },
      },
    },
    precondition: requireEndpoint,
  },
  "data.runEndpoint": {
    description:
      "Run an API endpoint once (same as the Test button); the run is recorded for explain_request_failure",
    // 문서 무변경 — 실행 스냅샷은 세션 전용 (`apiRuns`). 바깥으로 요청이 나간다.
    mutation: "none",
    undo: "none",
    confirm: (s, args) => {
      const endpoint = resolveDataRef(s.endpoints, args, "endpointId");
      return endpoint !== null && endpoint.method.toUpperCase() !== "GET";
    },
    provenance: "executor",
    args: endpointRefArgs,
    precondition: requireEndpoint,
  },
  "data.importPaste": {
    description:
      "Import pasted text (JSON array/object, or tab/comma table with a header row) as a new data table, or append rows to an existing one — proposed for approval with a diff",
    mutation: "document",
    undo: "history",
    confirm: false,
    provenance: "dispatcher",
    args: {
      type: "object",
      properties: {
        text: { type: "string", description: "pasted text" },
        name: {
          type: "string",
          description: "new table name (required unless collectionId)",
        },
        collectionId: {
          type: "string",
          description: "append rows to this existing collection instead",
        },
      },
      required: ["text"],
    },
    precondition: (s, args) => {
      const project = requireProject(s);
      if (!project.ok) return project;
      if (!str(args, "text")) return fail("text-required");
      if (str(args, "collectionId")) {
        return resolveDataRef(s.collections, args, "collectionId")
          ? OK
          : fail("collection-not-found");
      }
      return str(args, "name") ? OK : fail("name-required");
    },
  },
};

/** ADR-196 표와 같은 정적 게이트 판정 — 조항 1 (adapter 1:1) · 조항 2 (되돌릴 수 없는 변경은 confirm). */
export function validateDataCommandMeta(
  meta: Readonly<Record<string, DataCommandMeta>>,
  adapterIds: ReadonlySet<string>,
): { rule: number; id: string; message: string }[] {
  const out: { rule: number; id: string; message: string }[] = [];
  for (const id of Object.keys(meta)) {
    if (!adapterIds.has(id))
      out.push({ rule: 1, id, message: "meta 는 있지만 adapter 없음" });
    const m = meta[id];
    if (
      (m.mutation === "document" || m.mutation === "project") &&
      m.undo !== "history" &&
      m.undo !== "inverse" &&
      m.confirm === false
    )
      out.push({ rule: 2, id, message: "되돌릴 수 없는 변경은 confirm 필수" });
    if (m.mutation === "external")
      out.push({ rule: 3, id, message: "external 은 agent 노출 금지" });
    if (m.provenance === "dispatcher" && m.mutation !== "document")
      out.push({
        rule: 6,
        id,
        message: "dispatcher 기록은 데이터 proposal (document) 만",
      });
  }
  for (const id of adapterIds) {
    if (!(id in meta))
      out.push({ rule: 1, id, message: "adapter 는 있지만 meta 없음" });
  }
  return out;
}

