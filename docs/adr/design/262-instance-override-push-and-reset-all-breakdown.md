# ADR-262 design breakdown — 원본에 반영 · 전부 되돌리기

> 본문: [../262-instance-override-push-and-reset-all.md](../262-instance-override-push-and-reset-all.md). 이 문서가 Phase · 파일 · 검증의 정본이다. `docs/adr/evidence/` 는 로컬 전용이라 실측 결론은 여기에 둔다.

## 0. 전제 lock-in (fork 4 질문)

1. **base / 응용**: ADR-260 (원본 참조 모델) 이 base 다. 이 ADR 은 그 위에서 override 를 옮기거나 지우는 응용이다. [ADR-261](261-component-api-breakdown.md) 과는 직교한다 — 261 의 속성 값 반영 행만 261 Phase 4 뒤에 더한다 (본문 Decision 4).
2. **schema**: 문서 schema 변경 0. 새 shared 명령 둘 (`pushInstanceOverrides` · `resetInstance`).
3. **선행 전제 reverse 검증**: 2026-10-14 「Reset all changes 는 우선 그냥 놔둬」 는 2026-10-15 분리 답 「Reset all changes 포함」 으로 범위 안이 됐다. Restore origin 은 그대로다.
4. **판독**: Codex 1차는 사용자가 요청할 때 (`/review-adr 262`).

## 1. Phase 0 — 전수 표 · oracle (G0)

- **override 전수 표**: 행 = 원본 모양 (`originRef: true` page 원본 · 숨은 template `false` · 옛 소유 template · 기본 원본 `lib:`). 열 = 루트 own 필드 전부 (`props` · `visual` · `fills` · `fillSizing` · `stateRules` · `responsive` · `visibility` · `sizing` · `layout`) · 자리 `patch` 필드 10종 (`types.ts:462-475`) · `fillSlot` 필드 · 중첩 주소 (`instances` 2+) · `enabled: false` · breakpoint 층. 칸마다 「반영 쓰기 대상 (노드 · 필드 · 층 · 원본 층에서 지울 키)」, 「Reset all 제거 여부」, **손계산 기대 표시값** (반영 뒤 · 되돌리기 뒤 — 독립 기준) 을 적는다. 리뷰 Round 1 · 2 의 재현 4건을 칸으로 넣는다 (Round 2: 원본 mobile + instance tablet 만): 원본 mobile 층 + instance 기본값 · 중첩 N tablet + I mobile (통째 교체) · 루트 `fills` / mobile / hover.
- **원본 노드 쓰기 경로 확인**:
  - `setFields` (`commands/fields.ts`) 가 page 원본 · 숨은 template 노드에 쓸 수 있는지.
  - 숨은 template 노드에 직접 쓰면 `VIEW_ENTRY_READ_ONLY` 나 정의 view 판정에 걸리는지.
  - 기본 원본은 `setLibraryDefault` (`commands/components.ts:53-105`, 루트만).
- **중첩 주소 재기준**: `resolution/address.ts` · `resolution/templateOwners.ts` 의 주소 투영으로 「바깥 instance 주소 `[I, N, …]` → 원본의 중첩 instance 노드 N 의 주소 `[N, …]`」 가 같은 자리를 가리키는지 unit 으로 확정한다.
- **Figma 실물 확인**: Reset all changes 가 instance 크기 (resize) 를 되돌리는지 (사용자 결정 3 재료). 반영이 숨긴 레이어 · 글자 · 채움을 어떻게 옮기는지.
- **자리별 Reset 목록 누락 종류** (`CatalogComponentSection.tsx:39` `PATCH_FIELDS` · `:107-160`): `enabled` · `fills` · `fillSizing` · `stateRules` · `responsive` · `visibility`.

### Phase 0 결과

(실행 시 기록)

## 2. Phase 1 — shared 명령 (G1 · G2)

- `commands/components.ts` 에 두 명령을 둔다:
  - `pushInstanceOverrides({id, newId})`
    - 대상 검사: instance 가 아니면 `NOT_AN_INSTANCE`, 사용자 결정 1 이 「불가」 면 기본 원본은 `LIBRARY_ORIGIN_READ_ONLY`.
    - 매핑 함수 `originTargetOf(address)` 가 주소를 원본 노드 (또는 중첩 instance 노드 + 줄인 주소) 로 바꾼다.
    - 맞추기 함수 하나 (리뷰 h1 · Round 2 개정): instance 가 쓴 키 k 마다 반영 전 표시값을 breakpoint 마다 resolver 로 계산하고, 원본 노드 (또는 중첩 N 의 override — 축 규칙은 `layeredOverride` `resolution/templateOwners.ts:100-115`) 의 k 를 그 값들이 나오도록 다시 쓴다 — 기본값 = 기본 표시값, 층은 cascade 로 같으면 지우고 다르면 쓴다. 「같은 층으로 옮기기」 는 쓰지 않는다 (instance 의 모든 층이 원본의 모든 층 뒤에 덮인다 — `resolver.ts:1734-1750`).
    - 그 뒤 instance 의 같은 키를 지운다.
    - `fillSlot` 의 `childIds` 는 건드리지 않는다 (사용자 결정 2 기본안).
  - `resetInstance({id})`
    - 루트 own `props` · `visual` · `fills` · `fillSizing` · `stateRules` · `responsive` · `visibility` 를 지운다 (리뷰 h2).
    - 모든 `patch` 를 지운다.
    - `fillSlot` 은 필드만 지운다 — `resetDescendant` (`fields.ts:460-516`) 규칙을 재사용한다.
    - 루트 `sizing` · `layout` 은 사용자 결정 3 답대로.
