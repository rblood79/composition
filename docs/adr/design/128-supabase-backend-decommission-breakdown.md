# ADR-128 Design Breakdown — Supabase backend decommission

> 본 문서는 [ADR-128](../128-supabase-backend-decommission.md) 의 구현 phase 상세. ADR 본문은 base 결정 (auth-only 격하 + dead code 인정 + ADR-121~127 premise stale 해체) 만 다루며, 단계적 cleanup phase 는 본 문서에서 분리 관리한다.

## §1 Framing 4 질문 통과 (lock-in)

| #   | 질문                     | 답                                                                                                                   |
| --- | ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 1   | base/응용 분류           | **base** — backend dependency 단일화 (Supabase auth + IndexedDB only). 후속 cleanup 의 prerequisite                  |
| 2   | schema 직교성            | **직교** — ADR-116 (canonical-only runtime, internal data shape) 와 외부 backend dep 결정은 독립                     |
| 3   | baseline framing reverse | **reverse 필요** — ADR-121~127 의 "cloud transport boundary 유지" 명분이 stale. 본 ADR 이 그 stale premise 공식 해체 |
| 4   | codex 3차 미루지 말 것   | 본 ADR 본문 작성 시점 framing 확정, 후속 phase 진입 시 codex 1차 진입                                                |

**사용자 explicit confirm 시점**: 2026-05-12 — "Base scope confirm — 권고 그대로 진행, cleanup 은 design breakdown 후속 phase".

## §2 Phase 0 — Dead code inventory freeze (현재 baseline)

본 ADR Proposed 시점에서 확보된 evidence:

### Supabase `.from(...)` 호출 9 위치 (single-line grep, production)

> **⚠ Inventory 결함 — Phase 1 진입 직전 multi-line grep 재실행 의무 (codex 검토 2026-05-12)**:
>
> 본 표는 single-line `supabase.from(...)` pattern grep 결과 (9 호출 / 5 file). multi-line `supabase\n .from(...)` 호출이 누락됨. Phase 1 sub-phase 1-α 진입 직전 `rg --multiline 'supabase\s*\n?\s*\.from\('` 재실행 후 본 §2 inventory 를 66 호출 / 12 file 수준으로 갱신 의무.
>
> **추가 발견 file** (single-line grep 누락, multi-line 재실행 시 inventory 흡수 대상):
>
> - `apps/builder/src/services/api/DocumentsApiService.ts` (3 calls, `documents`)
> - `apps/builder/src/services/api/ProjectsApiService.ts` (5 calls, `projects`)
> - `apps/builder/src/services/theme/TokenService.ts` (3 calls, `design_tokens`) — **base scope 외 영역 가능, Phase 3 narrow framing 시점 사용자 confirm 결합**
> - `apps/builder/src/builder/factories/utils/dbPersistence.ts` (3 calls, `layouts`/`pages`/`elements`)
> - `apps/builder/src/builder/hooks/useCollectionItemManager.ts` (2 calls, `elements`)
> - `apps/builder/src/builder/panels/properties/PropertiesPanel.tsx` (3 calls, `elements`)
> - `historyActions.ts` (본 표 3 호출 → 실제 22+ 호출, undo/redo cloud read path 광범위)
>
> **base decision 영향 0** — auth-only 격하 결정은 9 든 66 든 동일. 본 inventory 정밀도는 Phase 1 cleanup 작업량 산정 입력 자료.

| File:Line                                                                        | Table      | 의도               |
| -------------------------------------------------------------------------------- | ---------- | ------------------ |
| `apps/builder/src/adapters/canonical/legacyElementsApiService.ts:269`            | `elements` | delete by id       |
| `apps/builder/src/adapters/canonical/legacyElementsApiService.ts:281`            | `elements` | delete in ids      |
| `apps/builder/src/builder/workspace/canvas/benchmarks/marginCollapseAudit.ts:19` | `projects` | select (benchmark) |
| `apps/builder/src/builder/panels/properties/editors/TableHeaderEditor.tsx:169`   | `elements` | insert             |
| `apps/builder/src/builder/panels/properties/editors/TableEditor.tsx:257`         | `elements` | upsert             |
| `apps/builder/src/builder/stores/history/historyActions.ts:240`                  | `elements` | delete in ids      |
| `apps/builder/src/builder/stores/history/historyActions.ts:862`                  | `elements` | delete by id       |
| `apps/builder/src/builder/stores/history/historyActions.ts:1533`                 | `elements` | delete by id       |
| `apps/builder/src/services/api/PagesApiService.ts:159`                           | `pages`    | delete by id       |

