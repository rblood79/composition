# ADR-192: Contextual Action Bar — 선택 컨텍스트 기반 온캔버스 액션 표면 (Photoshop 모델)

## Status

Implemented — 2026-08-27 (Phase 0~~4 완결, G1~~G3 PASS. Accepted 2026-08-27 — review-adr round 1 승인: MED 1·LOW 3 전부 fixed, 잔존 pending 0 — [reviews/192.md](../reviews/192.md))

> 출처: [ADR-016](016-photoshop-ui-ux.md) Superseded (2026-08-26) 의 유일한 미반영 기능. 016 §5.1~5.2 설계안 (신규 `builder/actions/` 계층 + 선택 bounds 부착 바) 은 **승계하지 않고** 리서치 ([ACTION_BAR_BENCHMARK.md](../../explanation/research/ACTION_BAR_BENCHMARK.md), 2026-08-26) 부터 다시 시작했다. fork lock-in 4 질문 + 사용자 confirm 기록: [breakdown §1](../design/192-contextual-action-bar-breakdown.md).

진행 로그:

- 2026-08-27 Phase 0 인벤토리 freeze · Phase 1 순수 계층 (vitest 18 + 182 회귀 31) · Phase 2 UI 마운트 + live 검증 (C0~C4 항목·컴포넌트 토글·다중 그룹·⋯ 메뉴·포커스 유지·`⌫`/`⌘Z`) — 결과 표와 범위 밖 관찰 2건은 [breakdown §4](../design/192-contextual-action-bar-breakdown.md). (`88f211a94` `74ecf36d8` `73d06d745`)
- 2026-08-27 Phase 3 배치 — 핸들 드래그·Pin·Reset·Hide·localStorage 영속·Settings 재표시 토글, live 전항 ✅ + G3 (zoom 왕복 DOM 변이 0) ✅ (`43f9f0eb4`). 같은 날 ADR-182 후속으로 `duplicateSelection` multiSelectMode 게이트 제거 (`af7303a0f`).
- 2026-08-27 Phase 4 종결 — M1 텍스트 편집 게이팅 live ✅ (Heading 더블클릭 → 바 미마운트 → Escape → 복귀), 옵션 메뉴 후 캔버스 포커스 복귀, `codex:preflight` PASS → Implemented.

## Context

**위상**: builder-system UI layer (ADR-182 컨텍스트 메뉴 · ADR-163 패널 구조와 동위상). 사용자 캔버스 컴포넌트의 SSOT 3-domain (D1/D2/D3) 체인과 무관하며 catalog/spec/Generator emit 확장 없음. 바 UI 자체는 빌더 내부 RAC (`Toolbar`/`Button`/`MenuTrigger`) 사용 — D1 권위는 RAC 가 갖는다.

### 문제 — 선택 의존 액션의 마우스 경로가 우클릭 하나뿐이다

2026-08-26 실측 (리서치 §4):

- ADR-182 이후 선택 요소에 적용 가능한 액션 14종 (복제 / 그룹·해제 / 정렬·분배 8 / 컴포넌트 토글 / 원본 이동 / 인스턴스 분리 …) 은 `canvasActions` + store 액션으로 단일화됐다. 마우스 진입점은 **단일 선택에서는 우클릭 메뉴 하나**다. 다중 선택 (2+) 에 한해 Properties 패널 상단 `MultiSelectStatusIndicator` (`PropertiesPanel.tsx:641-651`) 가 복사/붙여넣기/삭제/그룹/정렬 6/분배 2 버튼을 이미 노출한다 — 즉 Photoshop 형 "패널 Quick Actions" 의 다중 선택 절반은 존재하고, 단일 선택과 온캔버스 표면이 비어 있다. (리뷰 round 1 정정 — 초안의 "정렬은 패널 노출 없음" 은 182 breakdown §2 각주를 그대로 옮긴 오류. 단, 패널 쪽은 `alignElements` 유틸을 직접 호출해 `canvasActions.alignSelection` 과 경로가 갈린다 — 본 ADR 범위 밖 관찰.)
- 단축키 69개 (`canvas-focused` 27) 와 ⌘K 팔레트는 있으나 둘 다 **발견가능성이 0** 인 경로다 — 비전문가 대상 웹빌더 (composition 제품 방향) 에서 "선택하면 무엇을 할 수 있는지" 를 화면이 말해주지 않는다.
- 016 이 2026-02 에 같은 문제를 제기했으나 설계안이 (a) 182 와 중복되는 액션 계층 신설, (b) 선택 bounds 부착 + zoom/pan 추적 (TextEditOverlay 비용 구조를 상시 부담), (c) Figma UI3 가 2024~25 에 실증한 "이동·숨김 불가 플로팅" 함정 미고려 — 세 가지로 낡았다.

