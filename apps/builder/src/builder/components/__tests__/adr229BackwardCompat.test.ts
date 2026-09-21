import { describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import { getReusableEntries } from "@composition/shared";
import { resolveCanonicalRefTree } from "@/adapters/canonical/canonicalRefResolution";
import {
  ensureReusableCompositeOrigins,
  getReusableOriginEnsurers,
} from "../reusableCompositeOrigins";
import { convertNewOriginChildrenToRefs } from "../originChildRefs";
import { ensureStateVariantOrigins } from "../stateVariantOrigins";
import {
  TAG_ITEM_DEFAULT_ORIGIN_ID,
  TAG_ITEM_SELECTED_ORIGIN_ID,
  TAG_ITEM_TEMPLATE_SLOT,
  TAGGROUP_ORIGIN_ID,
} from "../taggroup/tagGroupTemplateOrigins";
import { FORM_ORIGIN_ID } from "../form/formTemplateOrigins";
import { TOOLBAR_ORIGIN_ID } from "../toolbar/toolbarTemplateOrigins";
import { COMPONENTS_SYSTEM_BODY_ID } from "../../pages/systemComponentsPage";

/**
 * ADR-229 Phase 4 — G4 BC (breakdown §3 Phase 4).
 *
 * "ADR-229 이전 문서" = ADR-228 이 만든 모양 — origin 57 의 자식이 전부 plain · Tag item origin 없음 ·
 * `component-taggroup.slot` 없음 — 에 사용자 저작 (사용자 페이지 plain Button · Form instance 의 descendants ·
 * Toolbar origin 자식 라벨 편집 · origin 순서 변경) 을 얹은 문서다. 229 hydration 을 지나면:
 *   - 기존 노드 (origin 57 + 자식 + 사용자 저작) 의 props/children/순서 직렬화 불변 — 유일한 필드 추가는
 *     `component-taggroup.slot` (처음 없는 template 을 보충하는 일)
 *   - 최초 보충량 = Tag item origin 2 (root 2 + Icon/Avatar/Text 6) = Δnode 8 · Δbyte 는 그 직렬화 길이와 정확히 같다
 *   - 두 번째 실행은 Δnode 0 · Δbyte 0 · 직렬화 동일
 *   - 롤백: 신규 ref seed (조합 자식 변환) 만 끄고 해소기는 유지해도 이미 저장된 중첩 ref 문서가 읽힌다
 */

function countNodes(nodes: readonly CanonicalNode[]): number {
  let n = 0;
  for (const node of nodes) n += 1 + countNodes(node.children ?? []);
  return n;
}

function findNode(
  nodes: readonly CanonicalNode[],
  id: string,
): CanonicalNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children ?? [], id);
    if (found) return found;
  }
  return undefined;
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

/**
 * 노드의 "자기" 직렬화 — children 은 id 열로만 (순서 비교), 나머지 필드 전부. `knownIds` 를 주면 그
 * 집합 밖 자식 id 는 빼고 센다 (보충된 origin 이 body 끝에 붙는 것은 기존 순서 불변과 별개).
 */
function ownSerialization(
  node: CanonicalNode,
  knownIds?: ReadonlySet<string>,
): string {
  const { children, ...rest } = node;
  return JSON.stringify({
    ...rest,
    childIds: (children ?? [])
      .map((child) => child.id)
      .filter((id) => !knownIds || knownIds.has(id)),
  });
}

