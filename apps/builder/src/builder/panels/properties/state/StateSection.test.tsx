// @vitest-environment jsdom
/**
 * ADR-214 Phase 5 — Properties 상태 절: 암묵 상태 이름 붙이기 (source.prop · 기본값 = 저작 prop) ·
 * 명시 `+ 추가` · 이름 충돌 거부 (프로젝트 · 같은 사슬) · 삭제 확인의 사용처 수 · body = 페이지 변수.
 */
import type { ReactElement } from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompositionDocument } from "@composition/shared";

import { I18nProvider } from "@/i18n";
import type { Element } from "../../../../types/core/store.types";
import { useStore } from "../../../stores";
import { useDataStore } from "../../../stores/data";
import { historyManager } from "../../../stores/history";
import { useCanonicalDocumentStore } from "../../../stores/canonical/canonicalDocumentStore";
import {
  PANEL_FIXTURE_PROJECT_ID,
  resetPanelFixture,
  seedPanelElements,
} from "../../../__tests__/panelFixture";
import { StateSection } from "./StateSection";

vi.mock("../../../../lib/db", () => ({
  getDB: vi.fn(async () => ({ documents: { put: vi.fn() } })),
}));

const renderWithI18n = (ui: ReactElement) =>
  render(ui, { wrapper: I18nProvider });

function el(id: string, overrides: Partial<Element> = {}): Element {
  return {
    id,
    type: "Button",
    parent_id: null,
    order_num: 0,
    page_id: "page-1",
    props: {},
    ...overrides,
  } as Element;
}

function canonicalNode(id: string) {
  const doc = useCanonicalDocumentStore
    .getState()
    .getDocument(PANEL_FIXTURE_PROJECT_ID) as CompositionDocument;
  const find = (nodes: readonly { id: string; children?: unknown[] }[] | undefined): unknown => {
    for (const node of nodes ?? []) {
      if (node.id === id) return node;
      const inner = find(node.children as never);
      if (inner) return inner;
    }
    return undefined;
  };
  return find(doc.children as never) as { state?: { id: string; name: string; type: string; defaultValue?: unknown; source?: { prop: string } }[] } | undefined;
}

