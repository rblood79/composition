/**
 * DataTable Preset System Types
 *
 * DataTable Preset 선택기에서 사용되는 타입 정의
 *
 * @see docs/features/DATATABLE_PRESET_SYSTEM.md
 */

import type { DataField } from "../../../../types/builder/data.types";

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
 * Preset 카테고리
 */
export type PresetCategory =
  "users-auth" | "organization" | "ecommerce" | "manufacturing" | "system";

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

  /** 아이콘 (이모지 또는 lucide 아이콘 이름) */
  icon: string;

  /**
   * 스키마 정의 — `label` 자리에 **키**가 들어 있다 (`labelKey`).
   * 적용 시점에 `resolvePresetSchema` 로 해소해 문서에 굳힌다.
   */
  schema: PresetField[];

  /** 샘플 데이터 생성 함수 — 적용 시점 해소기를 받는다. */
  generateSampleData: (
    count: number,
    t: PresetTranslate,
  ) => Record<string, unknown>[];

  /** 기본 샘플 데이터 개수 */
  defaultSampleCount: number;
}

/**
 * 카테고리 메타 정보 목록
 */
/** 스키마 필드 — `label` 대신 키를 싣는다. 나머지는 `DataField` 와 같다. */
export type PresetField = Omit<DataField, "label"> & { labelKey: string };

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
