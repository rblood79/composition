/**
 * ADR-237 Phase 1 — Slot "+" = 그룹 컨테이너 (CheckboxGroup · RadioGroup · ToggleButtonGroup · DisclosureGroup ·
 * ButtonGroup · Pagination · AvatarGroup · Nav · Toolbar) 에 항목 instance 삽입 (breakdown §4 Phase 1).
 *
 * - 항목은 slot 후보가 아니라 **가족 origin (체인 끝)** 을 가리킨다 — 상태 변형을 직접 ref 하면 실행 중 상태가
 *   그 patch 를 이기지 못한다 (234 `collectionItemInsert` 와 같은 규칙). 후보가 고른 상태는 기존 prop 값으로 남긴다:
 *   선택 모양 (`metadata.variant: "selected"`) → `isSelected: true` · 휴지 (`unselected`) → `false` · `disabled` →
 *   `isDisabled: true` · 접힘 (`collapsed`) → `isExpanded: false`. hover · pressed · focus-visible 은 저작 prop 이
 *   없어 origin 그대로.
 * - 선택 계약은 바꾸지 않는다 (review round 1 h1): 두 leg 의 reader 는 자식 `isSelected` (Checkbox · ToggleButton ·
 *   Preview Radio) · 그룹 `value` 우선 (Canvas Radio) 그대로. Radio 는 RAC key 가 `value` 라 그룹 안 유일값을 배정한다.
 * - 단일 선택 정규화 (review round 2 h3): RadioGroup 에 선택 항목을 넣으면 새 Radio `isSelected: true` · 형제
 *   `isSelected: false` · 그룹 `value` = 새 값 (Preview onChange writeback 과 같은 모양). `selectionMode: "single"`
 *   ToggleButtonGroup 은 형제 해제만 (writeback 이 자식만 쓴다). 호출자는 계획 전체를 한 history 항목으로 쓴다.
 * - host 가 ref instance 면 항목은 instance 자기 자식 (두 leg 모두 origin 자식 뒤 — ADR-234 3d) 이고, origin 에서
 *   상속한 형제의 해제는 instance `descendants` patch 로 쓴다.
 */
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { getCanonicalRefPathSegment } from "../../adapters/canonical/canonicalRefResolution";
import { GROUP_SLOT_HOSTS } from "./slotHostPolicy";
import { indexNodes, resolveChainEnd } from "./staticCollectionMigration";

type RefLike = CanonicalNode & {
  ref?: string;
  descendants?: Record<string, unknown>;
};

