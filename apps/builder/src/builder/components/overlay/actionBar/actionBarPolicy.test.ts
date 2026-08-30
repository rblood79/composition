import { describe, expect, it } from "vitest";
import type { ContextMenuItem } from "../contextMenu/types";
import {
  ACTION_BAR_ALLOWLIST,
  ACTION_BAR_MAX_ITEMS,
  applyActionBarPolicy,
  resolveActionBarContext,
} from "./actionBarPolicy";

const noop = () => undefined;

function action(id: string): ContextMenuItem {
  return { kind: "action", id, labelKey: id, run: noop };
}

function separator(id: string): ContextMenuItem {
  return { kind: "separator", id };
}

function submenu(id: string, children: ContextMenuItem[]): ContextMenuItem {
  return { kind: "submenu", id, labelKey: id, items: children };
}

/** ADR-182 breakdown §2 T1 — 단일 일반 요소 (형제 2+, 컴포넌트 아님) */
const T1_SINGLE: ContextMenuItem[] = [
  action("copy"),
  action("paste"),
  action("duplicate"),
  separator("z-order-separator"),
  action("bring-to-front"),
  action("send-to-back"),
  separator("structure-separator"),
  action("group"),
  separator("component-separator"),
  action("toggle-component-origin"),
  separator("delete-separator"),
  action("delete"),
];

const T1_FRAME: ContextMenuItem[] = [
  action("copy"),
  action("paste"),
  action("duplicate"),
  action("group"),
  action("ungroup"),
  action("toggle-component-origin"),
  action("delete"),
];

const T1_INSTANCE: ContextMenuItem[] = [
  action("copy"),
  action("paste"),
  action("duplicate"),
  action("group"),
  action("toggle-component-origin"),
  action("go-to-origin"),
  action("detach-instance"),
  action("delete"),
];

const T1_MULTI: ContextMenuItem[] = [
  action("copy"),
  action("paste"),
  action("duplicate"),
  action("group"),
  submenu("align", [action("align-left"), action("align-right")]),
  action("detach-instance"),
  action("delete"),
];

/**
 * ⌘A / 페이지 타이틀 shift 클릭 — 선택에 body 가 섞이면 182 는 group 을 만들지
 * 않는다 (canGroupSelection = "선택 전원 non-body"). 페이지당 body 는 1개라
 * 이 집합에는 적격 non-body 요소가 반드시 함께 있다.
 */
const T1_MULTI_WITH_BODY: ContextMenuItem[] = [
  action("copy"),
  action("paste"),
  action("duplicate"),
  submenu("align", [action("align-left"), action("align-right")]),
  action("delete"),
];

/** body 단독 선택 — 182 는 copy/paste/duplicate/delete 만 만든다 */
const T1_BODY_ONLY: ContextMenuItem[] = [
  action("copy"),
  action("paste"),
  action("duplicate"),
  action("delete"),
];

function ids(items: readonly ContextMenuItem[]): string[] {
  return items.map((item) => item.id);
}

describe("resolveActionBarContext — 182 항목 존재로만 판정", () => {
  it("항목 0 → null (C0 미마운트)", () => {
    expect(resolveActionBarContext([])).toBeNull();
    expect(resolveActionBarContext([separator("only")])).toBeNull();
  });

  it("body 단독 선택 (toggle-component-origin 없음) → null", () => {
    expect(resolveActionBarContext(T1_BODY_ONLY)).toBeNull();
  });

  // 2026-08-27 code-review #5 — 구 센티널 `!ids.has("group")` 은 body 가 섞인
  // 다중 선택에서도 null 을 돌려줘 ⌘A 선택에 바가 한 번도 뜨지 않았다.
  it("body 가 섞인 다중 선택(⌘A, group 없음) → multi (바 노출)", () => {
    expect(resolveActionBarContext(T1_MULTI_WITH_BODY)).toBe("multi");
    expect(ids(applyActionBarPolicy(T1_MULTI_WITH_BODY)!.items)).toEqual([
      "align",
      "duplicate",
    ]);
  });

  // 단일 선택 group 은 `groupSelection` 이 2+ 에서만 실행하는 결정적 no-op 이라
  // 182 가 언제든 뺄 수 있다. 그때도 C1/C2/C3 판정이 살아 있어야 한다.
  it("provider 가 단일 선택 group emit 을 멈춰도 판정이 유지된다", () => {
    const withoutGroup = (items: ContextMenuItem[]) =>
      items.filter((item) => item.id !== "group");
    expect(resolveActionBarContext(withoutGroup(T1_SINGLE))).toBe("single");
    expect(resolveActionBarContext(withoutGroup(T1_FRAME))).toBe("frame");
    expect(resolveActionBarContext(withoutGroup(T1_INSTANCE))).toBe("instance");
  });

  it("align 존재 → multi, ungroup → frame, go-to-origin → instance, 그 외 single", () => {
    expect(resolveActionBarContext(T1_MULTI)).toBe("multi");
    expect(resolveActionBarContext(T1_FRAME)).toBe("frame");
    expect(resolveActionBarContext(T1_INSTANCE)).toBe("instance");
    expect(resolveActionBarContext(T1_SINGLE)).toBe("single");
  });

  it("다중 + frame 포함 선택은 multi 가 우선 (align 이 판정 키)", () => {
    expect(resolveActionBarContext([...T1_MULTI, action("ungroup")])).toBe(
      "multi",
    );
  });
});