### 레퍼런스가 고정하는 사실 (리서치 §0·§5)

1. Photoshop Desktop/Web/Elements/Illustrator 4개 앱 공통: **캔버스 하단 중앙 플로팅, 선택과 무관한 위치**, 좌측 핸들 드래그, ⋯ 메뉴 (Pin / Reset / Hide), Window 메뉴 재표시, **적격 선택 없으면 바 자체가 사라짐**, 항목은 컨텍스트당 2~5.
2. Photoshop 은 같은 액션을 Properties 패널 Quick Actions 에 **미러** — 바는 단축 표면이지 유일 경로가 아니다.
3. Figma Design 은 선택 부착 바가 없다. UI2 상단 컨텍스트 도구를 UI3 가 서브메뉴/패널/⌘K 로 흩은 결과 "contextual tools should be visible, not hidden" 과 "플로팅 툴바가 캔버스를 가린다 (dock/이동/숨김 요청 188 답글, 공식 변경 없음)" 두 불만이 병존한다.
4. 두 레퍼런스 모두 바/툴바에 **Delete 를 두지 않는다**.

**Hard Constraints**:

1. **액션 논리 신규 0** — 바가 실행하는 것은 ADR-182 `buildCanvasContextMenuItems` 가 산출한 항목의 `run` 뿐. 바 코드에 store mutation 직접 작성 금지 (grep 게이트: `actionBar/` 안에 `useStore.getState().` mutation 호출 0).
2. **Skia 프레임 예산 무영향** — 바는 `selectedElementIds`·모드 플래그 변화에만 재렌더. 프레임 루프·`subscribeBounds`·pan/zoom 구독 0. 측정: 선택 불변 상태에서 pan/zoom 60프레임 동안 바 DOM 변이 0.
3. **캔버스 단축키 무손상** — 바 버튼 클릭 직후 `canvas-focused` scope 단축키 (⌘D / ⌫ / ⌘G 대표 3종) 가 캔버스에 적용. 기존 `keyboardShortcuts.test.ts` + live 로 확인.
4. **적격 없음 = 미마운트** — 빈 바·disabled 나열 금지. 항목 ≤5 + ⋯ (오버플로 = 182 메뉴 그대로).
5. **이동·고정·숨김·재표시 4계약** — 핸들 드래그 / Pin / Reset / Hide + SettingsPanel 재표시 토글. Figma UI3 불만 4종을 설계로 선차단.
6. **접근성** — RAC `Toolbar` (`aria-label`, 화살표 탐색) + `Button`. ARIA 수동 작성 0.
7. **상태 직교** — 영속 상태는 `canvasSettings` additive 3필드 (`hidden/pinned/offset`). canonical document·project data 무변경 → BC 영향 0 (사용자 0% / 재직렬화 0 파일).

**Soft Constraints**:

- 182 항목 `id` 가 두 표면의 계약이 된다 — `actionItem(id, …)` 리터럴 문자열로 안정 (`canvasContextMenuProviders.ts:252/274/286/298/313/328/348`, 리뷰 round 1 실측). 상수화 불필요.
- 텍스트 편집·드래그 세션 플래그가 store 에 노출돼 있어야 모드 게이팅이 selector 한 줄로 끝난다 (미노출 시 Phase 0 에서 노출 경로 1개 추가).
- 016 의 성공 지표 ("패널 이동 없이 주요 편집 50%") 는 계측 인프라가 없어 채택하지 않는다 — 완료 기준은 live exercise (§Gates).

## Alternatives Considered

### 대안 A: 선택 부착 플로팅 바 (FigJam 형 · 016 §5.2 원안)

