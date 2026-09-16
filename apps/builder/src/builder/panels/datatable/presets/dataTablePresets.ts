/**
 * DataTable Preset Definitions — 카테고리별 catalog/*.ts 를 한 표로.
 *
 * preset 은 `definePreset({ columns })` 로 정의한다 — 컬럼마다 규칙 (`SampleRule`,
 * mockaroo 어법) 이 데이터로 붙어 있고 스키마·샘플 행은 거기서 파생된다. 생성기는
 * `@composition/sample-data` (자체 모듈 — faker · randomuser · dummyjson · picsum 패턴 이식).
 *
 * | 카테고리      | preset                                            | 패턴 출처         |
 * | ------------- | ------------------------------------------------- | ----------------- |
 * | users-auth    | users · roles · permissions · invitations         | 기존 (규칙 이관)  |
 * | people        | profiles · contacts · employees                   | randomuser.me     |
 * | organization  | organizations · departments · projects            | 기존 (규칙 이관)  |
 * | ecommerce     | products · categories · orders · carts · reviews  | dummyjson         |
 * | content       | posts · comments · todos · recipes · quotes       | dummyjson         |
 * | finance       | transactions · paymentCards · invoices            | mockaroo          |
 * | media         | images                                            | picsum `/v2/list` |
 * | manufacturing | engines · components                              | 기존 (규칙 이관)  |
 * | system        | auditLogs · projectMemberships                    | 기존 (규칙 이관)  |
 */

import type { DataTablePreset, PresetCategory } from "./types";
import { USERS_AUTH_PRESETS } from "./catalog/usersAuth";
import { PEOPLE_PRESETS } from "./catalog/people";
import {
  MANUFACTURING_PRESETS,
  ORGANIZATION_PRESETS,
  SYSTEM_PRESETS,
} from "./catalog/organization";
import { ECOMMERCE_PRESETS } from "./catalog/ecommerce";
import { CONTENT_PRESETS } from "./catalog/content";
import { FINANCE_PRESETS, MEDIA_PRESETS } from "./catalog/finance";

export const DATATABLE_PRESETS: Record<string, DataTablePreset> = {
  ...USERS_AUTH_PRESETS,
  ...PEOPLE_PRESETS,
  ...ORGANIZATION_PRESETS,
  ...ECOMMERCE_PRESETS,
  ...CONTENT_PRESETS,
  ...FINANCE_PRESETS,
  ...MEDIA_PRESETS,
  ...MANUFACTURING_PRESETS,
  ...SYSTEM_PRESETS,
};

/**
 * 카테고리별 Preset 목록 가져오기
 */
export function getPresetsByCategory(
  category: PresetCategory | string,
): DataTablePreset[] {
  return Object.values(DATATABLE_PRESETS).filter(
    (preset) => preset.category === category,
  );
}

/**
 * 모든 Preset 목록 가져오기
 */
export function getAllPresets(): DataTablePreset[] {
  return Object.values(DATATABLE_PRESETS);
}
