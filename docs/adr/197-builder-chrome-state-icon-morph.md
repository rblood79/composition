# ADR-197: Builder chrome 상태 아이콘 morph — morphicons core vendoring + StateIcon 레지스트리

## Status

Accepted — 2026-08-30 (review-adr round 1 승인 — MED 1·LOW 3 전부 fixed, `docs/adr/reviews/197.md`; 직전 Proposed 2026-08-30)

> 출처: 2026-08-29 사용자 요청 — "빌더 내 아이콘을 더 동적으로 표현. lock-keyhole-open → lock-keyhole 식 on/off 개념을 더하면 단순한 아이콘에 시각 효과로 가독성·시인성을 줄 수 있다" + "재사용 가능한 패턴으로". 적용 대상은 **Builder chrome 한정, canvas 미적용** (사용자 결정). 완전 신규 주제 (fork 아님) — 전제 기록은 [breakdown §1](design/197-builder-chrome-state-icon-morph-breakdown.md).

## Context

**SSOT 3-domain 위치**: **해당 없음** — 에디터 자체 UI (Builder chrome, DOM React) 전용. 사용자 문서를 그리는 canvas (Skia) · Preview · Publish 는 미적용이므로 D1/D2/D3 경계 변경 없음, `/cross-check` 대상 아님. 유일하게 읽는 D3 자산은 `@composition/specs` `getIconData` (ADR-019 lucide 레지스트리) 이며 읽기 전용.

### 문제 — chrome 의 상태 전환이 "즉시 교체" 뿐이다

2026-08-29 실측 (breakdown §2):

- chrome 은 100 파일이 lucide-react 를 import 하고, 상태가 바뀌는 아이콘은 삼항으로 컴포넌트를 갈아끼운다 — 11곳 (`RuleRow.tsx:130`, `ItemsManager.tsx:72,216`, `ContextualActionBar.tsx:165`, `TransformSection.tsx:673`, `ResponsiveVisibilityEditor.tsx:142` 등). 회전·crossfade·`transition` CSS 는 0건.
- 상태를 가지지만 아이콘이 고정된 컨트롤이 12곳 더 있다 (`AppearanceSection.tsx:312` inset, `AgentControls.tsx:24`, `ConnectionStatus.tsx:70`, `PanelToggleGroup.tsx:91` 등). 이들은 RAC `ToggleButton[data-selected]` 의 회색 wash (`ActionIconButton.css:29` `color-mix(var(--fg) 10%)`, `SwatchIconButton.css:31` `--accent-subtle`) 만으로 상태를 말하는데, wash 는 "켜짐" 과 "눌림" 을 구분하지 못한다.
- lucide 는 base ↔ `-off` / `-open` / `-check` / `-x` 짝을 다수 제공한다 (composition 데이터 기준 `-off` 74 · `-check` 32 · `-x` 34 · `-open` 10). 짝이 있는 곳에 형태 자체가 상태를 말하게 하고, 두 형태 사이를 연속으로 이으면 전환도 읽힌다.
- morphicons (MIT, 런타임 의존 0, core 6.6 KB gz) 는 stroke 아이콘 둘 사이의 similarity (회전·크기) 를 closed-form Procrustes 로 구해 polar 보간한다 — 회전 그룹을 손으로 선언하지 않아도 chevron-right → chevron-down 이 θ 90° 로 나온다 (breakdown §2-4 실계산). 입력 계약 (`IconNode = [tag, attrs][]`) 이 composition 의 `LucideIconData` (`paths[]` + `circles[]`) 와 무손실 호환이다.
- lucide-react 는 아이콘 데이터 (`__iconNode`) 를 메인 index 에서 노출하지 않는다 → 데이터 원천은 이미 있는 `getIconData` 여야 한다.

**Hard Constraints**:

1. **번들·의존** — 초기 번들 <500KB (`CLAUDE.md`), 외부 라이브러리 추가 금지 (`.claude/skills/component-design/SKILL.md:75`). 본 ADR 의 신규 npm 의존 = **0**. builder 초기 chunk Δ ≤ +10KB gz (G1; upstream core+dom 7.1 KB gz 상한). 아이콘 데이터 (`lucideIconData.generated.ts`) 는 이미 초기 chunk 에 있다 — `specShapeConverter.ts:9` · `SearchField.tsx:19` 가 eager import — 따라서 Δ 는 core 만 센다.
2. **접근성** — OS `prefers-reduced-motion: reduce` 에서 전환 프레임 0 (WCAG 2.3.3). RAC `ToggleButton` / `Button` / `MenuItem` 의 DOM 구조·ARIA 무변경 — 교체는 `<svg>` 내부 `<path d>` 뿐 (D1 침범 없음).
3. **정지 fidelity** — 정지 상태의 `d` 는 morphicons canonical (원본 곡선을 cubic 으로 내린 4자리 양자화 — lucide 원본 바이트와는 다르고 arc→cubic 왕복 오차 5e-5 이내, upstream `normalize.test.ts` 고정). polyline 은 비행 중에만. DOM 은 lucide-react 의 다중 `<path>/<circle>` 대신 단일 `<path>` (chrome CSS 가 svg 자식 구조를 참조하지 않음 — Phase 0 재grep).
4. **데이터 원천** — `getIconData(name)` 단일. `lucide-react/dist/esm/icons/*` deep import 금지.
5. **성능** — 비행 중 rAF 는 morph 전체 singleton 1개, 정지 시 timer 0. Skia 프레임 루프 (`SkiaCanvas.tsx:627`) 와 무관 (canvas 미적용).
6. **레지스트리 무결성** — 등록된 모든 쌍의 양끝이 `getIconData` 에 존재하고 plan 이 유한 (θ/σ NaN 0) — 테스트 게이트 (G2).
7. **prop 계약 호환** — `size` / `strokeWidth` / `color` 는 lucide-react 와 동일 (`uiConstants.ts` `iconProps` 스프레드 그대로). 정적 아이콘 정본 `actionIcons.ts:34` `ActionIcon` 타입은 존속.

**Soft Constraints**:

- upstream morphicons 는 활발히 갱신 중 (1.7.1, 2026-08-28 commit). vendoring 이므로 drift 관리 절차가 필요하다 (breakdown §3-5).
- lucide-react 갱신으로 `lucideIconData.generated.ts` 를 재생성하면 아이콘 rename 이 레지스트리를 깨뜨릴 수 있다 — G2 테스트가 잡는다.
- 확장 후보 12곳 중 3곳 (monitor / save / view) 은 토글 여부·배치·시각이 미확인 — Phase 3 에서 개별 판정, 미달 시 미등록.
- ADR-192 (Action Bar) 가 진행 중이라 `ContextualActionBar.tsx` 는 같은 파일 동시 편집을 피해 마지막 순서.

## Alternatives Considered

### 대안 A: morphicons npm 설치 (`morphicons/react` `MorphIcon`)

- 설명: `pnpm add morphicons`, `<MorphIcon icon={lucideIconNode} />` 를 chrome 에 직접 사용.
- 근거: upstream 이 React/Vue/Svelte/RN/custom element 5개 binding 과 SSR 계약을 제공. 5 프레임워크 mirrored suite 로 lifecycle contract 가 검증돼 있다.
- 위험:
  - 기술: L — 검증된 배포본.
  - 성능: L — react entry 8.0 KB gz (core + dom + binding).
  - 유지보수: **M** — 외부 의존 정책 위반 (HC1) 은 정책 예외 승인이 필요하고, 5-binding 패키지 중 React 만 쓰면서 upstream major 를 추종해야 한다. 데이터도 lucide `IconNode` 를 기대하므로 composition 의 `getIconData` 와의 어댑터가 어차피 필요.
  - 마이그레이션: L — 제거 시 컴포넌트 1개 교체.

### 대안 B: core + dom driver vendoring (8 + 1 파일) + 자체 React binding + `StateIcon` 레지스트리 (권장)

