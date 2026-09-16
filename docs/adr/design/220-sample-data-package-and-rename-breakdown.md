# ADR-220 구현 분해 — `@composition/sample-data` 패키지화 + 명칭 정리

> 본문: [220-sample-data-package-and-rename.md](../220-sample-data-package-and-rename.md). 동작 변경 0 리팩터 — 절차는 `.claude/rules/review-loop-closure.md` §3 "동작 변경 0" 행. round 1 (reviews/220.md) 반영: §3 tsconfig 증거 · §4 유지 대상 · §5 스냅샷 하니스 · §7 220 전용 번들 판정기.

## 1. 전제 lock-in

1. base/응용: 패키지 (엔진) 가 base, preset 카탈로그 · AI tableSpec 이 응용. 응용은 builder 에 남고 import 경로만 바뀐다.
2. schema: 저장 스키마 무변경 — 규칙은 preset 정의 · tool 인자에만 있고 사용자 문서에는 생성된 행만 저장된다. collection 필드 `mockData` / `useMockData` 는 그대로.
3. 선행 ADR 전제: ADR-213 의 `create_table_from_description` 인자 계약에서 `fields[].generate.kind` 리터럴 하나가 바뀐다 (`mock` → `generate`). 213 본문의 Gate 는 무변경 (tool 이름·propose/review/apply 흐름 동일).
4. 병행 세션: task-state goal "Mock 데이터 자체 모듈 + Add Table preset 확장" 이 같은 파일을 편집한다 — G0 clean 전 시작 금지.

## 2. 파일 이동표

| 현재 (`apps/builder/src/`)                                              | 이후                                                                                           | 비고                                     |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `services/mockData/random.ts`                                           | `packages/sample-data/src/random.ts`                                                           | `git mv`                                 |
| `services/mockData/locale.ts`                                           | `packages/sample-data/src/locale.ts`                                                           |                                          |
| `services/mockData/generators.ts`                                       | `packages/sample-data/src/generators.ts`                                                       |                                          |
| `services/mockData/rules.ts`                                            | `packages/sample-data/src/rules.ts`                                                            |                                          |
| `services/mockData/index.ts`                                            | `packages/sample-data/src/index.ts`                                                            | 패키지 진입점                            |
| `services/mockData/mockData.test.ts`                                    | `packages/sample-data/src/sampleData.test.ts`                                                  | 18 it                                    |
| (신규)                                                                  | `packages/sample-data/src/boundary.static.test.ts`                                             | 역참조 정적 검사 (§3)                    |
| (신규)                                                                  | `packages/sample-data/{package.json,tsconfig.json,vitest.config.ts,README.md}`                 | §3                                       |
| (신규)                                                                  | `apps/builder/scripts/adr220-snapshot.test.ts` · `apps/builder/scripts/adr220-bundle-gate.mjs` | §5 · §7                                  |
| `builder/panels/datatable/presets/**`                                   | **유지**                                                                                       | import 경로만 `@composition/sample-data` |
| `services/ai/data/tableSpec.ts` · `tools/createTableFromDescription.ts` | **유지**                                                                                       | import 경로 + 리터럴                     |

## 3. 패키지 골격 — 경계는 `rootDir` 가 만든다 (실측)

```jsonc
// packages/sample-data/package.json
{
  "name": "@composition/sample-data",
  "version": "0.1.0",
  "private": true,
  "description": "seed 결정성 샘플 데이터 생성기 — faker · mockaroo · randomuser · dummyjson · picsum 어법 이식, 의존 0",
  "type": "module",
  "exports": {
    ".": { "types": "./src/index.ts", "default": "./src/index.ts" },
  },
  "scripts": {
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "lint": "eslint src/",
  },
  "devDependencies": {
    "@composition/config": "workspace:*",
    "typescript": "catalog:",
    "vitest": "catalog:",
  },
}
```

```jsonc
// packages/sample-data/tsconfig.json — @composition/shared 와 같은 형태
{
  "extends": "@composition/config/tsconfig/library",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true,
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"],
}
```

**2026-09-16 실측 (round 1 h1 재현 + 정정)** — 임시 패키지 `src/index.ts` 에 `apps/builder/src/services/mockData/random.ts` 의 `hashSeed` 재수출을 두고 `library.json` 상속 + `tsc -p` (noEmit):

| tsconfig 구성                      | 값 import                | `import type` 만                                  |
| ---------------------------------- | ------------------------ | ------------------------------------------------- |
| `include: ["src"]` 만 (round 1 안) | **오류 0 — 통과** (결함) | 통과                                              |
| + `rootDir: "./src"`               | **TS6059** 실패          | **TS6059** 실패                                   |
| + `rootDir` + `composite: true`    | TS6059 + TS6307 실패     | TS6059 + TS6307 실패 (전이 import 까지 전부 보고) |

