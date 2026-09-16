# ADR-220: 샘플 데이터 엔진 패키지화 — `@composition/sample-data` + `mockData` 명칭 정리

## Status

Proposed — 2026-09-16

> 출처: 2026-09-16 사용자 제안 "preset 모듈은 package 형태로 제공하는 것은 어떨까?" + 명칭 질의 (mock-data / dummy-data / 다른 것). 같은 날 Mock 데이터 자체 모듈 (`c9f2f7217`) · preset 규칙 기반 재작성 (`8eba9427f`) · preset 문자열 lazy 분리가 반영된 직후의 경계 정리다.

## Context

**SSOT 3-domain 관계**: D1/D2/D3 어느 것도 아니다 — 시각·DOM·props 가 아니라 **Data 패널이 사용자 테이블에 넣는 샘플 행을 만드는 순수 생성기** 의 모듈 경계와 이름을 정한다. collections 데이터 계약 (ADR-152 · 213) 은 건드리지 않는다.

### 코드 사실 (2026-09-16, HEAD `736aa8af4`)

| 사실                                                                                                                                                                                                                                 | 경로 : 라인                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 생성기 모듈 5 파일 1,923 줄, **외부 import 0** (React · builder store · i18n 어느 것도 안 읽음)                                                                                                                                      | `apps/builder/src/services/mockData/{random,locale,generators,rules,index}.ts`                                                                              |
| 공개 API 8 export — `createRandom · hashSeed · mulberry32` (seed PRNG) · `resolveMockLocale · FALLBACK_LOCALE` · `createMock · slugify` (faker 식 이름공간 생성기) · `generateValue · generateRow · generateRows` (mockaroo 식 규칙) | `services/mockData/index.ts:15-30`                                                                                                                          |
| 규칙 type `MockRule` — discriminated union (`rowNumber · sequence · id · uuid · gender · firstName · … `) + `MockColumn` · `MockRowContext` · `GenerateRowsOptions`                                                                  | `services/mockData/rules.ts:33-171`                                                                                                                         |
| 소비처 A — preset 카탈로그 (`definePreset` 이 `schema` + `generateSampleData` 파생)                                                                                                                                                  | `builder/panels/datatable/presets/types.ts:9-15` (`DataField` + `generateRows · resolveMockLocale · MockColumn · MockRule`) · `presets/catalog/column.ts:7` |
| 소비처 B — AI `create_table_from_description` 의 필드 생성 규칙 `fields[].generate` — **LLM 에 노출되는 tool schema** 가 `kind: z.literal("mock")` + `type: z.enum(MOCK_RULE_TYPES)` (54 종)                                         | `services/ai/data/tableSpec.ts:89-96 · 236-239 · 320` · `services/ai/tools/createTableFromDescription.ts:34`                                                |
| 소비처 C — 패널 (`DataTableCreator.tsx` · `DataTableList.tsx`) 는 preset 경유, 직접 import 없음                                                                                                                                      | `panels/datatable/editors/DataTableCreator.tsx:16` (주석 참조만)                                                                                            |
| preset 은 builder 타입에 결합 — `DataField` (`apps/builder/src/types/builder/data.types.ts:41`, `DataFieldType` 10-literal :26) 와 i18n (`presetStrings.ts:10` `getStoredLocale`, `:11` `SupportedLocale`)                           | `presets/types.ts:9` · `presets/presetStrings.ts:10-11`                                                                                                     |
| `DataField` 는 shared 에 없다 — shared 의 `FieldType` (`packages/shared/src/types/element.types.ts:45`, 7-literal) 은 element field 로 **다른 객체 경로** (`composition-vocabulary.ts:6` 가 구분을 명시)                             | `packages/shared/src/types/element.types.ts:45`                                                                                                             |
| 테스트 — 생성기 18 · preset 7 · tableSpec 8 (`it()`), 전부 vitest jsdom/node                                                                                                                                                         | `services/mockData/mockData.test.ts` · `presets/dataTablePresets.test.ts` · `services/ai/data/tableSpec.test.ts`                                            |
| `mock` 식별자 사용 지점 151 (src, 테스트·`vi.mock` 제외); 규칙 kind 리터럴 `"mock"` 4 (`tableSpec.ts`) — **저장 문서에는 없다** (규칙은 preset 정의·tool 인자에만, 사용자 문서엔 생성된 행만 저장)                                   | `grep -rIn 'mockData\|"mock"' apps/builder/src`                                                                                                             |
| 무관한 동음 — workflow 데이터 소스 종류 `sourceType: "dataTable" \| "api" \| "mock"` (Skia workflow 렌더) 는 이 모듈과 관계없다                                                                                                      | `workspace/canvas/skia/workflowEdges.ts:212 · 288` · `workflowRenderer.ts:546`                                                                              |
| 패키지 선례 — `@composition/shared` 는 `exports` 가 `./src/*.ts` 를 직접 가리키고 (빌드 0) `type-check: tsc --noEmit` · `test: vitest run`; `@composition/specs` 는 tsup dist 배포형                                                 | `packages/shared/package.json:7-16 · 52-57` · `packages/specs/package.json:5-12`                                                                            |
| turbo `type-check` 는 `^type-check` 의존 — 새 패키지가 자동 편입                                                                                                                                                                     | `turbo.json:21-23`                                                                                                                                          |
| 번들 상한 정본 (ADR-202 재승인·후속) — Builder ≤ 1,319,829 / Preview ≤ 592,000 B gzip, 만료 2026-10-16; HEAD Builder 1,312,037 (preset 문자열 lazy 분리 후)                                                                          | `apps/builder/scripts/adr202-bundle-gate.mjs:36-37`                                                                                                         |
| 이 저장소의 `mock` 은 테스트 대역 어휘로 굳어 있다 — `vi.mock` · `__mocks__` · ADR-202 G5 "DOM/Electron/provider mock 없이" · ADR-198 "provider mock"                                                                                | `docs/adr/completed/202-*.md` Gates G5 · `.claude/rules/measurement-validity.md`                                                                            |
| 사용자-가시 어휘는 이미 "샘플" — i18n `chart.sampleRows: "샘플 데이터"` · AI tool 설명 "샘플 행 **생성 규칙**" · `CHART_SAMPLE_ROWS`                                                                                                 | `apps/builder/src/i18n/translations.ts:18 · 1043 · 1054`                                                                                                    |

