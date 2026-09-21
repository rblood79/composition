import type { CompositionDocument } from "@composition/shared";
import {
  getReusableEntries,
  getReusableEntry,
  getReusableOriginId as getCatalogReusableOriginId,
} from "@composition/shared";
import {
  TOOLBAR_ORIGIN_ID,
  ensureToolbarTemplateOrigins,
} from "./toolbar/toolbarTemplateOrigins";
import {
  FORM_ORIGIN_ID,
  ensureFormTemplateOrigins,
} from "./form/formTemplateOrigins";
import {
  ICONBUTTON_ORIGIN_ID,
  ensureIconButtonTemplateOrigins,
} from "./iconbutton/iconButtonTemplateOrigins";
import {
  INLINE_ALERT_ORIGIN_ID,
  ensureInlineAlertTemplateOrigins,
} from "./inlinealert/inlineAlertTemplateOrigins";
import {
  CARD_ORIGIN_ID,
  ensureCardTemplateOrigins,
} from "./card/cardTemplateOrigins";
import {
  LISTBOX_ORIGIN_ID,
  ensureListBoxTemplateOrigins,
} from "./listbox/listBoxTemplateOrigins";
import {
  GRIDLIST_ORIGIN_ID,
  ensureGridListTemplateOrigins,
} from "./gridlist/gridListTemplateOrigins";
import {
  TAGGROUP_ORIGIN_ID,
  ensureTagGroupTemplateOrigins,
} from "./taggroup/tagGroupTemplateOrigins";
import { ensureCatalogOrigins, getCatalogOriginTypes } from "./catalogOrigins";
import { ensureStateVariantOrigins } from "./stateVariantOrigins";
import { catalogReusableOriginId } from "@composition/shared";
import {
  collectReusableOriginIds,
  convertNewOriginChildrenToRefs,
  type OriginChildRefDiagnostic,
} from "./originChildRefs";

/**
 * ADR-912 R-5 (HC#5 "조합 = 데이터") → **ADR-148 Phase 1 (catalog 파생 대체)**.
 *
 * 종전에는 본 모듈의 `REUSABLE_COMPOSITE_ORIGINS` 하드코딩 맵이 별도 레지스트리였다.
 * ADR-148 Phase 1 이 등록 SSOT 를 catalog `kind:"reusable"` entry 로 단일화하여
 * "1 컴포넌트 = 1 등록" 을 reusable 축까지 완성 — 본 모듈은 catalog 파생 re-export +
 * **origin seed(ensurer) 매핑**만 보유한다.
 *
 * **신규 조합 추가 = origin seed 모듈 1개 + catalog reusable entry 1개** (factory 코드
 * 변경 0 — ADR-912 HC#5 / ADR-148 HC#2). entry ↔ ensurer 누락은
 * `componentRegistrationContract.test.ts` 불변식이 강제한다.
 */

/**
 * reusableId → origin seed(멱등 repair) 매핑. catalog 는 id 를 알고, 문서 리터럴과
 * 멱등 repair 는 seed 모듈이 담는다 (설계도 I4). key 는 catalog entry 의 `reusableId`.
 *
 * 함수로 두는 이유 (ADR-229 Phase 1, 2026-09-21): 이 모듈은 `mainDocumentNormalization` ←
 * `adapters/canonical/index` ← `utils/element/elementUtils` ← factory definitions ←
 * `catalogOrigins` 순환 안에 있다. 모듈 본문에서 seed 모듈의 상수 (`TAGGROUP_ORIGIN_ID` ·
 * `getCatalogOriginTypes()`) 를 읽으면 진입점이 seed 모듈 쪽 (테스트가 `catalogOrigins` 나
 * `tagGroupTemplateOrigins` 를 먼저 import) 일 때 TDZ (`Cannot access … before initialization`)
 * 가 난다 — 첫 호출 시점까지 평가를 미룬다 (production 진입은 normalization 쪽이라 무관했고,
 * `catalogOrigins.test` 는 import 순서가 우연히 막고 있었다).
 */
let reusableOriginEnsurersCache: Readonly<
  Record<string, (document: CompositionDocument) => CompositionDocument>
> | null = null;

export function getReusableOriginEnsurers(): Readonly<
  Record<string, (document: CompositionDocument) => CompositionDocument>
