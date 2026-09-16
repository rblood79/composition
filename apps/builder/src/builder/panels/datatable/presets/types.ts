/**
 * DataTable Preset System Types
 *
 * preset = 스키마 + 컬럼별 생성 규칙 (`MockColumn`, mockaroo 어법). 규칙이 데이터라
 * 스키마와 샘플 행이 한 정의에서 나온다 — `definePreset` 이 `schema` 와
 * `generateSampleData` 를 파생한다. 생성기는 `@composition/sample-data` (ADR-220).
 */

import type { DataField } from "../../../../types/builder/data.types";
import {
  generateRows,
  resolveMockLocale,
  type MockColumn,
  type MockRule,
} from "@composition/sample-data";

/**
 * 표시 시점 해소기 — 이 모듈은 순수 `.ts` 라 훅을 못 쓴다 (ADR-200 어법).
 *
 * preset 은 두 종류의 문자열을 낸다. 카드 설명은 선택기에서만 보이고, 스키마
 * 라벨과 샘플 행은 **적용 순간 사용자 테이블에 굳는다**. 그래서 해소 시점이
 * 렌더가 아니라 **적용**이다 — 굳은 뒤에는 사용자 데이터이고 다시 번역하지 않는다.
 */
export type PresetTranslate = (
  key: string,
  params?: Record<string, string | number | boolean>,
) => string;

/**
 * Preset 카테고리 — 기존 5 + 5 서비스 패턴에서 온 4 (people = randomuser ·
 * content = dummyjson posts/comments/todos/recipes/quotes · finance = mockaroo
 * Money/Credit Card · media = picsum `/v2/list`)
 */
export type PresetCategory =
  | "users-auth"
  | "people"
  | "organization"
  | "ecommerce"
  | "content"
  | "finance"
  | "media"
  | "manufacturing"
  | "system";

/**
 * 카테고리 메타 정보
 */
export interface PresetCategoryMeta {
  id: PresetCategory;
  name: string;
  icon: string;
  /** 설명 **키** — 선택기가 표시 시점에 해소한다. */
  descriptionKey: string;
}

/** 스키마 필드 — `label` 대신 키를 싣는다. 나머지는 `DataField` 와 같다. */
export type PresetField = Omit<DataField, "label"> & { labelKey: string };

/** 스키마 필드 + 생성 규칙 (mockaroo 의 컬럼 한 줄) */
export type PresetColumn = PresetField & {
  rule: MockRule;
  /** 컬럼별 빈 값 비율 0~1 — 전역 blankRate 보다 우선 */
  blank?: number;
};

/** 생성 조건 — 선택기의 「생성 옵션」 (seed · 빈 값 비율) */
export interface PresetGenerateOptions {
  /** 같은 seed 면 같은 행 (randomuser `?seed=` · picsum `/seed/`). 비우면 매번 다름 */
  seed?: string | number | null;
  /** 전역 빈 값 비율 0~1 — required 아닌 컬럼에 (mockaroo Blank %) */
  blankRate?: number;
  /** `reference` 규칙의 FK 풀 (이름 → 값 목록) */
  references?: Readonly<Record<string, readonly unknown[]>>;
}

export interface PresetSample {
  rows: Record<string, unknown>[];
  /** 실제 쓰인 seed — 같은 값으로 다시 만들면 같은 행 */
  seed: number;
}

/**
 * DataTable Preset 정의
 */
export interface DataTablePreset {
  /** 고유 ID */
  id: string;

  /** 표시 이름 */
  name: string;

  /** 설명 **키** — 선택기가 표시 시점에 해소한다. */
  descriptionKey: string;

  /** 카테고리 */
  category: PresetCategory;

  /** 아이콘 (lucide 아이콘 이름) */
  icon: string;

  /** 컬럼 정의 — 스키마 + 규칙. `schema` 는 여기서 파생 */
  columns: readonly PresetColumn[];

  /**
   * 스키마 정의 — `label` 자리에 **키**가 들어 있다 (`labelKey`).
   * 적용 시점에 `resolvePresetSchema` 로 해소해 문서에 굳힌다.
   */
  schema: PresetField[];

  /** 샘플 행 + seed — 적용 시점 해소기를 받는다 (locale 풀은 카탈로그에서). */
  generateSample: (
    count: number,
    t: PresetTranslate,
    options?: PresetGenerateOptions,
  ) => PresetSample;

  /** `generateSample(...).rows` — 기존 호출자 호환 */
  generateSampleData: (
    count: number,
    t: PresetTranslate,
    options?: PresetGenerateOptions,
  ) => Record<string, unknown>[];

  /** 기본 샘플 데이터 개수 */
  defaultSampleCount: number;
}

export type PresetDefinition = Omit<
  DataTablePreset,
  "schema" | "generateSample" | "generateSampleData"
>;

/** 컬럼 정의 → preset (schema · 생성기 파생) */
export function definePreset(definition: PresetDefinition): DataTablePreset {
  const schema: PresetField[] = definition.columns.map(
    ({ rule: _rule, blank: _blank, ...field }) => field,
  );
  const mockColumns: MockColumn[] = definition.columns.map((column) => ({
    key: column.key,
    rule: column.rule,
    blank: column.blank,
    required: column.required,
  }));
  const generateSample: DataTablePreset["generateSample"] = (
    count,
    t,
    options = {},
  ) =>
    generateRows(mockColumns, {
      count,
      seed: options.seed,
      blankRate: options.blankRate,
      references: options.references,
      locale: resolveMockLocale((key) => t(key)),
      t,
    });
  return {
    ...definition,
    schema,
    generateSample,
    generateSampleData: (count, t, options) =>
      generateSample(count, t, options).rows,
  };
}

/** 적용 시점 해소 — 키를 문구로 바꿔 `DataField` 로 되돌린다. */
export function resolvePresetSchema(
  schema: readonly PresetField[],
  t: PresetTranslate,
): DataField[] {
  return schema.map(({ labelKey, ...field }) => ({
    ...field,
    label: t(labelKey),
  })) as DataField[];
}

export const PRESET_CATEGORIES: PresetCategoryMeta[] = [
  {
    id: "users-auth",
    name: "Users & Auth",
    icon: "Users",
    descriptionKey: "presetMeta.categoryUsersAuth",
  },
  {
    id: "people",
    name: "People",
    icon: "Contact",
    descriptionKey: "presetMeta.categoryPeople",
  },
  {
    id: "organization",
    name: "Organization",
    icon: "Building2",
    descriptionKey: "presetMeta.categoryOrganization",
  },
  {
    id: "ecommerce",
    name: "E-commerce",
    icon: "ShoppingCart",
    descriptionKey: "presetMeta.categoryEcommerce",
  },
  {
    id: "content",
    name: "Content",
    icon: "Newspaper",
    descriptionKey: "presetMeta.categoryContent",
  },
  {
    id: "finance",
    name: "Finance",
    icon: "CreditCard",
    descriptionKey: "presetMeta.categoryFinance",
  },
  {
    id: "media",
    name: "Media",
    icon: "Image",
    descriptionKey: "presetMeta.categoryMedia",
  },
  {
    id: "manufacturing",
    name: "Manufacturing",
    icon: "Factory",
    descriptionKey: "presetMeta.categoryManufacturing",
  },
  {
    id: "system",
    name: "System",
    icon: "Settings",
    descriptionKey: "presetMeta.categorySystem",
  },
];