### Hard constraints

1. **동작 무변경** — 같은 seed · 같은 규칙 → 같은 행 (byte-identical). 이건 리팩터이지 생성기 변경이 아니다.
2. **번들 무변경** — initial gzip Δ 가 Builder · Preview 각각 ±512 B 안이고 상한 (1,319,829 / 592,000) 안. 패키지 경계는 청크를 바꾸지 않는다 (청크는 import 그래프) — 바뀌면 원인을 찾는다.
3. **의존 0 유지** — 새 패키지는 `dependencies` 0, `peerDependencies` 0 (React 없음). 외부 요청 0 (이미지는 URL 문자열).
4. **builder 역참조 0** — 패키지가 `apps/builder` 의 어떤 모듈도 import 하지 않는다 (타입 포함). 오늘 Preview 가 i18n barrel 로 번역 표를 실었던 것과 같은 누수의 재발 차단이 이 ADR 의 본질이다.
5. **LLM tool schema 변경은 tableSpec 테스트 + live 1 회** — `kind: "mock"` → `"generate"` 는 `create_table_from_description` 의 인자 계약 (ADR-213) 을 바꾼다. 모델이 옛 리터럴을 내면 zod 가 거부하므로 프롬프트 설명·예시도 같이 바꾼다.
6. **병행 세션 충돌 0** — 같은 파일을 다른 세션이 편집 중 (task-state goal = Mock 데이터 모듈). 이동·rename 은 그 작업이 commit 된 clean 상태에서만 시작한다 (G0).

### Soft constraints

