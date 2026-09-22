import { describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { buildCatalogOrigin } from "../catalogOrigins";
import { ensureReusableCompositeOrigins } from "../reusableCompositeOrigins";
import { COMPONENTS_SYSTEM_BODY_ID } from "../../pages/systemComponentsPage";

/**
 * ADR-233 Phase 4 — G4 BC (breakdown §3 Phase 4 · 리뷰 m2 세 칸).
 *
 * "ADR-233 이전 문서" = 230 hydration 까지 지난 모양 — Tab 항목 origin 0 · `component-radio` 0 · Radio 변형 0 ·
 * `component-tabs` 에 slot 없음 · `component-radiogroup` 의 Radio 자식 plain (Radio origin 이 없어 229 규칙이
 * 바꾸지 못했다) + 사용자 저작 (plain Tabs · RadioGroup instance · plain RadioGroup). 233 hydration 을 지나면:
 *   (i) 불변 — 사용자 저작 노드 · 기존 origin 자식/순서/props · 사용자가 둔 slot · 기존 RadioGroup origin plain 자식
 *   (ii) 허용 보충 — `component-tabs` 의 변경 필드는 `slot` 하나 (부재 시만)
 *   (iii) 추가 노드 16 (Tab 항목 origin 2 + label 2 · component-radio 1 + Label 1 · Radio 변형 5 + Label 5)
 *         · Δbyte = 추가 노드 직렬화 + slot 필드 (정확히)
 *   재hydration Δnode · Δfield · Δbyte 0.
 */

function countNodes(nodes: readonly CanonicalNode[]): number {
  let n = 0;
  for (const node of nodes) n += 1 + countNodes(node.children ?? []);
  return n;
}

function indexById(
  nodes: readonly CanonicalNode[],
  into = new Map<string, CanonicalNode>(),
): Map<string, CanonicalNode> {
  for (const node of nodes) {
    into.set(node.id, node);
    indexById(node.children ?? [], into);
  }
  return into;
}

function mapNodes(
  nodes: readonly CanonicalNode[],
  fn: (node: CanonicalNode) => CanonicalNode | null,
): CanonicalNode[] {
  const out: CanonicalNode[] = [];
  for (const node of nodes) {
    const mapped = fn(node);
    if (!mapped) continue;
    out.push(
      mapped.children
        ? { ...mapped, children: mapNodes(mapped.children, fn) }
        : mapped,
    );
  }
  return out;
}

/** 자기 필드 + 자식 id 순서 (자식 내용은 각자 비교). */
function ownSerialization(node: CanonicalNode): string {
  const { children, ...rest } = node;
  return JSON.stringify({
    ...rest,
    childIds: (children ?? []).map((child) => child.id),
  });
}

const TAB_ITEM_IDS = [
  "component-tab-item-default",
  "component-tab-item-selected",
];
const isAdded233Root = (id: string) =>
  TAB_ITEM_IDS.includes(id) ||
  id === "component-radio" ||
  id.startsWith("component-radio--");

function buildPre233Document(
  input: { userSlot?: string[] } = {},
): CompositionDocument {
  const full = ensureReusableCompositeOrigins({
    version: "composition-1.0",
    children: [],
  });
  const plainRadioGroup = buildCatalogOrigin("RadioGroup");
  const stripped = mapNodes(full.children, (node) => {
    if (isAdded233Root(node.id)) return null;
    if (node.id === "component-tabs") {
      const { slot: _slot, ...rest } = node;
      return (
        input.userSlot ? { ...rest, slot: input.userSlot } : rest
      ) as CanonicalNode;
    }
    if (node.id === "component-radiogroup") {
      // 233 이전: Radio origin 이 없어 RadioGroup origin 의 Radio 자식은 plain (factory 트리 그대로).
      return { ...node, children: plainRadioGroup.children };
    }
    return node;
  });
  const userPage = {
    id: "page-1",
    type: "frame",
    metadata: { type: "legacy-page", pageId: "page-1" },
    children: [
      {
        id: "body",
        type: "body",
        props: {},
        children: [
          {
            id: "user-tabs",
            type: "Tabs",
            props: {
              items: [{ id: "u1", title: "Mine" }],
              defaultSelectedKey: "u1",
            },
            children: [
              { id: "user-tabs__list", type: "TabList", props: {} },
              {
                id: "user-tabs__panels",
                type: "TabPanels",
                props: {},
                children: [
                  {
                    id: "user-tabs__p1",
                    type: "TabPanel",
                    props: { itemId: "u1" },
                  },
                ],
              },
            ],
          },
          {
            id: "user-rg-inst",
            type: "ref",
            ref: "component-radiogroup",
            props: { value: "option2" },
          },
          {
            id: "user-rg-plain",
            type: "RadioGroup",
            props: { label: "Plain" },
            children: [
              {
                id: "user-rg-plain__r",
                type: "Radio",
                props: { value: "x" },
                children: [
                  {
                    id: "user-rg-plain__r__l",
                    type: "Label",
                    props: { children: "X" },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  } as unknown as CanonicalNode;
  return { ...full, children: [...stripped, userPage] };
}

describe("ADR-233 Phase 4 — G4 BC", () => {
  const pre = buildPre233Document();
  const preJson = JSON.stringify(pre);
  const post = ensureReusableCompositeOrigins(pre);
  const postJson = JSON.stringify(post);
  const before = indexById(pre.children);
  const after = indexById(post.children);

  it("pre 문서 모양 — 233 origin 0 · component-tabs slot 없음 · RadioGroup origin Radio 자식 plain", () => {
    expect([...before.keys()].some(isAdded233Root)).toBe(false);
    expect(before.get("component-tabs")?.slot).toBeUndefined();
    const groupChildren = before.get("component-radiogroup")?.children ?? [];
    expect(groupChildren.some((c) => c.type === "Radio")).toBe(true);
    expect(groupChildren.some((c) => c.type === "ref")).toBe(false);
  });

  it("(i) 불변 — component-tabs 를 뺀 기존 노드 전부 자기 필드 · 자식 순서 직렬화 동일 (RadioGroup origin plain 자식 · 사용자 저작 포함)", () => {
    const changed: string[] = [];
    for (const [id, node] of before) {
      if (id === "component-tabs") continue;
      const next = after.get(id);
      if (!next) {
        changed.push(`${id}: 사라짐`);
        continue;
      }
      if (id === COMPONENTS_SYSTEM_BODY_ID) continue; // body 는 자식이 늘어난다 — 아래 순서 검사
      if (ownSerialization(node) !== ownSerialization(next)) changed.push(id);
    }
    expect(changed).toEqual([]);
    // Components body — 기존 자식 순서는 추가분을 빼고 보면 그대로.
    const preBody = before
      .get(COMPONENTS_SYSTEM_BODY_ID)!
      .children!.map((c) => c.id);
    const postBody = after
      .get(COMPONENTS_SYSTEM_BODY_ID)!
      .children!.map((c) => c.id);
    expect(postBody.filter((id) => before.has(id))).toEqual(preBody);
    // 사용자 페이지 그대로.
    expect(JSON.stringify(post.children.find((c) => c.id === "page-1"))).toBe(
      JSON.stringify(pre.children.find((c) => c.id === "page-1")),
    );
  });

  it("(ii) 허용 보충 — component-tabs 의 변경 필드는 slot 하나 (Δfield 1)", () => {
    const preTabs = before.get("component-tabs")! as unknown as Record<
      string,
      unknown
    >;
    const postTabs = after.get("component-tabs")! as unknown as Record<
      string,
      unknown
    >;
    const keys = new Set([...Object.keys(preTabs), ...Object.keys(postTabs)]);
    const changedKeys = [...keys].filter(
      (key) => JSON.stringify(preTabs[key]) !== JSON.stringify(postTabs[key]),
    );
    expect(changedKeys).toEqual(["slot"]);
    expect(postTabs.slot).toEqual(TAB_ITEM_IDS);
  });

  it("(ii') 사용자가 둔 slot 은 보존 (보충하지 않는다)", () => {
    const userSlot = ["my-tab-item", "component-tab-item-selected"];
    const preUser = buildPre233Document({ userSlot });
    const postUser = ensureReusableCompositeOrigins(preUser);
    expect(indexById(postUser.children).get("component-tabs")?.slot).toEqual(
      userSlot,
    );
  });

  it("(iii) 추가 노드 16 · Δbyte = 추가 노드 직렬화 + slot 필드 (정확히)", () => {
    const deltaNodes = countNodes(post.children) - countNodes(pre.children);
    expect(deltaNodes).toBe(16);
    // root 만 (변형의 Label 자식 `component-radio--x__1` 은 root 직렬화 안에 들어 있다).
    const addedRoots = [...after.values()].filter(
      (n) => isAdded233Root(n.id) && !n.id.includes("__"),
    );
    expect(addedRoots.map((n) => n.id).sort()).toEqual(
      [
        ...TAB_ITEM_IDS,
        "component-radio",
        "component-radio--disabled",
        "component-radio--focus-visible",
        "component-radio--hover",
        "component-radio--pressed",
        "component-radio--selected",
      ].sort(),
    );
    const slotBytes = `,"slot":${JSON.stringify(TAB_ITEM_IDS)}`.length;
    const addedBytes = addedRoots.reduce(
      (n, node) => n + JSON.stringify(node).length + 1,
      0,
    ); // + 쉼표
    const deltaBytes = postJson.length - preJson.length;
    expect(deltaBytes).toBe(addedBytes + slotBytes);
    // G4 기준값 (2026-09-23 실측, G0 추정 ≈ 3.3 KB) — seed 모양이 바뀌면 breakdown §6 Phase 4 와 같이 갱신.
    expect(deltaBytes).toBe(3487);
    // G0 추정 ≈ 3.3 KB → 실측 기록 (breakdown §6 Phase 4 기준값).
    console.log(
      `[ADR-233 G4] Δnode ${deltaNodes} · Δbyte ${deltaBytes} (노드 ${addedBytes} + slot ${slotBytes})`,
    );
  });

  it("재hydration — Δnode 0 · Δbyte 0 · 직렬화 동일", () => {
    const again = ensureReusableCompositeOrigins(post);
    expect(countNodes(again.children)).toBe(countNodes(post.children));
    expect(JSON.stringify(again)).toBe(postJson);
  });
});