- 테스트:
  - 전수 표의 칸마다 반영 불변식과 되돌리기 불변식을 단언하고, 손계산 기대값과도 대조한다.
    - 반영 불변식: 반영 instance 의 표시 결과 (그리는 template 루트와 자손 — 노드 id · 래퍼 record 제외) 가 전후 같다.
    - 되돌리기 불변식: 새 instance 와 같다 (slot 내용 · 남기는 배치 필드 제외).
  - override 가 없는 다른 instance 는 원본 값을 보이고, override 가 있는 다른 instance 는 자기 값을 보인다.
  - undo 한 번에 원상으로 돌아간다.
  - 원복 RED: 매핑에서 중첩 처리 · `enabled` 를 빼거나, 원본 층의 키 지우기를 빼거나, 통째 교체 축을 키 병합으로 바꾸면 실패해야 한다.
  - 무작위 명령 500 단계 하니스 (ADR-248 4b) 에 두 명령을 추가한다.

## 3. Phase 2 — Builder (G3)

- `catalogRuntime/componentActions.ts` 에 `catalogComponentCommands.push` · `.resetAll` 을 둔다.
  - 사용 가능 판정: instance 자신만, 원본 안 중첩 자리는 제외 (Figma).
- `CatalogComponentSection.tsx`:
  - Overrides legend 옆 또는 아래 줄에 「Reset all changes」 와 「Push changes to component」 (`.control-button`) 를 둔다.
  - `PATCH_FIELDS` 를 누락 종류까지 넓힌다. 숨김 행 이름은 「Hidden」, fills 는 「Fill」.
- Canvas 오른쪽 클릭 (`catalogRuntime/canvasMenu.ts`) 의 instance 항목에 두 동작을 넣는다. i18n ko/en 도 같이 넣는다.
- 확인: 반영은 `componentConfirm.ts` 의 「N개 instance 영향」 대화상자를 재사용한다 (사용자 결정 4). Reset all 은 토스트 + undo.
- live 스크립트: `apps/builder/scripts/adr262-override-push-reset-live.mjs`.
  - 중첩 컴포넌트와 instance 3개로 반영 · 되돌리기를 하고, 다른 instance 값 · undo 를 확인한다.
  - Compare Mode 에서 Canvas = Preview 인지 본다.

## 4. 종료 (G4 · G5)

- 문서: 본문 Live Exercise · README · CHANGELOG · 메모리 `project-origin-instance-slot-reference-pen-figma`.
- ADR-261 Phase 4 가 먼저 끝났으면 속성 값 반영 행을 Phase 1 에 포함한다 (본문 Decision 4).

## 5. 기록

- 2026-10-15 Proposed — 코드 판독. 근거 위치:
  - override 타입: `types.ts:454-496 · 734-747`.
  - 자리별 Reset: `CatalogComponentSection.tsx:60-260 · 320-370`.
  - 쓰이지 않는 `resetDescendant`: `fields.ts:460`.
  - 기본 원본 루트만 편집: `originView.ts:120-166`.
  - Figma · pen.dev 문서는 2026-10-15 조회.
- 2026-10-15 Codex 설계 리뷰 Round 1 — HIGH 2 · MEDIUM 1, 셋 다 실제 `CatalogGraph` 실행 재현. 실행자 코드 대조: `resolver.ts:1725-1750` (원본 층이 instance 기본값 아래) · `templateOwners.ts:100-115` (통째 교체 축) · `types.ts:755-763` (루트 own 필드). r1 수리 — 본문 Decision 1 · 2 · 제약 · Gates, 이 문서 §1 · §2. 수리 검증 (Round 2) 대기.
- 2026-10-15 Codex 수리 검증 Round 2 — h2 · m1 닫힘 · h1 남음 (instance tablet → 원본 tablet 이면 원본 mobile 이 이김, 세 모양 실행 재현). r2 — 쓰기 규칙을 breakpoint 마다 결과값 맞추기로 개정. 판독 상한 도달 — 확인은 Phase 1 G1.