- 설명: 선택 합집합 bounds 하단 8px 에 DOM 바를 붙이고 `getSceneBounds`/`subscribeBounds` + `viewportToScreenPoint` 로 zoom/pan 마다 위치 갱신. TextEditOverlay 와 같은 경로.
- 근거: FigJam 스티키 툴바 (선택 부착), 016 원안. Figma Design/Photoshop 은 채택하지 않음.
- 위험:
  - 기술: **M** — 선택이 화면 밖·부분 clip·페이지 하단 근접일 때 flip/clamp 규칙, 다중 선택 합집합 갱신, 드래그 중 바 추종 여부 등 위치 edge case 가 UI 본체보다 크다 (`renderCommands.ts:802` bounds 는 clip 미교차, hit bounds 는 교차 — 어느 쪽을 기준으로 할지부터 분기).
  - 성능: **M** — pan/zoom 프레임마다 DOM `transform` 갱신 (TextEditOverlay 는 편집 중에만 부담, 바는 선택 중 상시). HC2 위반.
  - 유지보수: **M** — 위치 계산이 Skia bounds 계약 변화 (ADR-916 후속 parity sweep) 에 결합.
  - 마이그레이션: L — 상태 없음.
  - 추가: 바가 선택 바로 아래의 **이웃 요소를 가린다** — Figma UI3 "gets in the way of elements" 불만의 선택 부착 판.

### 대안 B: Photoshop 형 하단 중앙 고정 플로팅 바 + 182 레지스트리 부분집합 (권장)

- 설명: `.workspace-overlay` 하단 중앙에 고정 마운트. 항목 = `buildCanvasContextMenuItems(surface:"canvas-element")` 결과에 allowlist·순서·cap 5 정책을 적용한 부분집합, ⋯ 는 182 메뉴를 그 자리에서 연다. 핸들 드래그 (기본 위치 기준 상대 offset) / Pin / Reset / Hide / Settings 재표시. 적격 0 → 미마운트, 텍스트 편집·드래그 중 숨김.
- 근거: Photoshop 4개 앱 공통 계약 (리서치 §1-2) + Photoshop 바↔Quick Actions 미러 (= 단일 액션 원천) + 182 provider 확장 계약 ("후속 표면은 provider 등록만으로 편입").
- 위험:
  - 기술: L — 신규 계산은 offset clamp 뿐. 항목 산출·실행·메뉴·아이콘·툴팁 전부 기존 코드.
  - 성능: L — 선택 변경 시에만 렌더. HC2 자동 충족.
  - 유지보수: **M** — 182 항목 `id` 를 allowlist 계약으로 삼으므로 182 쪽 id/조건 변경이 바 노출을 조용히 바꿀 수 있다 → 정책 테스트가 182 항목을 고정 (R1).
  - 마이그레이션: L — `canvasSettings` additive, 기본값 = 미이동·미고정·표시.

### 대안 C: 새 표면 없이 Properties 패널 "Quick Actions" 섹션 + ⌘K 강화 (Figma UI3 모델)

- 설명: 캔버스에 아무것도 띄우지 않고 우측 패널 상단에 같은 부분집합을 버튼 행으로 두고, CommandPalette 에 선택 의존 항목을 추가.
- 근거: Figma UI3 (패널 + Actions ⌘K), Photoshop 의 미러 절반.
- 위험:
  - 기술: L / 성능: L / 마이그레이션: L.
  - 유지보수: L.
  - **목적 불충족**: 패널 접힘·모달·Minimize 상태에서 소실, 캔버스 시선에서 벗어남 — Figma UI3 "visible, not hidden" 불만 그대로. 사용자 결정 (온캔버스 액션바) 과도 불일치.

### 대안 D: B + C 동시 (Photoshop 완전 모델)

- 설명: 바와 패널 미러를 한 ADR 에서.
- 위험: 유지보수 **M** (표면 2개 동시 도입) · 나머지 L. 미러는 바의 `buildActionBarItems` 를 재사용하면 후속 1 섹션 작업이라 **분리 비용이 0** — 한 ADR 에 묶을 이유가 없다.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 |   HIGH+ 개수    |
| ---- | ---- | ---- | -------- | ------------ | :-------------: |
| A    | M    | M    | M        | L            |        0        |
| B    | L    | L    | M        | L            |        0        |
| C    | L    | L    | L        | L            | 0 (목적 불충족) |
| D    | L    | L    | M        | L            |        0        |

