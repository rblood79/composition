import { describe, expect, it, vi } from "vitest";
import type { CompositionDocument } from "../../types/composition-document.types";
import {
  coerceRuntimeValue,
  createRuntimeState,
  runtimeStateStorageKey,
  type RuntimeKeyValueStorage,
} from "../runtimeState";

function memoryStorage(): RuntimeKeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const doc = {
  version: "composition-1.0",
  children: [
    {
      id: "home",
      type: "frame",
      metadata: { type: "page" },
      state: [{ id: "v-page", name: "step", type: "number", defaultValue: 1 }],
      children: [
        {
          id: "card",
          type: "frame",
          state: [{ id: "v-card", name: "open", type: "boolean", defaultValue: false }],
          children: [{ id: "label", type: "Text", props: { children: "x" } }],
        },
      ],
    },
  ],
} as unknown as CompositionDocument;

const projectVariables = [
  { id: "v-user", name: "userName", type: "string" as const, defaultValue: "guest", persist: true },
  { id: "v-count", name: "count", type: "number" as const, defaultValue: 0 },
];

describe("createRuntimeState", () => {
  it("정의 색인 → 기본값 읽기 (project / page / element) · 없는 id 는 undefined", () => {
    const rt = createRuntimeState({ projectId: "p1", storage: null });
    rt.setDefinitions({ projectVariables, document: doc });
    expect(rt.read("v-user")).toBe("guest");
    expect(rt.read("v-page")).toBe(1);
    expect(rt.read("v-card")).toBe(false);
    expect(rt.read("nope")).toBeUndefined();
  });

  it("write 4 op — set 타입 강제 · toggle boolean 만 · increment number 만 · reset 기본값 · 같은 값은 changed false", () => {
    const rt = createRuntimeState({ projectId: "p1", storage: null });
    rt.setDefinitions({ projectVariables, document: doc });
    expect(rt.write({ variableId: "v-count", op: "set", value: "5" })).toMatchObject({ ok: true, changed: true, value: 5 });
    expect(rt.write({ variableId: "v-count", op: "set", value: "abc" })).toMatchObject({ ok: false, reason: "type-mismatch" });
    expect(rt.write({ variableId: "v-count", op: "increment" })).toMatchObject({ value: 6 });
    expect(rt.write({ variableId: "v-count", op: "increment", value: -2 })).toMatchObject({ value: 4 });
    expect(rt.write({ variableId: "v-user", op: "toggle" })).toMatchObject({ ok: false, reason: "toggle-requires-boolean" });
    expect(rt.write({ variableId: "v-card", op: "toggle" })).toMatchObject({ value: true });
    expect(rt.write({ variableId: "v-count", op: "set", value: 4 })).toMatchObject({ ok: true, changed: false });
    expect(rt.write({ variableId: "v-count", op: "reset" })).toMatchObject({ value: 0 });
    expect(rt.read("v-count")).toBe(0);
  });

  it("요소 변수는 instanceKey 별로 격리 — 같은 origin 의 인스턴스 2개가 값을 나누지 않는다 (R3)", () => {
    const rt = createRuntimeState({ projectId: "p1", storage: null });
    rt.setDefinitions({ projectVariables, document: doc });
    const a = { kind: "element", instanceKey: "inst-a/card" } as const;
    const b = { kind: "element", instanceKey: "inst-b/card" } as const;
    rt.write({ variableId: "v-card", op: "toggle", scope: a });
    expect(rt.read("v-card", a)).toBe(true);
    expect(rt.read("v-card", b)).toBe(false);
    expect(rt.read("v-card")).toBe(false); // origin
  });

  it("페이지 진입 리셋 — enterPage 가 그 페이지 값을 기본값으로 · 다른 페이지 무관", () => {
    const rt = createRuntimeState({ projectId: "p1", storage: null });
    rt.setDefinitions({ projectVariables, document: doc });
    rt.write({ variableId: "v-page", op: "set", value: 3 });
    expect(rt.read("v-page")).toBe(3);
    rt.enterPage("other");
    expect(rt.read("v-page")).toBe(3);
    rt.enterPage("home");
    expect(rt.read("v-page")).toBe(1);
  });

  it("persist:true 프로젝트 변수만 storage 에 projectId namespace 키로 · 전환 시 clear + 새 namespace hydrate (R10)", () => {
    const storage = memoryStorage();
    const rt = createRuntimeState({ projectId: "A", storage });
    rt.setDefinitions({ projectVariables, document: null });
    rt.write({ variableId: "v-user", op: "set", value: "Ana" });
    rt.write({ variableId: "v-count", op: "set", value: 9 }); // persist 아님
    expect(JSON.parse(storage.data.get(runtimeStateStorageKey("A"))!)).toEqual({ "v-user": "Ana" });
    expect(storage.data.has("composition-runtime-values")).toBe(false);

    rt.switchProject("B");
    expect(rt.read("v-user")).toBe("guest"); // A 의 값이 B 로 새지 않는다
    expect(rt.read("v-count")).toBe(0);
    rt.write({ variableId: "v-user", op: "set", value: "Bob" });
    expect(JSON.parse(storage.data.get(runtimeStateStorageKey("B"))!)).toEqual({ "v-user": "Bob" });
    expect(JSON.parse(storage.data.get(runtimeStateStorageKey("A"))!)).toEqual({ "v-user": "Ana" });

    rt.switchProject("A");
    expect(rt.read("v-user")).toBe("Ana");
  });

  it("의존 인덱스 — 쓰기는 그 변수의 구독자만 깨운다 · 전체 구독은 변경 id 집합", () => {
    const rt = createRuntimeState({ projectId: "p1", storage: null });
    rt.setDefinitions({ projectVariables, document: doc });
    const onUser = vi.fn();
    const onCount = vi.fn();
    const onAll = vi.fn();
    rt.subscribeVariable("v-user", onUser);
    rt.subscribeVariable("v-count", onCount);
    rt.subscribe(onAll);
    rt.write({ variableId: "v-user", op: "set", value: "Ana" });
    expect(onUser).toHaveBeenCalledTimes(1);
    expect(onCount).not.toHaveBeenCalled();
    expect(onAll).toHaveBeenCalledWith(new Set(["v-user"]));
    rt.write({ variableId: "v-user", op: "set", value: "Ana" }); // 같은 값
    expect(onUser).toHaveBeenCalledTimes(1);
  });

  it("정의 갱신 — 사라진 id 값 폐기 · 타입 변경은 값 리셋 · defaultValue 변경은 구독자 알림", () => {
    const rt = createRuntimeState({ projectId: "p1", storage: null });
    rt.setDefinitions({ projectVariables, document: doc });
    rt.write({ variableId: "v-count", op: "set", value: 7 });
    const onCount = vi.fn();
    rt.subscribeVariable("v-count", onCount);
    rt.setDefinitions({
      projectVariables: [
        { id: "v-user", name: "userName", type: "string", defaultValue: "Ana", persist: true },
        { id: "v-count", name: "count", type: "string", defaultValue: "" },
      ],
      document: null,
    });
    expect(rt.read("v-count")).toBe(""); // 타입 변경 → 리셋
    expect(onCount).toHaveBeenCalled();
    expect(rt.read("v-user")).toBe("Ana"); // 새 기본값
    expect(rt.read("v-page")).toBeUndefined(); // 문서 정의 사라짐
  });

  it("env — 가시성 사슬로 이름 해석 (요소 → 조상 → 페이지 → 프로젝트) · 인스턴스 키 매핑 · 미정의 이름 undefined", () => {
    const rt = createRuntimeState({ projectId: "p1", storage: null });
    rt.setDefinitions({ projectVariables, document: doc });
    rt.write({ variableId: "v-card", op: "toggle", scope: { kind: "element", instanceKey: "inst/card" } });
    const origin = rt.createEnv({ pageId: "home", elementId: "label" });
    expect(origin.get("userName")).toBe("guest");
    expect(origin.get("step")).toBe(1);
    expect(origin.get("open")).toBe(false);
    expect(origin.get("missing")).toBeUndefined();
    expect(origin.lookup("open")?.owner).toEqual({ kind: "element", elementId: "card" });
    const instance = rt.createEnv({
      pageId: "home",
      elementId: "label",
      instanceKeyFor: (ownerId) => `inst/${ownerId}`,
    });
    expect(instance.get("open")).toBe(true);
    const pageOnly = rt.createEnv({ pageId: "home" });
    expect(pageOnly.get("open")).toBeUndefined();
    expect(pageOnly.get("step")).toBe(1);
  });

  it("coerceRuntimeValue — string 은 객체를 JSON 으로 · number 는 문자열 숫자 허용 · object/array 는 형태만", () => {
    expect(coerceRuntimeValue("string", { a: 1 })).toEqual({ ok: true, value: '{"a":1}' });
    expect(coerceRuntimeValue("string", null)).toEqual({ ok: true, value: "" });
    expect(coerceRuntimeValue("number", " 12 ")).toEqual({ ok: true, value: 12 });
    expect(coerceRuntimeValue("number", "")).toEqual({ ok: false });
    expect(coerceRuntimeValue("boolean", "true")).toEqual({ ok: true, value: true });
    expect(coerceRuntimeValue("object", [])).toEqual({ ok: false });
    expect(coerceRuntimeValue("array", [1])).toEqual({ ok: true, value: [1] });
  });
});

describe("createEnv — 페이지 사슬 보강", () => {
  it("요소 사슬이 페이지에 닿지 않으면 (인스턴스 자손 = master 사슬) pageId 의 페이지 정의를 프로젝트 앞에 보탠다", () => {
    const withMaster = {
      version: "composition-1.0",
      children: [
        {
          id: "home",
          type: "frame",
          metadata: { type: "page" },
          state: [{ id: "v-page", name: "step", type: "number", defaultValue: 1 }],
          children: [{ id: "inst", type: "ref", ref: "master" }],
        },
        {
          id: "master",
          type: "frame",
          reusable: true,
          state: [{ id: "v-m", name: "open", type: "boolean", defaultValue: true }],
          children: [{ id: "m-label", type: "Text", props: { children: "{{ step }}/{{ open }}" } }],
        },
      ],
    } as unknown as CompositionDocument;
    const rt = createRuntimeState({ projectId: "p1", storage: null });
    rt.setDefinitions({ projectVariables, document: withMaster });
    const env = rt.createEnv({ pageId: "home", elementId: "m-label" });
    expect(env.get("open")).toBe(true);
    expect(env.get("step")).toBe(1);
    expect(env.get("userName")).toBe("guest");
  });
});
