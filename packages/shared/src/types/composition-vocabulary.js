/**
 * @fileoverview Canonical Component Vocabulary — ADR-903 P0
 *
 * **scope 분리 (R5)**: 본 파일의 `ComponentTag`는 오직 `Element.type` /
 * `CanonicalNode.type`의 값 공간이다. `DataBinding.type` ("collection" | "value"
 * | "field") 및 `FieldDefinition.type` (FieldType 7-literal)과는 **객체 경로가
 * 다른 별개 필드**이며 값 공간 교집합 0건 — compile-time disjoint 보장.
 */
/**
 * `isCanonicalNode` — runtime type guard.
 *
 * 체크 항목:
 * - `typeof obj === "object" && obj !== null`
 * - `typeof obj.id === "string" && !obj.id.includes("/")`
 * - `typeof obj.type === "string"`
 * - optional 필드(`children` / `reusable` / `ref` / `descendants` / `slot`)는
 *   존재 시에만 타입 검증
 *
 * canonical tree walker에서 `if (!isCanonicalNode(child)) continue` 방어 강제.
 * `FieldDefinition` / `DataBinding`이 tree walker에 섞여 들어오더라도 오판 차단.
 */
export function isCanonicalNode(obj) {
    if (typeof obj !== "object" || obj === null)
        return false;
    const node = obj;
    // id: slash 금지 포함
    if (typeof node.id !== "string" || node.id.includes("/"))
        return false;
    // type: string 존재 확인 (ComponentTag 값 공간은 컴파일-타임 보장)
    if (typeof node.type !== "string")
        return false;
    // optional 필드 존재 시 타입 검증
    if ("children" in node && node.children !== undefined) {
        if (!Array.isArray(node.children))
            return false;
    }
    if ("reusable" in node && node.reusable !== undefined) {
        if (typeof node.reusable !== "boolean")
            return false;
    }
    if ("ref" in node && node.ref !== undefined) {
        if (typeof node.ref !== "string")
            return false;
    }
    if ("descendants" in node && node.descendants !== undefined) {
        if (typeof node.descendants !== "object" || node.descendants === null)
            return false;
    }
    if ("slot" in node && node.slot !== undefined) {
        if (node.slot !== false && !Array.isArray(node.slot))
            return false;
    }
    return true;
}
//# sourceMappingURL=composition-vocabulary.js.map