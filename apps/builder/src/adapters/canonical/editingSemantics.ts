export type EditingSemanticsRole = "origin" | "instance";
export type EditingSemanticsOverrideItem = {
  descendantPath?: string;
  fieldKey: string;
  id: string;
  label: string;
};

type EditingSemanticsElementLike = {
  componentRole?: unknown;
  componentName?: unknown;
  customId?: unknown;
  id?: unknown;
  descendants?: unknown;
  masterId?: unknown;
  metadata?: unknown;
  overrides?: unknown;
  parent_id?: unknown;
  props?: unknown;
  ref?: unknown;
  reusable?: unknown;
  slot?: unknown;
  name?: unknown;
  type?: unknown;
};

function asElementLike(value: unknown): EditingSemanticsElementLike | null {
  if (!value || typeof value !== "object") return null;
  return value as EditingSemanticsElementLike;
}

/**
 * 인스턴스 축 — 이 노드가 다른 노드를 참조하는가 (`ref` / legacy `masterId`).
 *
 * origin 축과 **독립**이다. pencil 도 두 축을 따로 센다 (`c.prototype` 이면
 * detachInstance, `c.reusable` 이면 detachComponent — Pen.app 번들 실측
 * 2026-08-30). 한 노드가 둘 다일 수 있다: 다른 컴포넌트의 인스턴스를 루트로
 * 삼은 컴포넌트 (variant 패턴). `getEditingSemanticsRole` 은 마커용 단일 값이
 * 필요해 instance 를 먼저 고르므로, **액션 가용성 판정에는 이 두 술어를 쓴다**
 * — role 로 판정하면 dual 노드에서 origin 액션이 통째로 사라진다.
 */
export function isEditingSemanticsInstance(element: unknown): boolean {
  const candidate = asElementLike(element);
  if (!candidate) return false;

  // `type` 은 읽지 않는다 (ADR-199 HC3) — 캔버스 사영은 type 을 렌더 컴포넌트로
  // 해소하므로 같은 함수가 표면마다 다르게 답한다. `type:"ref"` 를 만드는 자리
  // 7곳이 전부 `ref` 를 함께 쓰고 (`RefNode.ref` 는 스키마 required) 이 축은
  // 아래 세 필드로 완전히 덮인다.
  return (
    candidate.componentRole === "instance" ||
    typeof candidate.masterId === "string" ||
    typeof candidate.ref === "string"
  );
}

/** origin 축 — 이 노드 자신이 재사용 원본인가 (`reusable`). */
export function isEditingSemanticsOrigin(element: unknown): boolean {
  const candidate = asElementLike(element);
  if (!candidate) return false;

  return candidate.reusable === true || candidate.componentRole === "master";
}

/**
 * 시각 마커 1개를 고르기 위한 단일 역할 값 — 두 축이 겹치면 instance 우선.
 * 액션 가용성은 축 술어 (`isEditingSemanticsInstance` /
 * `isEditingSemanticsOrigin`) 로 판정한다.
 */