따라서 `rootDir` 가 경계다. `dependencies: 0` 은 경계가 아니다 (상대 경로 import 는 의존성 없이 된다).

두 번째 층 `src/boundary.static.test.ts`: `src/**/*.ts` 의 모든 `import … from "…"` · `export … from "…"` specifier 를 읽어 (a) 상대 경로면 `path.resolve` 결과가 `packages/sample-data/src` 안, (b) `@/` · `apps/` · `@composition/builder` · `../../apps` 로 시작하면 실패, (c) 그 외 bare specifier 는 `package.json` `dependencies` 에 있어야 한다 (= 0 이므로 사실상 금지, `node:` 제외). 이 테스트는 tsc 가 못 보는 것 (주석 안 예시 코드는 무시하되 `vitest` 의 `vi.mock("…")` 경로도 검사) 을 잡는다.

**G1 음성 검사 절차**: `src/random.ts` 끝에 `export { visibleRowCount } from "../../../apps/builder/src/services/ai/data/collectionReadModel";` 1 줄 주입 → `pnpm -F @composition/sample-data type-check` 가 TS6059 로 실패 · `test` 의 boundary RED → 줄 제거 → 둘 다 GREEN. 두 출력을 `docs/adr/evidence/220-g1-boundary-negative.log` 에 기록.

- builder `package.json` `dependencies` 에 `"@composition/sample-data": "workspace:*"`. vite alias 불필요 (`exports` 가 src 를 가리킨다 — shared 와 동일; subpath 가 생기면 그때 shared 의 alias 패턴).
- `dependencies` · `peerDependencies` 없음 — 있으면 G1 실패.

## 4. 식별자 대응표 — rename 대상은 이동 모듈의 공개 심볼 28 + import 경로뿐

| 현재                                                                                                                                                                                                                                                                                      | 이후                                            | 지점                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `services/mockData` (경로)                                                                                                                                                                                                                                                                | `@composition/sample-data`                      | importer 6 파일 (presets/types · catalog/column · presets/index · dataTablePresets 주석 · tableSpec · createTableFromDescription) |
| `MockRule`                                                                                                                                                                                                                                                                                | `SampleRule`                                    | rules · presets/types · catalog/column · tableSpec                                                                                |
| `MockColumn`                                                                                                                                                                                                                                                                              | `SampleColumn`                                  | rules · presets/types                                                                                                             |
| `MockRowContext`                                                                                                                                                                                                                                                                          | `SampleRowContext`                              | rules                                                                                                                             |
| `MockRandom`                                                                                                                                                                                                                                                                              | `SeededRandom`                                  | random                                                                                                                            |
| `MockLocale` · `resolveMockLocale` · `FALLBACK_LOCALE`                                                                                                                                                                                                                                    | `SampleLocale` · `resolveSampleLocale` · (유지) | locale · presets/types · createTableFromDescription · tableSpec                                                                   |
| `Mock` (타입, `createMock` 반환) · `CreateMockOptions`                                                                                                                                                                                                                                    | `Generators` · `CreateGeneratorsOptions`        | generators · rules (`GenerateRowsOptions.mock` → `generators`)                                                                    |
| `createMock`                                                                                                                                                                                                                                                                              | `createGenerators`                              | generators · rules                                                                                                                |
| `GenerateRowsOptions.mock` (필드)                                                                                                                                                                                                                                                         | `GenerateRowsOptions.generators`                | rules · presets/types                                                                                                             |
| `MOCK_RULE_TYPES` · `MockRuleType`                                                                                                                                                                                                                                                        | `GENERATE_RULE_TYPES` · `GenerateRuleType`      | tableSpec                                                                                                                         |
| `{ kind: "mock", type }` (규칙 · zod 리터럴)                                                                                                                                                                                                                                              | `{ kind: "generate", type }`                    | tableSpec:93 · 236-239 · 320                                                                                                      |
| i18n `aiToolDef.*` 설명의 "mock 규칙" 문구                                                                                                                                                                                                                                                | "생성 규칙" / "generate rule"                   | translations ko/en                                                                                                                |
| 주석 `services/mockData (생성기)`                                                                                                                                                                                                                                                         | `@composition/sample-data`                      | DataTableCreator · DataTableList · presets/index · dataTablePresets                                                               |
| 나머지 공개 심볼 (`createRandom · hashSeed · mulberry32 · slugify · generateValue · generateRow · generateRows · GeneratedRows · GenerateRowsOptions · ListSelection · CardType · DateRangeOptions · Gender · PicsumOptions · RangeOptions · WeightedOption · NameOrder · PoolTranslate`) | **무변경**                                      | —                                                                                                                                 |