- preset 카탈로그 (`presets/`) 는 `DataField` 와 i18n 에 결합돼 있어 이번에 패키지로 옮기면 `DataField` 를 shared 로 올리는 결정 (ADR-152 계약 타입의 위치) 이 딸려 온다 — 이 ADR 의 범위 밖. 패키지는 그 이동을 막지 않는 형태로 둔다.
- 외부 배포 (npm · esm/cjs/IIFE) 소비자가 없다 — ADR-201 `@composition/upload` 의 Spring/JSP 예제 같은 사유가 여기엔 없다.

## Alternatives Considered

### 대안 A: 이름만 바꾸고 `services/` 에 둔다 (패키지 없음)

- 설명: `services/mockData` → `services/sampleData`, 식별자 rename. 경계는 관례 (주석) 로만.
- 위험: 기술 **LOW** / 성능 **LOW** / 유지보수 **HIGH** (builder 타입·i18n·store 를 import 해도 아무것도 막지 않는다 — Preview i18n barrel 누수와 같은 형태가 언제든 재발) / 마이그레이션 **LOW**.

### 대안 B: `packages/sample-data` (`@composition/sample-data`) — 엔진만, src 직접 export (권장)

- 설명: `@composition/shared` 와 같은 형태 — `exports` 가 `./src/index.ts`, 빌드 0, `type-check: tsc --noEmit` · `test: vitest run`, `dependencies` 0. builder 는 `workspace:*` 로 소비. preset 카탈로그 · AI tableSpec 은 builder 에 남고 import 경로만 바뀐다. 패키지 tsconfig 가 `apps/` 를 볼 수 없으므로 역참조는 컴파일러가 막는다.
- 위험: 기술 **LOW** (선례 그대로) / 성능 **LOW** (import 그래프 동일 → 청크 동일; G4 로 확인) / 유지보수 **LOW** / 마이그레이션 **MED** (151 지점 rename + 병행 세션 충돌 — G0 clean 시작으로 관리).

### 대안 C: 패키지에 preset 카탈로그까지 + `DataField` 를 shared 로 승격

- 설명: `packages/sample-data/src/presets/` 로 카탈로그·`presetStrings` 이동. 그러려면 `DataField/DataFieldType` 을 `@composition/shared/types` 로 올리고 (ADR-152 fieldId · store `normalizeCollection` 이 읽는 타입), `presetStrings` 의 `getStoredLocale` 을 인자로 바꾼다.
- 위험: 기술 **MED** / 성능 **LOW** / 유지보수 **MED** (shared 의 `FieldType` 7-literal 과 이름이 충돌 — `composition-vocabulary.ts` 가 이미 구분을 문서화할 만큼 헷갈리는 자리) / 마이그레이션 **HIGH** (ADR-152 계약 타입 위치 변경은 이 ADR 의 문제가 아니다 — 범위 팽창).

### 대안 D: 외부 배포형 패키지 (tsup esm/cjs/IIFE, `@composition/specs` 형태)

- 설명: dist 빌드 + `files: [dist]`.
- 위험: 기술 **LOW** / 성능 **LOW** / 유지보수 **HIGH** (빌드 단계·dist 동기화가 생기는데 소비자는 builder 하나) / 마이그레이션 **LOW**.

### 명칭 — `sample-data` (규칙 kind 는 `generate`)

