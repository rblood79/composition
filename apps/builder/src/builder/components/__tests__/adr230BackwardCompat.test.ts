import { describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import { resolveCanonicalRefTree } from "@/adapters/canonical/canonicalRefResolution";
import { ensureReusableCompositeOrigins } from "../reusableCompositeOrigins";
import {
  STATE_VARIANT_BASE_TYPES,
  ensureStateVariantOrigins,
  readStateVariantSelf,
  stateVariantOriginId,
} from "../stateVariantOrigins";
import { COMPONENTS_SYSTEM_BODY_ID } from "../../pages/systemComponentsPage";

/**
 * ADR-230 Phase 3 — G4 BC (breakdown §3 Phase 3).
 *
 * "ADR-230 이전 문서" = ADR-229 hydration 까지 지난 모양 (origin 57 + Tag item origin 2 + 조합 자식 ref) 에서
 * 상태 변형 origin 을 전부 뺀 것 + 사용자 저작 (Components body 순서 변경 · 사용자 페이지의 plain Button 과
 * `isSelected` ToggleButton instance). 230 hydration 을 지나면:
 *   - 기존 노드의 props/children/순서 직렬화 불변 — 필드 추가 0 (229 의 slot 같은 것도 없다)
 *   - 최초 보충량 = 기본 요소 5 × 상태 (Button/Link 4 · ToggleButton/Checkbox/Switch 5) = root 23 +
 *     Checkbox/Switch 의 Label 자식 10 = Δnode 33 · Δbyte 는 그 직렬화 길이와 정확히 같다
 *   - 변형은 default 바로 뒤에 붙는다 (body 끝이 아니다) — 사용자가 옮긴 default 를 따라간다
 *   - 두 번째 실행은 Δnode 0 · Δbyte 0 · 직렬화 동일
 *   - 롤백: seed 를 끄면 (변형 없는 문서) 해소기는 plain 경로 (projection null) · 변형이 있는 저장 문서는 그대로 읽힌다
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

// ADR-237 Phase 2: 상태 변형 표가 항목 템플릿 · Disclosure 로 넓어졌다 — 이 BC 는 230 가족 (기본 요소 6,
//   origin id = `component-${type}`) 만 잰다. 237 변형 (IconButton · 항목 · Disclosure) 은 pre · post 양쪽에 있다.
const BASE_230_TYPES = [
  "Button",
  "ToggleButton",
  "Link",
  "Checkbox",
  "Switch",
  "Radio",
] as const;
const BASE_230: Readonly<Record<string, readonly string[]>> =
  Object.fromEntries(
    BASE_230_TYPES.map((type) => [type, STATE_VARIANT_BASE_TYPES[type]!]),
  );

const BUTTON_ORIGIN_ID = "component-button";
const TOGGLE_ORIGIN_ID = "component-togglebutton";

// ADR-234: 선택 가능한 가족은 origin = 선택 상태 · selected 자리는 휴지 (`unselected`) 변형.
const seededStates = (states: readonly string[]) =>
  states.map((state) => (state === "selected" ? "unselected" : state));
const EXPECTED_VARIANT_IDS = Object.entries(BASE_230).flatMap(
  ([type, states]) =>
    seededStates(states).map((state) =>
      stateVariantOriginId(
        `component-${type.toLowerCase()}`,
        state as Parameters<typeof stateVariantOriginId>[1],
      ),
    ),
);
const SELECTABLE_ORIGIN_IDS = Object.entries(BASE_230)
  .filter(([, states]) => states.includes("selected"))
  .map(([type]) => `component-${type.toLowerCase()}`);

/** ADR-229 모양 (230 이전): 전체 hydration − 상태 변형 origin. 사용자 저작: Button origin 을 body 맨 뒤로 · 사용자 페이지. */
function buildPre230Document(): CompositionDocument {
  const full = ensureReusableCompositeOrigins({
    version: "composition-1.0",
    children: [],
  });
  // 230 이전 = 변형 0 · origin 에 234 선택 상태 표식도 없다.
  const baseOriginIds = new Set(
    Object.keys(BASE_230).map((type) => `component-${type.toLowerCase()}`),
  );
  const stripped = mapNodes(full.children, (node) => {
    const self = readStateVariantSelf(node);
    if (self && baseOriginIds.has(self.variantOf)) return null;
    const metadata = node.metadata as Record<string, unknown> | undefined;
    if (baseOriginIds.has(node.id) && metadata?.variant === "selected") {
      const { variant: _variant, ...rest } = metadata;
      return { ...node, metadata: rest } as CanonicalNode;
    }
    return node;
  });
  const body = findNode(stripped, COMPONENTS_SYSTEM_BODY_ID)!;
  const button = body.children!.find((n) => n.id === BUTTON_ORIGIN_ID)!;
  const reordered = [
    ...body.children!.filter((n) => n.id !== BUTTON_ORIGIN_ID),
    button,
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
            props: { children: "Plain", isDisabled: true },
          },
          {
            id: "toggle-inst",
            type: "ref",
            ref: TOGGLE_ORIGIN_ID,
            props: { isSelected: true, style: { opacity: 0.7 } },
          },
        ],
      },
    ],
  } as unknown as CanonicalNode;
  return { ...full, children: [...withUserEdits, userPage] };
}

