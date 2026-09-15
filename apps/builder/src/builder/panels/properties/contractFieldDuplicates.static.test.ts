/**
 * Properties 패널 — 같은 prop 이 두 곳에 뜨지 않는다 (2026-09-15 사용자 지적: Nav 의
 * `aria-label` 이 Content 와 Attributes 둘 다에 있었다).
 *
 * Attributes 절 (`ElementAttributesSection`) 은 전 타입 공통 축 (id · className · aria-label) 을
 * 편집한다. 어떤 계약도 같은 key 를 보이는 필드로 열면 안 된다 — 열어야 하면 `editorHidden`.
 * 같은 계약 안에서 key 나 표시 라벨이 두 번 나오는 것도 같은 문제다.
 */
import { componentCatalog, resolveEditContract } from "@composition/shared";
import { describe, expect, it } from "vitest";

const ATTRIBUTE_AXIS_KEYS: ReadonlySet<string> = new Set([
  "aria-label",
  "className",
  "class",
  "id",
  "customId",
]);

describe("Properties 계약 필드 — Attributes 축 · key · 라벨 중복 0", () => {
  it("모든 primitive 계약", () => {
    const problems: string[] = [];
    for (const entry of componentCatalog) {
      if (entry.kind !== "primitive") continue;
      const fields = resolveEditContract({
        id: "probe",
        type: entry.type,
        props: {},
        children: [],
      } as never).fields.filter(
        (field) => field.origin === "semantic" && !field.editorHidden,
      );
      for (const field of fields) {
        if (ATTRIBUTE_AXIS_KEYS.has(field.key)) {
          problems.push(`${entry.type}.${field.key} — Attributes 절과 중복`);
        }
      }
      const byKey = new Map<string, number>();
      const byLabel = new Map<string, string[]>();
      for (const field of fields) {
        byKey.set(field.key, (byKey.get(field.key) ?? 0) + 1);
        const label = `${field.section}:${field.label}`;
        byLabel.set(label, [...(byLabel.get(label) ?? []), field.key]);
      }
      for (const [key, count] of byKey) {
        if (count > 1) problems.push(`${entry.type}.${key} ×${count}`);
      }
      for (const [label, keys] of byLabel) {
        if (keys.length > 1)
          problems.push(`${entry.type} 라벨「${label}」 ${keys.join(" + ")}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