/** ADR-228 모양 (229 이전): ensurer 단계 ① 만 (plain 자식) − Tag item origin − TagGroup root slot. */
function buildPre229Document(): CompositionDocument {
  const base: CompositionDocument = {
    version: "composition-1.0",
    children: [],
  };
  let next = base;
  const applied = new Set<
    (document: CompositionDocument) => CompositionDocument
  >();
  for (const entry of getReusableEntries()) {
    const ensure = getReusableOriginEnsurers()[entry.reusableId];
    if (!ensure || applied.has(ensure)) continue;
    applied.add(ensure);
    next = ensure(next);
  }
  // ADR-230 (같은 hydration post-pass) 의 상태 변형 origin 은 이 테스트의 측정 대상이 아니다 —
  //   pre 문서에 미리 실어 Δ 가 229 의 보충량 (Tag item origin 2) 만 남게 한다. 230 의 최초 보충량은
  //   `adr230BackwardCompat.test.ts` 가 잰다.
  next = ensureStateVariantOrigins(next);
  const tagItemIds = new Set<string>([
    TAG_ITEM_DEFAULT_ORIGIN_ID,
    TAG_ITEM_SELECTED_ORIGIN_ID,
  ]);
  const stripped = mapNodes(next.children, (node) => {
    if (tagItemIds.has(node.id)) return null;
    if (node.id === TAGGROUP_ORIGIN_ID) {
      const { slot: _slot, ...rest } = node as CanonicalNode & {
        slot?: unknown;
      };
      return rest as CanonicalNode;
    }
    return node;
  });
  // 사용자 저작: Toolbar origin 자식 라벨 편집 · origin 순서 변경 (Toolbar 를 맨 뒤로) · 사용자 페이지.
  const body = findNode(stripped, COMPONENTS_SYSTEM_BODY_ID)!;
  const toolbar = body.children!.find((n) => n.id === TOOLBAR_ORIGIN_ID)!;
  const editedToolbar: CanonicalNode = {
    ...toolbar,
    children: toolbar.children!.map((child, i) =>
      i === 0
        ? { ...child, props: { ...child.props, children: "My action" } }
        : child,
    ),
  };
  const reordered = [
    ...body.children!.filter((n) => n.id !== TOOLBAR_ORIGIN_ID),
    editedToolbar,
  ];
  const withUserEdits = mapNodes(stripped, (node) =>
    node.id === COMPONENTS_SYSTEM_BODY_ID
      ? { ...node, children: reordered }
      : node,
  );
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
            id: "plain-button",
            type: "Button",
            props: { children: "Plain", variant: "accent" },
          },
          {
            id: "form-inst",
            type: "ref",
            ref: FORM_ORIGIN_ID,
            props: {},
            descendants: {
              "ButtonGroup/component-buttongroup__2": { children: "Go" },
            },
          },
        ],
      },
    ],
  } as unknown as CanonicalNode;
  return { ...next, children: [...withUserEdits, userPage] };
}

