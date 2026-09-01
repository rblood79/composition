/**
 * @fileoverview main document 정규화 체인 단일 소유 (ADR-923 r18m2, 2026-09-01).
 *
 * 배경: origin 시드 3종 + legacy ListBox 템플릿 → origin + 형태 migration 4개 (`applyCanonicalDocumentMigrations`)
 *   를 같은 순서로 중첩 호출하는 체인이 hydration (`adapters/canonical/index.ts`) 과 persist-back
 *   (`usePageManager.ts`) 두 곳에 복제돼 있었고, **전체 문서 교체 경계** (`applySnapshotDocument` —
 *   과거 snapshot 복원 · undo/redo 재적용 · 프로젝트 JSON 파일 가져오기) 는 어느 것도 통과하지 않아
 *   legacy 형태가 store·IndexedDB 에 그대로 실렸다 (Codex r18m2). 체인을 여기 한 함수로 모으고 세
 *   경계가 전부 이것을 호출한다 (정적 게이트: `__tests__/canonicalDocumentMigrations.test.ts`).
 *
 * 두 층:
 *   - `applyCanonicalDocumentMigrations` — 문서 **형태** 만 고치는 순수·멱등 migration (모든 진입점:
 *     main document + external import master).
 *   - `normalizeMainDocument` (본 함수) — 위 migration + main document 전용 origin 시드/보수. external
 *     import master 는 시드 대상이 아니다 (round 17 판정 유지).
 *
 * 순서 (안쪽부터): legacy ListBox 템플릿 → GridList origin → Menu origin → 형태 migration 4개 →
 *   reusable composite origin — 종전 두 체인의 중첩 순서 그대로. 순수 함수 — 고칠 게 없으면 같은 참조.
 */

import type { CompositionDocument } from "@composition/shared";

import { ensureGridListTemplateOrigins } from "../../builder/components/gridlist/gridListTemplateOrigins";
import { ensureMenuTemplateOrigins } from "../../builder/components/menu/menuTemplateOrigins";
import { ensureReusableCompositeOrigins } from "../../builder/components/reusableCompositeOrigins";
import { applyCanonicalDocumentMigrations } from "./canonicalDocumentMigrations";
import { migrateLegacyListBoxTemplatesToOrigins } from "./legacyListBoxTemplateMigration";

export function normalizeMainDocument(
  document: CompositionDocument,
): CompositionDocument {
  return ensureReusableCompositeOrigins(
    applyCanonicalDocumentMigrations(
      ensureMenuTemplateOrigins(
        ensureGridListTemplateOrigins(
          migrateLegacyListBoxTemplatesToOrigins(document),
        ),
      ),
    ),
  );
}
