/**
 * ADR-214 Phase 2 — 런타임 상태 store (builder preview · publish 공용, 프레임워크 무관).
 *
 * 세 스코프의 **값** 을 든다 (정의는 소유자별 저장소 — 프로젝트 store · canonical 문서):
 * - `project`            — 프로젝트 변수 값. `persist:true` 인 것만 storage 에
 *                          `composition:runtime-state:v1:${projectId}` (R10 — 프로젝트 namespace,
 *                          전환 시 clear → 새 namespace hydrate)
 * - `page:${pageId}`     — 페이지 변수 값. 페이지 **진입 시 리셋** (`enterPage`)
 * - `element:${instanceKey}` — 요소 변수 값. instanceKey = resolved tree id (origin 은 `node.id`,
 *                          인스턴스 자손은 `${refId}/${idPath}` — Phase 0 evidence §3, R3) 라
 *                          같은 origin 의 인스턴스 2개가 값을 나누지 않는다
 *
 * 값 키는 **VariableDef.id** (이름이 아님) — rename 이 값을 잃지 않고, `setState.variableId`
 * 참조와 같은 축이다. 이름 → id 해석은 가시성 사슬 (`resolveVisibleVariables`) 이 하고, env
 * (`createRuntimeEnv`, Phase 3 템플릿 해석기 입력) 가 그 둘을 잇는다.
 *
 * 의존 인덱스 (R5): `subscribeVariable(variableId, listener)` — 쓰기는 그 변수의 구독자만
 * 깨운다. 전체 구독 (`subscribe`) 은 변경된 id 집합을 받는다.
 *
 * 구 키 `composition-runtime-values` (이름 기반 · namespace 없음) 는 이관 불가라 읽지 않는다
 * (Phase 0 evidence §2).
 */
import type { CompositionDocument } from "../types/composition-document.types";
import type { VariableDef, VariableDefType } from "./variable.types";
import {
  collectDocumentVariables,
  resolveVisibleVariables,
  type VisibleVariable,
} from "./visibility";

export type RuntimeScope =
  | { kind: "project" }
  | { kind: "page"; pageId: string }
  | { kind: "element"; instanceKey: string };

export type RuntimeStateOp = "set" | "toggle" | "increment" | "reset";

export interface RuntimeWriteRequest {
  variableId: string;
  op: RuntimeStateOp;
  value?: unknown;
  /** 생략하면 정의의 소유자에서 유도 (project / page — element 는 instanceKey 가 필요해 필수) */
  scope?: RuntimeScope;
}

export interface RuntimeWriteResult {
  ok: boolean;
  changed: boolean;
  value?: unknown;
  reason?: string;
}

export interface RuntimeStateDefinitions {
  projectVariables: readonly VariableDef[];
  document: CompositionDocument | null;
}

/** localStorage 와 같은 최소 계약 (테스트 · SSR 에서 주입) */
export interface RuntimeKeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface RuntimeStateSnapshot {
  projectId: string;
  project: Record<string, unknown>;
  pages: Record<string, Record<string, unknown>>;
  elements: Record<string, Record<string, unknown>>;
}

export type RuntimeChangeListener = (changed: ReadonlySet<string>) => void;

export interface RuntimeEnvTarget {
  pageId: string | null;
  /** 읽는 노드 (origin id). 없으면 페이지/프로젝트 변수만 보인다 */
  elementId?: string | null;
  /**
   * 요소 변수 소유자 (origin id) → 이 렌더 문맥의 instanceKey. 기본은 항등 (origin 렌더).
   * 인스턴스 자손 렌더는 `${refId}/${idPath}` 를 만들어 넘긴다 (Phase 3 렌더러).
   */
  instanceKeyFor?: (ownerElementId: string) => string;
}

export interface RuntimeEnv {
  /** 이름 → 값 (가시성 사슬 안 정의가 없으면 undefined — 원문 유지의 신호) */
  get(name: string): unknown;
  /** 이름 → 정의 (자동완성 · 타입 형식 함수용) */
  lookup(name: string): VisibleVariable | undefined;
}