describe("ADR-229 Phase 4 — G4 BC", () => {
  const pre = buildPre229Document();
  const preJson = JSON.stringify(pre);
  const post = ensureReusableCompositeOrigins(pre);
  const postJson = JSON.stringify(post);

  it("기존 노드 (origin 57 + plain 자식 + 사용자 저작) 는 props/children/순서 직렬화 불변 — 유일한 추가 필드는 TagGroup root slot", () => {
    const before = indexById(pre.children);
    const after = indexById(post.children);
    const changed: string[] = [];
    for (const [id, node] of before) {
      const next = after.get(id);
      if (!next) {
        changed.push(`${id}: 사라짐`);
        continue;
      }
      if (
        ownSerialization(node) !==
        ownSerialization(next, new Set(before.keys()))
      )
        changed.push(id);
    }
    expect(changed).toEqual([TAGGROUP_ORIGIN_ID]);
    // 보충된 origin 2 는 Components body 끝에 붙는다 — 기존 순서 (Toolbar 를 맨 뒤로 옮긴 것 포함) 그대로.
    const bodyIds = after
      .get(COMPONENTS_SYSTEM_BODY_ID)!
      .children!.map((c) => c.id);
    const preBodyIds = before
      .get(COMPONENTS_SYSTEM_BODY_ID)!
      .children!.map((c) => c.id);
    expect(bodyIds.slice(0, preBodyIds.length)).toEqual(preBodyIds);
    expect(bodyIds.slice(preBodyIds.length).sort()).toEqual(
      [TAG_ITEM_DEFAULT_ORIGIN_ID, TAG_ITEM_SELECTED_ORIGIN_ID].sort(),
    );
    const tagGroupBefore = before.get(TAGGROUP_ORIGIN_ID) as CanonicalNode & {
      slot?: unknown;
    };
    const tagGroupAfter = after.get(TAGGROUP_ORIGIN_ID) as CanonicalNode & {
      slot?: unknown;
    };
    expect(tagGroupBefore.slot).toBeUndefined();
    expect(tagGroupAfter.slot).toEqual([...TAG_ITEM_TEMPLATE_SLOT]);
    expect(
      ownSerialization({ ...tagGroupAfter, slot: undefined } as CanonicalNode),
    ).toBe(
      ownSerialization({ ...tagGroupBefore, slot: undefined } as CanonicalNode),
    );
    // 기존 origin 의 plain 자식은 ref 로 바뀌지 않았다 (Form · Toolbar 포함) — 사용자 편집 라벨 그대로.
    const form = after.get(FORM_ORIGIN_ID)!;
    expect(form.children!.map((c) => c.type)).not.toContain("ref");
    const toolbar = after.get(TOOLBAR_ORIGIN_ID)!;
    expect(toolbar.children![0].props?.children).toBe("My action");
    // 사용자 페이지 (plain Button · Form instance descendants) 그대로.
    expect(JSON.stringify(findNode(post.children, "page-1"))).toBe(
      JSON.stringify(findNode(pre.children, "page-1")),
    );
  });

  it("최초 보충량 — Δnode 8 (Tag item origin root 2 + slot 자식 6) · Δbyte = 그 직렬화 + slot 필드 (정확히)", () => {
    const deltaNodes = countNodes(post.children) - countNodes(pre.children);
    expect(deltaNodes).toBe(8);
    const added = [TAG_ITEM_DEFAULT_ORIGIN_ID, TAG_ITEM_SELECTED_ORIGIN_ID].map(
      (id) => findNode(post.children, id)!,
    );
    expect(added.map((n) => n.children?.map((c) => c.type))).toEqual([
      ["Icon", "Avatar", "Text"],
      ["Icon", "Avatar", "Text"],
    ]);
    const originBytes = added.reduce(
      (n, node) => n + JSON.stringify(node).length + 1,
      0,
    ); // + 쉼표
    const slotBytes =
      `"slot":${JSON.stringify(TAG_ITEM_TEMPLATE_SLOT)}`.length + 1; // + 쉼표
    const deltaBytes = postJson.length - preJson.length;
    expect(deltaBytes).toBe(originBytes + slotBytes);
    console.log(
      `[ADR-229 G4] 최초 보충 Δnode ${deltaNodes} · Δbyte ${deltaBytes} (origin ${originBytes} + slot ${slotBytes})`,
    );
  });

  it("재hydration — 두 번째 실행은 Δnode 0 · Δbyte 0 · 직렬화 동일", () => {
    const again = ensureReusableCompositeOrigins(post);
    expect(countNodes(again.children) - countNodes(post.children)).toBe(0);
    expect(JSON.stringify(again)).toBe(postJson);
  });

  it("롤백 — 신규 ref seed (조합 자식 변환) 만 끄고 해소기는 유지: 이미 저장된 중첩 ref 문서 (신규 프로젝트 모양) 가 읽힌다", () => {
    // 신규 프로젝트 = 229 모양 (Form 자식 ref) + 사용자 Form instance.
    const fresh = ensureReusableCompositeOrigins({
      version: "composition-1.0",
      children: [findNode(pre.children, "page-1")!],
    });
    const formOrigin = findNode(fresh.children, FORM_ORIGIN_ID)!;
    expect(formOrigin.children!.map((c) => c.type)).toEqual([
      "ref",
      "ref",
      "ref",
    ]);
    // 변환 단계만 끈 hydration (진입 시 origin 전부 기존 취급) — 문서 불변.
    const rolledBack = convertNewOriginChildrenToRefs(fresh, {
      existingOriginIds: new Set(indexById(fresh.children).keys()),
    });
    expect(JSON.stringify(rolledBack.document)).toBe(JSON.stringify(fresh));
    // 해소기: 사용자 Form instance 의 중첩 ref (ButtonGroup ref 안 Button ref) 가 실체화되고 descendants 가 닿는다.
    const nodeMap = indexById(rolledBack.document.children);
    const childrenMap = new Map<string, CanonicalNode[]>();
    for (const node of nodeMap.values()) {
      if (node.children?.length) childrenMap.set(node.id, [...node.children]);
    }
    const instance = nodeMap.get("form-inst")!;
    const tree = resolveCanonicalRefTree<CanonicalNode>({
      elements: [instance],
      elementsMap: nodeMap,
      childrenMap,
    });
    const save = tree.elementsMap.get(
      "form-inst/ButtonGroup/component-buttongroup__2",
    );
    expect(save?.type).toBe("Button");
    expect(save?.props?.children).toBe("Go");
  });
});