루프 판정: HIGH 이상 없음 — 새 대안 추가 불필요. B 가 M 1개로 최소이며 목적을 충족한다.

## Decision

**대안 B: Photoshop 형 하단 중앙 고정 플로팅 바 + ADR-182 레지스트리 부분집합**을 선택한다.

선택 근거 (위험 수용):

1. 유지보수 M (182 항목 id 계약) 은 정책 단위 테스트가 182 항목 집합을 고정하면 **변경이 즉시 드러나는** 결합이다 — 조용한 발산이 아니라 시끄러운 실패로 전환된다 (R1/G1).
2. 레퍼런스 4개 앱이 같은 위치·이동·숨김 계약을 쓰고, 그 계약이 Figma UI3 가 실증한 불만 4종 (가림·dock 불가·숨김 불가·발견가능성) 을 전부 선차단한다.
3. 신규 코드는 정책(순수) + 렌더러 + 배치 훅 3층뿐이고, 액션·메뉴·아이콘·툴팁·단축키 표기는 전부 기존 것 — 016 원안 대비 액션 계층 1개가 통째로 사라진다.

핵심 정책 (상세 표는 breakdown §2~§3):

- **컨텍스트 6종**: C0 없음/body (미마운트) · C1 단일 일반 · C2 단일 frame · C3 단일 인스턴스 · C4 다중 · M1/M2 텍스트 편집·드래그 중 (숨김). 항목 ≤5 + ⋯.
- **배제**: Delete (레퍼런스 공통) · 복사/붙여넣기 · z-order (⋯ 로).
- **포커스**: 바 루트 `data-scope="canvas"` (`useActiveScope.ts:104` 판정 재사용) + (보조, RAC `Button` 지원 여부 Phase 2 실측 — 리뷰 round 1 에서 `@react-types/shared` 3.36.1 타입에 미발견) `preventFocusOnPress` — 캔버스 단축키 유지 (HC3).
- **배치 상태**: `canvasSettings.actionBar {hidden, pinned, offset}`; offset 은 기본 위치 기준 상대값 (리사이즈에 중앙 유지) + 마운트 시 clamp.
- **모드 교체 훅**: 182 `modeOverride` 와 같은 자리를 예약하되 v1 소비자 0 (Photoshop Type/Transform 컨텍스트는 비스코프).

기각 사유:

- **대안 A 기각**: HC2 (프레임 예산) 위반이 구조적이고, 위치 edge case 가 본체보다 크며, 선택 이웃을 가린다. 두 레퍼런스 중 Design 도구는 어느 쪽도 채택하지 않았다.
- **대안 C 기각**: 온캔버스 발견가능성이라는 목적 자체를 충족하지 못한다 (Figma UI3 불만 재현). 단, 그 절반은 **후속 미러 섹션**으로 흡수 (breakdown §6).
- **대안 D 기각**: 미러는 B 의 산출을 재사용하면 후속 1 섹션이라 동시 도입의 이득이 없고 표면 2개 동시 검증 비용만 남는다.

> 구현 상세: [192-contextual-action-bar-breakdown.md](../design/192-contextual-action-bar-breakdown.md) — fork lock-in(§1), 컨텍스트별 항목 정본(§2), 시스템 설계(§3), Phase 0~4(§4), 검증 체크리스트(§5), 비스코프(§6)

## Risks