export interface GroupItemInsertPlan {
  /** 새 자식을 넣을 host (plain 그룹 또는 그룹 ref instance) */
  hostId: string;
  /** 새 항목 instance (`type: "ref"` → 가족 origin) */
  child: CanonicalNode;
  /** 같은 history 항목에서 쓸 props patch (plain 형제 · 그룹 자신 · instance 자기 props) */
  propsUpdates: Array<{ id: string; props: Record<string, unknown> }>;
  /** host 가 instance 일 때 origin 에서 상속한 형제 해제 — instance `descendants` 다음 값 (없으면 null) */
  instanceDescendants: Record<string, unknown> | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** ref 체인을 따라 props 를 합친 값 (origin → … → 자기). */
function chainProps(
  node: CanonicalNode | undefined,
  byId: ReadonlyMap<string, CanonicalNode>,
  depth = 0,
): Record<string, unknown> {
  if (!node || depth > 8) return {};
  const own = (node.props ?? {}) as Record<string, unknown>;
  if (node.type !== "ref") return own;
  return {
    ...chainProps(byId.get((node as RefLike).ref ?? ""), byId, depth + 1),
    ...own,
  };
}

/** descendants patch (mode A) 의 props 부분. */
function patchProps(patch: unknown): Record<string, unknown> {
  if (!isRecord(patch)) return {};
  if (isRecord(patch.props)) return patch.props;
  const {
    children,
    fills: _f,
    enabled: _e,
    sizing: _s,
    responsive: _r,
    descendants: _d,
    ...props
  } = patch;
  return children !== undefined && !Array.isArray(children)
    ? { ...props, children }
    : props;
}

/** 후보가 고른 상태 → 새 항목 prop. */
function statePropsOf(candidate: CanonicalNode): Record<string, unknown> {
  switch ((candidate.metadata as { variant?: unknown } | undefined)?.variant) {
    case "selected":
      return { isSelected: true };
    case "unselected":
      return { isSelected: false };
    case "disabled":
      return { isDisabled: true };
    case "collapsed":
      return { isExpanded: false };
    default:
      return {};
  }
}

interface Sibling {
  /** plain 형제 (host 자식) 면 노드 id, instance 가 상속한 origin 자식이면 null */
  ownId: string | null;
  /** instance descendants 키 (상속 형제만) */
  path: string | null;
  type: string;
  props: Record<string, unknown>;
}

/** ADR-239 Phase 4 — swatch 후보 색 (factory 6 색 다음 순서). 다 쓰면 색상환을 더 잘게 나눈다. */
const SWATCH_COLOR_SEQUENCE: readonly string[] = [
  "#FF0000",
  "#00FF00",
  "#0000FF",
  "#FFFF00",
  "#FF00FF",
  "#00FFFF",
  "#FF8000",
  "#8000FF",
  "#0080FF",
  "#FF0080",
  "#80FF00",
  "#00FF80",
  "#000000",
  "#FFFFFF",
  "#808080",
];

function normalizeHex(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function pickUnusedSwatchColor(taken: ReadonlySet<string>): string {
  for (const color of SWATCH_COLOR_SEQUENCE) {
    if (!taken.has(color)) return color;
  }
  for (let step = 1; step < 4096; step += 1) {
    const hue = (step * 137.508) % 360;
    const color = hslToHex(hue, 70, 50);
    if (!taken.has(color)) return color;
  }
  return "#000000";
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) =>
    light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`.toUpperCase();
}

export function planGroupItemInsert(input: {
  document: CompositionDocument;
  hostId: string;
  candidateId: string;
  newId: string;
}): GroupItemInsertPlan | null {
  const { document, hostId, candidateId, newId } = input;
  const byId = indexNodes(document);
  const host = byId.get(hostId) as RefLike | undefined;
  const candidate = byId.get(candidateId);
  if (!host || !candidate) return null;
  const isInstance = host.type === "ref";
  const groupNode = isInstance ? resolveChainEnd(host.ref, byId) : host;
  const group = GROUP_SLOT_HOSTS.find((row) => row.type === groupNode?.type);
  const origin = resolveChainEnd(candidateId, byId);
  if (!groupNode || !group || !origin) return null;
  if (!group.originIds.includes(origin.id)) return null;
  const itemTypes = new Set(group.itemTypes);

  const siblings: Sibling[] = [];
  if (isInstance) {
    for (const child of groupNode.children ?? []) {
      const path = getCanonicalRefPathSegment(child);
      const endType = resolveChainEnd(child.id, byId)?.type ?? child.type;
      siblings.push({
        ownId: null,
        path,
        type: endType,
        props: {
          ...chainProps(child, byId),
          ...patchProps(host.descendants?.[path]),
        },
      });
    }
  }
  for (const child of host.children ?? []) {
    siblings.push({
      ownId: child.id,
      path: null,
      type: resolveChainEnd(child.id, byId)?.type ?? child.type,
      props: chainProps(child, byId),
    });
  }
  const items = siblings.filter((sibling) => itemTypes.has(sibling.type));

  const props: Record<string, unknown> = { ...statePropsOf(candidate) };
  // Radio 는 RAC key = `value` — 그룹 안 유일값 (Checkbox · ToggleButton · Disclosure 는 node id 라 유일).
  if (origin.type === "Radio") {
    const taken = new Set(
      items
        .filter((item) => item.type === "Radio")
        .map((item) => String(item.props.value ?? "")),
    );
    let n = items.filter((item) => item.type === "Radio").length + 1;
    while (taken.has(`option${n}`)) n += 1;
    props.value = `option${n}`;
  }

  // ADR-239 Phase 4 — ColorSwatch 는 RAC key = 색 (`color.toString("hexa")`, N3) — 같은 색 swatch 둘은 한 항목으로
  //   합쳐진다. 형제와 다른 색을 배정하고, 크기 · 모양은 마지막 형제 swatch 의 style 을 따른다 (picker 안 크기).
  if (origin.type === "ColorSwatch") {
    const swatches = items.filter((item) => item.type === "ColorSwatch");
    const taken = new Set(
      swatches.map((item) => normalizeHex(item.props.color)),
    );
    props.color = pickUnusedSwatchColor(taken);
    const last = swatches.at(-1);
    if (last && isRecord(last.props.style)) props.style = { ...last.props.style };
  }

  const propsUpdates: GroupItemInsertPlan["propsUpdates"] = [];
  let instanceDescendants: Record<string, unknown> | null = null;
  const groupProps = chainProps(host, byId);
  const singleSelection =
    props.isSelected === true &&
    (group.type === "RadioGroup" ||
      (group.type === "ToggleButtonGroup" &&
        groupProps.selectionMode === "single"));
  if (singleSelection) {
    for (const item of items) {
      if (item.type !== origin.type || item.props.isSelected !== true) continue;
      if (item.ownId) {
        propsUpdates.push({ id: item.ownId, props: { isSelected: false } });
      } else if (item.path) {
        instanceDescendants ??= { ...(host.descendants ?? {}) };
        const current = instanceDescendants[item.path];
        instanceDescendants[item.path] = {
          ...(isRecord(current) ? current : {}),
          isSelected: false,
        };
      }
    }
    // RadioGroup — Canvas 는 그룹 `value` 를 먼저 읽는다 (F14): 새 값으로.
    if (group.type === "RadioGroup") {
      propsUpdates.push({ id: host.id, props: { value: props.value } });
    }
  }

  const child = {
    id: newId,
    type: "ref",
    ref: origin.id,
    props,
  } as unknown as CanonicalNode;
  return { hostId: host.id, child, propsUpdates, instanceDescendants };
}
