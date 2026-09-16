import { describe, expect, it } from "vitest";
import { localizedStrings } from "../../../../i18n/translations";
import {
  DATATABLE_PRESETS,
  getAllPresets,
  getPresetsByCategory,
} from "./dataTablePresets";
import { PRESET_CATEGORIES, resolvePresetSchema } from "./types";

const ko = localizedStrings["ko-KR"] as Record<string, unknown>;
const en = localizedStrings["en-US"] as Record<string, unknown>;
/** 적용 시점 해소기와 같은 모양 — 카탈로그 값, 함수 메시지는 호출 */
const tOf =
  (catalog: Record<string, unknown>) =>
  (key: string, params?: Record<string, string | number | boolean>) => {
    const value = catalog[key];
    if (typeof value === "function")
      return String((value as (args?: unknown) => string)(params));
    return typeof value === "string" ? value : key;
  };
const tKo = tOf(ko);
const tEn = tOf(en);

const isEmpty = (value: unknown) =>
  value === undefined || value === null || value === "";

const typeMatches = (type: string, value: unknown): boolean => {
  switch (type) {
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "array":
      return Array.isArray(value);
    case "object":
      return typeof value === "object" && !Array.isArray(value);
    case "date":
    case "datetime":
      return typeof value === "string" && !Number.isNaN(Date.parse(value));
    case "email":
      return typeof value === "string" && /^[^\s@]+@[^\s@]+$/.test(value);
    case "url":
    case "image":
      return typeof value === "string" && /^https?:\/\//.test(value);
    default:
      return typeof value === "string";
  }
};

