# ADR-234: 상태 변형 = origin 의 instance · 목록 = slot 을 채운 instance 자식 — origin/instance/slot 의 뜻을 Pencil · RAC 에 맞춤

## Status

Implemented — 2026-09-23 (`/execute-adr 234` Phase 0~4 / G0~G5 같은 날 종결 — [실행 기록](../design/234-variant-instances-and-slot-filled-collections-breakdown.md#7-실행-기록)) · Accepted — 2026-09-23 (사용자 `/execute-adr 234`, Codex 리뷰 2 round 종결 후)

G4 는 사용자 판정 2단계로 닫았다 (2026-09-23): ① 같은 세션 A/B 미달 → "해석 증분화로 진행" (같은 문서 scene build 의 ref 해석 재사용 + 항목당 비용 절감, breakpoint 통과) ② 편집 조작 판정 = "이관 전 빌드 대비" → Tabs 세 조작 통과 · TagGroup 편집 두 조작 +2.3 / +2.6 ms (500 항목) 미달 → "예외로 기록 후 승격". 잔존 위험 R4 참조.

설계 요청: 사용자 (2026-09-23) — Pencil (`pencil-shadcn.pen`) 을 레퍼런스로 "origin, instance, slot 을 의도대로 사용이 안 되고 있다". 의도 (사용자 서술): ① `Tab Item/Active` = 컴포넌트 생성 (origin) ② `Tab Item/Inactive` = 그 origin 의 instance (스타일만 변경) ③ `Tabs` = 컴포넌트 생성, slot 에 Active · Inactive 등록 ④ `Tabs` instance 에서 slot 에 등록된 항목을 추가하면 빈 목록이 채워진다. Pencil `Tabs` 는 RAC Tabs 의 **TabList** 부분이다. "최종 active 환경을 origin 으로 만들고 나머지를 instance" · "그렇게 하면 RAC 의 근본 개념이 더 맞아진다" 는 판단 뒤 `/create-adr`. 범위 · 기존 items · 숨기기 방식은 AskUserQuestion 으로 확정 ([breakdown §1](../design/234-variant-instances-and-slot-filled-collections-breakdown.md#1-전제-확정-기록-fork-4-질문--사용자-confirm)).

## Context

### 문제

ADR-229 (Tag 항목) → 230 (상태 변형) → 233 (Tab 항목 · Radio) 이 "기본 모양을 읽어 그리고 상태 모양을 위에 겹치는" 모델을 이어 쌓았다. 그 결과 Components 페이지의 origin · instance · slot 이 Pencil 과 RAC 가 쓰는 뜻과 다르다.

- **변형이 instance 가 아니다.** 상태 · 항목 변형 31 개가 모두 기본 origin 의 복제본이다 (F1). 기본을 고쳐도 변형 노드는 옛 모양으로 남아 Components 페이지가 실제 결과를 보여 주지 못한다. 변형이 두 leg 에 닿는 값은 root 의 4 키뿐이라 (F3) 여백 · label 색 같은 상태별 편집은 조용히 무시된다.
- **slot 이 컨테이너가 아니다.** `slot` 을 "첫 칸 기본 · 둘째 선택" 역할 표로 쓰고, 목록 틀이 아닌 root 에 둔다 (F5). 목록은 `items` 데이터에서 만든 가상 행이고 (F6 · F7), instance 에서 항목을 추가하는 경로가 없다 (Tabs 는 "+" 숨김 — F8).
- **기반 결함**: 변형을 origin 의 ref 로 만들어도, 그 변형을 가리키는 instance (ref → ref) 는 두 leg 모두 해석이 끊긴다 (F9). canonical 노드에는 요소를 숨기는 필드가 없다 (F10).

Pencil 은 문서 전체가 한 규칙이다 (P1~P5): 가장 완성된 상태 = origin, 다른 상태 = 그 origin 의 reusable ref + 덮어쓰기 (`fill: []` · `enabled: false`), 목록 틀 = 빈 틀 + 추천 항목 slot, instance 가 항목 instance 를 자식으로 채운다. RAC 도 같은 구조다 — 상태가 바뀌어도 DOM 구조는 같고 `data-selected` 등 속성만 바뀌며, TabList · TagList 는 `<Tab id>` 정적 자식을 받고, `items` + render 함수는 데이터 목록 경로다.

### 3-Domain

- **D3 (시각)**: 상태별 모양의 정본 = 변형 노드의 덮어쓰기. 두 consumer (Skia · DOM) 가 같은 덮어쓰기를 겹친다.
- **D1 (RAC, 관찰만)**: 목록 틀의 정적 자식 (`<TabList><Tab id>`) · Tab ↔ TabPanel `id` 짝 · render props (`isSelected` · `isHovered` · `isPressed` · `isFocusVisible` · `isDisabled`) 를 그대로 쓴다. DOM 구조 재작성 없음.
- **D2**: 새 컴포넌트 prop 없음. `enabled` 는 canonical 문서 필드 (Pencil format 과 같은 이름) 이지 RAC/RSP prop 이 아니다.
- **선행 결정과의 관계**: 066 (Tabs `items` 정본) 을 **정적 목록에 한해** 역전, 148 · 229 · 233 의 "slot = 템플릿 역할 표" 와 230 의 "변형 = 복제본 + 관리 키 overlay + CSS 변수 채널" 을 대체한다. 데이터 바인딩 목록 (`items` + 템플릿) 은 유지.

### 코드 사실

Pencil 실측 P1~~P5 · 코드 사실 F1~~F13 (경로:라인) 은 [breakdown §2 · §3](../design/234-variant-instances-and-slot-filled-collections-breakdown.md#2-레퍼런스-실측--pencil-pencil-shadcnpen-2026-09-23).

### Hard constraints

- **시각 결과 보존 이관**: 기존 문서를 열었을 때 Canvas 픽셀이 이관 전과 같다 (변형 31 · 정적 목록 · 바인딩 목록). 재hydration Δnode · Δbyte 0. 보존 대상은 저장된 raw 객체가 아니라 **이관 전 consumer 가 실제로 그린 유효값**이다 — 230 overlay 가 무시하던 변형의 관리 키 밖 값 (padding 등) 은 이관에서 버리고 새 모델에서 켜지 않는다 (review round 1 h1).
- **사용자 편집 보존**: instance 의 `descendants` 편집은 이관 후에도 같은 자식에 닿는다. 사용자가 이미 ref 하는 origin 의 id 와 그 자식 id 는 바꾸지 않는다 (review round 1 h2).
- **BC 수식**: 문서당 변형 31 노드 재직렬화 (복제본 → ref + diff, 크기 감소) + 정적 목록 1개당 항목 `n` → ref 자식 `n` (항목당 추정 150~250 B, Phase 0 실측 확정) + slot 필드 이동 4. 바인딩 목록 · 사용자 저작 노드 Δ0 — 예외는 변형 노드를 **직접** ref 한 사용자 노드뿐이며 그 노드는 `ref` 대상 교체 + `descendants` 키 재매핑만 받는다 (건수는 Phase 0 실측, Δbyte = Σ(새 키 길이 − 옛 키 길이)).
- **성능**: `scene.build` p95 증가 ≤ +1 ms (Tabs 100 × 5 · TagGroup 100 × 5 fixture, 233 G3 조건 계승). Preview 상태 전환 (hover) 은 RAC 가 이미 하는 재렌더 범위 안.
- **RAC 계약**: 선택 · hover · pressed · focus · disabled 는 RAC 가 실행 중에 정한다 — 작성자가 상태 변형을 골라 두는 방식 (Pencil) 을 실행 결과에 쓰지 않는다. Canvas 는 selected · disabled 만 (hover/pressed/focus 는 Preview 소관 — ADR-150 A1 철회 판정).
- **ref 체인**: 순환 · 깊이 초과는 broken ref 와 같은 경고 경로로 막는다. 편집이 체인 끝 instance 에 반드시 닿는다 (캐시 무효화).

### Soft constraints

- Components 페이지 = 테마 자리 (데이터 바인딩 없음, 09-21 사용자 판정) 유지.
- Preview iframe / Compare Mode 는 사용자 지시 (09-22) 가 풀리기 전까지 live 검증에 쓰지 않는다 — renderer unit + 사용자 확인.
- publish 는 기능 링크 방침 — `enabled` 존중만.

## Alternatives Considered

### 대안 A: Pencil 모델 전면 — 변형 = origin 의 reusable ref, 목록 = slot 을 채운 instance 자식 (ref 체인 · `enabled` 도입)

- 설명: origin = 가장 완성된 상태 (선택 가능한 가족은 선택 상태). 다른 상태 = origin 의 `reusable` ref + 어떤 키든 덮어쓰기 (props · style · fills · descendants · `enabled`). 두 leg 가 유효 상태로 그 덮어쓰기를 겹친다 (Canvas scene · Preview RAC render props). slot 은 목록 틀 (TabList · TagList · ListBox · GridList · Menu) 에 추천 항목 목록으로 두고, instance 는 항목 instance 를 자식으로 채운다 ("+"). 정적 `items` 는 자식으로 1회 이관, 데이터 바인딩 목록은 `items` + 항목 origin 템플릿 유지. 해석기 두 곳에 ref 체인 · schema 에 `enabled`.
- 근거: Pencil 문서 전체 규칙 (P1~P5) · RAC collection (정적 children / `items` + render) · RAC render props 상태 모델. Figma 의 variant (component set 안 변형들이 같은 구조 + 속성별 덮어쓰기) 도 같은 방향.
- 위험: 기술 **H** (ref 체인 두 해석기 + 캐시 · Preview 상태 채널을 RAC render props 로 교체 — wrapper 5종) / 성능 M (정적 목록 실제 노드화) / 유지보수 L (규칙 하나로 수렴, 230 채널 · 233 우회 제거) / 마이그레이션 **H** (변형 re-root · items → 자식 이관을 시각 보존으로)

### 대안 B: 변형만 ref 로 — 목록은 `items` + 템플릿 유지

- 설명: 변형을 origin 의 ref + 덮어쓰기로 바꾸고 (ref 체인 · 관리 키 제한 폐지 포함) slot 역할 표 · `items` 가상 행은 그대로 둔다.
- 위험: 기술 M / 성능 L / 유지보수 M (변형은 Pencil 모델 · 목록은 템플릿 모델, 두 뜻 공존) / 마이그레이션 M
- 한계: 사용자 의도 ④ (instance 에서 항목 추가) 를 만족하지 못한다. slot 의 이중 의미 (233 round 3 m2 원인) 가 남는다.

### 대안 C: 상태 덮어쓰기를 origin 노드 안에 — `states: { selected: patch, … }`

- 설명: 변형 노드를 따로 두지 않고 origin 에 상태별 patch 를 싣는다 (CSS 상태 규칙 · Figma variant property 에 가까움). ref 체인 불필요.
- 위험: 기술 M / 성능 L / 유지보수 M (Pencil import 의 변형 노드를 patch 로 변환하는 층 필요) / 마이그레이션 M
- 한계: Components 페이지에 변형 노드가 보이지 않아 사용자가 말한 "② Inactive = origin 의 instance" 를 직접 편집할 수 없다. 목록 문제 (④) 는 여전히 별도.

### 대안 D: 현행 유지 + 관리 키 확대

- 설명: 230 overlay 에 관리 키 (padding 등) 와 자식 키를 추가하고, 233 round 3 처럼 slot 을 Tabs 마다 해석한다.
- 위험: 기술 L / 성능 L / 유지보수 **H** (키마다 두 leg 채널 추가 · 복제본 drift 는 그대로) / 마이그레이션 L
- 한계: 사용자 의도 ②·④ 모두 불충족.

### Risk Threshold Check

| 대안 | HIGH+                   | 판정                                                              |
| ---- | ----------------------- | ----------------------------------------------------------------- |
| A    | 기술 H · 마이그레이션 H | 사용자 의도 4단계 모두 충족 — HIGH 는 Gate (G1 · G2 · G5) 로 관리 |
| B    | 없음                    | 의도 ④ 불충족                                                     |
| C    | 없음                    | 의도 ② (변형 노드 편집) · ④ 불충족                                |
| D    | 유지보수 H              | 의도 ②·④ 불충족                                                   |

모든 대안이 HIGH 인 것은 아니므로 새 대안 루프는 필요 없다. HIGH 가 없는 B · C 는 사용자가 확정한 의도 (범위 "전부") 를 채우지 못해 기각하고, A 의 HIGH 는 수용 근거와 Gate 로 관리한다.

## Decision

**대안 A.** origin · instance · slot 을 Pencil 과 RAC 가 쓰는 뜻으로 되돌린다.

- **변형 = origin 의 instance**: origin 은 가장 완성된 상태 (Tab · Tag · ListBoxItem · Checkbox · Radio · Switch · ToggleButton = 선택 상태 · Button · Link = 기본 상태). 다른 상태는 origin 의 `reusable` ref + 덮어쓰기 — 키 제한 없음 (props · style · fills · descendants · `enabled`). 상태 이름은 `metadata.variant` 로 유지하고 소속은 `ref` 가 말한다. 선택 가능한 가족은 휴지 상태 변형 `unselected` 를 둔다.
- **상태 → 변형 적용**: RAC 가 켠 상태들의 덮어쓰기를 정해진 순서 (unselected → selected → focus-visible → hover → pressed → disabled, 뒤가 이김) 로 겹친다. 전체 층 순서는 root 와 descendants 모두 **origin → (instance 가 변형 노드를 직접 ref 했으면 그 변형 patch — 상속 층) → 실행 중 상태 변형 patch → instance 자기 patch (최종)** 이다. instance 가 직접 저장한 키 (root props · style · fills · 자기 `descendants` 항목) 는 어떤 상태에서도 이긴다 — 230 의 "instance 명시 > 상태" 규칙 계승. 상속으로 얻은 값 (중간 ref · 직접 ref 한 변형의 patch) 은 실행 중 상태에 진다 — 작성자가 고른 변형이 RAC 상태 결과를 이기지 않는다 (review round 1 m4). Canvas 는 selected · disabled, Preview 는 RAC render props (`style`/`className` 함수 + 자손에 상태 전달) 로 다섯 상태 모두. 230 의 `<style>` · `--co-*` 채널과 233 round 3 의 `INDICATOR_FILL_CSS_VAR` 우회는 대체 후 제거.
- **목록 = slot 을 채운 instance 자식**: slot 은 항목을 직접 담는 목록 틀에 추천 항목 origin 목록으로 둔다. 컨테이너 instance 는 항목 origin 의 instance 를 자식으로 갖고, Slot "+" 가 그 instance 를 넣는다 (Tabs 는 Tab `id` 로 TabPanel 을 짝지어 함께). Canvas 는 실제 자식을, Preview 는 RAC 정적 children 을 그린다.
- **데이터 바인딩 목록**: `items` + 항목 origin 템플릿 (RAC `items` + render 함수) 유지 — 행마다 같은 변형 규칙.
- **기반**: 두 해석기에 ref 체인 (순환 · 깊이 가드 · 캐시 키) · canonical `enabled?: boolean` (두 leg · 레이아웃 · descendants patch · publish 존중). 값의 뜻 = **부재: 상속 (체인 끝까지 부재면 표시) · `false`: 숨김 · `true`: 상속된 숨김을 풀고 표시**. 조상이 숨겨지면 자식의 `true` 와 무관하게 subtree 전체가 빠진다 (review round 1 m3). patch 의 값 `null` 은 "이 키를 지운다" (patch 끼리 합칠 때는 보존하고, 해석이 끝난 값에 적용할 때 키 제거 → catalog 기본값 — review round 2 h1), `fills: []` 는 "채움 없음" 명시, 키 부재는 상속 — 이관이 origin 에만 있는 값을 되돌릴 수 있게 하는 표기다 (review round 1 h1).
- **이관**: 변형 복제본 → ref + diff. diff 는 raw 객체 차분이 아니라 **유효값 차분** — 목표 (이관 전 그 상태가 그려진 유효값) 와 새 origin 유효값을 비교해 다른 키는 값, origin 에만 있는 키는 `null`, fills 부재 차이는 `[]` 로 적는다. 선택 가능한 가족은 **사용자가 ref 하는 기존 origin 노드 (id · 자식 id 유지) 의 내용을 선택 상태로 다시 쓰고**, 기존 기본 모양은 새 `unselected` 변형의 diff 로 보존한다. 옛 복제본 자식 id → origin 자식 id 대응표 (구조 경로 · slot 역할로 매칭) 로 변형을 직접 ref 한 노드의 `descendants` 키 (root ref · 중첩 ref · descendants 안 ref) 를 옮기고, 대응이 없는 경로가 하나라도 있으면 그 가족은 이관을 통째로 보류한다. 정적 `items` → 항목 instance 자식 · slot root → 목록 틀. 모두 시각 결과 보존.

위험 수용 근거: 기술 H 두 곳 (ref 체인 · Preview 상태 채널) 은 Phase 0 에서 진단 RED 로 먼저 고정하고 각 Phase 가 GREEN 으로 닫는다 — 한 wrapper 가 render props 로 상태를 자손에 못 넘기면 그 컴포넌트만 230 채널로 남기고 보고한다 (breakdown §6). 마이그레이션 H 는 이관 전후 Canvas 픽셀 동일 (G5) 을 가족별로 통과해야 적용하며, 실패한 가족은 이관을 보류한다. 새 해소 경로는 ref 체인 하나이고, 나머지는 기존 ref 해석 · descendants 3-mode · 229 조합 자식 ref 규칙 (F11~F13) 을 쓴다. 기각 사유: B 는 의도 ④ (instance 에서 항목 추가) 를 못 채우고 slot 이중 의미가 남는다 · C 는 변형 노드를 직접 편집할 수 없고 목록 문제가 별도로 남는다 · D 는 복제본 drift 를 키마다 채널을 늘려 막는 방식이라 유지보수 부담이 계속 커진다.

> 구현 상세: [234-variant-instances-and-slot-filled-collections-breakdown.md](../design/234-variant-instances-and-slot-filled-collections-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                    |  심각도  | 대응                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------: | -------------------------------------------------------------------------------------------------------------------------- |
| R1  | ref 체인 — 두 해석기 (`resolvers/canonical/index.ts:144,170` · `canvasSceneNode.ts:2905`) 의 캐시가 체인 master 변경을 놓쳐 편집이 체인 끝 instance 에 안 닿는다 · 순환 | **HIGH** | G1 — 두 leg unit (편집 전파 · 순환 · 깊이) + live                                                                          |
| R2  | Preview 상태 채널 교체 — internal wrapper (Tabs · TagGroup · ListBox · GridList · Menu) 가 RAC render props 를 자손 (label) 까지 못 넘긴다                              | **HIGH** | G2 — wrapper 별 renderer unit, 실패 컴포넌트는 230 채널 유지 + 보고                                                        |
| R3  | 이관 — 변형 re-root · `items` → 자식 · slot 이동이 기존 문서 모양을 바꾼다                                                                                              | **HIGH** | G5 — 가족별 이관 전후 Canvas 픽셀 동일 + 재hydration Δ0, 실패 가족 보류                                                    |
| R4  | 정적 목록 실제 노드화로 `scene.build` · resolver 비용 증가                                                                                                              |   MED    | G4 A/B                                                                                                                     |
| R5  | 목록 쓰기 경로 (팔레트 · factory · AI tool · Pencil import · 붙여넣기) 중 일부가 계속 `items` 를 써 정적 목록이 두 모양으로 갈린다                                      |   MED    | Phase 0 쓰기 경로 표 · G3 에 경로별 unit                                                                                   |
| R6  | `enabled` 를 모르는 소비자 (레이아웃 · 선택 · Layers · publish) 가 숨긴 요소를 그리거나 선택한다                                                                        |   MED    | G1 소비자 목록 unit                                                                                                        |
| R7  | 233 round 3 의 `INDICATOR_FILL_CSS_VAR` · 230 CSS 채널 제거 시 Preview 회귀                                                                                             |   MED    | G2 에서 대체 전후 renderer 결과 대조 후 제거                                                                               |
| R8  | 이관 diff 가 origin 에만 있는 값을 되돌리지 못하거나 (raw diff), 변형 자식 id 교체로 사용자 `descendants` 편집이 떨어진다 (review round 1 h1 · h2)                      | **HIGH** | 유효값 diff + `null` 표기 · origin id 유지 + 자식 id 대응표 — G1 표기 unit · G5 부재 보존 · 편집 보존, 대응 없는 가족 보류 |
| R9  | 상태가 geometry (padding · 자식 표시) 까지 바꾸면서 layout cache 서명이 상태를 모르면 형제 위치가 옛 상태로 남는다 (review round 1 l5)                                  |   MED    | G2 형제 위치 unit · G4 전체 비용                                                                                           |

R4 잔존 (Implemented 시점, 사용자 판정 2026-09-23 "예외로 기록 후 승격"): 정적 TagGroup 500 항목의 편집 (선택 · 휴지 모양) 이 이관 전 빌드보다 `scene.build` p95 +2.3 / +2.6 ms (항목당 ≈5 µs — 항목마다 root · label 노드 생성). Tabs 는 +0.7 / +1.0 · breakpoint 는 두 가족 모두 이관 전보다 빠르다 (−1.5 · −1.8). 재개 조건: 실제 문서에서 정적 목록 편집의 체감 저하 보고.

## Gates

| Gate | 시점    | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 실패 시 대안                                 |
| ---- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| G0   | Phase 0 | P1~~P5 · F1~~F13 재확인 · 진단 RED 6 (ref 체인 두 leg · 변형 padding/label 무시 · TabList instance 자식 무시 · `enabled` 무시 · raw diff 가 origin 전용 값을 되살림 · 변형 자식 id 교체로 `descendants` 편집 유실) · 목록 쓰기 경로 표 · 이관 수식 실측 (항목당 byte) · 변형 유효값 · 변형 직접 ref 수 · 자식 id 대응표 · 기존 문서의 `null` patch 값 0                                                                                                                                                                | 사실 불일치 → 본문 개정 후 재승인            |
| G1   | Phase 1 | unit (원복 RED): 두 해석기 체인 해석 · origin 편집이 체인 끝 instance 에 전파 (캐시) · 순환/깊이 경고 · `enabled:false` 가 Canvas · Preview · 레이아웃 · 선택 · publish 에서 빠짐 · 상속된 `false` 를 체인 끝 `true` 가 풀고 조상 숨김은 못 풂 · patch `null` = 키 제거 · 중첩 patch 합성 (안쪽 값 → 바깥 `null`) 뒤에도 원본 값이 되살아나지 않음 (두 leg) · `fills: []` = 채움 없음 · 필드 부재 문서 Δ0                                                                                                              | Phase 1 롤백                                 |
| G2   | Phase 2 | 변형 31 이 ref + diff · origin 편집 → Components 변형 노드 동시 반영 (Skia 픽셀) · 변형의 padding · label 색 편집이 해당 상태에만 (두 leg — Canvas scene · Preview renderer unit, wrapper 5종) · 상태 겹침 순서 + instance 자기 patch 가 모든 상태를 이김 (root · descendants, 230 `stateVariantResolution.test.ts` 명시 color/opacity 보호 계승) · 상태가 바꾼 padding 이 형제 위치 · hit 영역까지 (layout cache 무효화) · 230/233 채널 제거 전후 대조                                                                | 실패 wrapper 는 230 채널 유지 + 보고         |
| G3   | Phase 3 | slot 이 목록 틀 · Slot "+" → 항목 instance (Tabs 는 + TabPanel 짝) · 정적 목록 두 leg 가 자식을 그림 · 바인딩 목록 무변경 · 쓰기 경로별 unit                                                                                                                                                                                                                                                                                                                                                                           | 해당 컨테이너 보류                           |
| G4   | Phase 4 | 같은 세션 headed A/B — 대조 arm = 이관 전 모델 (items 가상 행 · 복제본 변형) · 실험 arm = 234 모델, 같은 fixture (합성 = 규모 전용: Tabs 100×5 · TagGroup 100×5) · 불리 조작 3 (항목 origin 편집 = 전 instance 무효화 · 변형 편집 · breakpoint 전환) · warm-up 3 · 보이는 페이지 1개 · DPR 고정 · visibilityState visible · `scene.build` 라벨 7회 p95 median Δ ≤ +1 ms (보조 기록: `layout.publish` · `render.frame` · Preview commit 시간 — 게이트 아님) · Preview hover 재렌더 수가 RAC 기본 (대조 arm) 대비 증가 0 | 자식 노드화 캐시 가설 재측정, 못 닫으면 보고 |
| G5   | Phase 4 | BC: 가족별 이관 전후 Canvas 픽셀 동일 — oracle = 이관 전 빌드 arm 이 같은 문서를 그린 픽셀 (변형 · 정적 목록 · 바인딩 목록, 사람이 만든 문서 + seed 문서) · origin 에만 있는 style 키가 이관 후 새로 나타나지 않음 (h1 반례) · 변형을 직접 ref 한 instance 의 `descendants` label 편집이 이관 후 같은 자식에 남음 (h2 반례) · Δbyte 수식 일치 · 재hydration Δ0 (unit + IndexedDB 저장 층 live)                                                                                                                         | 실패 가족 이관 보류                          |

G4 판정 (2026-09-23): 위 문구의 같은 세션 A/B 는 미달 (Δ +2.2~+4.9) → 해석 증분화 1단계 뒤 breakpoint 통과 · 편집 +2.3~+3.3 → 편집 판정을 이관 전 빌드 대비로 (사용자 판정) → Tabs 통과 · TagGroup 편집 +2.3 / +2.6 미달을 예외로 기록 (R4 잔존). 수치 · 조건: [breakdown §7 G4](../design/234-variant-instances-and-slot-filled-collections-breakdown.md#phase-4--g4-성능-ab-2026-09-23).

### Live Exercise

실제 builder (dev 서버 · headed Playwright · 새 프로젝트, Compare Mode · Preview iframe 미개방 — 사용자 지시) 에서 Skia layout · store · IndexedDB 로 확인했다 (2026-09-23).

- `adr234-live-exercise.mjs` 5/5: 항목 origin 편집 (Tab/Default paddingLeft 12 → 24, 영향 대화상자 적용) → Components origin · 휴지 변형 · 문서 Tabs instance 의 Tab 폭 모두 +12 · 휴지 변형 편집 → 선택 안 된 Tab 만 · 문서 instance TabList Slot "+" → Tab 3 + TabPanel 짝 (descendants mode C) · reload 그대로 · page error 0.
- `adr234-live-list-instance.mjs` 5/5: ListBox · GridList · Menu 문서 instance 선택 → Slot "Insert <항목>/Default" → instance 자기 자식 항목 (ListBox · GridList 는 Canvas 행, Menu 는 popover) · reload 그대로 · page error 0.
- `adr234-g5-bc-live.mjs`: 이관 전 빌드 (`66480f5e0` worktree) 가 저장한 문서를 IndexedDB 로 옮겨 reload → 가족별 Canvas 픽셀 대조 (ListBox · GridList · Menu · Button 변형 · Checkbox/Switch/Radio Δ0, Tabs gap 8 · 항목 템플릿 origin 모양은 의도된 대칭 수리) · 재hydration Δ0.
- live 에서 잡은 결함 3 (수리): mode C 자식 `sourceNode` 누락으로 캔버스 갱신 정지 · ListBox · GridList · Menu instance 에 Slot 절 없음 · 정적 Tag leading icon/avatar 크기.
- 해석 증분화 뒤 (`dc29a3183`): 위 두 하니스 다시 5/5 · 5/5 · `adr234-g4-perf-ab.mjs` 의 origin · 변형 편집과 breakpoint 전환 각 21회 이상이 모두 scene 재구성 (rebuilt 7/7) · page error 0 — 이관 전 빌드 대비 비교 포함.

## Consequences

### Positive

- origin 을 고치면 Components 페이지의 모든 변형과 문서의 instance 가 함께 바뀐다 — Components 페이지가 실제 결과를 보여 준다.
- 상태별로 여백 · 자식 · 표시 여부까지 바꿀 수 있다 (관리 키 4 제한 폐지).
- Tabs · TagGroup · ListBox · GridList · Menu 에서 instance 가 Slot "+" 로 항목을 직접 추가하고, 항목마다 label · 아이콘 · 표시를 바꿀 수 있다.
- Pencil 문서 (변형 = ref · slot 채움) 를 모양 그대로 가져올 수 있다.
- 230 CSS 변수 채널 · 233 fill 우회 · slot 역할 표 해석기 3종이 사라지고 규칙이 하나로 모인다.

### Negative

- 저장 스키마에 `enabled` 필드가 추가되고, 모든 기존 문서가 한 번 이관된다 (변형 31 · 정적 목록).
- 정적 목록 (자식) 과 데이터 바인딩 목록 (`items` + 템플릿) 두 경로가 공존한다 — RAC 의 두 collection 경로와 같지만 쓰기 경로마다 구분이 필요하다.
- 선택 가능한 가족의 origin 이 선택 상태로 바뀌어, 사용자가 알던 "기본 = 미선택 모양" 이 `unselected` 변형으로 옮겨 간다.
- ADR-066 · 148 · 229 · 230 · 233 의 일부 결정이 대체된다 — 해당 본문에 안내가 필요하다.