### `Legacy*` 식별자 사용 분포 (production, top)

| 식별자                       | 빈도 | 의도                                      |
| ---------------------------- | ---: | ----------------------------------------- |
| `legacyToCanonical`          |  102 | legacy → canonical adapter (boundary)     |
| `legacyElements`             |   72 | legacy element collection accessor        |
| `LegacyDocument`             |   59 | legacy document schema type               |
| `legacyProps`                |   52 | legacy element props field                |
| `LegacySnapshot`             |   43 | history snapshot legacy schema            |
| `LegacyMirror`               |   28 | runtime legacy mirror (ADR-122 제거 대상) |
| `LegacyLayoutId`             |   26 | legacy layout id alias                    |
| `LegacyLayout`               |   26 | legacy layout type                        |
| `LegacyFrameElementForFrame` |   25 | frame element legacy adapter              |
| `LegacyOwnership`            |   20 | ownership boundary type                   |

### `metadata.type` "legacy-\*" literal (production, 169 occurrences)

- `"legacy-page"`: 99
- `"legacy-layout"`: 47
- `"legacy-slot-hoisted"`: 23

### Legacy file count (apps/builder/src)

5 production:

- `legacyElementsApiService.ts`
- `legacyElementSanitizer.ts`
- `legacyMetadata.ts`
- `legacyExtensionFields.ts`
- `legacyElementFields.ts`

### Baseline 699 type 에러의 cloud-dead 기인 추정

`apps/builder/.type-errors-baseline.txt` 의 699 에러 중 cloud-dead 기인 추정:

- G1 (snake_case 227) — Supabase row schema 직렬화 호환 보존 → 상당 부분 dead
- G2-a (`fills` 15) — ADR-908 fill schema, cloud 무관 (유지)
- G2-b (`reusable`/`ref`/`descendants`/`placeholder` 83) — canonical-native schema, cloud 무관 (유지)
- G2-c (`componentRole`/`schemaVersion`/MIRROR_FIELD 31) — ADR-112 lineage, cloud 무관 (유지)
- G3 (ComponentTag "body" 23) — 명명 정합, cloud 무관 (유지)

→ G1 의 상당 부분 (production 35건 + test 190건) 이 cloud-dead 직접 기인 가능. 정확한 비율은 Phase 5 검증.

## §3 Phase 1 — Cloud-only dead call site 직접 제거

**진입 직전 의무 (multi-line grep 재실행)**:

```bash
rg --multiline 'supabase\s*\n?\s*\.from\(' apps/builder/src -g '*.ts' -g '*.tsx'
```

실행 결과로 §2 inventory 갱신 후 sub-phase 분류 확정. 본 표는 single-line grep 결과 9 호출의 의도 분류 + multi-line 재실행 시 추가 sub-phase (1-ζ ~ 1-θ) 흡수 가이드.

