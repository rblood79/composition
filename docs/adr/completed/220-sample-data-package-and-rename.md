# ADR-220: 샘플 데이터 엔진 패키지화 — `@composition/sample-data` + `mockData` 명칭 정리

## Status

Implemented — 2026-09-16 (Proposed 2026-09-16 → round 1 HIGH 1 / MEDIUM 3 · round 2 MEDIUM 2 전부 fixed, pending 0 — [reviews/220.md](../reviews/220.md) 종결 → Accepted 2026-09-16 → Phase 0~3 같은 날 실행: `7d32fcb54` (0·1a) · `46ca3bec9` (1b) · `d7bbc6fdd` (2) · `3976502fb` (3a) + 종결 커밋. G0~G5 전부 PASS — 근거 `docs/adr/evidence/220-execution.md` (로컬))

> 출처: 2026-09-16 사용자 제안 "preset 모듈은 package 형태로 제공하는 것은 어떨까?" + 명칭 질의 (mock-data / dummy-data / 다른 것). 같은 날 Mock 데이터 자체 모듈 (`c9f2f7217`) · preset 규칙 기반 재작성 (`8eba9427f`) · preset 문자열 lazy 분리가 반영된 직후의 경계 정리다.

## Context

**SSOT 3-domain 관계**: D1/D2/D3 어느 것도 아니다 — 시각·DOM·props 가 아니라 **Data 패널이 사용자 테이블에 넣는 샘플 행을 만드는 순수 생성기** 의 모듈 경계와 이름을 정한다. collections 데이터 계약 (ADR-152 · 213) 은 건드리지 않는다 — 특히 `DataTable.mockData` / `useMockData` **데이터 필드** 는 이 ADR 의 rename 대상이 아니다 (아래 사실 표).

### 코드 사실 (2026-09-16, HEAD `736aa8af4`)

