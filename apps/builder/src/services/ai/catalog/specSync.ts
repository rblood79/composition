/**
 * catalog(SSOT) ↔ AI 카탈로그 drift 검사 (ADR-134 Phase 5, D6).
 *
 * AI 카탈로그 본체는 `componentCatalog` 파생이라 자동으로 동기화된다 — 여기서 감시할
 * 대상은 **손으로 적은 얇은 층** 뿐이다: 한국어 별칭 / core set / 컨테이너 목록.
 * 이 층은 catalog 에서 컴포넌트가 사라지거나 이름이 바뀌면 조용히 죽는다 (별칭이
 * 존재하지 않는 type 을 가리키면 매칭은 성공하는데 상세는 비어 나온다).
 *
 * 그래서 "동기화 스크립트" 가 아니라 **검사**다. 파생이 파생으로 남아 있는지, 손으로 적은
 * 부분이 SSOT 를 벗어나지 않았는지를 본다.
 */
import { getAiCatalogEntry, CONTAINER_TYPES } from "./componentCatalog";
import {
  CORE_TYPES,
  KO_ALIASES,
  KO_CATEGORY_ALIASES,
} from "./dynamicInjection";
import { getCatalogByCategory } from "./componentCatalog";

export interface CatalogDriftFinding {
  source: "ko-alias" | "ko-category-alias" | "core-set" | "container-set";
  key: string;
  detail: string;
}

/** 손으로 적은 층이 catalog SSOT 를 벗어났는지 검사. 빈 배열 = drift 없음. */
export function checkCatalogDrift(): CatalogDriftFinding[] {
  const findings: CatalogDriftFinding[] = [];

  for (const [alias, type] of Object.entries(KO_ALIASES)) {
    if (!getAiCatalogEntry(type)) {
      findings.push({
        source: "ko-alias",
        key: alias,
        detail: `catalog 에 없는 type 을 가리킨다: ${type}`,
      });
    }
  }

  const categories = new Set(getCatalogByCategory().keys());
  for (const [alias, category] of Object.entries(KO_CATEGORY_ALIASES)) {
    if (!categories.has(category)) {
      findings.push({
        source: "ko-category-alias",
        key: alias,
        detail: `catalog 에 없는 카테고리를 가리킨다: ${category}`,
      });
    }
  }

  for (const type of CORE_TYPES) {
    if (!getAiCatalogEntry(type)) {
      findings.push({
        source: "core-set",
        key: type,
        detail: "catalog 에 없는 type",
      });
    }
  }

  for (const type of CONTAINER_TYPES) {
    if (!getAiCatalogEntry(type)) {
      findings.push({
        source: "container-set",
        key: type,
        detail: "catalog 에 없는 type",
      });
    }
  }

  return findings;
}