| ID  | 위험                                                                                                                                                                                           | 심각도 | 대응                                                                                                                                                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 182 항목 `id`/노출 조건 변경이 바 노출을 조용히 바꿈 (allowlist 계약)                                                                                                                          |  MED   | `actionBarPolicy.test` 가 컨텍스트 6종의 기대 id 집합을 고정 — 182 변경 시 실패로 드러남. Phase 0 에서 id 안정성 실측, 불안정하면 상수화 1회 (G1)                                                                                                               |
| R2  | 바 버튼이 포커스를 가져가 캔버스 단축키 회귀 — `canvas-focused` scope 는 `document.activeElement` 가 `data-scope="canvas"` 이거나 캔버스 컨테이너 안일 때만 성립 (`useActiveScope.ts:100-106`) |  MED   | 1차: 바 루트에 `data-scope="canvas"` 부여 — 포커스가 바에 있어도 scope 유지 (기존 판정 경로 재사용). 2차: RAC `Button` `preventFocusOnPress` (타입 미확인 — Phase 2 실측, 미지원 시 생략). live 3종 (⌘D/⌫/⌘G) 게이트 (G2). 키보드 진입은 Tab 한정 + Escape 복귀 |
| R3  | 바가 페이지 하단 요소를 가림 (Figma UI3 사례)                                                                                                                                                  |  MED   | 드래그·Pin·Hide·Reset 4계약 (HC5) + 기본 위치 `bottom:16px` 가 CanvasScrollbar 와 겹치지 않도록 Phase 2 에서 실측 조정                                                                                                                                          |
| R4  | 영속 offset 이 뷰포트 축소로 화면 밖                                                                                                                                                           |  LOW   | 상대 offset + 마운트/리사이즈 clamp + Reset                                                                                                                                                                                                                     |
| R5  | 텍스트 편집·드래그 세션 플래그가 store 에 없어 게이팅 경로 추가 필요                                                                                                                           |  LOW   | Phase 0 실측 ④ — 미노출 시 훅 로컬 상태를 store 1필드로 승격 (additive)                                                                                                                                                                                         |
| R6  | E1 텍스트 편집 항목의 진입 predicate 가 dblclick 핸들러 내부에 묻혀 있어 재사용 불가                                                                                                           |  LOW   | Phase 0 실측 ② — 추출 비용이 크면 v1 에서 E1 제외 (breakdown §2 조건부)                                                                                                                                                                                         |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                        | 실패 시 대안                                                                               |
| ---- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| G1   | Phase 1 종료 | 정책 단위 테스트 (컨텍스트 6종 × 기대 id 집합 · cap 5 · body 필터 · 다중 토글 숨김) PASS + 182 기존 테스트 전부 PASS                             | id 상수화 후 재실행; 182 테스트 실패 시 바 쪽 정책만 수정 (182 무수정)                     |
| G2   | Phase 2 종료 | **live**: 4종 선택에서 항목이 breakdown §2 와 일치 / 빈 선택 미마운트 / 버튼 실행 / 클릭 직후 ⌘D·⌫·⌘G 캔버스 적용 / 드래그·텍스트 편집 중 비표시 | 포커스 회귀 시 클릭 후 캔버스 컨테이너 `focus()` 복귀 (`BuilderCanvas.tsx:1374` 기존 경로) |
| G3   | Phase 3 종료 | **live**: 드래그→리로드 위치 유지 / Reset / Pin / Hide→Settings 재표시. **성능**: 선택 불변 pan/zoom 60프레임 바 DOM 변이 0 (MutationObserver)   | 변이 >0 이면 selector 구독 범위 축소 (HC2 위반 상태로 Implemented 금지)                    |

## Consequences

### Positive

- 단일 선택에 대한 **두 번째 마우스 경로** (우클릭 외) 가 생기고, 정렬·분배 8종에 처음으로 **온캔버스** 진입점이 생긴다 (패널 진입점은 다중 선택 한정으로 기존).
- 182 레지스트리가 "후속 표면은 provider/빌더 재사용만으로 편입" 계약을 실제로 소비하는 첫 사례 — 액션 원천 단일성 (메뉴·단축키·바) 이 유지된다.
- Properties 패널 Quick Actions 미러 (후속) 가 같은 `buildActionBarItems` 로 1 섹션 작업이 된다.

### Negative

- `canvasSettings` 에 UI 배치 상태 3필드가 추가된다 (project data 아님).
- 182 항목 `id` 가 외부 계약으로 승격 — 182 쪽 리네임 시 바 정책 테스트를 함께 갱신해야 한다.
- 화면 하단 중앙 16px 띠를 바가 점유 — Hide 를 아는 사용자만 회수 가능 (Settings 토글로 재표시).