> {
  if (reusableOriginEnsurersCache) return reusableOriginEnsurersCache;
  reusableOriginEnsurersCache = {
    [TOOLBAR_ORIGIN_ID]: ensureToolbarTemplateOrigins,
    [FORM_ORIGIN_ID]: ensureFormTemplateOrigins,
    [ICONBUTTON_ORIGIN_ID]: ensureIconButtonTemplateOrigins,
    [INLINE_ALERT_ORIGIN_ID]: ensureInlineAlertTemplateOrigins,
    [CARD_ORIGIN_ID]: ensureCardTemplateOrigins,
    // ADR-228 (2026-09-21): ListBox/GridList 는 factory definition 이 이미 ref 인 template origin
    //   을 reusableId 로 재사용 — ensurer 도 기존 모듈 (item template origin 을 같이 시드).
    [LISTBOX_ORIGIN_ID]: ensureListBoxTemplateOrigins,
    [GRIDLIST_ORIGIN_ID]: ensureGridListTemplateOrigins,
    // ADR-229 Phase 1: TagGroup 은 generic 과 같은 트리 + chip item template origin 2 + TagList slot.
    [TAGGROUP_ORIGIN_ID]: ensureTagGroupTemplateOrigins,
    // ADR-228: 나머지 catalog 파생 generic origin 49 — 손 seed 모듈 0, 한 ensurer 가 1 pass 로
    //   전부 시드 (`ensureReusableCompositeOrigins` 는 같은 함수를 한 번만 부른다).
    ...Object.fromEntries(
      getCatalogOriginTypes().map((type) => [
        catalogReusableOriginId(type),
        ensureCatalogOrigins,
      ]),
    ),
  };
  return reusableOriginEnsurersCache;
}

/** `type` 이 reusable composite (origin ref 로 생성) 인지 여부 — catalog 파생. */
export function isReusableCompositeType(type: string): boolean {
  return getReusableEntry(type) !== undefined;
}

/** `type` 의 reusable origin id (아니면 null) — catalog 파생. */
export function getReusableCompositeOriginId(type: string): string | null {
  return getCatalogReusableOriginId(type);
}

/**
 * 모든 reusable composite origin 을 Components page body 에 보장한다 (멱등).
 *
 * 신규 프로젝트 생성 + hydration 진입점에서 호출한다. catalog 의 reusable entry 를
 * 순회하며 reusableId 별 ensurer 를 적용 — entry 추가 시 seed 모듈 + `getReusableOriginEnsurers`
 * 1줄이면 자동 합류한다. ensurer 부재 entry 는 조용히 건너뛰지 않고 개발 중 즉시
 * 드러나도록 test 불변식이 차단한다 (여기서는 방어적 skip — bootstrap 경로 안전 우선).
 */
export function ensureReusableCompositeOrigins(
  document: CompositionDocument,
): CompositionDocument {
  // ADR-229 Phase 2 — 2단 seed ①: 진입 시 존재하던 origin id 를 먼저 보관한다. ensurer 들은 plain
  //   으로 보충하고 (기존 origin 은 repair 가 children 을 보존), ② 에서 진입 시 없던 origin 의
  //   자식만 ref 로 바꾼다 — 처음 보충된 plain 자식을 사용자 자식으로 오인해 건너뛰지 않고,
  //   기존 origin 의 자식은 일절 바꾸지 않는다 (G4).
  const existingOriginIds = collectReusableOriginIds(document);
  let next = document;
  // 같은 ensurer 를 여러 entry 가 공유한다 (ADR-228 generic 50 → `ensureCatalogOrigins` 하나) —
  //   함수 identity 로 dedupe 해 문서 pass 를 entry 수가 아니라 ensurer 수만큼만 돈다.
  const applied = new Set<
    (document: CompositionDocument) => CompositionDocument
  >();
  for (const entry of getReusableEntries()) {
    const ensure = getReusableOriginEnsurers()[entry.reusableId];
    if (!ensure || applied.has(ensure)) continue;
    applied.add(ensure);
    next = ensure(next);
  }
  const converted = convertNewOriginChildrenToRefs(next, { existingOriginIds });
  reportOriginChildRefDiagnostics(converted.diagnostics);
  // ADR-230 — 기본 요소 origin 의 상태 변형 origin 은 조합 자식 ref 변환 **뒤** 보충한다
  //   (변형 subtree 는 그 시점의 default 와 동형 — default 의 자식이 ref 로 바뀐 뒤 복제).
  return ensureStateVariantOrigins(converted.document);
}

/** 변환 보류는 조용히 지나가지 않는다 — 개발 중 즉시 보이도록 (production 도 warn 1줄). */
function reportOriginChildRefDiagnostics(
  diagnostics: readonly OriginChildRefDiagnostic[],
): void {
  if (diagnostics.length === 0) return;
  console.warn(
    `[reusableCompositeOrigins] ADR-229 조합 자식 ref 변환 보류 ${diagnostics.length}건`,
    diagnostics.map(
      (d) => `${d.childId} → ${d.originId ?? "?"} (${d.reason}${d.detail ? `: ${d.detail}` : ""})`,
    ),
  );
}