describe("DATATABLE_PRESETS — 카탈로그 전수", () => {
  const presets = getAllPresets();

  it("9 카테고리 모두 preset 이 1개 이상, id 는 표 키와 같다", () => {
    for (const category of PRESET_CATEGORIES) {
      expect(
        getPresetsByCategory(category.id).length,
        category.id,
      ).toBeGreaterThan(0);
    }
    for (const [key, preset] of Object.entries(DATATABLE_PRESETS)) {
      expect(preset.id).toBe(key);
      expect(preset.columns.length).toBe(preset.schema.length);
    }
    expect(presets.length).toBeGreaterThanOrEqual(28);
  });

  it("라벨 · 설명 키가 ko/en 카탈로그에 모두 있다", () => {
    const missing: string[] = [];
    for (const preset of presets) {
      for (const key of [preset.descriptionKey]) {
        if (typeof ko[key] !== "string") missing.push(`ko ${key}`);
        if (typeof en[key] !== "string") missing.push(`en ${key}`);
      }
      for (const field of preset.schema) {
        if (typeof ko[field.labelKey] !== "string")
          missing.push(`ko ${preset.id}.${field.key} ${field.labelKey}`);
        if (typeof en[field.labelKey] !== "string")
          missing.push(`en ${preset.id}.${field.key} ${field.labelKey}`);
      }
    }
    for (const category of PRESET_CATEGORIES) {
      if (typeof ko[category.descriptionKey] !== "string")
        missing.push(`ko ${category.descriptionKey}`);
      if (typeof en[category.descriptionKey] !== "string")
        missing.push(`en ${category.descriptionKey}`);
    }
    expect(missing).toEqual([]);
  });

  it.each(presets.map((preset) => [preset.id, preset] as const))(
    "%s — ko/en 행이 스키마와 정합 (키 집합 · required · 타입)",
    (_id, preset) => {
      for (const t of [tKo, tEn]) {
        const { rows, seed } = preset.generateSample(
          preset.defaultSampleCount,
          t,
          { seed: "catalog" },
        );
        expect(rows).toHaveLength(preset.defaultSampleCount);
        expect(typeof seed).toBe("number");
        const keys = preset.schema.map((field) => field.key);
        for (const row of rows) {
          expect(Object.keys(row)).toEqual(keys);
          for (const field of preset.schema) {
            const value = row[field.key];
            if (field.required) {
              expect(isEmpty(value), `${preset.id}.${field.key} required`).toBe(
                false,
              );
            }
            if (!isEmpty(value)) {
              expect(
                typeMatches(field.type, value),
                `${preset.id}.${field.key} (${field.type}) = ${JSON.stringify(value)}`,
              ).toBe(true);
            }
          }
        }
        const schema = resolvePresetSchema(preset.schema, t);
        expect(
          schema.every((field) => !field.label?.startsWith("presetField.")),
        ).toBe(true);
      }
    },
  );

  it("같은 seed 는 같은 행, seed 없이는 매번 다른 행 (users)", () => {
    const users = DATATABLE_PRESETS.users;
    const a = users.generateSample(5, tKo, { seed: 7 });
    const b = users.generateSample(5, tKo, { seed: 7 });
    expect(a.rows).toEqual(b.rows);
    expect(a.seed).toBe(7);
    const c = users.generateSample(5, tKo);
    const d = users.generateSample(5, tKo);
    expect(c.seed).not.toBe(d.seed);
  });

  it("ko 카탈로그 — 성별 ↔ 이름 ↔ 초상 일관, 이름은 성+이름 붙여 쓰기", () => {
    const { rows } = DATATABLE_PRESETS.profiles.generateSample(20, tKo, {
      seed: "ko",
    });
    const male = (ko["presetData.firstNamesMale"] as string).split(", ");
    const female = (ko["presetData.firstNamesFemale"] as string).split(", ");
    for (const row of rows) {
      const pool = row.gender === "male" ? male : female;
      expect(pool).toContain(row.firstName);
      expect(row.fullName).toBe(`${row.lastName}${row.firstName}`);
      expect(String(row.picture)).toContain(
        row.gender === "male" ? "/men/" : "/women/",
      );
      expect(String(row.phone)).toMatch(/^02-\d{4}-\d{4}$/);
    }
  });

  it("blankRate 는 required 아닌 컬럼만 비우고 컬럼별 blank 가 우선", () => {
    const { rows } = DATATABLE_PRESETS.contacts.generateSample(30, tEn, {
      seed: 1,
      blankRate: 1,
    });
    for (const row of rows) {
      expect(row.name).not.toBeNull();
      expect(row.email).toBeNull();
    }
    // company 는 blank 0.2 라 전역 1 이어도 일부는 채워진다
    expect(rows.some((row) => row.company !== null)).toBe(true);
  });

  it("dummyjson 파생값 — cart 합계는 항목 합, invoice total = subtotal + tax", () => {
    const { rows: carts } = DATATABLE_PRESETS.carts.generateSample(10, tEn, {
      seed: 3,
    });
    for (const cart of carts) {
      const items = cart.products as { total: number; quantity: number }[];
      expect(cart.totalProducts).toBe(items.length);
      expect(cart.totalQuantity).toBe(
        items.reduce((s, i) => s + i.quantity, 0),
      );
      expect(cart.total).toBeCloseTo(
        items.reduce((s, i) => s + i.total, 0),
        2,
      );
    }
    const { rows: invoices } = DATATABLE_PRESETS.invoices.generateSample(
      10,
      tEn,
      {
        seed: 3,
      },
    );
    for (const invoice of invoices) {
      expect(invoice.total).toBeCloseTo(
        Number(invoice.subtotal) + Number(invoice.tax),
        2,
      );
      expect(invoice.paidAt === null).toBe(invoice.status !== "paid");
    }
  });

  it("picsum 이미지 — id 기반 URL, grayscale/blur 는 previewUrl 에만", () => {
    const { rows } = DATATABLE_PRESETS.images.generateSample(20, tEn, {
      seed: "pic",
    });
    for (const row of rows) {
      expect(String(row.url)).toBe(
        `https://picsum.photos/id/${row.picsumId}/${row.width}/${row.height}`,
      );
      const preview = String(row.previewUrl);
      expect(preview.includes("grayscale")).toBe(Boolean(row.grayscale));
      expect(preview.includes("blur=")).toBe(Number(row.blur) > 0);
    }
  });
});
