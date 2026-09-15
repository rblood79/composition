import { isFillDerivedStyleProp } from "../../../builder/panels/styles/utils/fillDerivedStyleProps";
import { STYLE_GROUP_PROPS } from "../../../builder/panels/styles/constants/styleGroups";
import type { ManifestField } from "./manifest";

/** edit contract의 시각 subset을 Styles 패널의 실제 편집 키 집합으로 보완한다. */
export function withPanelStyleFields(
  fields: readonly ManifestField[],
): ManifestField[] {
  const result = fields.filter(
    (field) => field.origin !== "style" || !isFillDerivedStyleProp(field.name),
  );
  for (const name of new Set(Object.values(STYLE_GROUP_PROPS).flat())) {
    if (isFillDerivedStyleProp(name)) continue;
    const index = result.findIndex(
      (field) => field.origin === "style" && field.name === name,
    );
    // opacity 등 범위가 있는 수치 계약은 그대로 유지한다.
    if (
      index >= 0 &&
      (result[index].min !== undefined || result[index].max !== undefined)
    )
      continue;
    const field: ManifestField = { name, origin: "style", kind: "css" };
    if (index >= 0) result[index] = field;
    else result.push(field);
  }
  return result;
}
