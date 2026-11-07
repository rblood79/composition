import {
  catalogSelectionKeysFits,
  type CatalogSelectionKeys,
} from "../document/selectionKeysValue";

export function selectBoxDeclaredSelection(
  props: Readonly<Record<string, unknown>>,
  fallback: readonly string[],
): CatalogSelectionKeys {
  if (catalogSelectionKeysFits(props.selectedKeys)) return props.selectedKeys;
  if (catalogSelectionKeysFits(props.defaultSelectedKeys))
    return props.defaultSelectedKeys;
  return fallback;
}

export function selectBoxKeySelected(
  props: Readonly<Record<string, unknown>>,
  key: string,
  fallback: boolean,
): boolean {
  const keys = selectBoxDeclaredSelection(props, fallback ? [key] : []);
  return keys === "all" || keys.includes(key);
}

export function selectBoxDisabledKeys(
  props: Readonly<Record<string, unknown>>,
  items: readonly { key: string; isDisabled: boolean }[],
): string[] {
  return [
    ...new Set([
      ...(Array.isArray(props.disabledKeys)
        ? props.disabledKeys.filter(
            (key): key is string => typeof key === "string",
          )
        : []),
      ...items
        .filter((item) => props.isDisabled === true || item.isDisabled)
        .map((item) => item.key),
    ]),
  ];
}
