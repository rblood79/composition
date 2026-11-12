
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