| 사실                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 경로 : 라인                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 생성기 모듈 5 파일 1,923 줄, **외부 import 0** (React · builder store · i18n 어느 것도 안 읽음)                                                                                                                                                                                                                                                                                                                                                                       | `apps/builder/src/services/mockData/{random,locale,generators,rules,index}.ts`                                                                                    |
| 공개 API — 값 10: `createRandom · hashSeed · mulberry32` (seed PRNG) · `resolveMockLocale · FALLBACK_LOCALE` · `createMock · slugify` · `generateValue · generateRow · generateRows`; 타입 18: `Mock · CreateMockOptions · MockRule · MockColumn · MockRowContext · MockRandom · MockLocale · GenerateRowsOptions · GeneratedRows · ListSelection · CardType · DateRangeOptions · Gender · PicsumOptions · RangeOptions · WeightedOption · NameOrder · PoolTranslate` | `services/mockData/index.ts:15-36`                                                                                                                                |
| 규칙 type `MockRule` — discriminated union (`rowNumber · sequence · id · uuid · gender · firstName · … · now`) + `MockColumn` · `MockRowContext` · `GenerateRowsOptions { count, seed, locale, blankRate, references, mock, t }`                                                                                                                                                                                                                                      | `services/mockData/rules.ts:33-181`                                                                                                                               |
| **출력은 seed 만이 아니라 시각에도 의존** — 기준일 `startOfTodayUtc()` (`new Date()`), `birthDate` 는 `refMs` 기준 연령 역산, `cardExpiry` 도 기준일 의존, 규칙 `now` 는 `new Date().toISOString()`. `refDate` 는 `CreateMockOptions` 로 주입 가능 (`createMock({ refDate })` → `GenerateRowsOptions.mock`)                                                                                                                                                           | `services/mockData/generators.ts:85-87 · 297 · 330-338 · 457` · `rules.ts:112 · 386-387`                                                                          |
| 소비처 A — preset 카탈로그 (`definePreset` 이 `schema` + `generateSampleData(count, t, options)` 파생)                                                                                                                                                                                                                                                                                                                                                                | `builder/panels/datatable/presets/types.ts:9-15 · 118` (`DataField` + `generateRows · resolveMockLocale · MockColumn · MockRule`) · `presets/catalog/column.ts:7` |
| 소비처 B — AI `create_table_from_description` 의 필드 생성 규칙 `fields[].generate` — **LLM 에 노출되는 tool schema** 가 `kind: z.literal("mock")` + `type: z.enum(MOCK_RULE_TYPES)` (54 종)                                                                                                                                                                                                                                                                          | `services/ai/data/tableSpec.ts:89-96 · 236-239 · 320` · `services/ai/tools/createTableFromDescription.ts:34`                                                      |
| 소비처 C — 패널 (`DataTableCreator.tsx` · `DataTableList.tsx`) 는 preset 경유, 직접 import 없음                                                                                                                                                                                                                                                                                                                                                                       | `panels/datatable/editors/DataTableCreator.tsx:16` (주석 참조만)                                                                                                  |
| **동음이의 — 유지 대상**: collection 데이터 계약 `DataTable.mockData: Record<string, unknown>[]` · `useMockData` (저장 스키마, publish/preview store 타입 · `collectionReadModel.visibleRowCount` 등 **79 지점**) 은 생성기 모듈명과 무관한 기존 필드                                                                                                                                                                                                                 | `types/builder/data.types.ts:83` · `services/ai/data/collectionReadModel.ts:93` · preview store 타입                                                              |
| 동음이의 — 유지 대상: workflow 데이터 소스 종류 `sourceType: "dataTable" \| "api" \| "mock"` (Skia workflow 렌더)                                                                                                                                                                                                                                                                                                                                                     | `workspace/canvas/skia/workflowEdges.ts:212 · 288` · `workflowRenderer.ts:546`                                                                                    |
| preset 은 builder 타입에 결합 — `DataField` (`types/builder/data.types.ts:41`, `DataFieldType` 10-literal :26) 와 i18n (`presetStrings.ts:10` `getStoredLocale`, `:11` `SupportedLocale`)                                                                                                                                                                                                                                                                             | `presets/types.ts:9` · `presets/presetStrings.ts:10-11`                                                                                                           |
| `DataField` 는 shared 에 없다 — shared 의 `FieldType` (7-literal) 은 element field 로 다른 객체 경로 (`composition-vocabulary.ts:6` 가 구분을 명시)                                                                                                                                                                                                                                                                                                                   | `packages/shared/src/types/element.types.ts:45`                                                                                                                   |
| 테스트 — 생성기 18 · preset 7 · tableSpec 8 (`it()`)                                                                                                                                                                                                                                                                                                                                                                                                                  | `services/mockData/mockData.test.ts` · `presets/dataTablePresets.test.ts` · `services/ai/data/tableSpec.test.ts`                                                  |
| 패키지 선례 — `@composition/shared` 는 `exports` 가 `./src/*.ts` 를 직접 가리키고 (빌드 0) tsconfig 에 **`rootDir: "./src"` + `composite: true`**; `type-check: tsc --noEmit` · `test: vitest run`                                                                                                                                                                                                                                                                    | `packages/shared/package.json:7-16 · 52-57` · `packages/shared/tsconfig.json:3-7`                                                                                 |
| **역참조 차단 실측 (round 1 h1)** — `include: ["src"]` 만으로는 `apps/builder/src/…` 의 값·타입 import 가 **오류 0** 으로 통과. `rootDir: "./src"` 를 두면 값 import · `import type` · 재수출 모두 **TS6059** ("not under rootDir") 로 실패, `composite` 까지 두면 TS6307 추가. 상대 경로 import 라 `dependencies: 0` 은 경계가 아니다                                                                                                                                | 실측 2026-09-16: 임시 패키지 + `tsc -p` (`packages/config/tsconfig/library.json` 상속) 3 구성 비교                                                                |
| turbo `type-check` 는 `^type-check` 의존 — 새 패키지가 자동 편입                                                                                                                                                                                                                                                                                                                                                                                                      | `turbo.json:21-23`                                                                                                                                                |
| 번들 상한 정본 (ADR-202 재승인·후속) — Builder ≤ 1,319,829 / Preview ≤ 592,000 B gzip, 만료 2026-10-16; HEAD Builder 1,312,037 (preset 문자열 lazy 분리 후). `adr202-bundle-gate.mjs` 의 판정은 **202 전용** — Builder Δ ≤ 3,584 · Preview Δ ≤ 0 · lazy 대상 AIPanel/runCommand 뿐이라 220 의 ±512 · `presetStrings` lazy 는 검사하지 않는다 (round 1 m4: +1,000 B 입력이 pass)                                                                                       | `apps/builder/scripts/adr202-bundle-gate.mjs:36-37 · 58-62`                                                                                                       |
| 이 저장소의 `mock` 은 테스트 대역 어휘로 굳어 있다 — `vi.mock` · `__mocks__` · ADR-202 G5 "DOM/Electron/provider mock 없이" · ADR-198 "provider mock"                                                                                                                                                                                                                                                                                                                 | `docs/adr/completed/202-*.md` Gates G5 · `.claude/rules/measurement-validity.md`                                                                                  |
| 사용자-가시 어휘는 이미 "샘플" — i18n `chart.sampleRows: "샘플 데이터"` · AI tool 설명 "샘플 행 **생성 규칙**" · `CHART_SAMPLE_ROWS`                                                                                                                                                                                                                                                                                                                                  | `apps/builder/src/i18n/translations.ts:18 · 1043 · 1054`                                                                                                          |