describe("StateSection (ADR-214 Phase 5)", () => {
  beforeEach(() => {
    resetPanelFixture();
    historyManager.clearAllHistory();
    historyManager.setCurrentPage("page-1");
    useStore.setState({
      currentPageId: "page-1",
      pages: [{ id: "page-1", title: "Home", slug: "/", project_id: PANEL_FIXTURE_PROJECT_ID, parent_id: null }],
      selectedElementId: null,
    } as never);
    useDataStore.setState({
      variables: new Map([
        ["count", { id: "v-count", name: "count", type: "number", scope: "global", project_id: PANEL_FIXTURE_PROJECT_ID, owner: { kind: "project" } }],
      ]),
    } as never);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("암묵 isSelected 에 이름을 붙이면 source.prop 정의가 생기고 기본값은 저작 prop 값", async () => {
    seedPanelElements([el("check", { type: "Checkbox", props: { isSelected: true } })]);
    const { container } = renderWithI18n(<StateSection elementId="check" />);
    const input = container.querySelector(
      '.state-def[data-implicit="isSelected"] input.state-def-name-input',
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    fireEvent.change(input, { target: { value: "agree" } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    await vi.waitFor(() => {
      const state = canonicalNode("check")?.state ?? [];
      expect(state).toHaveLength(1);
      expect(state[0]).toMatchObject({ name: "agree", type: "boolean", defaultValue: true, source: { prop: "isSelected" } });
    });
    // 이름 붙은 뒤엔 정의 행으로 보인다 (입력 없음)
    await vi.waitFor(() =>
      expect(container.querySelector('.state-def[data-implicit="isSelected"] .state-def-name')?.textContent).toBe("agree"),
    );
  });

  it("+ 추가 → state1 · 프로젝트 변수 count 로 rename 은 거부 (문구 + 미반영) · 유효한 이름은 반영 · History 1 entry 씩", async () => {
    seedPanelElements([el("btn")]);
    const { container, getByText } = renderWithI18n(<StateSection elementId="btn" />);
    await act(async () => {
      fireEvent.click(getByText("Add"));
    });
    await vi.waitFor(() => expect(canonicalNode("btn")?.state?.[0]?.name).toBe("state1"));
    const entriesAfterAdd = historyManager.getCurrentPageEntries().length;
    expect(entriesAfterAdd).toBe(1);

    const nameInput = container.querySelector(".state-def-editor input") as HTMLInputElement;
    expect(nameInput.value).toBe("state1");
    fireEvent.change(nameInput, { target: { value: "count" } });
    fireEvent.keyDown(nameInput, { key: "Enter" });
    await vi.waitFor(() => expect(container.querySelector(".state-def-error")?.textContent).toContain("count"));
    expect(canonicalNode("btn")?.state?.[0]?.name).toBe("state1");

    fireEvent.change(nameInput, { target: { value: "open" } });
    await act(async () => {
      fireEvent.keyDown(nameInput, { key: "Enter" });
    });
    await vi.waitFor(() => expect(canonicalNode("btn")?.state?.[0]?.name).toBe("open"));
    expect(container.querySelector(".state-def-error")).toBeNull();
    expect(historyManager.getCurrentPageEntries().length).toBe(2);
  });

  it("삭제 확인은 사용처 (사슬 안 템플릿 + setState 규칙) 수를 싣고, 확인 뒤 정의가 사라진다", async () => {
    seedPanelElements([
      el("card", { type: "frame", state: [{ id: "v-open", name: "open", type: "boolean", defaultValue: false }] } as Partial<Element>),
      el("label", { parent_id: "card", props: { children: "{{ open }}" } }),
      el("outside", { props: { children: "{{ open }}" } }),
    ]);
    // setState 규칙 1 (문서 events)
    const canonical = useCanonicalDocumentStore.getState();
    const doc = canonical.getDocument(PANEL_FIXTURE_PROJECT_ID)!;
    canonical.setDocument(PANEL_FIXTURE_PROJECT_ID, {
      ...doc,
      events: [{ id: "r1", type: "interaction", elementId: "b", trigger: "onPress", action: { kind: "setState", variableId: "v-open", op: "toggle" } }],
    } as CompositionDocument);

    const { container, getByRole } = renderWithI18n(<StateSection elementId="card" />);
    expect(container.querySelector(".state-def-usage")?.textContent).toBe("Used in 2");
    const remove = container.querySelector(".state-def-remove") as HTMLButtonElement;
    fireEvent.click(remove);
    const dialog = await vi.waitFor(() => getByRole("alertdialog"));
    expect(dialog.textContent).toContain("Templates in 2 place(s)");
    const buttons = dialog.querySelectorAll("button");
    const ok = buttons[buttons.length - 1];
    await act(async () => {
      fireEvent.pointerDown(ok, { pointerType: "mouse", button: 0 });
      fireEvent.pointerUp(ok, { pointerType: "mouse", button: 0 });
      fireEvent.click(ok);
    });
    await vi.waitFor(() => expect(canonicalNode("card")?.state ?? []).toHaveLength(0));
  });

  it("body 선택 = 페이지 변수: + 추가 가 canonical page 노드 state 에 쓰고 History 는 page-state", async () => {
    seedPanelElements([el("body-1", { type: "body" })]);
    // 페이지 노드 (fixture 는 page-1 을 root page 로 만든다) 확인
    const { getByText } = renderWithI18n(<StateSection elementId="body-1" />);
    expect(getByText("Page variables")).toBeTruthy();
    await act(async () => {
      fireEvent.click(getByText("Add"));
    });
    await vi.waitFor(() => expect(canonicalNode("page-1")?.state?.[0]?.name).toBe("state1"));
    expect(historyManager.getCurrentPageEntries()[0]?.type).toBe("page-state");
  });
});
