/**
 * 필드 → 에디터 매핑 정적 가드 — catalog 전수 (`componentCatalog` × `resolveEditContract`) 에 대해
 * 사용자 판정 (2026-09-15) 대로 컨트롤이 정해지는지. 스위치 0 · 같은 키 = 같은 컨트롤.
 */
import { describe, expect, it } from "vitest";
import {
  componentCatalog,
  getCatalogDefaultProps,
  resolveEditContract,
  type ResolvedField,
} from "@composition/shared";

import {
  resolveFieldEditor,
  SIZE_MAX_STEPS,
  sizeSegOptions,
} from "./fieldEditor";

function allSemanticFields(): Array<{ type: string; field: ResolvedField }> {
  const out: Array<{ type: string; field: ResolvedField }> = [];
  for (const entry of componentCatalog) {
    const props = getCatalogDefaultProps(entry.type) ?? {};
    const contract = resolveEditContract(
      { id: "x", type: entry.type, props } as never,
      null,
    );
    for (const field of contract.fields) {
      if (field.origin === "semantic" && !field.editorHidden)
        out.push({ type: entry.type, field });
    }
  }
  return out;
}

const fields = allSemanticFields();
const byKey = (key: string) => fields.filter((f) => f.field.key === key);
const editorOf = (type: string, key: string) => {
  const hit = fields.find((f) => f.type === type && f.field.key === key);
  if (!hit) throw new Error(`${type}.${key} 없음`);
  return resolveFieldEditor(hit.field);
};