export function getEditingSemanticsRole(
  element: unknown,
): EditingSemanticsRole | null {
  if (isEditingSemanticsInstance(element)) return "instance";
  if (isEditingSemanticsOrigin(element)) return "origin";
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function hasSlotArray(value: unknown): boolean {
  return Array.isArray(value);
}

export function hasEditingSlotMarker(element: unknown): boolean {
  const candidate = asElementLike(element);
  if (!candidate) return false;

  const props = asRecord(candidate.props);
  if (
    props?._slotChrome === "hidden" &&
    props?._slotMarkerChrome !== "visible"
  ) {
    return false;
  }

  if (candidate.type === "Slot") return true;
  if (hasSlotArray(candidate.slot)) return true;

  const metadata = asRecord(candidate.metadata);
  return hasSlotArray(metadata?.slot);
}

export function getEditingSlotMarkerRole(
  element: unknown,
  elementsById: Map<string, unknown> = new Map(),
): EditingSemanticsRole | null {
  const candidate = asElementLike(element);
  if (!candidate || !hasEditingSlotMarker(candidate)) return null;

  const ownRole = getEditingSemanticsRole(candidate);
  if (ownRole) return ownRole;

  const visited = new Set<string>();
  let parentId =
    typeof candidate.parent_id === "string" ? candidate.parent_id : null;

  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = elementsById.get(parentId);
    const role = getEditingSemanticsRole(parent);
    if (role) return role;

    const parentLike = asElementLike(parent);
    parentId =
      parentLike && typeof parentLike.parent_id === "string"
        ? parentLike.parent_id
        : null;
  }

  if (typeof candidate.id === "string" && candidate.id.includes("/")) {
    const segments = candidate.id.split("/");
    while (segments.length > 1) {
      segments.pop();
      const ancestor = elementsById.get(segments.join("/"));
      const role = getEditingSemanticsRole(ancestor);
      if (role) return role;
    }
  }

  return "origin";
}

export function getEditingSemanticsLabel(
  role: EditingSemanticsRole | null,
): string | null {
  if (role === "origin") return "Origin";
  if (role === "instance") return "Instance";
  return null;
}

export function getEditingSemanticsOriginId(element: unknown): string | null {
  const candidate = asElementLike(element);
  if (!candidate) return null;

  if (typeof candidate.ref === "string") return candidate.ref;
  if (typeof candidate.masterId === "string") return candidate.masterId;
  return null;
}

export function canDetachLegacyInstance(element: unknown): boolean {
  const candidate = asElementLike(element);
  return candidate?.componentRole === "instance";
}

/**
 * 분리할 원본이 실제로 지목돼 있는가 — `type` 은 보지 않는다.
 *
 * 캔버스 상호작용 elementsMap 은 인스턴스의 `type` 을 렌더되는 컴포넌트
 * (`"Button"` 등) 로 해소해 넘기고 `ref` 만 보존한다. `type === "ref"` 를 함께
 * 요구하면 그 표면에서만 판정이 뒤집혀 **캔버스 컨텍스트 메뉴·선택 툴바에서
 * "인스턴스 분리" 가 통째로 사라진다** (Properties 패널은 canonical 을 읽어
 * 정상이었다 — 2026-08-30 실측). 같은 map 을 읽는
 * `getEditingSemanticsOriginId` 도 이미 `type` 을 보지 않는다.
 */
/**
 * 표면 액션 술어의 입력 — **사영 불변 필드만** (ADR-199 HC3).
 *
 * `type` 이 없는 것이 계약이다. 캔버스 상호작용 map 은 Skia
 * `interactionNodesMap` 파생이라 `type` 이 렌더 컴포넌트(`"Button"`)로
 * 해소되고, 술어가 그것을 읽으면 같은 함수가 표면마다 다르게 답한다.
 */
export interface EditingSemanticsTarget {
  id: string;
  componentRole?: string;
  ref?: string;
  masterId?: string;
  reusable?: boolean;
}

/**
 * 표면의 element 를 target 으로 좁힌다.
 *
 * 표면마다 element 모양이 다르다 — canonical 노드 · 캔버스 사영 · legacy
 * elementsMap mirror. 좁히는 규칙을 한 곳에 두어야 표면별로 다른 필드를
 * 넘기는 일이 생기지 않는다.
 */
export function toEditingSemanticsTarget(
  element: unknown,
): EditingSemanticsTarget | null {
  const candidate = asElementLike(element);
  if (!candidate || typeof candidate.id !== "string") return null;
  return {
    id: candidate.id,
    ...(typeof candidate.componentRole === "string"
      ? { componentRole: candidate.componentRole }
      : {}),
    ...(typeof candidate.ref === "string" ? { ref: candidate.ref } : {}),
    ...(typeof candidate.masterId === "string"
      ? { masterId: candidate.masterId }
      : {}),
    ...(candidate.reusable === true ? { reusable: true } : {}),
  };
}