### Hard constraints

1. **동작 무변경 — 같은 생성 컨텍스트에서 같은 출력** (byte-identical). 컨텍스트 = seed · 기준 시각 (`refDate` 주입 + 가짜 시계) · `TZ` · locale · `t` (문구 해소기). seed 만 같고 날짜가 다르면 무변경 코드도 `birthDate` 가 하루 밀린다 (round 1 m3 실측: 09-16 → 1975-05-20, 09-17 → 1975-05-21). 스냅샷 하니스가 이 다섯을 고정하고 context로 남긴다. 제품의 날짜 동작은 바꾸지 않는다.
2. **번들 무변경** — initial gzip Δ 가 Builder · Preview **각각 |Δ| ≤ 512 B** 이고 상한 (1,319,829 / 592,000) 안이며 `presetStrings` 가 initial closure 밖에 남는다. 판정기는 220 전용 (`adr220-bundle-gate.mjs` — 202 판정 보존 + 위 3 조건). A/B 두 arm 은 **같은 최종 lockfile** (workspace 패키지 추가로 lockfile 이 바뀌므로 Phase 1a 준비 커밋이 lockfile 을 먼저 확정).
3. **의존 0 유지** — 새 패키지는 `dependencies` 0, `peerDependencies` 0 (React 없음). 외부 요청 0 (이미지는 URL 문자열).
4. **builder 역참조 0 — 컴파일러 + 정적 경계 검사 이중** — tsconfig `rootDir: "./src"` + `composite: true` (shared 형태) 가 `apps/` 로의 값·타입 import 를 TS6059/TS6307 로 거부한다 (`include` 만으로는 통과 — 실측). 여기에 `boundary.static.test.ts` 가 소스의 모든 import specifier (상대 · `@/` · `apps/` · `@composition/builder`) 의 해소 경로가 패키지 root 안인지 검사한다. **음성 검사** (builder import 1 줄 주입 → tsc 실패 + 정적 테스트 RED) 를 G1 에 둔다. 오늘 Preview 가 i18n barrel 로 번역 표를 실었던 것과 같은 누수의 재발 차단이 이 ADR 의 본질이다.
5. **LLM tool schema 변경은 tableSpec 테스트 + live 1 회** — `kind: "mock"` → `"generate"` 는 `create_table_from_description` 의 인자 계약 (ADR-213) 을 바꾼다. 모델이 옛 리터럴을 내면 zod 가 거부하므로 프롬프트 설명·예시 (`aiToolDef.*`) 도 같이 바꾼다.
6. **병행 세션 충돌 0** — 같은 파일을 다른 세션이 편집 중 (task-state goal = Mock 데이터 모듈). 이동·rename 은 그 작업이 commit 된 clean 상태에서만 시작한다 (G0).
7. **rename 범위 = 이동 모듈의 import 경로 + 공개 심볼 28 개만.** collection 데이터 필드 `mockData` / `useMockData` (79 지점) 와 workflow `sourceType "mock"` 은 유지 — G2 검사는 이 범위로 좁힌다 (round 1 m2).

