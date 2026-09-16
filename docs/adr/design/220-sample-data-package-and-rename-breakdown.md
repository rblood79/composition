# ADR-220 구현 분해 — `@composition/sample-data` 패키지화 + 명칭 정리

> 본문: [220-sample-data-package-and-rename.md](../220-sample-data-package-and-rename.md). 동작 변경 0 리팩터 — 절차는 `.claude/rules/review-loop-closure.md` §3 "동작 변경 0" 행.

## 1. 전제 lock-in

1. base/응용: 패키지 (엔진) 가 base, preset 카탈로그 · AI tableSpec 이 응용. 응용은 builder 에 남고 import 경로만 바뀐다.
2. schema: 저장 스키마 무변경 — 규칙은 preset 정의 · tool 인자에만 있고 사용자 문서에는 생성된 행만 저장된다.
3. 선행 ADR 전제: ADR-213 의 `create_table_from_description` 인자 계약에서 `fields[].generate.kind` 리터럴 하나가 바뀐다 (`mock` → `generate`). 213 본문의 Gate 는 무변경 (tool 이름·propose/review/apply 흐름 동일).
4. 병행 세션: task-state goal "Mock 데이터 자체 모듈 + Add Table preset 확장" 이 같은 파일을 편집한다 — G0 clean 전 시작 금지.

## 2. 파일 이동표

| 현재 (`apps/builder/src/`)                                              | 이후                                                                                     | 비고                                     |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------- |
| `services/mockData/random.ts`                                           | `packages/sample-data/src/random.ts`                                                     | `git mv`                                 |
| `services/mockData/locale.ts`                                           | `packages/sample-data/src/locale.ts`                                                     |                                          |
| `services/mockData/generators.ts`                                       | `packages/sample-data/src/generators.ts`                                                 |                                          |
| `services/mockData/rules.ts`                                            | `packages/sample-data/src/rules.ts`                                                      |                                          |
| `services/mockData/index.ts`                                            | `packages/sample-data/src/index.ts`                                                      | 패키지 진입점                            |
| `services/mockData/mockData.test.ts`                                    | `packages/sample-data/src/sampleData.test.ts`                                            | 18 it                                    |
| (신규)                                                                  | `packages/sample-data/package.json` · `tsconfig.json` · `vitest.config.ts` · `README.md` | shared 형태 (아래 §3)                    |
| `builder/panels/datatable/presets/**`                                   | **유지**                                                                                 | import 경로만 `@composition/sample-data` |
| `services/ai/data/tableSpec.ts` · `tools/createTableFromDescription.ts` | **유지**                                                                                 | import 경로 + 리터럴                     |

## 3. 패키지 골격

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

- `tsconfig.json`: `extends: "@composition/config/tsconfig/library"`, `include: ["src"]` — `apps/` 가 보이지 않으므로 역참조는 컴파일 오류.
- builder `package.json` `dependencies` 에 `"@composition/sample-data": "workspace:*"`. vite alias 불필요 (`exports` 가 src 를 가리킨다 — shared 와 동일; subpath 가 생기면 그때 shared 의 alias 패턴).
- `dependencies` · `peerDependencies` 없음 — 있으면 G1 실패.

## 4. 식별자 대응표