**유지 대상 (rename 금지, G2 가 개수 불변을 확인)**:

| 항목                                                                                                 | 지점                                                                                                |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| collection 데이터 계약 `DataTable.mockData: Record<string, unknown>[]` · `useMockData` (저장 스키마) | `types/builder/data.types.ts:83` 외 79 지점 (preview store 타입 · `collectionReadModel.ts:93` 포함) |
| workflow 데이터 소스 종류 `sourceType: "mock"`                                                       | `workflowEdges.ts:212 · 288` · `workflowRenderer.ts:546`                                            |
| 테스트 대역 `vi.mock` · `__mocks__`                                                                  | 전역                                                                                                |

## 5. 스냅샷 하니스 — `apps/builder/scripts/adr220-snapshot.mjs` (G0 · G3 오라클)

생성 결과는 seed 만이 아니라 **시각** (`startOfTodayUtc()` → `birthDate` · `cardExpiry`, 규칙 `now` → `new Date()`) · TZ · locale · `t` 에 의존한다. 하니스가 다섯을 전부 고정하고 결과 JSON 의 `metadata` 에 남긴다. metadata 가 다르면 G3 비교 무효.

| 고정 축 | 값                                                                        | 방법                                                                                                                          |
| ------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 시계    | `2026-09-16T00:00:00.000Z`                                                | vitest `vi.useFakeTimers({ now })` + `vi.setSystemTime` (하니스는 vitest 파일로 실행 — `now` 규칙의 `new Date()` 까지 잡는다) |
| refDate | 같은 값                                                                   | `createGenerators({ seed, locale, refDate })` → `GenerateRowsOptions.generators`                                              |
| TZ      | `UTC`                                                                     | `TZ=UTC pnpm -F @composition/builder exec vitest run …`                                                                       |
| locale  | `ko-KR` · `en-US` 둘 다                                                   | preset `generateSampleData(5, t, { seed: "adr220", locale })`                                                                 |
| `t`     | `presetStrings` 의 해소기를 locale 고정으로 (`getStoredLocale` 대신 인자) | 하니스가 `PresetTranslate` 를 직접 만든다                                                                                     |

산출: `docs/adr/evidence/220-p0-seed-snapshot.json` = `{ metadata: { clock, tz, locale[], seed, head, harness }, presets: { [id]: rows[5] × locale }, rules: { [type]: value[3] } }` (preset 13 · 규칙 54 종 + `now`). G3 는 같은 하니스를 이동·rename 후 다시 돌려 `diff` 0.

## 6. Phase

| Phase | 내용                                                                                                                                                                                                              | 종료 조건          |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 0     | 병행 세션 commit 확인 → 인벤토리 freeze (§4 심볼 28 · importer 6 · 유지 79/3 개수 기록) → §5 스냅샷 (이동 **전**)                                                                                                 | G0                 |
| 1a    | **준비 커밋** — 빈 패키지 골격 (`package.json` · tsconfig · vitest · `src/index.ts` 빈 export) + builder 의존 + `pnpm install` → **lockfile 확정**. 코드 이동 0. 이 커밋이 G4 의 before arm                       | type-check 4 tasks |
| 1b    | `git mv` 5 파일 + 테스트 이동 + `boundary.static.test` · importer 6 파일 경로 교체 (식별자는 아직 그대로) · G1 음성 검사 기록                                                                                     | G1                 |
| 2     | 식별자 rename (§4) · tool 리터럴 `generate` · i18n 설명 · 주석 · 스냅샷 재생성 diff 0 · 유지 대상 개수 불변                                                                                                       | G2 · G3            |
| 3     | `adr220-bundle-gate.mjs` 작성 + 음성 fixture · 같은 HEAD·같은 lockfile 두 worktree A/B (before = 1a 커밋, after = Phase 2 커밋) · live (preset 적용 1 + AI create-table 1) · CHANGELOG · README · ADR Implemented | G4 · G5            |

커밋 4 개 (1a 준비 / 1b 이동 / 2 rename / 3 게이트·문서) — `git mv` 이력이 rename diff 와 섞이지 않게.

## 7. 번들 판정기 — `apps/builder/scripts/adr220-bundle-gate.mjs`

