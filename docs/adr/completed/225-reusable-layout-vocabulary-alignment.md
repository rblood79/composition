# ADR-225: 재사용 레이아웃 어휘 정렬 — Frames 기능 표면을 Layouts로 통일

## Status

Implemented — 2026-09-19 (Accepted 같은 날 `/execute-adr 225` Phase 0~~4 / G0~~G6 종결)

사용자 요청으로 ADR-111 이후 남아 있는 재사용 레이아웃 기능의 `Frames` 명칭을
`Layouts`로 정렬하는 결정을 승인했고 (review round 1 MEDIUM 3 · LOW 2 수정, pending 0),
같은 날 구현을 종결했다. 실행 결과는 [Gates](#gates) 아래 `### Live Exercise` 와
[Phase 0 인벤토리](../design/225-reusable-layout-vocabulary-alignment-inventory.md) 에 있다.

## Context

Navigator의 사용자 모델은 `Pages / Layouts`이고 Properties는 `Layout Preset`을 사용하기
시작했지만, 같은 기능의 내부 소유 경계와 일부 사용자 문구에는 아직 `Frame`이 남아 있다.
대표적으로 `FramesTab/FrameList/FrameElementTree`, `canonicalFrameStore`의 선택 API,
`frameActions`, `FrameSlotsSection`, `navigator-frames`, `.frame-tree`, 그리고
`PageLayoutSelector`의 `No Frame / Apply Frame / Remove Frame`이 같은 재사용 페이지
레이아웃 기능을 서로 다른 이름으로 표현한다. 최초 잔여 후보 정규식은 46개 파일
(프로덕션 26, 테스트 20)로 재현됐다. rename 표의 store/action API와 대소문자 변형까지
포함해 재동결한 authoritative 기준선은 **49개 파일(프로덕션 27, 테스트 22)**이다.
차이 3개는 1.5배 범위 재확인 임계값보다 작다.

그러나 Composition의 모든 `Frame`이 이 제품 기능을 뜻하지는 않는다. canonical 문서의
`FrameNode`와 `type: "frame"`, Pencil import/export, page-frame binding은 저장 포맷의
실제 container 계약이다. Canvas의 기하학적 frame, `requestAnimationFrame`, `iframe`,
catalog의 `Frame` 컴포넌트도 각각 다른 의미를 가진다. 따라서 이 ADR에서 “남은 모든
사항”은 **재사용 레이아웃 기능이 소유한 모든 명칭**을 뜻하며, 전역 문자열 치환을
뜻하지 않는다. 완료 시 남은 `Frame` 용례는 예외 목록에 근거와 소유자가 있어야 한다.

### Domain과 SSOT 경계

주 변경 대상은 **D1/D2/D3 밖의 Builder chrome**이다. Navigator·Properties의 label,
description, title, aria-label과 내부 selection/action/section id를 Layout 계열로
정렬한다.

- **D1 RAC 출력 DOM/접근성 계약**: 변경 0. Builder chrome의 접근성 이름은 D1 component
  output 계약과 구분한다.
- **D2 component Props/API 계약**: 변경 0. Builder 내부 facade rename은 catalog Props/API
  변경이 아니며, canonical `FrameNode`는 D2가 아니라 document 저장 계약이다.
- **D3 catalog 시각 계약**: 변경 0. `.frame-tree`는 Builder chrome selector이므로 이름만
  바꾸고 theme/token, 크기, 색, 간격, Canvas/Preview 결과는 바꾸지 않는다.

`CompositionDocument`가 저장 정본이다. UI에서는 “페이지에 적용하는 재사용 Layout”으로
말하고, adapter 아래에서는 “`FrameNode`를 참조하는 binding”으로 말한다. 이 번역 경계를
숨기기보다 Builder facade와 canonical adapter 사이에서 명시한다.

### Hard constraints

| ID  | 계약                                                                                                                                                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HC1 | 사용자 노출·접근성 문구에서 재사용 레이아웃을 뜻하는 `Frame(s)` 0건. Navigator는 `Pages / Layouts`, Properties는 `Layout Preset`, page binding은 `No/Apply/Remove Layout`을 사용한다.                                                              |
| HC2 | Builder의 기능 소유 component/file/export/state/action/test 식별자를 `Layout` 계열로 정렬하고, 완료 시 미분류 `Frame` 후보 0건을 만든다.                                                                                                           |
| HC3 | `FrameNode`, `type: "frame"`, canonical/Pencil adapter, page-frame binding의 저장 계약과 JSON/DB/Pencil 직렬화는 byte-equivalent 의미를 유지한다. document·DB schema migration은 0건이다.                                                          |
| HC4 | Canvas/Preview/publish geometry와 component behavior 변화 0건, 신규 runtime dependency 0건, 정상 사용자 동작의 canonical mutation/history 증가 0건.                                                                                                |
| HC5 | 기존 사용자 작성 이름(`Frame 1` 등)은 콘텐츠이므로 자동 변경 0건. 신규 기본 이름만 `Layout N`을 유지한다.                                                                                                                                          |
| HC6 | 접힘 상태 승계는 hydrated `collapsedSections`에서 구 id를 제거하고 신 id로 치환하며 `activeFocusSection`도 같은 mapping을 적용한다. 승계 후 펼침→reload가 다시 접히지 않아야 한다. 이미 `layouts`인 tab/split key는 바꾸지 않는다.                 |
| HC7 | 완료 시 허용되는 `Frame`은 canonical/Pencil 포맷, Canvas geometry, browser cadence/iframe, catalog 고유명, 과거 ADR·design·증거와 명시적 비소스 probe에 한정한다. 현행 rule/research 문서는 변경 대상으로 분류하고 각 범주를 정적 gate로 고정한다. |

### 선행 결정과 분리 전제

[ADR-111](111-layout-frameset-pencil-redesign.md)은 reusable preset을 canonical
`FrameNode`로 구현한 **응용·실행 결정**이고, 이 ADR은 그 저장 모델을 바꾸지 않는
**후속 제품 어휘·Builder 소유권 정리**다. 2026-09-19 사용자가 “남은 모든 사항들을
Frames → Layouts로 변경할 ADR”을 명시 요청해 별도 ADR 작성을 승인했다.

분리 시 네 질문을 다음처럼 고정한다.

1. **base/응용**: canonical Frame schema가 기반이고 Layouts 제품 어휘가 그 위의 UI
   facade다. 이 ADR이 ADR-111의 prerequisite가 되지 않는다.
2. **schema 직교성**: 저장 schema에는 변화가 없으므로 specialization이나 신규 schema가
   아니다. Builder 명명과 canonical 명명 사이 번역만 명시한다.
3. **의존 방향 reverse 검증**: ADR-111의 `FramesTab` 명명 결론은 당시 Pencil schema
   정렬을 위한 것이었다. 그 구현을 보존하되 제품 어휘까지 Frame이어야 한다는 전제는
   승계하지 않는다.
4. **조기 검증**: 코드 inventory와 schema 보존 목록을 이 ADR의 Phase 0/G0에서 먼저
   동결하고, 구현 후 문자열 검색으로 범위를 뒤늦게 발견하지 않는다.

### 코드 근거

| 경로·심볼                                                                           | 확인 사실 / 설계 영향                                                                                                                                 |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/builder/src/builder/panels/navigator/FramesTab/`                              | 사용자에게 Layouts로 보이는 기능의 component·directory·test가 Frame을 소유한다. 변경 대상이다.                                                        |
| `apps/builder/src/builder/stores/canonical/canonicalFrameStore.ts`                  | `FrameNode` 판독과 `selectedReusableFrameId` UI 상태가 한 파일에 섞여 있다. UI facade는 Layout으로 정렬하되 내부 type guard는 Frame을 유지한다.       |
| `apps/builder/src/builder/stores/utils/frameActions.ts`                             | Navigator가 쓰는 CRUD facade다. public Builder action은 Layout으로 바꾸고 실제 생성 노드는 Frame으로 유지한다.                                        |
| `apps/builder/src/builder/panels/properties/editors/PageLayoutSelector.tsx`         | `No/Apply/Remove Frame`과 frame description이 현재 사용자에게 노출된다. D1 필수 변경 대상이다.                                                        |
| `apps/builder/src/builder/panels/navigator/navigatorSectionIds.ts`                  | collapse id는 `navigator-frames`/`navigator-frame-layers`, split key는 이미 `navigator-split:layouts`다. 전자는 상태 승계가 필요하고 후자는 유지한다. |
| `packages/shared/src/types/composition-document.types.ts` — `FrameNode`             | `type: "frame"`이 canonical 정본이다. 변경 금지 경계다.                                                                                               |
| `apps/builder/src/adapters/canonical/index.ts`, `apps/builder/src/adapters/pencil/` | reusable node 생성·선택과 `.pen` 왕복이 Frame schema를 소비한다. 변경 금지 또는 raw-boundary 명명 유지 대상이다.                                      |

### 외부 근거

2026-09-19 공식 문서 기준으로 확인했다.

- [Pencil `.pen` format](https://docs.pencil.dev/for-developers/the-pen-format)은 저장 노드
  type과 interface를 `frame`/`Frame`으로 정의한다. canonical/Pencil 경계의 Frame 보존
  근거다.
- [Pencil interface](https://docs.pencil.dev/core-concepts/pencil-interface)는 Frame을
  container로, layout을 그 안의 배치 behavior로 구분한다. 저장 객체명과 제품 과업명이
  같은 단어일 필요가 없음을 뒷받침한다.
- [Pencil components](https://docs.pencil.dev/core-concepts/components)는 frame을 포함한
  여러 node를 reusable component로 만들 수 있다고 설명한다. `reusable`과 `frame`을
  동의어로 전역 치환하면 안 되는 근거다.
- [Figma FrameNode API](https://developers.figma.com/docs/plugins/api/FrameNode/)도
  `FRAME` container가 layout hierarchy를 소유한다고 정의한다. 외부 포맷과 접하는 raw
  model에는 Frame 용어가 여전히 정확하다.

## Alternatives Considered

### 대안 A: 사용자 노출 문구만 Layouts로 유지

- 설명: 현재처럼 label·translation만 `Layouts`로 바꾸고 `FramesTab`,
  `selectedReusableFrameId`, `frameActions` 등 내부 식별자는 유지한다.
- 위험: 기술 **LOW** / 성능 **LOW** / 유지보수 **HIGH** / 마이그레이션 **LOW**
- 평가: 변경량은 작지만 검색 결과와 코드 리뷰에서 제품 feature와 raw schema를 계속
  구별하기 어렵다. 새 UI 문구가 다시 Frame으로 회귀할 가능성도 남는다.

### 대안 B: 기능 소유 UI·Builder 내부 식별자를 Layouts로 정렬하고 canonical Frame 계약은 유지

- 설명: 사용자 문구와 Builder feature facade는 Layout으로 바꾸고, facade 아래 raw
  canonical/Pencil boundary만 Frame으로 유지한다. 잔여 Frame은 범주별 allowlist로
  판정한다.
- 위험: 기술 **MEDIUM** / 성능 **LOW** / 유지보수 **LOW** / 마이그레이션 **MEDIUM**
- 평가: import rename과 persisted section id 승계가 필요하지만 저장 schema와 renderer를
  건드리지 않고 제품 어휘와 포맷 어휘의 경계를 코드 구조에 반영한다.

### 대안 C: canonical FrameNode까지 LayoutNode로 전면 변경

- 설명: `FrameNode`, `type: "frame"`, Pencil adapter와 page-frame binding까지 Layout으로
  바꾸고 import/export에서 다시 Frame으로 변환한다.
- 위험: 기술 **CRITICAL** / 성능 **MEDIUM** / 유지보수 **HIGH** / 마이그레이션 **CRITICAL**
- 평가: CompositionDocument/DB/Pencil 호환 migration과 이중 변환 계층이 필요하다.
  사용자에게 보이는 어휘를 고치기 위해 저장 정본을 흔드는 과잉 변경이다.

### Risk Threshold Check

| 대안 | HIGH 이상                  | 판정                                                              |
| ---- | -------------------------- | ----------------------------------------------------------------- |
| A    | 유지보수                   | split-brain 명명이 남아 HC2·HC7을 충족하지 못하므로 기각          |
| B    | 없음                       | 선택. rename 누락과 로컬 상태 승계 위험은 G0~G5로 관리            |
| C    | 기술·유지보수·마이그레이션 | CRITICAL 회피를 위해 schema를 보존하는 B를 대안으로 유지하고 기각 |

모든 대안이 HIGH인 상황은 아니다. C의 CRITICAL 위험 때문에 근본적으로 다른 B를 비교했고,
B는 제품 facade와 저장 model을 분리하여 위험 임계값 아래로 낮춘다. 이 범위를 다시
copy-only와 structural rename으로 나누면 같은 feature의 완료 기준이 둘로 갈라지므로
별도 ADR로 추가 분리하지 않는다.

## Decision

**대안 B를 선택한다. 재사용 페이지 레이아웃 기능의 사용자 표면과 Builder 소유
식별자는 `Layout(s)`로 통일하고, canonical/Pencil/container 계약의 `Frame`은 유지한다.**

변경 여부는 단어 자체가 아니라 소유 경계로 판정한다.

- “사용자가 재사용해 페이지에 적용하는 preset/구조”이면 Layout이다.
- “문서에 직렬화되는 container node, 그 node를 가리키는 raw adapter/binding”이면
  Frame이다.
- “Canvas 좌표 사각형, animation frame, iframe, catalog 고유 component”이면 이 ADR의
  feature 명칭이 아니므로 유지한다.
- 과거 ADR, changelog, evidence는 당시 사실 기록이므로 기계 수정하지 않는다. 현재
  문서에서 과거 경로를 가리켜야 할 때만 후속 명칭을 병기한다.

Builder 내부에서는 Layout-named facade가 `FrameNode`를 소비한다. 예를 들어 UI selection은
`selectedReusableLayoutId`, action은 `createReusableLayout`, 목록 projection은
`ReusableLayoutSummary`를 노출할 수 있지만, facade 내부 type guard와 canonical mutation은
계속 `FrameNode`와 `type: "frame"`을 사용한다. page binding adapter도 저장 계약을 정확히
표현하므로 `applyPageFrameBinding*` 이름을 유지하고 UI caller의 변수·문구만 Layout으로
정렬한다.

대안 A는 사용자 화면 일부만 고쳐 동일 기능의 소유권 검색과 회귀 방지를 해결하지 못해
기각한다. 대안 C는 외부 포맷과 canonical schema에 불필요한 migration을 도입하므로
기각한다. B의 rename 비용과 section state 승계 비용은 한 번이고, 이후 기능 코드와 raw
adapter의 경계가 더 명확해지는 이익이 지속되므로 수용한다.

> 구현 상세: [225-reusable-layout-vocabulary-alignment-breakdown.md](../design/225-reusable-layout-vocabulary-alignment-breakdown.md)

## Risks

| ID  | 위험                                                                              | 심각도 | 대응                                                                              |
| --- | --------------------------------------------------------------------------------- | :----: | --------------------------------------------------------------------------------- |
| R1  | `FrameNode`/Pencil/page binding까지 잘못 rename해 저장·왕복 호환이 깨짐           |  HIGH  | 변경 금지 경로와 schema snapshot·5개 `.pen` roundtrip을 G0/G3에서 고정            |
| R2  | component/directory/export rename 뒤 정적 import, mock, lazy boundary 일부가 끊김 | MEDIUM | feature import 0건 ratchet, 인접 static/runtime test와 typecheck를 G2/G6에서 실행 |
| R3  | 구 section id가 저장 상태에 남아 승계 후 펼친 section이 reload마다 다시 접힘      | MEDIUM | 구 id 제거·`activeFocusSection` 치환과 승계→펼침→reload를 G4에서 검증             |
| R4  | 전역 치환이 과거 ADR·evidence 또는 실제 geometry/cadence 용어를 오염시킴          | MEDIUM | 범주별 inventory/allowlist, 변경 파일 검토를 G0/G5에서 강제                       |
| R5  | PageLayoutSelector·aria/title·translation에 사용자 노출 Frame이 남음              | MEDIUM | ko/en 문자열·접근성 정적 검사와 foreground Builder 흐름을 G1/G6에서 검증          |

R1은 영향이 HIGH지만 `CompositionDocument`와 adapter를 명시적 비변경 경계로 두고 G3에서
직렬화 회귀를 차단한다.

## Gates

| Gate | 시점           | 통과 조건                                                                                                                                                                                                                      | 실패 시 대안                                                |
| ---- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| G0   | 구현 전        | 확장 정규식 기준 49개 파일(프로덕션 27, 테스트 22)을 `rename / canonical 보존 / platform·component 보존 / history 보존`으로 100% 분류하고 미분류 0건. rename 표의 공개 API와 대소문자 변형을 같은 ratchet에 포함               | inventory를 보강한 뒤에만 rename 시작                       |
| G1   | 문구 변경      | ko/en 문구·aria-label·title에서 재사용 레이아웃 의미의 Frame 0건. `No Layout`, `Select a reusable layout…`, formatted `Using "{name}" layout` 신규 key를 포함하고 ko-KR 부팅 probe에서 영어 residue 0건                        | 누락 key·formatted message·consumer 수정                    |
| G2   | 구조 변경      | `FramesTab/FrameList/FrameElementTree`, UI store/action/section의 구 feature import·export 0건; 신규 Layout facade를 모든 caller가 사용; typecheck와 인접 test 통과                                                            | 호환 facade를 최소 기간 두고 caller를 완료한 뒤 제거        |
| G3   | canonical 보존 | `FrameNode` schema·`type: "frame"`·DB JSON·page binding·Pencil 5 fixture import/export/roundtrip 의미 불변, document migration 0건, Canvas/Preview/publish 결과 불변                                                           | raw boundary rename 철회, facade 경계 축소                  |
| G4   | 로컬 상태      | hydration이 `navigator-frames`/`navigator-frame-layers`를 제거하고 새 id로 치환하며 `activeFocusSection`도 승계. old/new/both/none과 승계→펼침→reload 통과; split/editMode 유지; 사용자 이름 자동 변경 0건                     | 신 id rollout을 보류하고 version marker 또는 호환 read 추가 |
| G5   | 잔여 검색      | 확장 49-file ratchet에서 feature-owned 구 명칭·class·comment·test title 0건. 잔여 Frame은 allowlist 근거 보유. pre-225 ADR/design/evidence는 원문 유지, 현행 rule/research는 갱신, `.tmp-panel-cap`은 비소스 probe로 명시 제외 | 미분류 항목을 Phase 0 표로 되돌려 판정                      |
| G6   | 완료 전        | focused Vitest, `pnpm run codex:typecheck`, 범위별 preflight 통과. foreground Builder에서 생성→선택→page 적용→해제→삭제와 refresh 후 read-back, console warning/error 0                                                        | 실패 경로 수리 후 동일 gate 재실행                          |

### Live Exercise

**2026-09-19 · headed Playwright 로 실제 dev Builder (5173) 부팅 — `apps/builder/scripts/adr225-layouts-live.mjs` 16/16 PASS**
(round 2 m3 뒤 13 → 16: 내부 Layers 트리 · 분할 핸들 · Layout 적용 page geometry 추가, console warning 도 수집).
Chrome MCP 탭은 처음 `document.hidden=true` (RAF pause, 부트 95% 정지 — 메모리
`reference-chrome-mcp-hidden-tab-raf-pause-stale-overlay`) 라 headed Playwright 로 먼저 돌렸고, 사용자가 창을 앞으로 가져온 뒤
**foreground Chrome MCP 로 같은 날 재확인** (프로젝트 `new`, 사용자 참관 — 아래 표 뒤 절).

| #   | 시나리오 (새 프로젝트)                                                                          | read-back                                                                                                                                 |
| --- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `styles-panel-collapse` 에 구 id `navigator-frame-layers` 를 심고 부팅 → Navigator `Layouts` 탭 | `navigator-layout-layers` 절 `aria-expanded=false` (승계) · 펼친 뒤 persist 에 `navigator-frame*` 0 (G4)                                  |
| 2   | `Add Layout` (aria-label)                                                                       | IDB `document_parts` 의 canonical 노드 `{type:"frame", reusable:true, name:"Layout 1"}` 1 · 목록 `Layout 1`                               |
| 3   | 내부 트리 class                                                                                 | `.layout-tree` 2 · `.frame-tree` 0                                                                                                        |
| 4   | Pages 탭 → 페이지 body 선택 → Properties                                                        | 절 제목 `Layout` · legend `Apply Layout` · 옵션 `["No Layout","Layout 1"]`                                                                |
| 5   | `Layout 1` 선택                                                                                 | page binding id = frame 노드 id 의 uuid (`layout-<uuid>` 접두 그대로)                                                                     |
| 6   | `Remove Layout` (title `Remove layout from this page`) 클릭                                     | binding `null`                                                                                                                            |
| 7   | Navigator·Properties 의 텍스트 · aria-label · title · placeholder 전수 (15 + 31 문자열)         | `\bframes?\b` 0                                                                                                                           |
| 8   | `Delete Layout 1` → reload                                                                      | canonical reusable frame 0 · reload 후 0 (persist)                                                                                        |
| 9   | `composition-locale=ko-KR` 부팅 → 같은 흐름                                                     | 탭 `레이아웃` · `레이아웃 추가` · `레이아웃 적용` · 옵션 `레이아웃 없음` · `레이아웃 제거` / `이 페이지에서 레이아웃 제거` · 영어 Frame 0 |
| 10  | Layout 1 body → Properties `Layout Preset` 2-Row → Layers 트리                                  | `Slot: header` / `Slot: content` 2 · Slot 클릭 → 선택 = Slot(header) · body 접기 0 → 펼치기 2                                             |
| 11  | SectionSplitStack 분할 핸들 60px 드래그                                                         | `navigator-split:layouts` = 146 기록 · `navigator-split:pages` 무변경                                                                     |
| 12  | page 에 Button 추가 → Layout 1 적용 → Compare                                                   | Canvas layout map 69×30 vs Preview DOM 68×30 (Δ1, 반올림) · Preview y=60 (header slot 아래)                                               |
| 13  | 전 과정                                                                                         | pageerror 0 · console error/warning 0                                                                                                     |

**Foreground Chrome MCP (2026-09-19, 사용자 프로젝트 `new`, mobile breakpoint)**: 구 id `navigator-frame-layers` 를 심고
reload → Layouts 탭의 Layers 절 `aria-expanded=false` · `data-section-id^="navigator-frame"` 0 · persist 첫 set 뒤 구 id 0 →
`Add Layout` → `Layout 2` 자동 선택, Layers 펼침, Canvas 에 Layout 2 프레임 → Layout 1 선택 → 트리 body > Slot: header / Slot: content ·
Slot 선택 시 Canvas 342×60 선택 · body 접기 · 분할 핸들 드래그 → `navigator-split:layouts` 기록 → Properties 헤더 `Layout 2` ·
`Layout Preset` 2-Row 적용 → 슬롯 2 생성 (트리·Canvas 즉시) → Pages 탭 → Home body → `Layout / Apply Layout` 옵션
`No Layout / Layout 1 / Layout 2` → Layout 2 적용 → header slot 띠 + 콘텐츠 content slot 이동, `Remove Layout` · Slot Assignment 노출 →
Compare (CSS ↔ Canvas) Cancel 버튼 같은 y (141) · 30px 높이 양 leg → `Remove Layout` → 양 leg 복귀, binding null → `Delete Layout 2` →
IDB reusable frame `Layout 1` 만 → reload → `Layout 1` 만 · Layers 펼침 유지 · console error/warning 0 (tracking 켠 뒤 reload 포함).

- `Using "{name}" layout` / `Select a reusable layout for this page` 는 `PropertySelect.description` 으로 전달되는데 이 prop 은
  기존부터 렌더되지 않는다 (`PropertySelect.tsx` "not displayed") — 표시 동작을 바꾸지 않았고 (HC4) 카탈로그 등록은
  `adr225VocabularyRatchet.static.test.ts` 가 ko/en · formatted 함수로 잠근다.
- Undo: reusable layout CRUD 는 종전부터 history 에 기록하지 않는 canonical 직접 갱신이라 (ADR-111 그대로) 이 ADR 의 검증
  대상이 아니다. refresh 후 read-back 으로 대체했다. 이름 변경 UI 도 같은 이유로 범위 밖 (`updateReusableLayoutName` production
  caller 0 — rename 만) — breakdown §6 에 명시 (round 2 m3).
- round 2 (codex) MEDIUM 3 수리: m1 주석·테스트 제목의 UI 어법 13곳 + ratchet `LEGACY_FEATURE_COPY_PATTERN` · m2 인벤토리를
  tracked `docs/adr/design/…-inventory.md` 로 · m3 위 10~13 harness 확장. 판정: `docs/adr/reviews/225.md`.
- 자동화: 인접 Vitest (navigator 24 파일 155 · stores · properties editors · i18n · canonical static 등 88 파일 636) PASS ·
  전체 builder 6699 PASS / 실패 8 은 clean HEAD 에서 재현되는 선재 항목 (`canvasResizeEdit` 4 · `pageFrameBinding` 1 ·
  `g5LegacyFieldGrepGate` 1 · `actionIcons.static` 1 · `sharedActionVocabulary` 1) · `pnpm -F @composition/builder type-check` PASS.

## Consequences

### Positive

- 사용자 화면, 접근성 이름, Builder feature code가 같은 `Layouts` 어휘를 사용한다.
- `Layout` product facade와 `FrameNode` storage model의 경계가 검색·리뷰 가능한 구조가 된다.
- 신규 문구나 component가 다시 `Frames`로 회귀하는 것을 정적 gate로 막을 수 있다.
- canonical/Pencil 호환과 Canvas/Preview 동작을 건드리지 않고 명칭 debt를 끝낸다.

### Negative

- 저장 model과 제품 feature가 서로 다른 이름을 사용하므로 facade 경계에서 변환 의도를
  문서화하고 유지해야 한다.
- directory/export/mock/static test rename이 넓어 단순 copy 수정치고 변경 파일 수가 많다.
- persisted section id를 바꾸려면 일회성 로컬 상태 승계 코드와 회귀 테스트가 필요하다.
- 기존 사용자 작성 이름은 존중하므로 화면에 사용자가 직접 붙인 `Frame 1`은 남을 수 있다.