| Sub | File                                                                                                                                                                                                      | 작업                                                                                                                                  | 회귀 검증                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 1-α | `legacyElementsApiService.ts:269, 281` + multi-line 5 select 호출 (line 35/81/137/213/253)                                                                                                                | cloud delete + select 호출 제거 + `LegacyElementsApiService` class 의도 재정의 (IndexedDB only 또는 deletion)                         | targeted vitest                        |
| 1-β | `historyActions.ts:240, 862, 1533` + multi-line 22+ 호출 (line 215/226/731/761/787/802/845/868/889/902/912/1344/1355/1401/1417/1439/1469/1490/1503/1513/1539/2237/2261/2271)                              | undo/redo 시 cloud read/write/delete 전체 호출 제거. IndexedDB persistence 정합 확인. **본 sub-phase 가 Phase 1 작업량 최대**         | history undo/redo test                 |
| 1-γ | `TableEditor.tsx:257` + multi-line 2 (line 148/193), `TableHeaderEditor.tsx:169`                                                                                                                          | Property editor 저장 시 cloud insert/upsert/select 제거. IndexedDB write path 만 유지                                                 | Table editor smoke + 사용자 환경 검증  |
| 1-δ | `PagesApiService.ts:159` + multi-line 5 (line 43/64/97/123/151)                                                                                                                                           | page CRUD cloud 호출 제거. IndexedDB only path 정합                                                                                   | page CRUD test                         |
| 1-ε | `marginCollapseAudit.ts:19` + multi-line 1 (line 30)                                                                                                                                                      | dev benchmark cloud read 제거 또는 IndexedDB / static fixture 로 전환                                                                 | benchmark 동작 확인 (optional)         |
| 1-ζ | `DocumentsApiService.ts` 3 호출 (line 43/82/110, `documents` table)                                                                                                                                       | documents table CRUD cloud 호출 제거. 사용자 명시 ("Supabase 로그인 외 모두 제거") 정합 — IndexedDB only 전환 또는 file 자체 deletion | targeted vitest + 사용자 환경          |
| 1-η | `ProjectsApiService.ts` 5 호출 (line 45/70/100/121/143, `projects` table)                                                                                                                                 | projects table CRUD cloud 호출 제거. IndexedDB only 또는 file deletion                                                                | targeted vitest + 사용자 환경          |
| 1-θ | `dbPersistence.ts` 3 호출 (line 23/46/74, `layouts`/`pages`/`elements`) + `useCollectionItemManager.ts` 2 호출 (line 170/196, `elements`) + `PropertiesPanel.tsx` 3 호출 (line 628/1168/1254, `elements`) | factory persistence layer + collection editor + property panel 의 cloud write 제거. IndexedDB write path 만 유지                      | 사용자 환경 검증 (production hot path) |

**TokenService (`design_tokens` table) 별도 처리**:

`apps/builder/src/services/theme/TokenService.ts` (line 58/90/112, 3 호출, `design_tokens` table) 는 base scope (auth-only 격하) 외 영역 가능. design tokens 가 cloud-sync 자산인지 IndexedDB-native 인지 결정은 Phase 3 narrow framing 시점에 export/import scope 결정과 결합하여 사용자 confirm. 본 결정 전까지 Phase 1 sub-phase 분류 제외.

각 sub-phase 별 (1) 직접 제거 (2) targeted vitest PASS (3) 사용자 환경 검증 (4) commit + push. 메모리 `feedback-pr-vs-direct-push` 정합 main 직접.

**회귀 검증 책임**: 각 sub-phase 별 production code 변경 후 baseline 699 가 줄어야 함 (dead 기인이었으면). 늘어나면 별 stale debt 노출.

## §4 Phase 2 — Cloud-only adapter file 제거

Phase 1 직접 제거 후 cloud-only adapter 의 잔존 호출 grep + 추가 제거:

| Sub | File                                                                                                                        | 검증                      |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| 2-α | `legacyElementsApiService.ts` 전체 dead 여부 검증 + 전체 파일 제거 (또는 IndexedDB-only API service 로 rename + scope 축소) | grep import + 사용자 환경 |
| 2-β | `PagesApiService.ts` cloud 부분 vs IndexedDB 부분 분리. cloud method 제거                                                   | grep import               |
| 2-γ | `legacyElementSanitizer.ts` cloud row schema sanitize 부분 제거 또는 file scope 재정의                                      | grep + targeted vitest    |
| 2-δ | `DocumentsApiService.ts` 전체 dead 여부 검증 + 파일 제거 (또는 IndexedDB-only API service 로 rename)                        | grep import + 사용자 환경 |
| 2-ε | `ProjectsApiService.ts` 전체 dead 여부 검증 + 파일 제거 (또는 IndexedDB-only API service 로 rename)                         | grep import + 사용자 환경 |