- 설명: upstream `src/core/*` 와 `src/dom/index.ts` 를 `apps/builder/src/builder/components/icons/morph/` 에 그대로 복사 (MIT 헤더 + upstream commit 기록). 그 위에 이름 기반 `MorphIcon` (upstream React binding 의 축소판 — controlled 모드·imperative handle 제거) 과 boolean 전용 `StateIcon` + `ICON_STATE_PAIRS` 레지스트리 (`[off, on]`, index 1 = 항상 "활성·잠김·보임·실행 중") 를 둔다. 호출부는 `<StateIcon pair="lock" on={locked} />` 만 쓴다.
- 근거: upstream 자체가 "core 는 DOM 무관 순수 함수, binding 은 얇은 껍질" 로 설계돼 있어 (CONTEXT.md "Binding controller" / "Shell") core 만 떼어내도 계약이 유지된다. 수학 불변식 11개가 테스트로 고정돼 있어 vendoring 후에도 같은 테스트로 drift 를 검출할 수 있다. 레지스트리 패턴은 composition 의 `actionIcons.ts` (다중 surface 아이콘 정본) 선례와 같은 어법.
- 위험:
  - 기술: L — 순수 함수 1,470 LOC, 테스트 123 케이스 이식 (bun:test → vitest 는 API 동일).
  - 성능: L — core+dom 7.1 KB gz 상한, 비행 중 alloc 은 프레임당 문자열 1개, 정지 시 timer 0.
  - 유지보수: **M** — vendoring drift. 완화: `UPSTREAM.md` hash + "디렉토리 통째 교체 + 불변식 테스트" 갱신 절차, 부분 patch 금지.
  - 마이그레이션: L — 신규 모듈, 기존 lucide-react 컴포넌트는 그대로 (짝 없는 토글은 계속 정적). 롤백 = `StateIcon` 호출 11곳을 삼항으로 되돌림.

### 대안 C: CSS transform / opacity 전환만 (라이브러리 0)

- 설명: chevron 은 `rotate(90deg)` transition, 나머지는 두 `<svg>` 를 겹쳐 opacity crossfade.
- 근거: Radix / shadcn 의 Accordion chevron (`data-state` + `transition: transform`) 이 표준 어법. 의존·번들 0.
- 위험:
  - 기술: L.
  - 성능: L.
  - 유지보수: **M** — 지점별 CSS, 쌍마다 다른 기법. crossfade 는 두 svg 동시 마운트 (DOM 2배, `aria-hidden` 관리).
  - 마이그레이션: L.
  - 한계 (위험 축 밖): 형태 변화 (lock 고리 회전, eye 슬래시 생성, sun→moon) 를 표현하지 못한다 — 사용자 의도 ("on/off 개념을 형태로") 의 절반만 충족. chevron 4곳에만 유효.

### 대안 D: 수작업 keyframe 애니메이션 아이콘 (Lordicon / lucide-animated 류 접근)

- 설명: 쌍마다 SVG `<animate>` / CSS keyframes 를 손으로 작성하거나 Lottie 에셋을 재생.
- 근거: Lordicon·useAnimations 가 상용 애니메이션 아이콘 세트의 표준. 표현력 최고.
- 위험:
  - 기술: M — Lottie 경로는 lottie-web ~60 KB gz + 에셋 포맷; 수작업 경로는 아이콘 지식 필요.
  - 성능: M — Lottie 시 HC1 위반, 수작업 시 L.
  - 유지보수: **H** — 쌍마다 에셋 제작·보수, lucide 갱신과 무관하게 손으로 동기화. 레지스트리에 한 줄 추가로 끝나지 않는다.
  - 마이그레이션: M — 에셋 형식 종속.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | L    | L    | M        | L            |     0      |
| B    | L    | L    | M        | L            |     0      |
| C    | L    | L    | M        | L            |     0      |
| D    | M    | M    | H        | M            |     1      |

루프 판정: HIGH 0 인 대안이 3개 (A/B/C) — 새 대안 추가 불필요. A 는 위험 등급과 무관하게 HC1 (외부 라이브러리 추가 금지) 위반, C 는 사용자 의도 (형태 변화) 미충족으로 아래에서 기각.

## Decision

**대안 B: core + dom driver vendoring + 자체 `MorphIcon` / `StateIcon` 레지스트리** 를 선택한다.

선택 근거:

1. **잔존 위험은 drift 하나 (MED)** 이고, upstream 이 순수 함수 + 실행 가능한 불변식 테스트로 구성돼 있어 "디렉토리 통째 교체 → 같은 테스트 통과" 로 관리 가능하다. 부분 patch 를 금지하면 drift 가 누적되지 않는다.
2. **HC1 을 지키면서 사용자 의도를 전부 충족** — 형태 변화 (lock-keyhole 고리, eye 슬래시, sun→moon) 가 수학에서 나오므로 쌍마다 애니메이션을 만들지 않는다. 새 토글은 레지스트리 한 줄.
3. **재사용 패턴이 곧 fallback 규칙** — `StateIcon` 은 레지스트리 키만 받으므로 짝 없는 토글 (Bold/Italic, Magnet, 패널 토글 11개) 은 자연히 정적 유지된다. 억지 짝 등록을 구조로 막는다.
4. **D1 무침범** — RAC 컴포넌트 DOM·ARIA 는 그대로, `<path d>` 만 driver 가 쓴다. `reducedMotion: "user"` 기본으로 접근성 기본값을 코드에 고정.

기각 사유:

- **대안 A 기각**: 외부 라이브러리 추가 금지 (HC1) 위반. 5-binding 패키지 중 React 하나만 쓰고, 데이터 어댑터는 어차피 자체 작성 — 설치가 주는 것은 upstream 자동 추종뿐인데 그 대가가 정책 예외.
- **대안 C 기각**: chevron 4곳에만 유효. lock / eye / sun / pin / maximize 는 회전만으로 이어지지 않고, crossfade 는 "두 아이콘이 겹쳐 사라짐" 이라 형태 연속성이 없어 사용자 의도 미충족.
- **대안 D 기각**: 유지보수 HIGH — 쌍마다 수작업 에셋, lucide 갱신과 분리된 동기화 부담. Lottie 경로는 HC1 위반.

