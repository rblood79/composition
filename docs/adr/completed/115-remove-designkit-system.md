# ADR-115: DesignKit 시스템 제거 — Theme/Variable 시스템과 중복 해소

## Status

Implemented — 2026-04-27 (PR #263 머지)

### 진행 로그

- **2026-04-27 (세션 38)**: Proposed + Implemented 동일 PR 내 land
  - **Phase 0** ADR-115 발의 — Risk-First 템플릿 + 4 대안 + Risk Threshold Check + Gates G1-G4 + design breakdown 220 LOC
    - **Phase 1** ADR Status / reference 정리 — ADR-020 → `completed/` Superseded + ADR-111/112/016/011 reference 일괄 정리 (ADR-114 는 2026-04-30 ADR-116 으로 흡수되어 Superseded 처리)
  - **Phase 2** 코드 제거 — 5 경로 ~1,989 LOC: `panels/designKit/` (5 파일, 634) + `stores/designKitStore.ts` (222) + `types/builder/designKit.types.ts` (298) + `utils/designKit/` (4 파일, 822) + `panelConfigs.ts` import/config + Package icon 정리 + `panels/core/types.ts` panel id "designKit" + DEFAULT_PANEL_LAYOUT 항목 제거 + `composition-document.types.ts` `importedFrom designkit:` 주석 정리
  - **Phase 3** 검증 + CHANGELOG + PR — G1 type-check 3/3 PASS / G2 잔존 reference 0건 / G4 CHANGELOG entry. PR #263 단일 commit `16bd9288` (23 파일, +451 / -2022 LOC)
  - **머지 후 dev 검증** (사용자): 사이드바 "디자인 킷" 사라짐 + `Ctrl+Shift+K` 충돌 0 + 다른 패널 정상 마운트 확인
- **2026-04-27 (closure)**: Status `Proposed → Implemented` 승격 + `completed/` archive + README 완료 섹션 이동 + reference link path 정합화 (5 단계 마감 패턴)

## Context

### Domain (SSOT 체인 — [ssot-hierarchy.md](../../.claude/rules/ssot-hierarchy.md))

- **해당 domain**: **D2 (Props/API) + D3 (시각 스타일) 의 사용자 향 기능 단일화** — DesignKit 패널이 D3 의 별도 SSOT 분기를 시도했으나 ADR-021 Theme System 과 D3 권위 중복.

### 배경

[ADR-020](completed/020-design-kit-improvement.md) 에서 도입된 DesignKit 패널 시스템은 변수 / 테마 / 토큰 / Master 컴포넌트를 `.kit.json` 으로 묶어 프로젝트 간 재사용하는 기능이다. 5-Layer 아키텍처 + 6-step 적용 파이프라인 + Zod 검증 등 **인프라는 견고**하지만, ADR-020 §2 의 자가 분석에서 이미 다음이 명시됨:

- **§2.1 (CRITICAL)**: 킷 콘텐츠 빈약 — 내장 킷 1개, 컴포넌트 2개 (Card / Badge), Card 는 `Box + 2 Text` 로 composition 의 실제 Card Compositional Architecture 와 무관
- **§2.2 (HIGH)**: composition 컴포넌트 시스템 미활용 — 46+ 컴포넌트가 있음에도 Box / Text 만 사용
- **§2.8 (MEDIUM)**: 변수 바인딩 (`$--`) 불완전 — 적용 시 교체되지 않고 문자열 그대로 저장
- **§2.9 (MEDIUM)**: 테마 매핑 불안정 — 이름 기반 검색

이 분석에서 ADR-020 은 **점진적 개선 (대안 A) + Factory 통합 (대안 B) 혼합** 을 결정했으나 land 되지 않음 (Status `Proposed` 유지).

### 중복 영역 분석

DesignKit 의 4 핵심 기능 각각 **이미 composition 에 더 성숙한 권위 시스템 존재**:

| DesignKit 기능                                    | composition 의 기존 권위                                                                      |               중복도                |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------- | :---------------------------------: |
| 변수 (`KitVariable` 5개)                          | `useUnifiedThemeStore` DesignVariable 시스템 (ADR-021 Phase A-E)                              |            **완전 중복**            |
| 테마 / 토큰 (`KitTheme` 1개 / `KitToken` 12개)    | ADR-021 Theme System Redesign — `themes` table + token bulk upsert                            |            **완전 중복**            |
| Master 컴포넌트 (`KitElement` 2개 — Card / Badge) | composition Compositional Architecture (46+ 컴포넌트, Factory + Spec)                         | **상위 호환** (composition 이 우월) |
| 프로젝트 간 재사용                                | ADR-116 이 흡수한 pencil `imports` resolver/import-export adapter (외부 `.pen` URL/path 참조) |        **참조형이 더 적합**         |

DesignKit 의 **고유 가치** 라 할만한 것은 ADR-020 §2.6 (시각적 미리보기) 정도이나, 이 역시 ADR-111 의 pencil 호환 frame 시스템이 자연스럽게 흡수 가능.

### Hard Constraints

| 제약                     | 값                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------- |
| type-check               | error 0 통과 필수                                                                       |
| `pnpm build`             | 통과 필수                                                                               |
| Supabase schema          | 영향 없음 (designkit 전용 테이블 / column 0건 검증됨)                                   |
| localStorage / IndexedDB | 영향 없음 (designkit 키 0건 검증됨)                                                     |
| 사용자 데이터 보존       | `.kit.json` 파일은 사용자 로컬 디스크 보존 (composition 측에서 import / export 차단 OK) |
| 다른 패널 회귀           | 0건 (사이드바 + 단축키 + 패널 마운트)                                                   |

### Soft Constraints

- 기존 사용자 워크플로 — DesignKit 사용자가 있다면 안내 필요. 다만 ADR-020 §2.1 에서 "기능 가치 부재" 가 CRITICAL 로 명시된 점, panel 외부 직접 의존 0건인 점에서 실제 사용 흔적이 있는지 추가 분석은 P2
- ADR-111 / ADR-112 / ADR-114 등 진행 중 ADR 의 reference 정리 비용

## Alternatives Considered

### 대안 A: 즉시 전수 제거 (Hard Removal)

- 설명: panel + store + utils + types + panelConfigs 등록 일괄 삭제. 단일 PR 로 ADR 발의 + 코드 제거 + 다른 ADR reference 정리 동시 진행
- 근거: 외부 직접 의존 0건 + DB 영향 0건 + 사용자 데이터 로컬 파일만 — Boris 패턴 dead code cleanup 의 표준 (ADR-029 Builder CSS dead code cleanup 동일 패턴)
- 위험:
  - 기술: **L** — 외부 직접 의존 0, 5 경로 모두 패키지 boundary 내부
  - 성능: **L** — 오히려 번들 -100~150KB 감소 (1,989 LOC 제거)
  - 유지보수: **L** — 제거 결정이므로 신규 부담 없음
  - 마이그레이션: **L** — DB 영향 0, 사용자 `.kit.json` 파일은 로컬 디스크 보존, composition 측 import / export 차단으로 충분

### 대안 B: Deprecate-then-Remove (1주 안내 후 제거)

- 설명: DesignKit 패널에 deprecation banner 추가 (`Ctrl+Shift+K` 시 "DesignKit 은 ADR-115 로 제거 예정. theme 시스템 사용 권장" 토스트). 1~2주 후 정식 제거
- 근거: 사용자 facing 기능 제거 시 일반적 안전장치 (semver major bump 패턴)
- 위험:
  - 기술: **L**
  - 성능: **L**
  - 유지보수: **M** — deprecation 기간 동안 코드 + banner UI 유지 비용. ADR-111 / ADR-112 / ADR-114 진행 중에 reference 정리 시점도 분리됨
  - 마이그레이션: **L**

### 대안 C: UI 만 숨김 (Soft Hide)

- 설명: panelConfigs.ts 에서 `disabled: true` 또는 `hidden: true` 만 설정. 코드는 모두 잔존
- 근거: 가역적 — 향후 부활 가능
- 위험:
  - 기술: **L**
  - 성능: **L** (번들 -0KB, 코드 살아있음)
  - 유지보수: **H** — dead code 영구 잔존. theme 시스템 발전 시 designKitStore ↔ themeStore 인터페이스가 stale → 다른 ADR 진행 시 회귀 위험. ADR-111 / ADR-112 의 reference 도 영구 stale
  - 마이그레이션: **L**

### 대안 D: 유지 + Theme 시스템에 점진적 흡수

- 설명: DesignKit 의 변수 / 테마 / Master 컴포넌트 일부 기능을 theme 시스템에 흡수한 후 DesignKit 만 제거
- 근거: 기능 손실 0
- 위험:
  - 기술: **M** — theme 시스템 확장 분석 + 인터페이스 설계 비용. 별도 ADR scope
  - 성능: **L**
  - 유지보수: **H** — 흡수 기간 동안 이중 소스 (DesignKit + Theme) 유지. theme 측 로직 복잡도 증가
  - 마이그레이션: **H** — 사용자 `.kit.json` 마이그레이션 path 설계 필요. `.kit.json` → theme JSON 변환기 작성 + 사용자 안내 + 검증 시나리오. 그러나 ADR-020 §2.1 에서 "기능 가치 부재" CRITICAL 로 명시 — 흡수 가치 자체 의문

### Risk Threshold Check

| 대안                      | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ------------------------- | :--: | :--: | :------: | :----------: | :--------: |
| A (즉시 전수 제거)        |  L   |  L   |    L     |      L       |   **0**    |
| B (Deprecate-then-Remove) |  L   |  L   |    M     |      L       |     0      |
| C (UI 숨김)               |  L   |  L   |  **H**   |      L       |     1      |
| D (유지 + 흡수)           |  M   |  L   |  **H**   |    **H**     |     2      |

루프 판정:

- 모든 대안 HIGH 1+ 미만이거나 D 만 HIGH 2 → 새 대안 추가 불필요
- A 가 모든 축 LOW → 즉시 채택 가능
- D 의 HIGH 는 "흡수 가치 부재" 라는 본질 문제 (ADR-020 §2.1 자가 분석) 로 인해 흡수 시도 자체가 비용 대비 효익 음수

## Decision

**대안 A (즉시 전수 제거) 를 선택한다.**

선택 근거:

1. **위험 모든 축 LOW** — 외부 직접 의존 0건 (panel registry 만 2 라인), DB 영향 0건, 사용자 데이터 로컬 파일만, 번들 감소 효과
2. **흡수 가치 부재** — ADR-020 §2.1/§2.2 가 자체 CRITICAL/HIGH 로 명시한 "기능 가치 부재 + composition 컴포넌트 시스템 미활용" 은 흡수 가치를 부정. 5 변수 / 12 토큰 / 2 컴포넌트 (Card / Badge) 는 theme 시스템 + Compositional Architecture 가 더 풍부하게 표현
3. **단순 dead code cleanup** — ADR-029 (Builder CSS dead code cleanup) 와 동일 패턴. 외부 의존 0건 + DB 영향 0건이면 즉시 제거가 표준
4. **진행 중 ADR 정리 일괄성** — ADR-111 / ADR-112 / ADR-114 가 모두 DesignKit 을 reference 함. 즉시 제거가 reference 정리도 단일 PR 로 일괄 처리

### 기각 사유

- **대안 B 기각**: 사용자 facing 기능이지만 ADR-020 §2.1 에서 "기능 가치 부재" CRITICAL 로 명시 — deprecation 기간 동안 사용자 안내가 가치 없음. 유지보수 MED 만큼 비용. PR 도 분할되어 ADR-111/112/114 reference 정리가 후순위로 밀림
- **대안 C 기각**: 유지보수 HIGH — dead code 영구 잔존이 가장 큰 실패 모드. theme 시스템 발전 + 다른 ADR 진행 시 stale 인터페이스가 회귀 위험. 가역성 이득보다 영구 부담이 큼
- **대안 D 기각**: 유지보수 HIGH + 마이그레이션 HIGH. ADR-020 §2.1 자가 분석에서 "흡수 가치 부재" 가 명시됨 — 흡수 노력이 ROI 음수. 별도 ADR scope (theme 시스템 확장) 가 본 결정의 단순성을 훼손

> 구현 상세: [115-remove-designkit-system-breakdown.md](../design/115-remove-designkit-system-breakdown.md)

## Risks

| ID  | 위험                                                                                                          | 심각도 | 대응                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 사용자 `.kit.json` 파일이 로컬 디스크에 저장되어 있다가 composition 으로 import 시도 시 메뉴 자체 사라져 혼동 |  LOW   | (a) CHANGELOG Breaking Changes 명시 (b) 사용자 안내: theme 시스템 사용 권장 (c) `.kit.json` 파일은 사용자 디스크 보존 — 데이터 손실 0 |
| R2  | 잔존 reference (코드 / 문서) 가 1건이라도 누락 시 build 실패 또는 stale 문서                                  |  LOW   | Phase 3 §3-2 grep 명령으로 0건 검증 (CHANGELOG / 본 ADR / ADR-020 / design breakdown 제외)                                            |
| R3  | ADR-111 / ADR-112 / ADR-114 의 reference 가 stale 인 채 land 되어 진입 시점 혼동                              |  LOW   | Phase 1 §1-2 일괄 정리. ADR-114 는 2026-04-30 ADR-116 으로 잔여 scope 흡수 + Superseded archive 처리                                  |
| R4  | dev 검증에서 다른 패널 회귀 (사이드바 / 단축키 / 패널 마운트)                                                 |  LOW   | Phase 3 §3-3 dev verify Gate G3. 회귀 발견 시 단일 commit revert                                                                      |
| R5  | DesignKit panel 외부 직접 의존이 inventory 에서 누락되어 type-check error                                     |  LOW   | Phase 3 §3-1 Gate G1. 외부 직접 의존 inventory 검증 결과 panelConfigs.ts (2 라인) + panels/core/types.ts (1 라인) 만 확인됨           |

잔존 HIGH 위험 없음.

## Gates

| Gate                     | 시점            | 통과 조건                                                                                                                                                                                                                           | 실패 시 대안                              |
| ------------------------ | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **G1: 정적 검증**        | Phase 3 시작    | (a) `pnpm type-check` error 0 / (b) `pnpm build` error 0 / (c) vitest 회귀 없음 (DesignKit 관련 test 함께 제거 후)                                                                                                                  | 누락된 reference 추적 → 보강 후 재검증    |
| **G2: 잔존 reference 0** | Phase 3 진행 중 | (a) `apps/` + `packages/` 에서 `designKit\|DesignKit\|KitElement\|KitToken\|KitVariable\|kitLoader\|kitExporter\|kitValidator` grep 0건 / (b) `docs/` 에서 동일 grep 0건 (CHANGELOG / 본 ADR-115 / ADR-020 / design breakdown 제외) | 잔존 위치 추가 정리                       |
| **G3: 동적 검증**        | Phase 3 마지막  | (a) 좌측 사이드바에서 DesignKit 항목 사라짐 / (b) 단축키 `Ctrl+Shift+K` 가 다른 패널과 충돌 0 / (c) 기존 패널 (Layers / Themes / Properties / Frames 등) 정상 마운트 / (d) 콘솔 error 0                                             | 패널 등록부 회귀 — panelConfigs.ts 재검토 |
| **G4: CHANGELOG entry**  | PR 직전         | Breaking Changes 섹션 + Architecture 섹션 포함 — DesignKit 제거 / `.kit.json` import/export 차단 / Why 명시 / 사용자 영향 명시                                                                                                      | CHANGELOG 보강 후 재검토                  |

## Consequences

### Positive

- **번들 -100~150KB 감소** (1,989 LOC 제거)
- **theme 시스템 단일 권위 복원** (ADR-021 + variable 시스템 + Compositional Architecture 가 D3 SSOT 단일화)
- **진행 중 ADR 정리** — ADR-111 / ADR-112 / ADR-016 / ADR-011 의 DesignKit reference 일괄 제거. ADR-114 는 이후 ADR-116 으로 잔여 imports scope 흡수 + Superseded 처리
- **dead code cleanup 패턴 정착** — ADR-029 (CSS dead code) 와 동일 단일 PR 즉시 제거 워크플로 확인
- **유지보수 부담 영구 감소** — DesignKit ↔ themeStore 인터페이스 stale 위험 제거

### Negative

- **사용자 `.kit.json` import / export 차단** — 사용자가 외부에서 받은 `.kit.json` 을 composition 으로 가져올 수 없음 (다만 ADR-020 §2.1 자가 분석상 "기능 가치 부재" 로 실 사용자 영향 미미 추정)
- **ADR-020 본문 archive (completed/) 이동** — Superseded by ADR-115 + 본문 historical reference 유지
- **ADR-111 / ADR-112 / ADR-114 후속 정리 비용** — Phase 1 §1-2 에서 일괄 처리했고, ADR-114 standalone plan 은 2026-04-30 ADR-116 으로 흡수
- **CHANGELOG Breaking Changes** — semver major 성격의 변경 (사용자 facing 기능 제거)

## References

- [ADR-020](completed/020-design-kit-improvement.md) — 본 ADR 가 Supersede 하는 DesignKit 패널 분석/개선 계획 (Status: Proposed → Superseded)
- [ADR-021](completed/021-theme-system-redesign.md) — Theme System Redesign (DesignKit 의 변수/테마/토큰 영역의 단일 권위)
- [ADR-029](completed/029-builder-css-dead-code-cleanup.md) — Builder CSS dead code cleanup (본 ADR 의 단일 PR 즉시 제거 패턴 선례)
- [ADR-111](111-layout-frameset-pencil-redesign.md) — pencil 호환 frame 재설계 (line 249 reference 정리 대상)
- [ADR-112](112-editing-semantics-ui-5elements.md) — Editing Semantics UI 5요소 (G4-A 시각 마커에서 DesignKit 제거)
- [ADR-114](114-imports-resolver-designkit-integration.md) — pencil imports resolver + DesignKit 통합 (Superseded 2026-04-30; DesignKit scope 는 본 ADR 로 무효화, imports resolver/cache 잔여는 ADR-116 으로 흡수)
- [ADR-016](016-photoshop-ui-ux.md) — Photoshop UI/UX (line 43 다이어그램 DesignKitPanel 박스 제거)
- [ADR-011](011-ai-assistant-design.md) — AI Assistant Design (line 1079 `appliedKitIds` 표 footnote — ADR-054 Superseded + 본 ADR-115 제거)