본 Phase 의 결과로 `apps/builder/src/services/api/` 및 `apps/builder/src/adapters/canonical/legacy*` 경로의 cloud 의존 코드 zero. legacy file 5개 → 필요한 것 (IndexedDB 직렬화 / file export / import) 만 잔존, scope 명시. Phase 2 진입 직전 §3 multi-line grep 재실행 결과로 adapter file 추가 발견 시 sub-phase 추가 흡수.

## §5 Phase 3 — Legacy export/import scope 재정의

본 ADR scope 안에서 **결정 필요** (Phase 0 inventory 시점에 사용자 confirm):

- `exportLegacyDocument()` — cloud sync 호환 명분 stale. 잔존 의도:
  - (i) file export (JSON download) 시나리오 유지 → file 입출력 boundary 로 scope 재정의
  - (ii) 완전 제거 → 사용자 file export 시나리오 없음 명시 시
- `legacyToCanonical()` — JSON file import / 기존 indexedDB 데이터 마이그레이션 명분
  - 새 IndexedDB-native 직렬화로 통일하면 제거 가능
  - 기존 user IndexedDB 데이터의 schema 변환 필요 시 유지

이 결정은 본 ADR Phase 3 진입 전 별 사용자 confirm 단계 (M2 의무 — fork 시점 아닌 본 phase 의 narrow framing).

## §6 Phase 4 — ADR-121~127 Status reverse 처리

본 ADR Implemented 승격 시점:

- ADR-121~127 의 본문에 "**Superseded in part by ADR-128**" addendum 추가
- ADR-121~127 의 "cloud transport boundary 유지" 명분이 stale 임을 본 ADR-128 본문 참조로 명시
- `docs/adr/README.md` 의 ADR-121~127 entry 비고 갱신
- **본문 Status 자체는 Implemented 유지** (반복적 part-supersede 는 본 ADR 만으로 충분, 7개 ADR 의 Status 전면 변경 불필요)

## §7 Phase 5 — Baseline 측정 (type-error + 번들 사이즈)

Phase 1~4 완료 후 두 baseline 동시 refresh + 측정:

### 5-A. Type-error baseline 측정

- Phase 1 dead code 9 호출 + Phase 2 cloud adapter 제거 → `apps/builder/.type-errors-baseline.txt` 자동 감소량 측정
- 측정 방법: `cd apps/builder && pnpm exec tsc -p tsconfig.app.json --noEmit 2>&1 | grep "error TS" | wc -l`
- baseline (Phase 0): **699 에러**
- 목표 추정: G1 (snake_case 227) 의 cloud-dead 기인 부분 자동 해소 — **-100~-150 추정** (정확한 비율은 측정으로 확정)
- 자동 감소 후 잔존 type 에러는 진정한 stale 마이그레이션 영역 (canonical-native schema 정합 작업)
- 잔존 에러의 ADR 매핑 갱신 — 메모리 `project-type-baseline-categories.md` 의 G1/G2 재분류

### 5-B. 번들 사이즈 baseline 측정 (R6 반영)

본 ADR Consequences/Positive 의 "번들 사이즈 감소" 주장을 정량 검증.

**baseline 측정 (Phase 0 시점)**:

- 측정 방법: `pnpm build` 후 `apps/builder/dist/assets/` 내 production chunk 사이즈 합산
  - 명령어: `du -ch apps/builder/dist/assets/*.js | tail -1` (총 JS chunk gzipped)
  - 보조: `ls -lh apps/builder/dist/assets/index-*.js apps/builder/dist/assets/vendor-*.js` (개별 chunk)
- baseline 값: Phase 0 inventory 시점에 측정 후 본 §5-B 에 기록 (TBD — Phase 1 진입 직전 확정)

**목표 추정 (Phase 1~2 합산)**:

