# ADR-115 구현 상세 — DesignKit 시스템 제거

> 본 문서는 [ADR-115](../completed/115-remove-designkit-system.md) 의 구현 상세. 본문에는 결정/위험/Gates 만, 본 문서에는 Phase / 파일 변경표 / 체크리스트 / 검증 절차.

## 영향 범위 inventory (제거 직전 측정)

### 1. 자체 코드 (~1,976 LOC, 5 경로)

| 경로                                                   | 파일 수 |    LOC     | 역할                                                                                 |
| ------------------------------------------------------ | :-----: | :--------: | ------------------------------------------------------------------------------------ |
| `apps/builder/src/builder/panels/designKit/`           |    5    |    634     | DesignKitPanel + KitBrowser/KitPreview/KitComponentList + CSS                        |
| `apps/builder/src/stores/designKitStore.ts`            |    1    |    222     | Zustand store (8 actions)                                                            |
| `apps/builder/src/types/builder/designKit.types.ts`    |    1    |    298     | DesignKit / KitElement / KitComponent / KitToken / KitVariable + Zod schema          |
| `apps/builder/src/utils/designKit/`                    |    4    |    822     | kitLoader (365) + kitExporter (179) + kitValidator (56) + builtinKits/basicKit (222) |
| `apps/builder/src/builder/panels/core/panelConfigs.ts` |  부분   |    ~13     | import 1줄 + config 객체 항목 ~12줄                                                  |
| **합계**                                               | **11**  | **~1,989** |                                                                                      |

### 2. 외부 직접 참조 (제거 시 갱신 필요)

| 위치                                                      |      라인       | 변경                                                                                     |
| --------------------------------------------------------- | :-------------: | ---------------------------------------------------------------------------------------- |
| `apps/builder/src/builder/panels/core/panelConfigs.ts`    |       42        | `DesignKitPanel` import 라인 제거                                                        |
| `apps/builder/src/builder/panels/core/panelConfigs.ts`    |     109-120     | panel config 객체 항목 제거 (id "designKit", shortcut Ctrl+Shift+K, navigation 카테고리) |
| `apps/builder/src/builder/panels/core/types.ts`           | (panel id type) | `"designKit"` 항목 제거                                                                  |
| `packages/shared/src/types/composition-document.types.ts` |     (주석)      | `metadata.importedFrom: "designkit:<kit-id>"` 주석 정리 (선택)                           |

### 3. ADR / 문서 reference

| 위치                                                               |     라인      | 처리                                                                                                            |
| ------------------------------------------------------------------ | :-----------: | --------------------------------------------------------------------------------------------------------------- |
| `docs/adr/020-design-kit-improvement.md`                           |    (전체)     | Status: Proposed → **Superseded by ADR-115** + `completed/` 이동                                                |
| `docs/adr/completed/111-layout-frameset-pencil-redesign.md`        |      249      | "ADR-903 P5-D/E/F (`imports` resolver + DesignKit 통합) 와 자연스럽게 통합" → DesignKit 부분 제거               |
| `docs/adr/completed/112-editing-semantics-ui-5elements.md`         | 18 / 34 / 112 | G4-A 시각 마커 항목에서 "DesignKit" 제거 (LayerTree + Canvas 만 유지)                                           |
| `docs/adr/016-photoshop-ui-ux.md`                                  |      43       | 다이어그램 박스에서 `DesignKitPanel` 제거                                                                       |
| `docs/adr/011-ai-assistant-design.md`                              |     1079      | `appliedKitIds` 표 항목 정리 (이미 ADR-054 Superseded — 가벼운 footnote)                                        |
| `docs/adr/completed/114-imports-resolver-designkit-integration.md` |    (전체)     | **Superseded** — DesignKit scope 는 본 ADR-115 로 무효화, imports fetch/cache/resolver 잔여는 ADR-116 으로 흡수 |
| `docs/adr/README.md`                                               |   (현황 표)   | ADR-020 → 완료 섹션 (Superseded) / ADR-115 → 신규 추가                                                          |

### 4. 영속화 / DB

| 영역                              |                                    상태                                     |
| --------------------------------- | :-------------------------------------------------------------------------: |
| Supabase schema (테이블 / column) |                  영향 없음 (검증 결과 designkit 전용 0건)                   |
| localStorage / IndexedDB          |                        영향 없음 (designkit 키 0건)                         |
| 사용자 `.kit.json` 파일           | 사용자 로컬 디스크 보존 (composition 이 더 이상 import/export 하지 못할 뿐) |