| 현재                                                   | 이후                                            | 지점 (src, 테스트 제외)                                             |
| ------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------- |
| `services/mockData` (경로)                             | `@composition/sample-data`                      | importer 6 파일                                                     |
| `MockRule`                                             | `SampleRule`                                    | rules · presets/types · catalog/column · tableSpec                  |
| `MockColumn`                                           | `SampleColumn`                                  | rules · presets/types                                               |
| `MockRowContext`                                       | `SampleRowContext`                              | rules                                                               |
| `MockRandom`                                           | `SeededRandom`                                  | random                                                              |
| `MockLocale` · `resolveMockLocale` · `FALLBACK_LOCALE` | `SampleLocale` · `resolveSampleLocale` · (유지) | locale · presets/types · createTableFromDescription · tableSpec     |
| `createMock`                                           | `createGenerators`                              | generators · rules                                                  |
| `MOCK_RULE_TYPES` · `MockRuleType`                     | `GENERATE_RULE_TYPES` · `GenerateRuleType`      | tableSpec                                                           |
| `{ kind: "mock", type }` (규칙 · zod 리터럴)           | `{ kind: "generate", type }`                    | tableSpec:93 · 236-239 · 320                                        |
| i18n `aiToolDef.*` 설명의 "mock 규칙" 문구             | "생성 규칙" / "generate rule"                   | translations ko/en                                                  |
| 주석 `services/mockData (생성기)`                      | `@composition/sample-data`                      | DataTableCreator · DataTableList · presets/index · dataTablePresets |
| `workflowEdges.sourceType: "mock"`                     | **무변경**                                      | 무관한 동음                                                         |

## 5. Phase

| Phase | 내용                                                                                                                                                                                                                                                    | 종료 조건                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 0     | 병행 세션 commit 확인 → 인벤토리 freeze (`grep` 지점 수 기록) → **seed 스냅샷**: `node` 스크립트로 preset 13 × `generateSampleData({ seed: "adr220", rows: 5 })` + tableSpec 규칙 54 종 × 3 값 을 `docs/adr/evidence/220-p0-seed-snapshot.json` 에 기록 | G0                                                         |
| 1     | 패키지 골격 + `git mv` 5 파일 + 테스트 이동 · builder 의존 추가 · importer 6 파일 경로 교체 (식별자는 아직 그대로) · `pnpm install`                                                                                                                     | G1 (type-check 4 tasks · 패키지 test 18 · builder 관련 15) |
| 2     | 식별자 rename (§4) · tool 리터럴 `generate` · i18n 설명 · 주석 · 스냅샷 재생성 후 diff 0                                                                                                                                                                | G2 · G3                                                    |
| 3     | 같은 HEAD worktree A/B 번들 게이트 · live (preset 적용 1 + AI create-table 1) · CHANGELOG · README · ADR Implemented                                                                                                                                    | G4 · G5                                                    |

Phase 1 과 2 는 커밋 2 개 (이동 / rename) — `git mv` 이력이 rename diff 와 섞이지 않게.

## 6. 게이트 명령

```sh
# G0 인벤토리
grep -rIn --include='*.ts' --include='*.tsx' 'mockData\|MockRule\|MockColumn\|resolveMockLocale\|createMock\|kind: "mock"' apps/builder/src | grep -v '\.test\.\|vi\.mock\|workflowEdges\|workflowRenderer' | wc -l
# G1
pnpm -F @composition/sample-data type-check && pnpm -F @composition/sample-data test && pnpm type-check
pnpm -F @composition/builder exec vitest run src/builder/panels/datatable/presets src/services/ai/data
# G2 (0 이어야 한다)
grep -rIn --include='*.ts' --include='*.tsx' 'mockData\|MockRule\|MockColumn\|resolveMockLocale\|createMock\|kind: "mock"' apps/builder/src packages/sample-data/src | grep -v 'workflowEdges\|workflowRenderer' | wc -l
# G4 — ADR-202 절차 (같은 HEAD 두 worktree, 엔진 wasm composition-engine-pkg 복사)
node apps/builder/scripts/adr202-bundle-gate.mjs --before-builder … --after-builder … --manifest …/.vite/manifest.json --out …
```

## 7. 범위 밖 (후속 후보)

- preset 카탈로그 · `presetStrings` 의 패키지 이동 — `DataField/DataFieldType` 을 `@composition/shared/types` 로 올리는 결정 (ADR-152 계약 타입 위치) 뒤에 `packages/sample-data/src/presets/` 서브패스로.
- publish 런타임에서 샘플 행 생성 (executionPolicy 와의 관계) — 소비자가 생기면.
- 외부 배포 (dist) — 소비자가 생기면.
