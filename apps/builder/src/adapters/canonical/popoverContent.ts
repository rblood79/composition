/**
 * ADR-238 G4 — Canvas 가 그리지 않는 popover 내용 (Select · ComboBox 항목 · Menu 항목) 을 scene 해석 전에 거른다.
 *
 * Canvas 는 트리거만 그린다 (F10) — layout (`implicitStyles` Select · Menu 분기) 과 Skia (`_hasChildren`) 가 이미 이
 * 자식을 건너뛴다. 해석하면 항목 수에 비례한 비용 (Select 50 × 20 행 편집 +4.6 ms · 항목 origin 편집 +12.5 ms) 만
 * 낸다. 트리거 표시 글자에 필요한 것은 **선택된 행 하나** 라 Select · ComboBox 는 선택 key · value 에 맞는 행
 * (그 행을 담은 section) 만 남긴다 — 글자는 그대로 해석기가 만든다 (`annotateStaticPickerItems`).
 *
 * scene build 만 쓴다 (opt-in) — Properties · Layers 의 합성 자손 조회는 모든 항목이 필요하다.
 */

const POPOVER_CONTENT_CHILD_TYPES: ReadonlyMap<
  string,
  ReadonlySet<string>
> = new Map([
  ["Select", new Set(["ListBoxItem", "ListBoxSection"])],
  ["ComboBox", new Set(["ListBoxItem", "ListBoxSection"])],
  ["Menu", new Set(["MenuItem", "MenuSection", "Separator"])],
]);

interface PopoverChildNode {
  id: string;
  type: string;
  props?: unknown;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function propsOf(node: PopoverChildNode): Record<string, unknown> {
  return node.props && typeof node.props === "object"
    ? (node.props as Record<string, unknown>)
    : {};
}

/**
 * owner 의 popover 자식 필터 — `true` = 해석한다. popover owner 가 아니면 null.
 *
 * @param ownerType 해석된 owner type (instance 면 origin type)
 * @param ownerProps 선택 상태를 읽을 owner props (instance 면 해석된 props)
 * @param childrenOf 자식 조회 (section 안 항목 판정)
 */
export function createPopoverChildFilter<T extends PopoverChildNode>(
  ownerType: string,
  ownerProps: Record<string, unknown> | undefined,
  childrenOf: (id: string) => readonly T[],
): ((child: T, patchProps?: Record<string, unknown>) => boolean) | null {
  const popoverTypes = POPOVER_CONTENT_CHILD_TYPES.get(ownerType);
  if (!popoverTypes) return null;
  if (ownerType === "Menu") return (child) => !popoverTypes.has(child.type);
  const selectedKey = nonEmptyString(ownerProps?.selectedKey);
  const selectedValue = nonEmptyString(ownerProps?.selectedValue);
  const matches = (
    node: PopoverChildNode,
    patchProps?: Record<string, unknown>,
  ): boolean => {
    const props = patchProps
      ? { ...propsOf(node), ...patchProps }
      : propsOf(node);
    if (selectedKey !== null) {
      if (node.id === selectedKey || props.id === selectedKey) return true;
    }
    return selectedValue !== null && props.value === selectedValue;
  };
  return (child, patchProps) => {
    if (!popoverTypes.has(child.type)) return true;
    if (selectedKey === null && selectedValue === null) return false;
    if (child.type === "ListBoxItem") return matches(child, patchProps);
    // section — 안 항목이 선택됐거나, 상속 항목 key (`<section key>/<항목 key>`) 의 접두가 이 section.
    const props = patchProps
      ? { ...propsOf(child), ...patchProps }
      : propsOf(child);
    const sectionKey = nonEmptyString(props.id) ?? child.id;
    if (selectedKey !== null && selectedKey.startsWith(`${sectionKey}/`)) {
      return true;
    }
    return childrenOf(child.id).some(
      (item) => item.type === "ListBoxItem" && matches(item),
    );
  };
}
