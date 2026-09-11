/**
 * ADR-152 Phase 1b — `{#id}` 저장형: 변환기 왕복 + 보간이 색인으로 행을 읽는다.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearFieldIdIndex, registerFieldIds } from "@composition/specs";
import {
  compileFieldTemplate,
  interpolateFieldTemplate,
} from "../fieldTemplate";
import { storedToTemplate, templateToStored } from "../fieldTemplateStorage";

const schema = [
  { id: "f-name", key: "name", type: "string" },
  { id: "f-addr", key: "address", type: "object" },
  { key: "legacy", type: "string" },
];

afterEach(() => {
  clearFieldIdIndex();
  vi.restoreAllMocks();
});

describe("templateToStored / storedToTemplate", () => {
  it("이름 → #id, 경로·포맷·literal·이스케이프 보존", () => {
    const stored = templateToStored(
      "Hi {name}, {address.city|date} {{raw}} {label}",
      schema,
    );
    expect(stored).toBe(
      "Hi {#f-name}, {#f-addr.city|date} {{raw}} {label}",
    );
    expect(storedToTemplate(stored, schema)).toBe(
      "Hi {name}, {address.city|date} {{raw}} {label}",
    );
  });

  it("schema 에 없는 key (가상 필드 · 정적 items) 는 이름 그대로", () => {
    expect(templateToStored("{label} / {unknown}", schema)).toBe(
      "{label} / {unknown}",
    );
  });

  it("key 는 있는데 id 가 없으면 이름 유지 + warn (정규화 누락 검출)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(templateToStored("{legacy}", schema)).toBe("{legacy}");
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("미등록 #id 는 저장형 그대로 노출 (사용자가 고칠 수 있게)", () => {
    expect(storedToTemplate("{#gone}", schema)).toBe("{#gone}");
    expect(storedToTemplate("plain", schema)).toBe("plain");
  });
});

describe("compile + interpolate — 저장형은 색인으로 행을 읽는다", () => {
  it("rename 뒤에도 같은 저장형이 새 key 로 값을 읽는다", () => {
    const compiled = compileFieldTemplate("{#f-name} <{#f-addr.city}>")!;
    expect(compiled.tokenCount).toBe(2);
    registerFieldIds(schema);
    expect(
      interpolateFieldTemplate(compiled, {
        name: "Ann",
        address: { city: "Seoul" },
      }),
    ).toBe("Ann <Seoul>");
    // rename name → fullName (행 key 도 migrate 됐다는 전제)
    registerFieldIds([{ id: "f-name", key: "fullName" }]);
    expect(
      interpolateFieldTemplate(compiled, {
        fullName: "Ann",
        address: { city: "Seoul" },
      }),
    ).toBe("Ann <Seoul>");
  });

  it("미등록 id 는 빈 문자열 (throw 금지) · 포맷은 저장형에도 적용", () => {
    const compiled = compileFieldTemplate("[{#nope}] {#f-name|number}")!;
    registerFieldIds([{ id: "f-name", key: "n" }]);
    expect(interpolateFieldTemplate(compiled, { n: 1234 })).toBe("[] 1,234");
  });
});