`adr202-bundle-gate.mjs` 는 202 전용 (Builder Δ ≤ 3,584 · Preview Δ ≤ 0 · lazy 대상 AIPanel/runCommand) 이라 220 조건을 검사하지 않는다 (round 1 m4: +1,000 B fixture 가 pass). 220 판정기는 202 의 closure JSON 4 + manifest 입력을 그대로 받고:

| 검사                                                                    | 조건                                                                                                    |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `sameLockfile` · `beforeSameRevision`/`afterSameRevision` (202 와 동일) | true                                                                                                    |
| Builder initial gzip Δ · Preview initial gzip Δ                         | **각각 −512 ≤ Δ ≤ +512**                                                                                |
| 절대 상한 · 만료                                                        | 1,319,829 / 592,000 · `2026-10-16`                                                                      |
| `presetStrings` lazy                                                    | `src/builder/panels/datatable/presets/presetStrings.ts` 의 chunk 가 builder initial closure 에 **없음** |
| 202 lazy 조건 (AIPanel · runCommand)                                    | 보존                                                                                                    |

**음성 fixture 2 개** (판정기 자기 검증, G4 통과 조건에 포함): ① after builder = before + 1,000 → exit 1 · ② manifest 를 조작해 presetStrings 를 initial 에 넣은 사본 → exit 1.

lockfile: workspace 패키지 추가로 `pnpm-lock.yaml` 이 바뀐다 → before arm 은 **Phase 1a 준비 커밋** (골격 + lockfile, 코드 이동 0) 이라 두 arm 의 lockfile sha 가 같다. 두 worktree 모두 `pnpm install --frozen-lockfile` + 엔진 wasm `composition-engine-pkg` 복사 (ADR-202 절차).

## 8. 게이트 명령

```sh
# G0 인벤토리 — 이동 모듈 import 경로 + 공개 심볼만 (collection 필드 mockData/useMockData · workflow sourceType 제외)
grep -rIn --include='*.ts' --include='*.tsx' -E 'services/mockData|\b(MockRule|MockColumn|MockRowContext|MockRandom|MockLocale|CreateMockOptions|createMock|resolveMockLocale|MOCK_RULE_TYPES|MockRuleType)\b|kind: "mock"' apps/builder/src | grep -v '\.test\.' | wc -l
# 유지 대상 개수 (G2 전후 불변)
grep -rIn --include='*.ts' --include='*.tsx' -E '\.mockData\b|mockData:|useMockData' apps/builder/src apps/publish/src | grep -v 'services/mockData\|\.test\.' | wc -l   # 79
grep -rn '"mock"' apps/builder/src/builder/workspace/canvas/skia/workflow*.ts | wc -l                                                                           # 3
# G0/G3 스냅샷
TZ=UTC pnpm -F @composition/builder exec vitest run scripts/adr220-snapshot.test.ts   # → docs/adr/evidence/220-p0-seed-snapshot.json (metadata 포함)
# G1
pnpm -F @composition/sample-data type-check && pnpm -F @composition/sample-data test && pnpm type-check
#   음성: src/random.ts 에 apps/builder 상대 import 1 줄 주입 → 위 두 명령이 실패해야 한다 → 제거
# G2 (0 이어야 한다)
grep -rIn --include='*.ts' --include='*.tsx' -E 'services/mockData|\b(MockRule|MockColumn|MockRowContext|MockRandom|MockLocale|CreateMockOptions|createMock|resolveMockLocale|MOCK_RULE_TYPES|MockRuleType)\b|kind: "mock"' apps/builder/src packages/sample-data/src | wc -l
# G4 — 같은 HEAD·같은 lockfile 두 worktree (엔진 wasm composition-engine-pkg 복사)
node apps/builder/scripts/adr220-bundle-gate.mjs --before-builder …/before-builder.json --before-preview …/before-preview.json --after-builder …/after-builder.json --after-preview …/after-preview.json --manifest …/after-dist/.vite/manifest.json --out …/220-gate.json
```

## 9. 범위 밖 (후속 후보)

- preset 카탈로그 · `presetStrings` 의 패키지 이동 — `DataField/DataFieldType` 을 `@composition/shared/types` 로 올리는 결정 (ADR-152 계약 타입 위치) 뒤에 `packages/sample-data/src/presets/` 서브패스로.
- collection 저장 필드 `mockData`/`useMockData` 의 이름 — 저장 스키마 마이그레이션이 따르는 별도 ADR.
- publish 런타임에서 샘플 행 생성 (executionPolicy 와의 관계) — 소비자가 생기면.
- 외부 배포 (dist) — 소비자가 생기면.