### Soft constraints

- preset 카탈로그 (`presets/`) 는 `DataField` 와 i18n 에 결합돼 있어 이번에 패키지로 옮기면 `DataField` 를 shared 로 올리는 결정 (ADR-152 계약 타입의 위치) 이 딸려 온다 — 이 ADR 의 범위 밖. 패키지는 그 이동을 막지 않는 형태로 둔다.
- 외부 배포 (npm · esm/cjs/IIFE) 소비자가 없다 — ADR-201 `@composition/upload` 의 Spring/JSP 예제 같은 사유가 여기엔 없다.

## Alternatives Considered

### 대안 A: 이름만 바꾸고 `services/` 에 둔다 (패키지 없음)

- 설명: `services/mockData` → `services/sampleData`, 식별자 rename. 경계는 관례 (주석) 로만.
- 위험: 기술 **LOW** / 성능 **LOW** / 유지보수 **HIGH** (builder 타입·i18n·store 를 import 해도 아무것도 막지 않는다 — Preview i18n barrel 누수와 같은 형태가 언제든 재발) / 마이그레이션 **LOW**.

### 대안 B: `packages/sample-data` (`@composition/sample-data`) — 엔진만, src 직접 export, `rootDir` 경계 (권장)

- 설명: `@composition/shared` 와 같은 형태 — `exports` 가 `./src/index.ts`, 빌드 0, tsconfig `rootDir: "./src"` + `composite: true`, `type-check: tsc --noEmit` · `test: vitest run`, `dependencies` 0. builder 는 `workspace:*` 로 소비. preset 카탈로그 · AI tableSpec 은 builder 에 남고 import 경로만 바뀐다. 역참조는 TS6059 (컴파일러) + `boundary.static.test` (정적) 이중으로 막고, 음성 검사로 실제 실패를 증명한다.
- 위험: 기술 **LOW** (선례 그대로 + 실측 증거) / 성능 **LOW** (import 그래프 동일 → 청크 동일; G4 로 확인) / 유지보수 **LOW** / 마이그레이션 **MED** (공개 심볼 28 + importer 6 파일 rename + 병행 세션 충돌 — G0 clean 시작으로 관리).

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

규칙 kind `{ kind: "mock", type }` 는 `{ kind: "generate", type }` — AI tool 인자가 이미 `fields[].generate` 다 (`"sample"` 은 "샘플 행" 과 겹쳐 규칙 종류 이름으로는 모호). collection 필드 `mockData` (저장 스키마) 는 이름을 바꾸지 않는다 — 데이터 계약 변경은 별도 ADR.

### Risk Threshold Check

| 대안                             | HIGH+             | 판정                        |
| -------------------------------- | ----------------- | --------------------------- |
| A 이름만                         | 유지보수 HIGH     | 기각 — 경계 강제 없음       |
| **B 엔진 패키지 + rootDir 경계** | 없음 (MED 1)      | **채택**                    |
| C preset 포함 + DataField 승격   | 마이그레이션 HIGH | 기각 — 범위 팽창, 별도 결정 |
| D 외부 배포형                    | 유지보수 HIGH     | 기각 — 소비자 없음          |

루프 불필요 — B 에 HIGH 없음.

## Decision

**대안 B.** `packages/sample-data` (`@composition/sample-data`, private, src 직접 export, 의존 0, `rootDir` 경계) 로 생성기 5 파일을 옮기고, 명칭을 `sample-data` / `Sample*` / 규칙 kind `generate` 로 정리한다. preset 카탈로그와 AI `tableSpec` 은 builder 에 남긴다 (import 경로만 교체). collection 데이터 필드 `mockData`/`useMockData` 와 workflow `sourceType "mock"` 은 그대로.

