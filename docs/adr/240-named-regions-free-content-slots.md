# ADR-240: 이름 영역 · 자유 내용 slot — Card · Dialog · Popover · Tooltip instance 의 영역 채우기

## Status

Proposed — 2026-09-24

설계 요청: 사용자 (2026-09-24) — RAC 조사 후보 중 남은 항목 "설계부터 하자" → 사용자 판정 3 ADR 분리 (239 Tree · **240 이름 영역** · 241 Table). 전제 기록: [breakdown §1](design/240-named-regions-free-content-slots-breakdown.md#1-전제-확정-기록-fork-4-질문--사용자-confirm).

## Context

### 문제

RAC 와 composition 조합에는 **고정 영역** 을 가진 컨테이너가 있다 — Dialog 의 제목 · 내용 · 닫기 (R1), Popover · Tooltip 의 자유 내용 (R2), composition Card 의 preview · header · content · footer (R5). [ADR-148](completed/148-reusable-slot-system-unification.md) 이 영역 어휘 (`header` · `content` · `footer` · `preview` · `action`) 를 정했고 234 가 instance slot 채우기 (`descendants[path].children`, mode C — F2) 와 그 UI (F3) 를 만들었지만, 둘이 이어지지 않았다.

1. **Card** — 영역 자식은 `slotRole` 만 있고 `slot` 배열이 없어 (F5) Slot 채우기 절이 Card instance 에서 비어 있다. instance 는 `{title}` · `{description}` 글자만 바꿀 수 있다.
2. **Dialog** — 영역 표시도 내용 컨테이너도 없다 (F6). instance 에 내용 (입력 필드 · 버튼) 을 더할 자리가 없다.
3. **Popover · Tooltip** — 자유 내용 컨테이너인데 (R2) slot 이 없다 (F8).
4. **채우기가 reusable ref 만** — Slot 채우기 UI 는 origin ref 만 넣는다 (F3). 영역의 뜻 (자유 내용) 은 글자 · 이미지 같은 primitive 를 요구한다.

고정 부품과 영역을 섞으면 안 된다: Dialog `title` · `close`, Calendar `previous`/`next`, Disclosure `trigger` 는 RAC 가 동작을 소유하는 고정 부품이다 (R1 · R3 · F12).

### 3-Domain

- **D1 (RAC, 관찰만)**: 고정 부품 (`title` Heading · `close` Button · prev/next · trigger) 은 RAC 계약 그대로 영역 밖. 영역 안 자유 내용은 RAC 가 어떤 자식이든 받는 자리 (R1 · R2).
- **D2**: 새 prop 없음.
- **D3**: 영역 컨테이너 모양 = 기존 catalog rule (CardHeader 등 · Dialog 내용은 `frame`). 채운 노드는 자기 catalog rule.
- **SSOT 경계 변경 없음.** 새 노드 type · 새 저장 필드 없음 (`slot` · mode C · `slotRole` 은 기존 모양).

### 코드 사실

레퍼런스 R1~~R5 · 코드 사실 F1~~F13 (경로:라인) 은 [breakdown §2 · §3](design/240-named-regions-free-content-slots-breakdown.md#2-레퍼런스--rac-react-aria-components1210--starter-read-only).

### Hard constraints

- **고정 부품 보존**: Dialog `title` · `close` 와 Calendar · Disclosure 고정 부품은 영역 후보 · drop 대상이 아니다 (RAC 접근성 이름 · 닫기 동작).
- **Canvas 시각 보존 이관**: Dialog origin 구조 변경 (Description → Content frame) 뒤 기존 Dialog instance 의 Canvas 픽셀 · patch 적용 결과가 같다 (경로 전치 — F7 선례).
- **구조 보존**: instance 안 영역 밖 inherited 노드에는 drop · 삽입이 없다 (234 — instance 는 origin 구조를 바꾸지 않는다).
- **BC 수식**: 문서당 (i) origin `slot` 필드 — Card 4 · Dialog 2 · Popover 1 (+ Dialog Content frame 노드 1) (ii) Dialog instance 1개당 Description patch 경로 전치 0~1 (iii) Card · Popover · Tooltip instance Δ0.
- **성능**: `scene.build` p95 증가 ≤ +1 ms.

### Soft constraints

- 영역 추천 목록은 seed 일 뿐 — 사용자가 origin 에서 편집 · 끌 수 있다 (`slot: false`).
- Preview iframe / Compare Mode 는 사용자 지시 전까지 live 검증에 쓰지 않는다.

## Alternatives Considered

### 대안 A: 영역 = origin 자식 컨테이너 + `slotRole` + `slot` 배열 · 채우기 = mode C (추천 origin + 팔레트 primitive)

- 설명: 영역 host 노드 (CardHeader · CardContent · Dialog Content frame · DialogFooter …) 에 추천 `slot` 을 seed 하고, instance 는 Slot 채우기 절 · Canvas drop 으로 그 영역에 추천 origin 또는 primitive 를 넣는다 (mode C). Popover · Tooltip 은 root 가 영역.
- 근거: F1 · F2 (모양이 이미 있다) · F13 (페이지 frame slot 이 같은 mode C) · 설계도 P3.
- 위험: 기술 M (mode C 에 primitive · Canvas drop 경로) / 성능 L / 유지보수 L (Frame · 페이지 slot 과 같은 채우기 규칙) / 마이그레이션 **H** (Dialog origin 구조 변경 + 경로 전치)

### 대안 B: 영역마다 새 컨테이너 type (DialogContent · PopoverContent …)

- 설명: RSP 처럼 영역 전용 type 을 만든다.
- 위험: 기술 M / 성능 L / 유지보수 **H** (RAC 에 없는 type — D2 RSP 참조 없는 컴포넌트 신설, 두 leg 배선 · catalog entry 증가) / 마이그레이션 H

### 대안 C: instance 자기 자식 (237 `placedChildren`) 만 — 영역 구분 없음

- 설명: Card · Dialog instance 에 자식을 그냥 붙인다.
- 위험: 기술 L / 성능 L / 유지보수 M / 마이그레이션 L
- 한계: 넣은 내용이 inherited 자식 **뒤** (Dialog 는 footer 아래) 에 놓인다 — 영역 (header 안 · 내용 자리) 을 고를 수 없다.

### 대안 D: 채우기는 reusable ref 만 (지금 UI 그대로)

- 설명: 영역에 `slot` 만 seed 하고 primitive 는 막는다.
- 위험: 기술 L / 성능 L / 유지보수 L / 마이그레이션 H (Dialog 구조 이관은 같다)
- 한계: 글자 · 이미지 같은 자유 내용을 넣으려면 그것부터 reusable 로 만들어야 한다 — 영역의 뜻과 어긋난다.

### Risk Threshold Check

| 대안 | HIGH+                       | 판정                                     |
| ---- | --------------------------- | ---------------------------------------- |
| A    | 마이그레이션 H              | Dialog 구조 이관만 H — F7 선례로 G4 관리 |
| B    | 유지보수 H · 마이그레이션 H | RAC 밖 type 신설                         |
| C    | 없음                        | 영역 선택 불가 — 문제 1~3 불충족         |
| D    | 마이그레이션 H              | 자유 내용 불가 — 문제 4 불충족           |

HIGH 가 없는 C 는 문제를 풀지 못해 기각. A 의 H 는 Dialog 한 가족의 경로 전치로 한정되고 선례 (F7) 가 있다 — 수용.

## Decision

**대안 A** — 영역 = origin 자식 컨테이너 + `slotRole` + `slot` · 채우기 = mode C.

1. **영역 seed**: Card 4 영역 (preview · header · content · footer) · Dialog content (새 `frame` "Content" — Description 을 안으로) · Dialog footer (DialogFooter) · Popover · Tooltip root 에 `slot` (없을 때만). DialogFooter · Popover · Tooltip 을 slot host 로.
2. **자유 내용**: Slot 채우기 절과 Canvas drop 이 영역에 추천 origin 과 팔레트 primitive 를 넣는다 (mode C). 채운 노드는 instance 소유 — 일반 노드처럼 편집.
3. **고정 부품 판정**: Dialog `title` · `close` · Calendar `previous`/`next` · Disclosure `trigger` 는 영역 밖 고정 부품 (slot 후보 · drop 대상 아님).
4. **Dialog 이관**: Content frame 도입에 따른 instance patch 경로 전치 (1회 · 멱등, F7 선례).
5. **Toast 판정**: 저작 모델 밖 — RAC Toast 는 런타임 큐 (R4) 이고 composition Toast 는 생성 진입점 0 (F11). 재개 조건 = Toast 를 띄우는 이벤트 액션 · 팔레트 도입.

기각: B 는 RAC 에 없는 영역 type 을 만든다 · C 는 영역을 고를 수 없다 · D 는 자유 내용을 막는다.

> 구현 상세: [240-named-regions-free-content-slots-breakdown.md](design/240-named-regions-free-content-slots-breakdown.md)

## Risks

| ID  | 위험                                                                                                             | 심각도 | 관리                                                                      |
| --- | ---------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------- |
| R1  | Dialog 구조 이관 뒤 기존 instance 의 Description patch 가 새 경로에 안 붙어 글자 · 모양이 origin 값으로 돌아간다 |  HIGH  | G4 — 경로 전치 unit + 이관 전 빌드 arm Canvas 픽셀 · patch 적용 결과 동일 |
| R2  | mode C 에 primitive 를 넣는 경로가 한 leg (해석기 · 렌더) 에만 닿아 Canvas · Preview 중 한쪽에서 사라진다        |  HIGH  | G2 — Phase 0 진단 (b) 로 해석기 범위 확정 · 두 leg unit (원복 RED)        |
| R3  | Canvas drop 이 영역 밖 inherited 노드 · 고정 부품 (`close` Button) 에 들어가 origin 구조를 바꾼다                |  MED   | drop 대상 판정 unit (영역 host 만) · live                                 |
| R4  | 채운 노드가 많은 Card instance 가 `scene.build` 를 늘린다                                                        |  LOW   | G3 A/B                                                                    |

## Gates

| Gate | Phase   | 조건                                                                                                                                                                                                                                       | 실패 시               |
| ---- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| G0   | Phase 0 | F1~~F13 재확인 · 진단 RED 4 (breakdown §4 (a)~~(d)) · 쓰기 경로 표 · Dialog 경로 전치 건수 실측                                                                                                                                            | 본문 개정             |
| G1   | Phase 1 | unit (원복 RED): 영역 `slot` seed (없을 때만 · 사용자 값 보존) · Card · Dialog · Popover instance 의 Slot 채우기 절에 영역 표시 · 추천 origin 채우기 두 leg · Dialog 경로 전치 (기존 patch 가 새 경로에서 같은 결과) · live (Skia · store) | 해당 가족 보류        |
| G2   | Phase 2 | unit (원복 RED): primitive 채우기가 Canvas scene · Preview renderer 에 같은 노드 · Canvas drop 대상 = 영역 host 만 (inherited · 고정 부품 거부) · 채운 노드 Properties/Styles 편집 · live (Skia): Card content 영역에 Text drop → rect     | 자유 내용 보류 (D 로) |
| G3   | Phase 3 | 같은 세션 headed A/B (대조 arm = 240 전 빌드) · `scene.build` p95 median Δ ≤ +1 ms · fixture = 사람이 만든 모양 (Q1) · 불리 조작 (origin 편집 · breakpoint, Q2) · 총비용 A/B (Q3)                                                          | 사용자 판정           |
| G4   | Phase 3 | BC: Card · Dialog · Popover instance 이관 전후 Canvas 픽셀 동일 (oracle = 240 전 빌드 arm) · Δbyte 수식 · 재hydration Δ0 (IndexedDB 저장 층 live)                                                                                          | Dialog 구조 이관 보류 |

### Live Exercise

(Implemented 승격 시 기재)

## Consequences

### Positive

- Card · Dialog · Popover · Tooltip instance 에 영역을 골라 내용을 넣을 수 있다 — 페이지 frame slot 과 같은 채우기 규칙.
- 148 의 영역 어휘가 실제 편집 경로를 갖는다.
- 고정 부품과 영역의 경계가 문서로 정해진다 (RAC 계약).

### Negative

- Dialog origin 구조가 바뀐다 (Content frame) — 1회 경로 전치가 필요하다.
- 자유 내용 (primitive) 은 instance 에 흩어져 origin 에서 일괄 편집되지 않는다 (추천 origin 을 쓰면 일괄).
- Toast 는 계속 저작 모델 밖이다.