export function canDetachInstance(element: unknown): boolean {
  const candidate = asElementLike(element);
  return (
    candidate?.componentRole === "instance" ||
    typeof candidate?.ref === "string" ||
    typeof candidate?.masterId === "string"
  );
}

function getCanonicalOverrideFieldKeys(
  override: Record<string, unknown>,
): string[] {
  const canonicalProps = asRecord(override.props);
  if (canonicalProps) return Object.keys(canonicalProps);

  const {
    children: _children,
    descendants: _descendants,
    id: _id,
    metadata: _metadata,
    name: _name,
    ref: _ref,
    reusable: _reusable,
    type: _type,
    ...props
  } = override;
  return Object.keys(props);
}

export function getEditingSemanticsOverrideFields(element: unknown): string[] {
  const candidate = asElementLike(element);
  if (!candidate) return [];

  if (candidate.componentRole === "instance") {
    return Object.keys(asRecord(candidate.overrides) ?? {});
  }

  if (candidate.type === "ref") {
    return Object.keys(asRecord(candidate.props) ?? {});
  }

  return [];
}

export function getEditingSemanticsOverrideItems(
  element: unknown,
): EditingSemanticsOverrideItem[] {
  const candidate = asElementLike(element);
  if (!candidate) return [];

  const rootFields = getEditingSemanticsOverrideFields(candidate).map(
    (fieldKey) => ({
      fieldKey,
      id: `root:${fieldKey}`,
      label: fieldKey,
    }),
  );

  if (candidate.type !== "ref") return rootFields;

  const descendants = asRecord(candidate.descendants);
  if (!descendants) return rootFields;

  const descendantFields = Object.entries(descendants).flatMap(
    ([descendantPath, override]) => {
      const overrideRecord = asRecord(override);
      if (!overrideRecord) return [];

      return getCanonicalOverrideFieldKeys(overrideRecord).map((fieldKey) => ({
        descendantPath,
        fieldKey,
        id: `descendant:${descendantPath}:${fieldKey}`,
        label: `${descendantPath}.${fieldKey}`,
      }));
    },
  );

  return [...rootFields, ...descendantFields];
}

export function getEditingSemanticsInstanceIds(
  originId: string,
  elements: Iterable<unknown>,
): string[] {
  const instanceIds: string[] = [];

  for (const element of elements) {
    const candidate = asElementLike(element);
    if (!candidate) continue;
    if (getEditingSemanticsRole(candidate) !== "instance") continue;
    if (getEditingSemanticsOriginId(candidate) !== originId) continue;

    const id = (candidate as { id?: unknown }).id;
    if (typeof id === "string") {
      instanceIds.push(id);
    }
  }

  return instanceIds;
}

export function getEditingSemanticsImpactInstanceIds(
  originElement: unknown,
  elements: Iterable<unknown>,
): string[] {
  const origin = asElementLike(originElement);
  if (!origin) return [];

  const originKeys = new Set<string>();
  const metadata = asRecord(origin.metadata);
  for (const value of [
    origin.id,
    origin.customId,
    origin.componentName,
    origin.name,
    metadata?.customId,
    metadata?.componentName,
  ]) {
    if (typeof value === "string" && value.length > 0) {
      originKeys.add(value);
    }
  }
  if (originKeys.size === 0) return [];

  const instanceIds: string[] = [];
  for (const element of elements) {
    const candidate = asElementLike(element);
    if (!candidate) continue;
    if (getEditingSemanticsRole(candidate) !== "instance") continue;
    const originId = getEditingSemanticsOriginId(candidate);
    if (!originId || !originKeys.has(originId)) continue;
    if (typeof candidate.id === "string") {
      instanceIds.push(candidate.id);
    }
  }

  return instanceIds;
}
