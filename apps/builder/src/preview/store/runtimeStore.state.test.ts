/**
 * ADR-214 Phase 2 — preview runtimeStore 가 shared 런타임 상태 handle 을 감싼다:
 * UPDATE_VARIABLES (project 정의) + canonical 문서 (page/element 정의) → 정의 색인 ·
 * 페이지 진입 리셋 · 프로젝트 전환 namespace · 값 변경 → runtimeStateRevision.
 */
import { describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import { createRuntimeStore } from "./runtimeStore";

const doc = (pageDefault: number): CompositionDocument =>
  ({
    version: "composition-1.0",
    children: [
      {
        id: "home",
        type: "frame",
        metadata: { type: "page" },
        state: [
          {
            id: "v-step",
            name: "step",
            type: "number",
            defaultValue: pageDefault,
          },
        ],
        children: [],
      },
    ],
  }) as unknown as CompositionDocument;

const message = (projectId: string, revision: number, pageDefault = 1) => ({
  type: "UPDATE_CANONICAL_DOCUMENT" as const,
  projectId,
  documentRevision: revision,
  document: doc(pageDefault),
});

describe("runtimeStore ↔ shared runtimeState (ADR-214 Phase 2)", () => {
  it("setVariables (project) + 문서 (page) → 정의 색인 · 값 읽기 · 변경 → revision 증가", () => {
    const store = createRuntimeStore();
    store.getState().receiveCanonicalDocument(message("p1", 1));
    store.getState().setVariables([
      {
        id: "v-user",
        name: "userName",
        type: "string",
        defaultValue: "runtime-guest",
        definitionDefault: "guest",
        persist: false,
        scope: "global",
        owner: { kind: "project" },
      },
    ]);
    const { runtimeState } = store.getState();
    expect(runtimeState.read("v-user")).toBe("guest"); // 정의 기본값 (runtime 값 아님)
    expect(runtimeState.read("v-step")).toBe(1); // 문서 page 정의
    // legacy appState 초기화는 그대로 (read 호환 alias)
    expect(store.getState().appState.userName).toBe("runtime-guest");

    const before = store.getState().runtimeStateRevision;
    runtimeState.write({ variableId: "v-user", op: "set", value: "Ana" });
    expect(store.getState().runtimeStateRevision).toBe(before + 1);
    expect(runtimeState.createEnv({ pageId: "home" }).get("userName")).toBe(
      "Ana",
    );
  });

  it("문서 재수신이 page 정의 기본값을 갱신하고, 페이지 진입 (setCurrentPageId) 이 값을 리셋한다", () => {
    const store = createRuntimeStore();
    store.getState().receiveCanonicalDocument(message("p1", 1));
    const { runtimeState } = store.getState();
    runtimeState.write({ variableId: "v-step", op: "set", value: 5 });
    expect(runtimeState.read("v-step")).toBe(5);
    store.getState().setCurrentPageId("home");
    expect(runtimeState.read("v-step")).toBe(1);
    store.getState().receiveCanonicalDocument(message("p1", 2, 7));
    expect(runtimeState.read("v-step")).toBe(7);
    // 같은 revision 재수신은 무시 (정의 동기화도 0)
    store.getState().receiveCanonicalDocument(message("p1", 2, 9));
    expect(runtimeState.read("v-step")).toBe(7);
  });

  it("프로젝트가 바뀐 문서 수신 → 런타임 namespace 전환 (값 clear, R10)", () => {
    const store = createRuntimeStore();
    store.getState().receiveCanonicalDocument(message("p1", 1));
    store.getState().setVariables([
      {
        id: "v-user",
        name: "userName",
        type: "string",
        definitionDefault: "guest",
        persist: false,
        scope: "global",
        owner: { kind: "project" },
      },
    ]);
    const { runtimeState } = store.getState();
    runtimeState.write({ variableId: "v-user", op: "set", value: "Ana" });
    store.getState().receiveCanonicalDocument(message("p2", 1));
    expect(runtimeState.projectId).toBe("p2");
    expect(runtimeState.read("v-user")).toBe("guest");
  });
});