## Phase 0: ADR 발의 (본 작업 진행 전 land 필수)

- 본 ADR-115 + design breakdown 작성
- README.md 현황 표 갱신
- Status: Proposed
- 단일 PR 안에서 Phase 1+2+3 함께 진행 (의존성 0, 분할 이득 없음)

## Phase 1: 기존 ADR 정리

### 1-1. ADR-020 Superseded 처리

```bash
# 1) 본문 상단 Status 변경
# Proposed → Superseded by ADR-115

# 2) Superseded 행 추가 (본문 최상단)
# > Superseded by [ADR-115](115-remove-designkit-system.md) — DesignKit 시스템 전수 제거 결정

# 3) completed/ 이동
git mv docs/adr/020-design-kit-improvement.md docs/adr/completed/020-design-kit-improvement.md
```

### 1-2. ADR reference 정리

| 파일                                                            | 변경                                                                                                                                  |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/adr/completed/111-layout-frameset-pencil-redesign.md:249` | "ADR-903 P5-D/E/F (`imports` resolver + DesignKit 통합)" → "ADR-903 P5-D/E (`imports` resolver) — DesignKit 통합은 ADR-115 로 제거됨" |
| `docs/adr/completed/112-editing-semantics-ui-5elements.md:18`   | "DesignKit role 마커 (재사용 원본 시각화) **0건**" → 항목 제거                                                                        |
| `docs/adr/completed/112-editing-semantics-ui-5elements.md:34`   | "① reusable / ref / override 시각 마커 3종 (LayerTree + Canvas + DesignKit)" → "...3종 (LayerTree + Canvas)"                          |
| `docs/adr/completed/112-editing-semantics-ui-5elements.md:112`  | G4-A 표에서 "DesignKit" 제거                                                                                                          |
| `docs/adr/016-photoshop-ui-ux.md:43`                            | 다이어그램에서 `DesignKitPanel` 박스 제거 (좌측 패널 구성 갱신)                                                                       |
| `docs/adr/011-ai-assistant-design.md:1079`                      | 표 항목 footnote: "_[ADR-054 Superseded + ADR-115 제거됨]_"                                                                           |

### 1-3. ADR-114 처리

- **2026-04-30 후속 정리 완료** — ADR-114 standalone plan 을 Superseded 처리하고 `completed/` 로 이동
- DesignKit P5-F section 은 본 ADR-115 로 무효화, P5-D/P5-E imports resolver/cache 는 ADR-116 canonical document SSOT transition 으로 흡수

### 1-4. README.md 갱신

```markdown
# 변경 1: 미구현 (Proposed) 섹션에서 ADR-020 제거

# 변경 2: 완료 섹션에 ADR-020 Superseded 행 추가

# 변경 3: 미구현 (Proposed) 섹션에 ADR-115 행 추가

# 변경 4: 합계 카운트 동기화 (미구현 +0, 완료 +1, Superseded +1)
```

## Phase 2: 코드 제거

### 2-1. 디렉토리 / 파일 삭제

```bash
git rm -r apps/builder/src/builder/panels/designKit/
git rm apps/builder/src/stores/designKitStore.ts
git rm apps/builder/src/types/builder/designKit.types.ts
git rm -r apps/builder/src/utils/designKit/
```

### 2-2. panelConfigs.ts 갱신

- `DesignKitPanel` import 라인 제거
- panel config 객체 항목 제거 (id `"designKit"`, shortcut `Ctrl+Shift+K`, navigation 카테고리, icon `Package`)

### 2-3. panels/core/types.ts 갱신

- panel id union 에서 `"designKit"` 제거

### 2-4. composition-document.types.ts 주석 정리

- `metadata.importedFrom: "designkit:<kit-id>"` 주석 라인 제거 (선택 — 이미 미사용 주석)

### 2-5. 회귀 테스트

```bash
# DesignKit 관련 vitest 가 있는지 확인
find . -name "*.test.ts" -o -name "*.test.tsx" | xargs grep -l -i "designkit\|kitLoader\|KitElement" 2>/dev/null
# 발견 시 제거
```

## Phase 3: 검증

### 3-1. 정적 검증

```bash
pnpm type-check  # Stop hook 자동
pnpm build       # specs 빌드 + 전체 빌드
```

**통과 조건**:

- type-check error 0
- build error 0

### 3-2. 잔존 reference 검증 (CRITICAL)

```bash
# code 잔존 reference
grep -rn -E "designKit|DesignKit|KitElement|KitToken|KitVariable|kitLoader|kitExporter|kitValidator|applyDesignKit|exportCurrentAsKit" apps/ packages/ --include="*.ts" --include="*.tsx" 2>/dev/null