describe("ADR-230 Phase 3 — G4 BC", () => {
  const pre = buildPre230Document();
  const preJson = JSON.stringify(pre);
  const post = ensureReusableCompositeOrigins(pre);
  const postJson = JSON.stringify(post);

  // ADR-233 Phase 2: Radio 가 기본 요소에 합류 (팔레트 밖 reusable `component-radio`) — 6 · 변형 28.
  it("pre 문서에는 변형 origin 이 0 · 기본 요소 origin 6 은 있다", () => {
    const ids = indexById(pre.children);
    expect(EXPECTED_VARIANT_IDS.some((id) => ids.has(id))).toBe(false);
    for (const type of Object.keys(BASE_230)) {
      expect(ids.has(`component-${type.toLowerCase()}`)).toBe(true);
    }
    expect(EXPECTED_VARIANT_IDS).toHaveLength(28);
  });

  it("기존 노드 (origin + 자식 + 사용자 저작) 는 props/children/순서 직렬화 불변 — 선택 가능한 origin 의 234 표식 (metadata.variant) 1 필드만", () => {
    const before = indexById(pre.children);
    const after = indexById(post.children);
    const changed: string[] = [];
    for (const [id, node] of before) {
      const next = after.get(id);
      if (!next) {
        changed.push(`${id}: 사라짐`);
        continue;
      }
      const nextWithoutMark = SELECTABLE_ORIGIN_IDS.includes(id)
        ? (() => {
            const { variant, ...rest } = (next.metadata ?? {}) as Record<
              string,
              unknown
            >;
            expect(variant, id).toBe("selected");
            return { ...next, metadata: rest } as CanonicalNode;
          })()
        : next;
      if (
        ownSerialization(node) !==
        ownSerialization(nextWithoutMark, new Set(before.keys()))
      )
        changed.push(id);
    }
    expect(changed).toEqual([]);
    // 기존 body 순서 (Button 을 맨 뒤로 옮긴 것 포함) 는 변형을 빼고 보면 그대로.
    const bodyIds = after
      .get(COMPONENTS_SYSTEM_BODY_ID)!
      .children!.map((c) => c.id);
    const preBodyIds = before
      .get(COMPONENTS_SYSTEM_BODY_ID)!
      .children!.map((c) => c.id);
    expect(bodyIds.filter((id) => before.has(id))).toEqual(preBodyIds);
    // 사용자 페이지 그대로.
    expect(JSON.stringify(findNode(post.children, "page-1"))).toBe(
      JSON.stringify(findNode(pre.children, "page-1")),
    );
  });

  it("변형은 default 바로 뒤 (body 끝이 아니다) — 사용자가 맨 뒤로 옮긴 Button 의 변형 4 는 그 뒤 4 칸", () => {
    const bodyIds = findNode(
      post.children,
      COMPONENTS_SYSTEM_BODY_ID,
    )!.children!.map((c) => c.id);
    for (const [type, states] of Object.entries(BASE_230)) {
      const base = `component-${type.toLowerCase()}`;
      const i = bodyIds.indexOf(base);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(bodyIds.slice(i + 1, i + 1 + states.length)).toEqual(
        seededStates(states).map((s) =>
          stateVariantOriginId(
            base,
            s as Parameters<typeof stateVariantOriginId>[1],
          ),
        ),
      );
    }
    expect(bodyIds.slice(-5)).toEqual([
      BUTTON_ORIGIN_ID,
      ...STATE_VARIANT_BASE_TYPES.Button!.map((s) =>
        stateVariantOriginId(BUTTON_ORIGIN_ID, s),
      ),
    ]);
  });

  // ADR-233 Phase 2: Radio 합류 · ADR-234: 변형 = origin 의 ref (자식 복제 0) — Δnode 28 (root 만).
  it("최초 보충량 — Δnode 28 (ref 변형 root) · Δbyte = 그 직렬화 + 선택 가능한 origin 표식 (정확히)", () => {
    const deltaNodes = countNodes(post.children) - countNodes(pre.children);
    expect(deltaNodes).toBe(28);
    const added = EXPECTED_VARIANT_IDS.map((id) =>
      findNode(post.children, id)!,
    );
    expect(added.every(Boolean)).toBe(true);
    const originBytes = added.reduce(
      (n, node) => n + JSON.stringify(node).length + 1,
      0,
    ); // + 쉼표
    const markBytes =
      SELECTABLE_ORIGIN_IDS.length * ',"variant":"selected"'.length;
    const deltaBytes = postJson.length - preJson.length;
    expect(deltaBytes).toBe(originBytes + markBytes);
    // 시드 값: origin 의 ref · patch 비움 · fills 없음 · 자식 없음 (origin 상속)
    for (const node of added) {
      expect(node.type).toBe("ref");
      expect(node.props).toEqual({});
      expect(node.fills).toBeUndefined();
      expect(node.children).toBeUndefined();
    }
    console.log(
      `[ADR-230 G4] 최초 보충 Δnode ${deltaNodes} · Δbyte ${deltaBytes}`,
    );
  });

  it("재hydration — 두 번째 실행은 Δnode 0 · Δbyte 0 · 직렬화 동일 (같은 문서 객체)", () => {
    const again = ensureReusableCompositeOrigins(post);
    expect(countNodes(again.children) - countNodes(post.children)).toBe(0);
    expect(JSON.stringify(again)).toBe(postJson);
    expect(ensureStateVariantOrigins(post)).toBe(post);
  });

  it("롤백 — seed 를 끈 문서 (변형 0) 는 해소기가 plain 경로 (projection 없음) · 변형이 있는 저장 문서는 그대로 읽힌다", () => {
    const resolveInstance = (doc: CompositionDocument) => {
      const nodeMap = indexById(doc.children);
      const childrenMap = new Map<string, CanonicalNode[]>();
      for (const node of nodeMap.values()) {
        if (node.children?.length) childrenMap.set(node.id, [...node.children]);
      }
      const instance = nodeMap.get("toggle-inst")!;
      const tree = resolveCanonicalRefTree<CanonicalNode>({
        elements: [instance],
        elementsMap: nodeMap,
        childrenMap,
      });
      return tree.elementsMap.get("toggle-inst")!;
    };
    const rolledBack = resolveInstance(pre);
    expect(rolledBack.type).toBe("ToggleButton");
    expect(rolledBack.props?._stateVariants).toBeUndefined();
    const withVariants = resolveInstance(post);
    expect(withVariants.type).toBe("ToggleButton");
    // ADR-234: Canvas 는 projection 을 싣지 않는다 — seed 변형은 비어 있어 결과 props 가 plain 과 같다.
    expect(withVariants.props?._stateVariants).toBeUndefined();
    expect(withVariants.props).toEqual(rolledBack.props);
  });
});