export interface RuntimeStateHandle {
  readonly projectId: string;
  setDefinitions(defs: RuntimeStateDefinitions): void;
  getDefinition(variableId: string): VisibleVariable | undefined;
  enterPage(pageId: string | null): void;
  read(variableId: string, scope?: RuntimeScope): unknown;
  write(request: RuntimeWriteRequest): RuntimeWriteResult;
  createEnv(target: RuntimeEnvTarget): RuntimeEnv;
  snapshot(): RuntimeStateSnapshot;
  subscribe(listener: RuntimeChangeListener): () => void;
  subscribeVariable(variableId: string, listener: () => void): () => void;
  /** 프로젝트 전환 — 값 전부 clear 후 새 namespace 의 persist 값 hydrate (R10) */
  switchProject(projectId: string): void;
}

export const RUNTIME_STATE_STORAGE_PREFIX = "composition:runtime-state:v1:";

export function runtimeStateStorageKey(projectId: string): string {
  return `${RUNTIME_STATE_STORAGE_PREFIX}${projectId}`;
}

export function scopeKey(scope: RuntimeScope): string {
  switch (scope.kind) {
    case "project":
      return "project";
    case "page":
      return `page:${scope.pageId}`;
    case "element":
      return `element:${scope.instanceKey}`;
  }
}

/** 타입에 맞게 값을 강제 — 실패는 `undefined` (쓰기 거부) */
export function coerceRuntimeValue(
  type: VariableDefType,
  value: unknown,
): { ok: true; value: unknown } | { ok: false } {
  switch (type) {
    case "string":
      if (value === null || value === undefined) return { ok: true, value: "" };
      return {
        ok: true,
        value:
          typeof value === "object" ? JSON.stringify(value) : String(value),
      };
    case "number": {
      if (typeof value === "number")
        return Number.isFinite(value) ? { ok: true, value } : { ok: false };
      if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        return Number.isFinite(parsed)
          ? { ok: true, value: parsed }
          : { ok: false };
      }
      if (typeof value === "boolean") return { ok: true, value: value ? 1 : 0 };
      return { ok: false };
    }
    case "boolean": {
      if (typeof value === "boolean") return { ok: true, value };
      if (value === "true") return { ok: true, value: true };
      if (value === "false") return { ok: true, value: false };
      if (typeof value === "number") return { ok: true, value: value !== 0 };
      return { ok: false };
    }
    case "object":
      return typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
        ? { ok: true, value }
        : { ok: false };
    case "array":
      return Array.isArray(value) ? { ok: true, value } : { ok: false };
  }
}

function defaultFor(def: VariableDef): unknown {
  if (def.defaultValue !== undefined) return def.defaultValue;
  switch (def.type) {
    case "string":
      return "";
    case "number":
      return 0;
    case "boolean":
      return false;
    case "object":
      return {};
    case "array":
      return [];
  }
}