- **위험 수용 근거**: 남는 MED 는 마이그레이션 (심볼 28 + importer 6 rename + 병행 편집) 뿐이고, G0 (clean 시작 + 인벤토리 freeze + 고정 컨텍스트 스냅샷) · G2 (범위 한정 잔존 0) · G3 (스냅샷 byte-identical) 이 1:1 로 막는다. 경계 보장은 실측 (TS6059) 에 근거하고 G1 음성 검사가 매번 증명한다.
- **기각 사유**: A 는 이 ADR 의 목적 (경계 강제) 을 달성하지 못한다. C 는 ADR-152 계약 타입의 위치를 바꾸는 별도 결정이 딸려 온다 — preset 이동은 그 결정 뒤 후속 (패키지는 `presets/` 서브패스를 받을 수 있는 형태로 둔다). D 는 소비자가 builder 하나라 빌드·dist 동기화 비용만 생긴다.

> 구현 상세: [220-sample-data-package-and-rename-breakdown.md](../design/220-sample-data-package-and-rename-breakdown.md) (파일 이동표 · 패키지 골격 (tsconfig 증거) · 식별자 대응표 · 스냅샷 하니스 · phase · 게이트 명령)

## Risks

| ID  | 위험                                                                                                                        | 심각도 | 대응                                                                                                                                                                                         |
| --- | --------------------------------------------------------------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 병행 세션이 같은 파일 (`services/mockData` · `presets/` · `tableSpec.ts`) 을 편집 중 — 이동·rename 이 그 WIP 를 덮거나 충돌 |  MED   | G0: 해당 경로 `git status` clean + 그 세션 commit 확인 후 시작. 이동은 `git mv` 로 이력 보존                                                                                                 |
| R2  | rename 이 LLM tool 인자 계약 (`kind: "mock"` → `"generate"`) 을 바꿔 모델이 옛 리터럴을 내면 zod 거부                       |  MED   | 프롬프트 설명·예시 (`aiToolDef.*` i18n) 동시 교체 + `tableSpec.test` 8 + live AI create-table 1 회 (Ollama qwen3:14b, G5)                                                                    |
| R3  | 패키지 이동 후 청크 이름·경계가 바뀌어 initial gzip 이 움직인다 / 202 판정기를 그대로 쓰면 220 조건 위반이 통과한다 (m4)    |  LOW   | G4: 220 전용 판정기 (양방향 512 · `presetStrings` initial 제외 · 202 조건 보존) + 같은 HEAD·같은 lockfile 두 worktree A/B. 벗어나면 chunk 대조 후 처리                                       |
| R4  | 경계 보장이 설정만으로 성립한다고 믿고 검증을 생략 — `include` 만 둔 구성은 역참조를 통과시킨다 (h1)                        |  MED   | HC4: `rootDir` + `composite` (실측 TS6059) + `boundary.static.test` + G1 음성 검사 (주입 → 실패) 를 매 실행                                                                                  |
| R5  | 스냅샷이 seed 만 고정해 자정을 넘기면 무변경 코드도 diff (m3)                                                               |  MED   | HC1: 하니스가 `vi.setSystemTime(2026-09-16T00:00:00Z)` + `TZ=UTC` + `createMock({ refDate })` + locale ko/en + `t` 고정, context와 provenance 분리 기록. G3은 context/행만 비교              |
| R6  | rename 잔존 또는 과잉 — 주석·i18n 의 "mock" 이 남거나, 반대로 collection 필드 `mockData` 까지 바꿔 저장 계약을 깨뜨림 (m2)  |  LOW   | G2: 검사 대상 = 이동 모듈 import 경로 + 공개 심볼 28 (breakdown §4) 만. `DataTable.mockData`/`useMockData` 79 지점 · workflow `sourceType` 은 유지 목록에 명시하고 G2 통과 후 개수 불변 확인 |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점    | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 실패 시 대안                                                                                                     |
| ---- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| G0   | Phase 0 | 대상 경로 `git status` clean (병행 세션 commit 완료) · 인벤토리 freeze (공개 심볼 28 · importer 6 파일 · 테스트 33 · 유지 대상 `mockData` 필드 79 지점 · workflow 3) · **고정 컨텍스트 스냅샷** (breakdown §5 하니스: 가짜 시계 `2026-09-16T00:00:00Z` · `TZ=UTC` · `refDate` 동일 · locale ko/en · `t` 고정 · seed `"adr220"`; preset 13 × `generateSampleData(5, t, options)` + 규칙 54 종 × 3 값 + `now` 규칙) 을 이동 **전** 기록, 고정 context와 실행 provenance 포함                  | clean 이 아니면 대기 — 이동 시작 금지. 하니스가 context/provenance 없이 만든 스냅샷은 무효                       |
| G1   | Phase 1 | `pnpm -F @composition/sample-data type-check · test` PASS (18 + boundary) · 루트 `pnpm type-check` 4 tasks PASS · builder 에서 `@composition/sample-data` import 가 vite dev · production 둘 다 해소 · **음성 검사**: 패키지 소스에 `apps/builder` 상대 import 1 줄 주입 → `tsc` TS6059 **실패** + `boundary.static.test` RED, 제거 → GREEN. 정상 테스트의 vitest 허용 · 제품의 vitest 및 테스트의 Builder import 금지 대조 (breakdown §3; evidence 기록)                                   | 패키지 `exports` / tsconfig 수정. 음성 검사가 통과해 버리면 (실패하지 않으면) 경계가 없는 것 — Phase 2 진입 금지 |
| G2   | Phase 2 | **범위 한정 잔존 0**: `@composition/sample-data` 밖에서 `services/mockData` 경로 import 0 · 옛 공개 심볼 28 (`MockRule · MockColumn · MockRowContext · MockRandom · MockLocale · Mock · CreateMockOptions · createMock · resolveMockLocale · MOCK_RULE_TYPES · MockRuleType …`) 참조 0 · `kind: "mock"` 리터럴 0 · i18n `aiToolDef` 설명의 "mock" 0. **유지 확인**: `DataTable.mockData`/`useMockData` 79 지점 · workflow `sourceType "mock"` 3 지점 개수 불변. preset 7 + tableSpec 8 PASS | 잔존은 즉시 교체 — 부분 rename 상태로 commit 금지. 유지 대상 개수가 줄면 과잉 rename — 되돌린다                  |
| G3   | Phase 2 | G0 baseline을 보존하고 별도 G3 candidate 생성. **같은 context와 생성 행만** 정규 직렬화해 byte-identical 비교 (breakdown §5). 실제 HEAD/diff는 양쪽 provenance로 보존하고 비교에서 제외. HEAD만 다르면 PASS · context 변경은 무효 · 행 변경은 FAIL                                                                                                                                                                                                                                          | 차이가 나면 리팩터가 아니다 — 원인 규명 전 진행 금지. context가 다르면 비교 무효; provenance 차이는 허용         |
| G4   | Phase 3 | `adr220-bundle-gate.mjs`: 같은 HEAD · **같은 최종 lockfile** 두 worktree A/B (before = Phase 1a lockfile 확정 커밋, after = 완료 커밋) — Builder · Preview initial gzip **                                                                                                                                                                                                                                                                                                                  | Δ                                                                                                                | ≤ 512 B 각각** · 절대 상한 (1,319,829 / 592,000) 안 · `presetStrings` chunk 가 initial closure 밖 · 202 조건 (AI/runCommand lazy · 만료) 보존. 판정기 자체를 +1,000 B / presetStrings initial 편입 fixture 로 **음성 검사** (exit 1) | chunk 대조 (stem 별 gzip) 후 원인 처리; 상한 초과면 승격 보류 |
| G5   | Phase 3 | live (Chrome MCP 또는 headed Playwright): Data 패널 Add Table preset 1 개 적용 → 행 생성 · 같은 seed 재적용 동일 · AI `create_table_from_description` 1 회 (Ollama) 가 `kind: "generate"` 규칙으로 행 생성 · page error 0                                                                                                                                                                                                                                                                   | tool 계약 실패면 프롬프트 설명 보강 후 재시도 1 회                                                               |