describe("fieldEditor — 사용자 판정 매핑", () => {
  it("boolean 은 전부 칩 (스위치 0)", () => {
    for (const { field } of fields) {
      if (field.kind !== "boolean") continue;
      expect(resolveFieldEditor(field).type).toBe("chip");
    }
  });

  it("칩 그룹·라벨 — show*/fill* 접두 제거, hideTimeZone 은 Show 그룹 긍정형", () => {
    expect(editorOf("Chart", "showAxis")).toMatchObject({
      type: "chip",
      group: "Show",
      label: "Axis",
    });
    expect(editorOf("Chart", "fillArea")).toMatchObject({
      type: "chip",
      group: "Fill",
    });
    expect(editorOf("DateField", "hideTimeZone")).toMatchObject({
      type: "chip",
      group: "Show",
      label: "Time Zone",
      negate: true,
    });
    expect(editorOf("TextField", "isDisabled")).toMatchObject({
      type: "chip",
      group: "Options",
      label: "Disabled",
    });
  });

  it("On/Off enum (autoCorrect · spellCheck) 은 칩", () => {
    expect(editorOf("TextField", "autoCorrect")).toMatchObject({
      type: "chip",
      onValue: "on",
      offValue: "off",
    });
    expect(editorOf("TextArea", "spellCheck")).toMatchObject({ type: "chip" });
  });

  it("방향·정렬·모양은 아이콘 seg, placement 는 9-위치 피커, staticColor 는 스와치 seg", () => {
    for (const key of [
      "orientation",
      "labelAlign",
      "legendPosition",
      "stackType",
      "curve",
      "gridType",
    ]) {
      for (const { field } of byKey(key)) {
        const editor = resolveFieldEditor(field);
        expect(editor.type, key).toBe("seg");
        expect(editor.type === "seg" && editor.icons != null, key).toBe(true);
      }
    }
    // labelPosition (Top · Side) 은 글자 seg — 아이콘은 가독성이 떨어진다 (2026-09-16 사용자 판정)
    for (const { field } of byKey("labelPosition")) {
      expect(resolveFieldEditor(field)).toMatchObject({
        type: "seg",
        span: "half",
      });
      expect(resolveFieldEditor(field)).not.toHaveProperty("icons");
    }
    expect(editorOf("Popover", "placement").type).toBe("placement");
    expect(editorOf("Button", "staticColor").type).toBe("swatch-seg");
  });

  it("배타 2~4 짧은 값은 텍스트 seg — selectionMode · necessityIndicator · density · fillStyle · Button type", () => {
    expect(editorOf("ListBox", "selectionMode")).toMatchObject({
      type: "seg",
      span: "wide",
    });
    expect(editorOf("TextField", "necessityIndicator")).toMatchObject({
      type: "seg",
      span: "half",
    });
    expect(editorOf("CardView", "density")).toMatchObject({ type: "seg" });
    expect(editorOf("Button", "fillStyle")).toMatchObject({ type: "seg" });
    expect(editorOf("Button", "type")).toMatchObject({
      type: "seg",
      span: "wide",
    });
    expect(editorOf("DateField", "hourCycle")).toMatchObject({
      type: "seg",
      span: "half",
    });
  });

  it("size 는 seg — 2~3 반폭 · 4~5 전폭, 옵션은 5단까지", () => {
    expect(editorOf("Toolbar", "size")).toMatchObject({
      type: "seg",
      span: "half",
    }); // S M L
    expect(editorOf("Button", "size")).toMatchObject({
      type: "seg",
      span: "wide",
    }); // XS~XL
    expect(editorOf("TextField", "size")).toMatchObject({
      type: "seg",
      span: "wide",
    }); // S~XL
    const text = fields.find(
      (f) => f.type === "Text" && f.field.key === "size",
    )!.field;
    expect(text.options?.length).toBe(7);
    expect(sizeSegOptions(text.options ?? []).map((o) => o.label)).toEqual([
      "XS",
      "S",
      "M",
      "L",
      "XL",
    ]);
    expect(SIZE_MAX_STEPS).toBe(5);
  });

  it("variant — 이진은 seg, 의미색 ≤4 는 seg+점, 5+ 는 셀렉트+점, 그 밖 5+ 는 셀렉트", () => {
    expect(editorOf("Toolbar", "variant")).toMatchObject({ type: "seg" }); // Default/Accent
    expect(editorOf("Meter", "variant")).toMatchObject({
      type: "seg",
      span: "wide",
      swatch: true,
    }); // 4 의미색
    expect(editorOf("Button", "variant")).toMatchObject({
      type: "select",
      swatch: true,
    }); // 6
    expect(editorOf("Separator", "variant").type).toBe("select"); // 7 비색
  });

  // 2026-09-16 「A 팝오버 grid」 — 색 이름이 절반 이상인 variant 만 격자. 의미 variant 는 목록.
  it("variant — 색 이름 ≥ 절반 (Badge 25 · StatusLight 19) 만 격자 셀렉트, 나머지는 grid 없음", () => {
    expect(editorOf("Badge", "variant")).toMatchObject({
      type: "select",
      swatch: true,
      grid: true,
    });
    expect(editorOf("StatusLight", "variant")).toMatchObject({
      type: "select",
      grid: true,
    });
    const gridTypes = byKey("variant")
      .filter((f) => {
        const e = resolveFieldEditor(f.field);
        return e.type === "select" && e.grid === true;
      })
      .map((f) => f.type)
      .sort();
    expect(gridTypes).toEqual(["Badge", "StatusLight"]);
  });

  it("5+ · 긴 라벨 · 도메인 enum 은 셀렉트 유지", () => {
    for (const [type, key] of [
      ["TextField", "inputMode"],
      ["TextField", "enterKeyHint"],
      ["TextField", "type"],
      ["ColorField", "channel"],
      ["Chart", "animationEasing"],
      ["Link", "target"],
      ["Form", "encType"],
    ] as const) {
      expect(editorOf(type, key).type, `${type}.${key}`).toBe("select");
    }
  });

  it("number — 상한 있는 키는 슬라이더, 나머지는 스텝퍼", () => {
    expect(editorOf("Icon", "strokeWidth")).toMatchObject({
      type: "slider",
      min: 0.5,
      max: 4,
    });
    expect(editorOf("Chart", "innerRadius")).toMatchObject({
      type: "slider",
      max: 100,
      unit: "%",
    });
    expect(editorOf("Chart", "endAngle")).toMatchObject({
      type: "slider",
      max: 360,
    });
    expect(editorOf("ColorSwatchPicker", "columns")).toMatchObject({
      type: "slider",
      min: 1,
      max: 12,
    });
    expect(editorOf("TextField", "maxLength").type).toBe("stepper");
    expect(editorOf("Popover", "offset").type).toBe("stepper");
    expect(editorOf("Slider", "minValue").type).toBe("stepper");
    // value 는 형제 min/max 에 묶인 슬라이더 (Slider · Meter · ProgressBar · ProgressCircle)
    expect(editorOf("Slider", "value")).toMatchObject({
      type: "slider-bound",
      minKey: "minValue",
      maxKey: "maxValue",
    });
    expect(editorOf("Meter", "value").type).toBe("slider-bound");
  });

  it("같은 키는 어느 컴포넌트에서든 같은 컨트롤 종류", () => {
    const seen = new Map<string, string>();
    for (const { type, field } of fields) {
      // 옵션 집합이 다르면 다른 필드 (Button.type 3 ↔ Input.type 7) — 키 + 옵션 서명으로 본다
      //   kind 가 다르면 (RadioGroup.value enum ↔ Slider.value number) 다른 필드
      const sig = `${field.kind}:${field.key}|${(field.options ?? []).map((o) => o.value).join(",")}`;
      const editor = resolveFieldEditor(field);
      const prev = seen.get(sig);
      if (prev && prev !== editor.type) {
        throw new Error(`${sig}: ${prev} vs ${editor.type} (${type})`);
      }
      seen.set(sig, editor.type);
    }
  });
});
