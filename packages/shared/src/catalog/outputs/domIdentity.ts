/**
 * 사용자가 지정한 DOM 식별자(`customId`) → 렌더 DOM `id` 투영 규칙.
 *
 * **왜 별도 규칙인가**: `id`/`class` 는 컴포넌트별 편집 계약(`accepts`)이 아니라 모든 DOM
 * 노드의 구조 축이다. 퍼블리싱된 문서가 그대로 실어야 CSS `#id` 선택자·앵커·외부 스크립트가
 * 성립한다. `className` 은 이미 props 로 흘러 DOM 에 실리지만(publish 실측:
 * `react-aria-Button button-base hero-cta`), `id` 는 어디서도 emit 되지 않아 RAC 자동생성값
 * (`react-aria…_r_0_`)만 남아 있었다 (2026-08-29 사용자 지적).
 *
 * **RAC 예외 — `id` 가 DOM 속성이 아니라 collection key 인 타입**: React Aria 의 collection
 * item(`ListBoxItem`/`GridListItem`/`Tab`/`Row` 등)에서 `id` prop 은 selection/expansion key 다.
 * 여기에 customId 를 실으면 저장된 `selectedKeys` 와 어긋나 선택 동작이 깨진다. 그래서 이
 * 타입들은 emit 대상에서 제외하고 기존 동작(`data-element-id` 마커)을 유지한다.
 */

/**
 * RAC 에서 `id` prop 이 collection key 로 해석되는 canonical 타입.
 * catalog binding 기준 — 새 collection item 타입을 추가하면 여기에도 등재해야 한다.
 */
export const RAC_KEYED_ITEM_TYPES: ReadonlySet<string> = new Set([
  "ListBoxItem",
  "GridListItem",
  "MenuItem",
  "TreeItem",
  "Tab",
  "Tag",
  "Row",
  "TableRow",
  "Column",
  "Cell",
  "TableCell",
  "ColorSwatch",
]);

/**
 * 렌더러가 DOM 에 실을 `id` 를 판정한다.
 *
 * @param type canonical 노드 타입
 * @param customId 사용자가 지정한 식별자 (미지정이면 undefined)
 * @param existingId 렌더러가 이미 산출한 `id` (catalog prop 투영 등) — 있으면 덮지 않는다
 */
export function resolveAuthoredDomId(
  type: string,
  customId: string | undefined | null,
  existingId?: unknown,
): string | undefined {
  if (existingId !== undefined && existingId !== null) return undefined;
  if (!customId) return undefined;
  if (RAC_KEYED_ITEM_TYPES.has(type)) return undefined;
  return customId;
}

/**
 * 렌더러가 DOM 에 실을 `aria-label` 을 판정한다.
 *
 * `id`/`class` 와 같은 **전 타입 공통 축**이다 — 컴포넌트별 편집 계약(catalog `accepts`)이
 * 아니라 모든 DOM 노드가 가질 수 있는 접근성 축이고, `toRacProps` 의 allowlist 를 타지
 * 않으므로 이 규칙이 유일한 emit 지점이다.
 *
 * 넣게 된 계기: `role="progressbar"` 처럼 **접근 가능한 이름이 필수인** 컴포넌트를 빌더에서
 * 만들면 이름을 넣을 수단이 없었다 (2026-09-05). 컴포넌트마다 prop 을 늘리는 대신 축을
 * 하나 연다 — 그것이 `id`/`class` 와 같은 성격이기 때문이다.
 *
 * @param props canonical 노드의 props
 * @param existing 렌더러가 이미 산출한 `aria-label` — 있으면 덮지 않는다 (컴포넌트가 스스로
 *   이름을 만드는 경우가 우선. 예: RAC 가 label 자식에서 파생)
 */
export function resolveAuthoredAriaLabel(
  props: Record<string, unknown> | undefined | null,
  existing?: unknown,
): string | undefined {
  if (existing !== undefined && existing !== null) return undefined;
  const raw = props?.["aria-label"];
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
