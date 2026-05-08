import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "../elements";

// ADR-073 P4: addItem/removeItem/updateItem 일반화 액션 단위 테스트

describe("Store items actions (ADR-073 P4)", () => {
  const selectId = "test-select-1";

  beforeEach(() => {
    const state = useStore.getState();
    const el = {
      id: selectId,
      type: "Select",
      parent_id: null,
      page_id: "p1",
      order_num: 0,
      props: { items: [] },
    };
    useStore.setState({
      ...state,
      currentPageId: "p1",
      elements: [el as never],
      elementsMap: new Map([[selectId, el as never]]),
      childrenMap: new Map(),
    } as never);
  });

  it("addItem: items 배열에 신규 item push + id 자동 생성", async () => {
    await useStore.getState().addItem(selectId, "items", { label: "Opt A" });
    const el = useStore.getState().elementsMap.get(selectId)!;
    const items = el.props.items as Array<{ id: string; label: string }>;
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe("Opt A");
    expect(items[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("removeItem: id 일치 항목 제거", async () => {
    await useStore
      .getState()
      .addItem(selectId, "items", { id: "fixed-id", label: "X" });
    await useStore.getState().removeItem(selectId, "items", "fixed-id");
    const el = useStore.getState().elementsMap.get(selectId)!;
    expect(el.props.items as unknown[]).toHaveLength(0);
  });

  it("updateItem: 특정 id patch 적용", async () => {
    await useStore
      .getState()
      .addItem(selectId, "items", { id: "x", label: "Old" });
    await useStore
      .getState()
      .updateItem(selectId, "items", "x", { label: "New", value: "V" });
    const el = useStore.getState().elementsMap.get(selectId)!;
    const items = el.props.items as Array<{
      id: string;
      label: string;
      value?: string;
    }>;
    expect(items[0]).toMatchObject({ id: "x", label: "New", value: "V" });
  });

  it("addMenuItem: Menu 회귀 0 — addItem wrapper 로 동작", async () => {
    const menuEl = {
      id: "menu-1",
      type: "Menu",
      parent_id: null,
      page_id: "p1",
      order_num: 0,
      props: { items: [] },
    };
    useStore.setState({
      elements: [menuEl as never],
      elementsMap: new Map([["menu-1", menuEl as never]]),
    } as never);
    await useStore.getState().addMenuItem("menu-1", { label: "MI" });
    const menu = useStore.getState().elementsMap.get("menu-1")!;
    const items = menu.props.items as Array<{ label: string }>;
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe("MI");
  });

  it("addItem: 존재하지 않는 elementId → no-op (throw 없음)", async () => {
    await expect(
      useStore.getState().addItem("non-existent", "items", { label: "X" }),
    ).resolves.toBeUndefined();
  });
});

// ADR-076 Phase 4: ListBox items actions (tag-agnostic 동일 API 재사용)
describe("Store items actions — ListBox (ADR-076 P4)", () => {
  const listBoxId = "test-listbox-1";

  beforeEach(() => {
    const state = useStore.getState();
    const el = {
      id: listBoxId,
      type: "ListBox",
      parent_id: null,
      page_id: "p1",
      order_num: 0,
      props: { items: [] },
    };
    useStore.setState({
      ...state,
      currentPageId: "p1",
      elements: [el as never],
      elementsMap: new Map([[listBoxId, el as never]]),
      childrenMap: new Map(),
    } as never);
  });

  it("addItem: ListBox items 에 StoredListBoxItem push + id 자동 생성", async () => {
    await useStore.getState().addItem(listBoxId, "items", {
      label: "Apple",
      description: "빨간 과일",
    });
    const el = useStore.getState().elementsMap.get(listBoxId)!;
    const items = el.props.items as Array<{
      id: string;
      label: string;
      description?: string;
    }>;
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe("Apple");
    expect(items[0].description).toBe("빨간 과일");
    expect(items[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("removeItem: ListBox 특정 id 항목 제거", async () => {
    await useStore
      .getState()
      .addItem(listBoxId, "items", { id: "lb-a", label: "Apple" });
    await useStore
      .getState()
      .addItem(listBoxId, "items", { id: "lb-b", label: "Banana" });
    await useStore.getState().removeItem(listBoxId, "items", "lb-a");
    const el = useStore.getState().elementsMap.get(listBoxId)!;
    const items = el.props.items as Array<{ id: string; label: string }>;
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("lb-b");
  });

  it("updateItem: ListBox 특정 id label/isDisabled/description patch", async () => {
    await useStore
      .getState()
      .addItem(listBoxId, "items", { id: "lb-x", label: "Old Label" });
    await useStore.getState().updateItem(listBoxId, "items", "lb-x", {
      label: "New Label",
      description: "새 설명",
      isDisabled: true,
    });
    const el = useStore.getState().elementsMap.get(listBoxId)!;
    const items = el.props.items as Array<{
      id: string;
      label: string;
      description?: string;
      isDisabled?: boolean;
    }>;
    expect(items[0]).toMatchObject({
      id: "lb-x",
      label: "New Label",
      description: "새 설명",
      isDisabled: true,
    });
  });
});