| 제거 영역                                                   | 추정 영향                                                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 9 supabase.from 호출 위치 코드 라인                         | inline 제거 분 (수 KB 추정)                                                                |
| `legacyElementsApiService.ts` 전체 (Phase 2-α)              | 1 파일 dead → ~3-5KB 감소 추정                                                             |
| `PagesApiService.ts` cloud 부분 (Phase 2-β)                 | 부분 제거 → ~1-2KB 감소 추정                                                               |
| `legacyElementSanitizer.ts` cloud sanitize 부분 (Phase 2-γ) | 부분 제거 → ~1-2KB 감소 추정                                                               |
| `@supabase/supabase-js` tree-shaking 효과                   | auth-only 사용으로 일부 module 제거 → ~10-30KB 감소 추정 (vite tree-shaking 분석으로 확정) |

**총 추정**: **-15KB~-40KB** (gzipped, production chunk 기준). 정확한 수치는 Phase 1~2 완료 후 측정.

**검증 방법 (Phase 1~2 완료 후)**:

1. `pnpm build` 재실행
2. 동일 명령으로 chunk 사이즈 재측정
3. baseline 대비 감소량 절대값 + 비율 계산
4. 목표 추정 (-15KB~-40KB) 정합 여부 확인
5. tree-shaking 효과 분석: `vite build --mode production --logLevel info` 의 chunk 보고 + `vite-bundle-visualizer` 또는 `rollup-plugin-visualizer` 로 supabase 의존 module 잔존 검증

**Gate G-Phase-5 통과 조건 갱신**:

- (a) type-error baseline 자동 감소 측정 완료 + 메모리 반영
- (b) 번들 사이즈 baseline + 감소량 측정 완료 + 본 §5-B 에 수치 기록
- (c) 추정 (-15~-40KB) 정합 시 PASS / 불정합 시 dead 가정 재검토 + ADR scope 축소

본 Phase 의 결과는 ADR-116 후속 phase 의 정확한 scope 결정 입력 자료 + ADR-128 Implemented 승격 evidence (번들 감소 정량).

## §8 Phase 6 — Final baseline + 신규 진입 차단 강화

- `apps/builder/.type-errors-baseline.txt` Phase 5 후 최종 freeze
- baseline wrapper (`scripts/type-check-baseline.sh`) 정합 확인 — 새 위반 fail 정책 그대로
- ADR-116 후속 phase 가 baseline 잔존 G1/G2/G4/G5 단계적 축소

## §9 ADR-128 Implemented 승격 조건

Phase 1~4 완료 시 본 ADR Status `Implemented` 승격 가능. Phase 5~6 는 후속 작업 (ADR-128 implicit follow-up + ADR-116 후속 phase).

승격 조건:

- (a) Phase 1 sub-phase 1-α~1-ε 모두 production 직접 제거 + 사용자 환경 검증 PASS
- (b) Phase 2 sub-phase 2-α~2-γ 모두 grep import 0건 + 파일 제거 또는 scope 재정의
- (c) Phase 3 의 export/import scope 사용자 confirm + 결정 commit
- (d) Phase 4 ADR-121~127 addendum + README 갱신
- (e) `pnpm type-check` PASS (baseline 축소, 새 위반 0)
- (f) targeted vitest PASS
- (g) 사용자 환경 IndexedDB-only data layer 정상 동작 확인 (create/edit/delete/undo/redo 시나리오)

## §10 금지 패턴 (ADR-128 phase 전체)

- ❌ Phase 1 의 9 호출 위치 일괄 sed 제거 (각 호출 별 동작 검증 필수)
- ❌ Phase 2 의 adapter file 제거를 dependency grep 없이 진행
- ❌ Phase 3 의 export/import scope 결정을 사용자 confirm 없이 진행
- ❌ Phase 4 의 ADR-121~127 Status 전면 변경 (part-supersede 만으로 충분)
- ❌ Phase 5 의 baseline refresh 를 ADR-128 phase 외부에서 진행 (commit chain 정합 유지)
- ❌ cloud 복원 시나리오 미래 도입 시 본 ADR 만으로 자동 reverse 불가 — 신규 ADR 발의 필요 (no-derived-adr-mid-execution 정합)