### Live Exercise

2026-09-16 · **headed Playwright** (dev 5173 · `.auth-session.json` · Ollama qwen3:14b `OLLAMA_CONTEXT_LENGTH=32768`) — Chrome MCP 아님. 근거 `docs/adr/evidence/220-g5-{preset,ai}-live.json` · `220-g5-ai-confirm-dialog.png` (로컬).

| 시나리오 | 하니스 | 결과 |
| --- | --- | --- |
| Data 패널 Add Table preset 적용 (Profiles, seed "live" · blank 20 → 행 10 · 성별↔초상 일관 · null 21.1%) · **같은 seed 재적용 동일 행** · Images preset picsum URL · 카테고리 9 · 카드 28 · dialog 0 · page error 0 | `apps/builder/scripts/mock-preset-live.mjs` | **8/8 PASS** — 이동한 `@composition/sample-data` 가 vite dev 에서 해소 (G1 dev 조건) |
| AI 패널 → `create_table_from_description` (실모델) → 규칙 `{ kind: "generate", type }` → 승인 다이얼로그 "Create table Customers — 4 fields · 5 rows" → 승인 → IndexedDB collection Customers 5 행 (`phone "(455) 941-0639"` · city · email) · 스트림 본문 `"kind":"mock"` 0 · page error 0 | `apps/builder/scripts/adr220-ai-live.mjs` | **4/4 PASS** (85~159 s, 2회 동일 행 — seed = 테이블 이름) |

