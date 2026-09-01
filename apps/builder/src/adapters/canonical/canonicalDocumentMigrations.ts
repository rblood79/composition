/**
 * @fileoverview canonical document 형태 migration 단일 체인 (ADR-923 r17m2, 2026-09-01).
 *
 * 배경: 같은 migration 4개가 `adapters/canonical/index.ts` (hydration) 와 `usePageManager.ts`
 *   (persist-back) 두 곳에 중첩 호출로 복제돼 있었고, external import (`importPayloadAdapter`
 *   `normalizeCompositionImportPayload`) 는 어느 것도 통과하지 않았다 — import master 의 legacy
 *   ColorField 는 parent label 없이 남아 Preview 무라벨 / Skia·레이아웃 "Color" 였다 (Codex r17m2).
 *   진입 경로마다 체인을 다시 적는 구조 자체가 결함이라 여기 한 함수로 모으고 세 진입점이 전부 이것을
 *   호출한다 (정적 게이트: `canonicalDocumentMigrations.test.ts`).
 *
 * 포함: 문서 **형태** 를 고치는 순수·멱등 migration 만. origin 시드/보수 (`ensure*TemplateOrigins`,
 *   `ensureReusableCompositeOrigins`, legacy ListBox 템플릿 → origin) 는 main document 전용이라 두
 *   체인에 남긴다.
 *
 * 순서 (안쪽부터): CheckboxRadio 구조 → ColorField parent label → field inline layout strip →
 *   circle leaf inline size strip — 종전 두 체인의 중첩 순서 그대로.
 */

import type { CompositionDocument } from "@composition/shared";

import { migrateCheckboxRadioItemsStructure } from "./checkboxRadioItemsMigration";
import { migrateCircleLeafInlineSize } from "./circleLeafInlineSizeMigration";
import { migrateColorFieldParentLabel } from "./colorFieldParentLabelMigration";
import { migrateFieldInlineLayout } from "./fieldInlineLayoutMigration";

export function applyCanonicalDocumentMigrations(
  document: CompositionDocument,
): CompositionDocument {
  return migrateCircleLeafInlineSize(
    migrateFieldInlineLayout(
      migrateColorFieldParentLabel(
        migrateCheckboxRadioItemsStructure(document),
      ),
    ),
  );
}