# docs 잔존 reference (정리되지 않은 것)
grep -rn -E "DesignKit|designKit|\.kit\.json|kitLoader" docs/ --include="*.md" 2>/dev/null \
  | grep -v "020-design-kit" \
  | grep -v "115-remove-designkit" \
  | grep -v "design/115-" \
  | grep -v "CHANGELOG"
```

**통과 조건**: code 0건, docs 0건 (CHANGELOG / 본 ADR / 020 / design breakdown 제외)

### 3-3. 동적 검증 (dev server)

```bash
pnpm dev
# 브라우저에서:
# 1. 좌측 사이드바에서 DesignKit 항목 사라졌는지 확인
# 2. 단축키 Ctrl+Shift+K 누른 후 다른 동작 또는 무동작 확인
# 3. 기존 패널 (Layers / Themes / Properties / 기타) 정상 마운트
# 4. 콘솔 error 0
```

### 3-4. CHANGELOG 갱신

```markdown
## [DesignKit 시스템 제거 — Theme/Variable 시스템 중복 해소] - 2026-04-27

### Breaking Changes

- **DesignKit 패널 제거** (ADR-115 Implemented):
  - `Ctrl+Shift+K` 단축키 비활성화
  - `.kit.json` import / export 기능 제거
  - **Why**: theme 시스템 + variable 시스템 + Compositional Architecture 와 의미 중복 — DesignKit 의 5 변수 / 12 토큰 / 2 컴포넌트 (Card / Badge) 는 모두 theme 시스템에서 더 풍부하게 표현됨
  - **사용자 영향**: 기존 사용자가 저장한 `.kit.json` 파일은 로컬 디스크에 보존되나 composition 으로 다시 import 불가
  - 제거 LOC: ~1,989 (코드 5 경로 + panelConfigs 일부)

### Architecture

- **ADR-020 Superseded by ADR-115**: DesignKit 패널 분석/개선 계획 → 제거 결정
- **ADR-111 / ADR-112 / ADR-016 / ADR-011 reference 정리**: DesignKit 언급 제거
```

## Gate 점검 (자가 검증)

| Gate                 | 통과 조건                                                     | 검증 방법                       |
| -------------------- | ------------------------------------------------------------- | ------------------------------- |
| G1: 정적 검증        | type-check + build error 0                                    | `pnpm type-check && pnpm build` |
| G2: 잔존 reference 0 | code 0건, docs 0건 (CHANGELOG / ADR-020 / ADR-115 제외)       | grep 명령 (3-2 절)              |
| G3: 동적 검증        | 사이드바에서 DesignKit 사라짐 + 다른 패널 정상 + 콘솔 error 0 | `pnpm dev` + 수동 확인          |
| G4: CHANGELOG entry  | Breaking Changes + Architecture 섹션 포함                     | git diff `docs/CHANGELOG.md`    |

## 실행 순서 (단일 PR)

1. (현재 단계) ADR-115 + design breakdown 파일 생성
2. README.md 갱신 + ADR-020 Superseded 처리 + ADR-020 → completed/ 이동
3. ADR-111 / 112 / 016 / 011 reference 정리
4. 코드 5 경로 삭제 + panelConfigs / types.ts 갱신
5. composition-document.types.ts 주석 정리 (선택)
6. type-check + build
7. 잔존 reference grep 0건 확인
8. dev verify
9. CHANGELOG entry
10. 단일 commit + push + PR 발의

## 롤백 경로

발의 후 검증 단계에서 critical 이슈 발견 시:

- **Phase 1 단계**: `git restore` 로 ADR 정리만 되돌리기
- **Phase 2 단계**: `git restore` 또는 `git reset --soft HEAD~1` 후 재검토
- **Phase 3 단계**: 동적 검증에서 다른 패널 회귀 발견 시 — panelConfigs.ts 만 임시 롤백 (DesignKit panel 만 다시 등록 + 코드 본체는 제거된 상태이므로 사실상 불가) → 전체 commit revert

PR 머지 전 검증으로 충분 — 머지 후 회귀 발견 시 PR revert (단일 commit).