- **R2 실현 → G5 대안 1회 적용**: 보강 전 1차에서 모델이 `{ "kind": "phone" }` 처럼 종류 이름을 kind 에 넣어 zod 거부 2회. `aiToolDef.createTableFromDescription` ko/en 에 "사실적 값은 { kind: 'generate', type: '<종류>' } — 종류는 type 에" 문장 + zod `kind`/`type` `.describe()` (JSON Schema 로 모델에 전달) 추가 후 PASS. 이후에도 모델의 1차 시도가 `generate.type` 부적합으로 거부될 수 있으나 Agent 재시도가 흡수한다 (ADR-213 동일 계약).
- G4 (production 해소 + 번들): 같은 lockfile 두 worktree A/B — Builder initial 1,312,037 → 1,312,038 (**+1 B**) · Preview 592,000 → 592,000 (**0**) · `presetStrings` chunk initial 밖 · 202 lazy 보존 · 판정기 음성 fixture 2 통과. `220-g4-220-gate.json`.
- G1 음성 검사 `220-g1-boundary-negative.log`: Builder 상대 re-export 1 줄 주입 → tsc TS6059+TS6307 · boundary RED → 제거 → GREEN. G3 `220-g3-compare.json` PASS (byte-identical, sha `e3abb78b…`). 인벤토리 정정: preset 은 신규 13 이 아니라 카탈로그 전체 **28** 을 잰다.

## Consequences

### Positive

- 생성기의 **의존 0 · builder 역참조 0** 을 컴파일러 (`rootDir`, TS6059) 와 정적 경계 검사가 강제하고 G1 음성 검사가 매번 증명한다 — Preview i18n barrel 누수 (2026-09-16, −89.7 KB) 와 같은 형태가 이 모듈에서는 구조적으로 불가능.
- 이름이 사용자-가시 어휘 ("샘플") 와 같아진다. `mock` 은 테스트 대역과 (별도 결정 전까지) collection 저장 필드에만 남는다.
- AI tool · preset · (미래) publish 런타임 샘플이 같은 패키지를 읽는다 — `services/` 아래 "패널 부속" 으로 오해될 여지 소거.
- preset 카탈로그 이동 (대안 C) 은 `DataField` 승격 결정만 있으면 `presets/` 서브패스로 이어 붙일 수 있다.
- 220 전용 번들 판정기와 고정 컨텍스트 스냅샷 하니스는 이후 생성기 변경 ADR 의 오라클로 재사용된다.

### Negative

- 공개 심볼 28 + importer 6 파일 rename 1 회 — 리팩터 커밋이 크다 (동작 변경 0 이라 `.claude/rules/review-loop-closure.md` §3 의 축소 절차: 원복 RED 는 새 게이트가 반응하는 행만).
- workspace 패키지 1 개 추가 — `pnpm install` postinstall · turbo 그래프에 노드 1 증가, lockfile 변경 (Phase 1a 준비 커밋).
- LLM tool 인자 리터럴 변경 — 외부 프롬프트/레시피가 `kind: "mock"` 을 하드코딩했다면 깨진다 (저장소 안에는 없음, 사용자 문서에도 저장 안 됨).
- collection 필드 `mockData` 와 패키지명 `sample-data` 가 한동안 공존한다 — 데이터 계약 rename 은 별도 ADR (저장 스키마 마이그레이션이 필요).