| 후보              | 기각/채택 사유                                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mock-data`       | 기각 — 이 저장소에서 `mock` 은 테스트 대역 (`vi.mock` · "provider mock 0") 이다. 사용자 테이블에 들어가는 데이터에 같은 단어를 쓰면 "테스트용 가짜" 로 읽힌다 |
| `dummy-data`      | 기각 — dummy 는 의미 없는 자리표시자. 이 데이터는 성별↔이름↔초상 일관 · FK · 파생 컬럼 · seed 재현이 있다                                                     |
| `fake-data`       | 기각 — faker 브랜드 연상 + 사용자-가시 부정 어감                                                                                                              |
| `synthetic-data`  | 기각 — 정확하지만 사용자에게 낯선 용어. 내부 명칭으로만 가능                                                                                                  |
| **`sample-data`** | **채택** — 사용자-가시 어휘와 일치 (`sampleRows: "샘플 데이터"` · "샘플 행 생성 규칙" · `CHART_SAMPLE_ROWS`). UI 와 코드가 같은 단어                          |

규칙 kind `{ kind: "mock", type }` 는 `{ kind: "generate", type }` — AI tool 인자가 이미 `fields[].generate` 다 (`"sample"` 은 "샘플 행" 과 겹쳐 규칙 종류 이름으로는 모호).

### Risk Threshold Check

| 대안                           | HIGH+             | 판정                        |
| ------------------------------ | ----------------- | --------------------------- |
| A 이름만                       | 유지보수 HIGH     | 기각 — 경계 강제 없음       |
| **B 엔진 패키지**              | 없음 (MED 1)      | **채택**                    |
| C preset 포함 + DataField 승격 | 마이그레이션 HIGH | 기각 — 범위 팽창, 별도 결정 |
| D 외부 배포형                  | 유지보수 HIGH     | 기각 — 소비자 없음          |

루프 불필요 — B 에 HIGH 없음.

## Decision

**대안 B.** `packages/sample-data` (`@composition/sample-data`, private, src 직접 export, 의존 0) 로 생성기 5 파일을 옮기고, 명칭을 `sample-data` / `Sample*` / 규칙 kind `generate` 로 정리한다. preset 카탈로그와 AI `tableSpec` 은 builder 에 남긴다 (import 경로만 교체).

- **위험 수용 근거**: 남는 MED 는 마이그레이션 (151 지점 rename + 병행 편집) 뿐이고, G0 (clean 시작 + 인벤토리 freeze) · G2 (rename 잔존 0 grep) · G3 (seed 결정성 byte-identical) 이 1:1 로 막는다.
- **기각 사유**: A 는 이 ADR 의 목적 (경계 강제) 을 달성하지 못한다. C 는 ADR-152 계약 타입의 위치를 바꾸는 별도 결정이 딸려 온다 — preset 이동은 그 결정 뒤 후속 (패키지는 `presets/` 서브패스를 받을 수 있는 형태로 둔다). D 는 소비자가 builder 하나라 빌드·dist 동기화 비용만 생긴다.
- 무관한 동음 `workflowEdges.sourceType: "mock"` (workflow 데이터 소스 종류) 은 **바꾸지 않는다**.

> 구현 상세: [220-sample-data-package-and-rename-breakdown.md](design/220-sample-data-package-and-rename-breakdown.md) (파일 이동표 · 식별자 대응표 · phase · 게이트 명령)

## Risks

| ID  | 위험                                                                                                                        | 심각도 | 대응                                                                                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------- | :----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 병행 세션이 같은 파일 (`services/mockData` · `presets/` · `tableSpec.ts`) 을 편집 중 — 이동·rename 이 그 WIP 를 덮거나 충돌 |  MED   | G0: 해당 경로 `git status` clean + 그 세션 commit 확인 후 시작. 이동은 `git mv` 로 이력 보존                                                                                  |
| R2  | rename 이 LLM tool 인자 계약 (`kind: "mock"` → `"generate"`) 을 바꿔 모델이 옛 리터럴을 내면 zod 거부                       |  MED   | 프롬프트 설명·예시 (`aiToolDef.*` i18n) 동시 교체 + `tableSpec.test` 8 + live AI create-table 1 회 (Ollama qwen3:14b, G5)                                                     |
| R3  | 패키지 이동 후 청크 이름·경계가 바뀌어 initial gzip 이 움직인다                                                             |  LOW   | G4: 같은 HEAD worktree A/B (ADR-202 절차) Δ ±512 B · 상한 안. 벗어나면 원인 chunk 대조 후 처리                                                                                |
| R4  | 패키지 tsconfig/vitest 배선 누락 — turbo `type-check` 편입은 자동이지만 vitest 는 패키지별 실행                             |  LOW   | G1: `pnpm -F @composition/sample-data type-check · test` PASS + 루트 `pnpm type-check` 3 → 4 tasks                                                                            |
| R5  | rename 잔존 — 주석·문서·i18n 설명 문자열의 "mock" 이 남아 어휘가 다시 갈린다                                                |  LOW   | G2: src `mockData\|MockRule\|MockColumn\|resolveMockLocale\|createMock\|kind: "mock"` 0 (workflowEdges 제외) + docs 갱신 (CHANGELOG · README · research 문서는 이력이라 유지) |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점    | 통과 조건                                                                                                                                                                                                                      | 실패 시 대안                                                                                               |
| ---- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| G0   | Phase 0 | 대상 경로 `git status` clean (병행 세션 commit 완료) · 식별자 인벤토리 freeze (`grep` 지점 수 · 파일 5 · 테스트 33) · **seed 고정 출력 스냅샷** (preset 13 × 5 행 + tableSpec 규칙 54 종 각 3 값, JSON) 을 이동 **전** 에 기록 | clean 이 아니면 대기 — 이동 시작 금지                                                                      |
| G1   | Phase 1 | `pnpm -F @composition/sample-data type-check · test` PASS (18) · 루트 `pnpm type-check` 4 tasks PASS · builder 에서 `@composition/sample-data` import 가 vite dev · production 둘 다 해소                                      | 패키지 `exports` / tsconfig `include` 수정. builder alias 추가는 최후 (shared 처럼 subpath 가 필요할 때만) |
| G2   | Phase 2 | src 에서 옛 식별자 0 (`mockData` · `Mock*` · `resolveMockLocale` · `createMock` · `kind: "mock"`; `workflowEdges` 의 `sourceType "mock"` 제외) · preset 7 + tableSpec 8 PASS · i18n `aiToolDef` 설명의 "mock" 0                | 잔존은 즉시 교체 — 부분 rename 상태로 commit 금지                                                          |
| G3   | Phase 2 | G0 스냅샷과 이동·rename 후 출력 **byte-identical** (같은 seed · 같은 규칙) — 오라클은 이동 전 산출물 (외부)                                                                                                                    | 차이가 나면 리팩터가 아니다 — 원인 규명 전 진행 금지                                                       |
| G4   | Phase 3 | 같은 HEAD 별도 worktree A/B (`adr202-bundle-gate.mjs`): Builder · Preview initial gzip Δ 각 ±512 B 안 · 절대 상한 (1,319,829 / 592,000) 안 · lazy 경계 (`presetStrings`) 유지                                                  | chunk 대조 (stem 별 gzip) 후 원인 처리; 상한 초과면 승격 보류                                              |
| G5   | Phase 3 | live (Chrome MCP 또는 headed Playwright): Data 패널 Add Table preset 1 개 적용 → 행 생성 · seed 재적용 동일 · AI `create_table_from_description` 1 회 (Ollama) 가 `kind: "generate"` 규칙으로 행 생성 · page error 0           | tool 계약 실패면 프롬프트 설명 보강 후 재시도 1 회                                                         |

### Live Exercise

(Implemented 승격 시 기재 — G5 시나리오 · 결과 · 날짜 · Chrome MCP / Playwright 구분)

## Consequences

### Positive

- 생성기의 **의존 0 · builder 역참조 0** 을 컴파일러가 강제한다 — Preview i18n barrel 누수 (2026-09-16, −89.7 KB) 와 같은 형태가 이 모듈에서는 구조적으로 불가능.
- 이름이 사용자-가시 어휘 ("샘플") 와 같아진다. `mock` 은 테스트 대역에만 남는다.
- AI tool · preset · (미래) publish 런타임 샘플이 같은 패키지를 읽는다 — `services/` 아래 "패널 부속" 으로 오해될 여지 소거.
- preset 카탈로그 이동 (대안 C) 은 `DataField` 승격 결정만 있으면 `presets/` 서브패스로 이어 붙일 수 있다.

### Negative

- 151 지점 rename 1 회 — 리팩터 커밋이 크다 (동작 변경 0 이라 `.claude/rules/review-loop-closure.md` §3 의 축소 절차: 원복 RED 는 새 게이트가 반응하는 행만).
- workspace 패키지 1 개 추가 — `pnpm install` postinstall · turbo 그래프에 노드 1 증가.
- LLM tool 인자 리터럴 변경 — 외부 프롬프트/레시피가 `kind: "mock"` 을 하드코딩했다면 깨진다 (저장소 안에는 없음, 사용자 문서에도 저장 안 됨).