> 구현 상세: [197-builder-chrome-state-icon-morph-breakdown.md](design/197-builder-chrome-state-icon-morph-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                     | 심각도 | 대응                                                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | vendoring drift — upstream 버그 수정·계약 변경이 반영되지 않거나, 로컬 patch 가 upstream 과 갈라짐                                                       |  MED   | `core/UPSTREAM.md` 에 1.7.1 / `38d2a72` 기록. 갱신 = 디렉토리 통째 교체 + 이식 테스트 (불변식 11 + driver) 통과. 부분 patch 금지 (breakdown §3-5) |
| R2  | IconNode 참조 불안정 — 매 render 변환 시 plan `WeakMap` 캐시가 무효화돼 전환마다 `buildPlan` 재계산 (sub-ms 이나 GC 압력)                                |  MED   | 이름 → IconNode 모듈 `Map` 캐시. 테스트: 같은 이름 두 번 조회 시 `Object.is` 동일 (G1)                                                            |
| R3  | 정지 시 canonical 복귀 누락 — polyline `d` 가 남아 곡선 fidelity 손실 (12-16px 에서 미세하지만 hover 확대·DPR 2 에서 드러남)                             |  MED   | driver settle 경로 보존 + 테스트 `settle 후 d === canonicalD(target)` (G0 dom.test)                                                               |
| R4  | reduced-motion 무시 — upstream driver 기본값이 `"never"` (`dom/index.ts:166`) 라 wrapper 가 override 하지 않으면 그대로 새거나, 호출부가 `never` 를 명시 |  MED   | `StateIcon` / `MorphIcon` 기본 `"user"` 를 테스트로 고정 (G1). `never` 는 prop 명시만                                                             |
| R5  | 짝 없는 토글에 억지 등록 — 의미가 어긋난 쌍 (예: 토글이 아닌 `zap`) 이 레지스트리에 들어감                                                               |  LOW   | 확인 필요 3건 (monitor / save / view) 은 Phase 3 개별 판정, 미달 시 미등록. 레지스트리 변경은 리뷰 대상 (breakdown §2-3 표 갱신 동반)             |
| R6  | lucide-react 갱신 (`lucideIconData.generated.ts` 재생성) 시 아이콘 rename 으로 쌍 양끝 소실                                                              |  LOW   | G2 레지스트리 테스트가 CI 에서 즉시 실패 — 재생성 commit 에 동반 수정                                                                             |
| R7  | ADR-192 진행 중 `ContextualActionBar.tsx` 동시 편집 충돌                                                                                                 |  LOW   | Pin 교체는 Phase 2 마지막, ADR-192 종결 후                                                                                                        |

잔존 HIGH 위험 없음.

## Gates

잔존 HIGH 위험 없음 — 아래 Gate 는 MED 위험 (R1~R4) 의 통과 조건이다.

| Gate | 시점           | 통과 조건                                                                                                                                                                                                                                                                                                                                        | 실패 시 대안                                                                          |
| ---- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| G0   | Phase 0 완료   | 이식 테스트 (invariants 11 + closed + dom) 전부 PASS · `pnpm type-check` 0 (리뷰 시 probe: upstream core+dom 9 파일을 `apps/builder/tsconfig.app.json` 으로 tsc → 오류 0, 2026-08-30) · eslint 오류 0 · Prettier 재포맷 후에도 테스트 동일                                                                                                       | 실패 케이스 원인이 vitest 환경 (rAF fake) 이면 fake 보강, core 차이면 upstream 재복사 |
| G1   | Phase 1 완료   | builder 초기 chunk Δ ≤ +10KB gz — 측정: 같은 HEAD 에서 Phase 1 commit 전/후 `vite build` 2회 (대조군), `dist/assets/index-*.js` gzip 크기 차 (ADR-196 방법), 아이콘 데이터는 양쪽 다 포함이므로 Δ = core+binding 만 · 같은 이름 IconNode `Object.is` 동일 · `reducedMotion` 기본 `"user"` 테스트 PASS · StrictMode 이중 mount 후 live driver 1개 | Δ 초과 시 core 를 lazy chunk 로 분리 (첫 토글 시 로드, 초기 렌더는 canonical d 정적)  |
| G2   | Phase 2 완료   | `statePairs.test.ts` PASS (양끝 존재 · θ/σ 유한 · off≠on) · 교체 파일 기존 테스트 PASS · **Live Exercise** (breakdown §6: lock / pin / theme + reduced-motion + rAF 0 — 조건: 보이는 탭 (`visibilityState: visible`, hidden 탭은 rAF 정지로 오판), DPR 2, dark 테마, reduced-motion 은 OS 설정으로 켜고 끔)                                      | 특정 쌍이 시각 미달이면 해당 쌍만 레지스트리 제외 (삼항 유지), 나머지 진행            |
| G3   | Phase 3 항목별 | 추가 쌍마다 G2 테스트 + live 1회. 확인 필요 3건은 실측 근거 (토글 여부 · 배치 · 시각) 를 breakdown §2-3 에 기록                                                                                                                                                                                                                                  | 근거 미달 항목은 미등록 — 억지 짝 금지                                                |

### Live Exercise

(Implemented 승격 시 기재 — breakdown §6 시나리오 5개의 결과 · 날짜 · Chrome MCP / 사용자 confirm 구분.)

## Consequences

### Positive

- chrome 의 상태 전환 11곳이 형태 연속 전환을 얻고, 상태 있는 고정 아이콘 12곳 (Phase 3) 에 on/off 형태가 생긴다 — `data-selected` wash 에 의존하던 시인성이 형태로 옮겨간다.
- 새 토글은 `statePairs.ts` 한 줄 + `<StateIcon pair on />` — 지점별 삼항·CSS 가 사라지고, 쌍 교체 (lock/unlock → lock-keyhole) 가 한 곳 수정으로 전 지점에 반영된다.
- 접근성 기본값 (`reducedMotion: "user"`) 이 컴포넌트에 고정돼 지점별로 잊을 수 없다.
- 외부 의존 0, 초기 번들 ≤ +10KB gz, rAF singleton — 성능 기준 유지.

### Negative

- `apps/builder/src/builder/components/icons/morph/core/` 1,470 LOC 의 vendoring 코드가 리포에 들어온다 — 리뷰 대상은 아니지만 upstream 갱신 절차를 지켜야 한다 (R1).
- chrome 아이콘 어법이 둘이 된다: 정적 = lucide-react 컴포넌트 (`ActionIcon`), 상태 = `StateIcon`. 리뷰 시 "상태가 있는데 삼항을 썼는가" 를 봐야 한다.
- 이식 테스트 (~120 케이스) 가 vitest 실행 시간에 더해진다 (순수 함수라 ms 단위).
- Preview / canvas 의 사용자 요소 `Icon` 은 그대로 즉시 교체 — 빌더 chrome 과 사용자 문서의 아이콘 동작이 달라진다 (의도된 범위 한정, breakdown §7).