describe("applyActionBarPolicy — 컨텍스트별 allowlist·순서·상한", () => {
  it("C1 단일: 복제 · 컴포넌트 토글 순 (group 은 2+ 전용이라 제외)", () => {
    const model = applyActionBarPolicy(T1_SINGLE);
    expect(model?.context).toBe("single");
    expect(ids(model!.items)).toEqual(["duplicate", "toggle-component-origin"]);
  });

  it("C2 frame: 그룹 해제 · 복제 · 컴포넌트 토글 순", () => {
    const model = applyActionBarPolicy(T1_FRAME);
    expect(model?.context).toBe("frame");
    expect(ids(model!.items)).toEqual([
      "ungroup",
      "duplicate",
      "toggle-component-origin",
    ]);
  });

  // 컴포넌트 축 3항목의 순서는 Properties 패널 Component 섹션과 같다.
  it("C3 인스턴스: 원본 이동 · 인스턴스 분리 · 컴포넌트 토글 · 복제 순", () => {
    const model = applyActionBarPolicy(T1_INSTANCE);
    expect(model?.context).toBe("instance");
    expect(ids(model!.items)).toEqual([
      "go-to-origin",
      "detach-instance",
      "toggle-component-origin",
      "duplicate",
    ]);
  });

  it("C4 다중: 정렬(submenu 유지) · 그룹 · 복제 · 인스턴스 분리 순", () => {
    const model = applyActionBarPolicy(T1_MULTI);
    expect(model?.context).toBe("multi");
    expect(ids(model!.items)).toEqual([
      "align",
      "group",
      "duplicate",
      "detach-instance",
    ]);
    expect(model!.items[0].kind).toBe("submenu");
  });

  it("copy/paste/delete/z-order 는 어느 컨텍스트에도 노출되지 않는다", () => {
    for (const fixture of [T1_SINGLE, T1_FRAME, T1_INSTANCE, T1_MULTI]) {
      const picked = ids(applyActionBarPolicy(fixture)!.items);
      for (const excluded of [
        "copy",
        "paste",
        "delete",
        "bring-to-front",
        "send-to-back",
      ]) {
        expect(picked).not.toContain(excluded);
      }
    }
  });

  it("조건 미충족으로 provider 가 뺀 항목은 바에도 없다 (disabled 나열 금지)", () => {
    // 다중 선택에 인스턴스가 없으면 182 는 detach-instance 를 만들지 않는다
    const withoutDetach = T1_MULTI.filter(
      (item) => item.id !== "detach-instance",
    );
    expect(ids(applyActionBarPolicy(withoutDetach)!.items)).toEqual([
      "align",
      "group",
      "duplicate",
    ]);
  });

  it("allowlist 항목이 전부 없으면 null (빈 바 금지)", () => {
    expect(
      applyActionBarPolicy([action("copy"), action("paste"), action("delete")]),
    ).toBeNull();
  });

  it("상한 5 — allowlist 가 길어져도 5개에서 자른다", () => {
    for (const list of Object.values(ACTION_BAR_ALLOWLIST)) {
      expect(list.length).toBeLessThanOrEqual(ACTION_BAR_MAX_ITEMS);
    }
    const long: ContextMenuItem[] = [
      submenu("align", []),
      action("group"),
      action("duplicate"),
      action("detach-instance"),
    ];
    expect(applyActionBarPolicy(long)!.items.length).toBeLessThanOrEqual(
      ACTION_BAR_MAX_ITEMS,
    );
  });

  it("182 항목 id 계약 고정 (R1) — allowlist 는 이 집합 안에서만 고른다", () => {
    const contract = new Set([
      "duplicate",
      "group",
      "ungroup",
      "align",
      "toggle-component-origin",
      "go-to-origin",
      "detach-instance",
    ]);
    for (const list of Object.values(ACTION_BAR_ALLOWLIST)) {
      for (const id of list) expect(contract.has(id)).toBe(true);
    }
  });
});