function readStorage(
  storage: RuntimeKeyValueStorage | null,
  projectId: string,
): Record<string, unknown> {
  if (!storage) return {};
  try {
    const raw = storage.getItem(runtimeStateStorageKey(projectId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export interface CreateRuntimeStateOptions {
  projectId: string;
  /** 기본 `globalThis.localStorage` (없으면 persist 없이 동작) */
  storage?: RuntimeKeyValueStorage | null;
  /** 값이 같아도 쓰기를 알릴지 (기본 false — 같은 값 재입력은 구독자 0 갱신, R5) */
  notifyUnchanged?: boolean;
}

function resolveDefaultStorage(): RuntimeKeyValueStorage | null {
  try {
    const candidate = (globalThis as { localStorage?: RuntimeKeyValueStorage })
      .localStorage;
    return candidate ?? null;
  } catch {
    return null;
  }
}

export function createRuntimeState(
  options: CreateRuntimeStateOptions,
): RuntimeStateHandle {
  const storage =
    options.storage === undefined ? resolveDefaultStorage() : options.storage;
  let projectId = options.projectId;
  let definitions = new Map<string, VisibleVariable>();
  let projectVariables: readonly VariableDef[] = [];
  let document: CompositionDocument | null = null;
  const values = new Map<string, Map<string, unknown>>();
  const listeners = new Set<RuntimeChangeListener>();
  const variableListeners = new Map<string, Set<() => void>>();

  const scopeMap = (scope: RuntimeScope): Map<string, unknown> => {
    const key = scopeKey(scope);
    let map = values.get(key);
    if (!map) {
      map = new Map();
      values.set(key, map);
    }
    return map;
  };

  const ownerScope = (
    entry: VisibleVariable,
    scope?: RuntimeScope,
  ): RuntimeScope | null => {
    if (scope) return scope;
    switch (entry.owner.kind) {
      case "project":
        return { kind: "project" };
      case "page":
        return { kind: "page", pageId: entry.owner.pageId };
      case "element":
        // origin 렌더 — instanceKey = node.id
        return { kind: "element", instanceKey: entry.owner.elementId };
    }
  };

  const persistProject = (): void => {
    if (!storage) return;
    const project = values.get("project");
    const toSave: Record<string, unknown> = {};
    for (const [id, entry] of definitions) {
      if (entry.owner.kind !== "project" || !entry.def.persist) continue;
      if (project?.has(id)) toSave[id] = project.get(id);
    }
    try {
      if (Object.keys(toSave).length === 0)
        storage.removeItem(runtimeStateStorageKey(projectId));
      else
        storage.setItem(
          runtimeStateStorageKey(projectId),
          JSON.stringify(toSave),
        );
    } catch {
      // storage 실패는 런타임을 막지 않는다
    }
  };

  const hydratePersisted = (): void => {
    const stored = readStorage(storage, projectId);
    const project = scopeMap({ kind: "project" });
    for (const [id, entry] of definitions) {
      if (entry.owner.kind !== "project" || !entry.def.persist) continue;
      if (!(id in stored)) continue;
      const coerced = coerceRuntimeValue(entry.def.type, stored[id]);
      if (coerced.ok) project.set(id, coerced.value);
    }
  };

  const notify = (changed: Set<string>): void => {
    if (changed.size === 0) return;
    for (const id of changed) {
      const set = variableListeners.get(id);
      if (set) for (const fn of [...set]) fn();
    }
    for (const fn of [...listeners]) fn(changed);
  };

  const rebuildDefinitions = (): void => {
    const next = new Map<string, VisibleVariable>();
    for (const def of projectVariables)
      next.set(def.id, { def, owner: { kind: "project" } });
    for (const entry of collectDocumentVariables(document))
      next.set(entry.def.id, entry);
    // 사라진 정의의 값은 버린다 (고아 0)
    const changed = new Set<string>();
    for (const map of values.values()) {
      for (const id of [...map.keys()]) {
        if (!next.has(id)) {
          map.delete(id);
          changed.add(id);
        }
      }
    }
    // 타입이 바뀐 정의는 값을 리셋 (기본값으로) — 문자열이 number 로 남는 것을 막는다
    for (const [id, entry] of next) {
      const prev = definitions.get(id);
      if (prev && prev.def.type !== entry.def.type) {
        for (const map of values.values()) if (map.delete(id)) changed.add(id);
      }
      if (prev && prev.def.defaultValue !== entry.def.defaultValue)
        changed.add(id);
    }
    definitions = next;
    hydratePersisted();
    notify(changed);
  };

  const handle: RuntimeStateHandle = {
    get projectId() {
      return projectId;
    },
    setDefinitions(defs) {
      projectVariables = defs.projectVariables;
      document = defs.document;
      rebuildDefinitions();
    },
    getDefinition(variableId) {
      return definitions.get(variableId);
    },
    enterPage(pageId) {
      if (!pageId) return;
      const key = scopeKey({ kind: "page", pageId });
      const map = values.get(key);
      if (!map || map.size === 0) return;
      const changed = new Set(map.keys());
      values.delete(key);
      notify(changed);
    },
    read(variableId, scope) {
      const entry = definitions.get(variableId);
      if (!entry) return undefined;
      const resolved = ownerScope(entry, scope);
      if (!resolved) return defaultFor(entry.def);
      const map = values.get(scopeKey(resolved));
      return map?.has(variableId) ? map.get(variableId) : defaultFor(entry.def);
    },
    write(request) {
      const entry = definitions.get(request.variableId);
      if (!entry)
        return { ok: false, changed: false, reason: "unknown-variable" };
      const scope = ownerScope(entry, request.scope);
      if (!scope)
        return { ok: false, changed: false, reason: "scope-required" };
      const map = scopeMap(scope);
      const current = map.has(request.variableId)
        ? map.get(request.variableId)
        : defaultFor(entry.def);
      let next: unknown;
      switch (request.op) {
        case "set": {
          const coerced = coerceRuntimeValue(entry.def.type, request.value);
          if (!coerced.ok)
            return { ok: false, changed: false, reason: "type-mismatch" };
          next = coerced.value;
          break;
        }
        case "toggle": {
          if (entry.def.type !== "boolean")
            return {
              ok: false,
              changed: false,
              reason: "toggle-requires-boolean",
            };
          next = !current;
          break;
        }
        case "increment": {
          if (entry.def.type !== "number")
            return {
              ok: false,
              changed: false,
              reason: "increment-requires-number",
            };
          const step =
            request.value === undefined
              ? 1
              : coerceRuntimeValue("number", request.value);
          const delta =
            typeof step === "number"
              ? step
              : step.ok
                ? (step.value as number)
                : NaN;
          if (!Number.isFinite(delta))
            return { ok: false, changed: false, reason: "type-mismatch" };
          next = (typeof current === "number" ? current : 0) + delta;
          break;
        }
        case "reset":
          next = defaultFor(entry.def);
          break;
      }
      const changed = !Object.is(current, next);
      if (request.op === "reset") map.delete(request.variableId);
      else map.set(request.variableId, next);
      if (changed || options.notifyUnchanged) {
        if (scope.kind === "project" && entry.def.persist) persistProject();
        notify(new Set([request.variableId]));
      }
      return { ok: true, changed, value: next };
    },
    createEnv(target) {
      const visibilityTarget = target.elementId
        ? ({ kind: "element", elementId: target.elementId } as const)
        : target.pageId
          ? ({ kind: "page", pageId: target.pageId } as const)
          : null;
      const visible = [
        ...resolveVisibleVariables(document, visibilityTarget, projectVariables),
      ];
      // 요소 사슬이 페이지에 닿지 않는 경우 (인스턴스 자손은 master 사슬 — 페이지 밖) 페이지 정의를
      // 프로젝트 앞에 보탠다: 요소 → 조상 → **페이지** → 프로젝트 순서 유지.
      if (
        target.elementId &&
        target.pageId &&
        !visible.some(
          (entry) =>
            entry.owner.kind === "page" && entry.owner.pageId === target.pageId,
        )
      ) {
        const pageEntries = resolveVisibleVariables(
          document,
          { kind: "page", pageId: target.pageId },
          [],
        );
        const firstProject = visible.findIndex(
          (entry) => entry.owner.kind === "project",
        );
        visible.splice(
          firstProject < 0 ? visible.length : firstProject,
          0,
          ...pageEntries,
        );
      }
      const byName = new Map<string, VisibleVariable>();
      for (const entry of visible)
        if (!byName.has(entry.def.name)) byName.set(entry.def.name, entry);
      const instanceKeyFor = target.instanceKeyFor ?? ((id: string) => id);
      const scopeOf = (entry: VisibleVariable): RuntimeScope => {
        switch (entry.owner.kind) {
          case "project":
            return { kind: "project" };
          case "page":
            return { kind: "page", pageId: entry.owner.pageId };
          case "element":
            return {
              kind: "element",
              instanceKey: instanceKeyFor(entry.owner.elementId),
            };
        }
      };
      return {
        get(name) {
          const entry = byName.get(name);
          if (!entry) return undefined;
          return handle.read(entry.def.id, scopeOf(entry));
        },
        lookup(name) {
          return byName.get(name);
        },
      };
    },
    snapshot() {
      const project: Record<string, unknown> = {};
      const pages: Record<string, Record<string, unknown>> = {};
      const elements: Record<string, Record<string, unknown>> = {};
      for (const [key, map] of values) {
        const obj = Object.fromEntries(map);
        if (key === "project") Object.assign(project, obj);
        else if (key.startsWith("page:")) pages[key.slice(5)] = obj;
        else if (key.startsWith("element:")) elements[key.slice(8)] = obj;
      }
      return { projectId, project, pages, elements };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    subscribeVariable(variableId, listener) {
      let set = variableListeners.get(variableId);
      if (!set) {
        set = new Set();
        variableListeners.set(variableId, set);
      }
      set.add(listener);
      return () => {
        set?.delete(listener);
        if (set && set.size === 0) variableListeners.delete(variableId);
      };
    },
    switchProject(nextProjectId) {
      if (nextProjectId === projectId) return;
      const changed = new Set<string>();
      for (const map of values.values())
        for (const id of map.keys()) changed.add(id);
      values.clear();
      projectId = nextProjectId;
      hydratePersisted();
      notify(changed);
    },
  };
  return handle;
}
