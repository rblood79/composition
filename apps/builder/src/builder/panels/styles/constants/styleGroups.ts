/**
 * Style 패널 그룹 탭 정의 (섹션 그룹화)
 *
 * 스타일 패널은 섹션 5개(Responsive / Transform / Layout / Appearance / Typography)를 한 줄로
 * 늘어놓아 233px 폭에서 콘텐츠가 2화면을 넘었다. 섹션은 하나도 지우지 않고 **4개 그룹 탭**으로
 * 묶어 한 번에 한 그룹만 보이게 한다.
 *
 * | 그룹     | 섹션                     |
 * | -------- | ------------------------ |
 * | `layout` | Transform + Layout       |
 * | `style`  | Appearance (Background)  |
 * | `text`   | Typography               |
 * | `screen` | Responsive (+Visibility) |
 *
 * `STYLE_GROUP_PROPS` 는 각 섹션 reset 범위(`{TRANSFORM,LAYOUT,APPEARANCE,TYPOGRAPHY}_PROPS`)를
 * **그대로 재사용** 한다 — 탭의 수정 표시(dot)와 섹션 reset 버튼이 같은 dirty 판정을 공유해야
 * "탭엔 점이 없는데 안에 들어가면 reset 이 활성" 같은 비대칭이 안 생긴다.
 * screen 그룹은 style prop 이 아니라 breakpoint override / visibility 라 목록이 비어 있다.
 */

import { TRANSFORM_PROPS } from "../sections/TransformSection";
import { LAYOUT_PROPS } from "../sections/LayoutSection";
import { APPEARANCE_PROPS } from "../sections/AppearanceSection";
import { TYPOGRAPHY_PROPS } from "../sections/TypographySection";

export type StyleGroupId = "layout" | "style" | "text" | "screen";

export const STYLE_GROUP_IDS: readonly StyleGroupId[] = [
  "layout",
  "style",
  "text",
  "screen",
];

/**
 * 콘텐츠 영역이 보여줄 수 있는 뷰 전체 = 그룹 4개 + "수정된 속성만".
 *
 * Modified 는 그룹을 가로지르는 필터지 5번째 그룹이 아니다. 그래도 **같은 영역을 배타적으로
 * 차지하는 뷰**라 탭 줄에 함께 둔다 — 별도 토글로 두면 "탭을 누르면 modify 가 풀린다" 는
 * 숨은 결합이 생기고, 한 영역을 두 컨트롤이 나눠 쥐게 된다.
 */
export type StyleViewId = StyleGroupId | "modified";

export const STYLE_VIEW_IDS: readonly StyleViewId[] = [
  ...STYLE_GROUP_IDS,
  "modified",
];

/** 뷰 id 가 실제 그룹(=섹션을 가진 뷰)인지. */
export function isStyleGroupId(view: StyleViewId): view is StyleGroupId {
  return view !== "modified";
}

export const STYLE_GROUP_PROPS: Record<StyleGroupId, readonly string[]> = {
  layout: [...TRANSFORM_PROPS, ...LAYOUT_PROPS],
  style: APPEARANCE_PROPS,
  text: TYPOGRAPHY_PROPS,
  screen: [],
};

/** style prop → 소속 그룹. 탭 dot 표시를 위해 dirty prop 목록을 그룹으로 접는다. */
const PROP_TO_GROUP: ReadonlyMap<string, StyleGroupId> = new Map(
  STYLE_GROUP_IDS.flatMap((group) =>
    STYLE_GROUP_PROPS[group].map((prop) => [prop, group] as const),
  ),
);

/** dirty prop 목록을 "수정된 값이 있는 그룹" 집합으로 접는다. */
export function toDirtyGroups(
  dirtyProps: readonly string[],
): Set<StyleGroupId> {
  const groups = new Set<StyleGroupId>();
  for (const prop of dirtyProps) {
    const group = PROP_TO_GROUP.get(prop);
    if (group) groups.add(group);
  }
  return groups;
}
