# ADR-262: instance override 정리 — 원본에 반영 (Push changes to main) · 전부 되돌리기 (Reset all changes)

## Status

Accepted — 2026-10-15 (Proposed 2026-10-15)

- **Accepted 근거 (2026-10-15)**: 사용자 `/execute-adr 262` 호출 + [리뷰 기록](reviews/262.md) 최신 round (Round 2) 의 이슈 전부 `fixed` · pending 0 · HIGH 전부 fixed. 사용자 결정 1~4 는 닿는 Phase 에서 묻는다.
- 사용자 요청: `/create-adr` (2026-10-15) — 「ADR-260 후속 B — override 정리 (원본에 반영 · Reset all changes)」.
- 방향을 정한 사용자 원문: 「origin - instance, slot 은 pen.dev 와 pigma(Figma) 참조 모델이다」 (2026-10-14) · 「260 종료 후 설계」 (2026-10-14). 동작 판단이 갈리면 「pen.dev / Figma 에 같은 기능이 있다면 그 방식으로」 (2026-10-14).
- **분리 confirm (결정 지점 ①, 2026-10-15 AskUserQuestion 답)**: 후속 4 기능을 ADR 2개로 — [ADR-261](261-component-api-swap-slot-suggestions-properties.md) (컴포넌트 API) 과 이 ADR (override 정리). 같은 답에서 「Reset all changes 포함」 을 골랐다. 2026-10-14 「Restore origin 은 그대로 · Reset all changes 는 우선 그냥 놔둬」 를 이 답이 범위 안으로 옮긴다.
- 사용자가 이미 답한 확인 항목: 놓은 instance 의 slot 내용은 instance 의 것 (2026-10-14) · Restore origin = Figma 「Restore main component」 (지운 원본 되살리기) 그대로 (2026-10-14) · 기본 원본은 루트만 편집 — 프로젝트 기본값 (2026-10-01 · 10-05) · 옛 문서 전환 코드 금지 (2026-10-14).
- **Codex 설계 리뷰 Round 1 (2026-10-15)**: HIGH 2 · MEDIUM 1 — 모두 실행 재현이 있었고, 같은 날 r1 에서 설계를 고쳤다. h1 반영이 투영 순서를 뒤집음 (원본 층 · 통째 교체 축) → Decision 1 쓰기 규칙 · 현재 6. h2 루트 own 필드 누락 (`fills` · `stateRules` · `responsive` …) → Decision 1 · 2 범위. m1 비교 계약 (표시 결과 · 제외 필드 · 독립 기준 = 손계산 표) → 제약 · Gates. 수리 검증 (Round 2) 대기. 상세: [리뷰 기록](reviews/262.md).
- **Codex 수리 검증 Round 2 (2026-10-15)**: h2 · m1 닫힘. h1 은 같은 종류의 결함이 남았다 (instance tablet 을 같은 층으로 옮기면 원본 mobile 이 이김 — 세 원본 모양에서 실행 재현). r2 에서 쓰기 규칙을 「키별 breakpoint 마다 결과값 맞추기」 로 바꿨다. 판독 상한 (설계 판독 1 + 수리 검증 1) 에 닿았다 — 이 수리의 확인은 Phase 1 G1 (손계산 표 + 원복 RED) 이 맡는다.
- **사용자 결정 1~4 확정 (2026-10-15 AskUserQuestion, `/execute-adr 262` Phase 0 뒤)**: 1 기본 원본 = 루트 `props` · `visual` 만 프로젝트 기본값으로 · 2 slot 내용 반영하지 않음 · 3 Reset all 은 루트 `sizing` · `layout` 을 남긴다 (반영도 옮기지 않음 — Figma 앱의 「Reset size」 가 별도 항목) · 4 다른 instance 1개 이상이면 「N개 영향」 확인. 전부 기본안.
- **Phase 0 · 1 · 2 완료 (2026-10-15, `/execute-adr 262`)**: Phase 0 전수 표 (19 행 · 손계산 칸 · Figma 확인) → Phase 1 shared `pushInstanceOverrides` · `resetInstance` · `resetOverrideField` (G1 · G2 — 세 원본 모양 × 전수 표 칸 19 테스트 · 원복 RED 4/4 · 무작위 500 단계) → Phase 2 Builder (G3 live 13/13 · G4 type-check · 스위트). 설계에서 바뀐 것: 맞추기는 작성값 cascade (토큰 보존) · 중첩 자리는 `layerPatchFields` 병합 · Reset all 이 ADR-261 교체 (`replace`) 도 되접음 (G2 요구) · 반영 사전 확인을 원본 편집 감시자 키에 등록 (live 결함). 남은 것: **G5 사용자 Builder 확인** → Implemented. 상세: [breakdown §1 ~ §3 결과](design/262-instance-override-push-and-reset-all-breakdown.md).
- 범위 밖: 교체 · 추천 · 속성 ([ADR-261](261-component-api-swap-slot-suggestions-properties.md) — 속성 값의 반영은 261 Phase 4 뒤 이 ADR 에 행을 더한다) · variant · 라이브러리 공유.

## Context

### 도메인

- **문서 모델 (ADR-248 catalog 문서) + Builder 편집 UI**. D1 · D2 · D3 무변경 — 이미 있는 override 와 원본 노드 필드 사이에서 값을 옮기거나 지우기만 한다. 새 schema 필드는 0 이고 새 명령이 둘 생긴다.
- 참조 모델 (외부 근거, 2026-10-15 조회):
  - **Figma** (`help.figma.com` Apply overrides to instances):
    - 반영 — 「You can choose to push your changes back to the main component, which updates any other instances of that component」.
    - 반영 조건:
      - 「You can only push changes if the main component is in the same file as the instance」.
      - 「It's not possible to push changes to components in another file, including published libraries」.
      - 「It's not possible to push changes to a component that's nested within another component」.
      - 「You need to select the instance itself, not a specific layer within it」.
    - 되돌리기 — 「Reset > Reset all changes to reset all properties for that layer」 · 「Reset [property]」 · 「Figma only lists properties that have changes applied」.
  - **pen.dev** (`docs.pencil.dev/core-concepts/components`): 반영 기능은 문서에 없다. 되돌리기는 「To reset to the origin's current values, insert a new instance from the Components panel」.

### 현재 (실측 2026-10-15, main `15b847d5b`)

1. **override 가 있는 곳**:
   - instance 루트 자신의 필드 — `props` · `visual` (`packages/shared/src/catalog/document/types.ts:734-735`) 과 `sizing` · `layout` · `fills` · `fillSizing` · `stateRules` · `responsive` · `visibility` (`:738` · `:757-763`, `setWholeField` — `commands/fields.ts:217-258`). `placement` 는 놓은 자리다.
   - `descendantOverrides` (`:739`, 종류 `:477-489`):
     - `patch` — 주소 + `props` · `visual` · `sizing` · `stateRules` · `enabled` (false = 숨김) · `layout` · `fills` · `fillSizing` · `responsive` · `visibility`.
     - `fillSlot` — 주소 + `childIds` + 같은 patch 필드.
     - `replace` — 만드는 명령이 없다.
   - 주소는 `{instances, templatePath}` 다 (`:454-459`). 첫 id 가 instance 자신이고, 2개 이상이면 원본 안 중첩 instance 의 정의 안이다.
2. **자리별 Reset 만 있다** — Design 패널 Component 절 (`apps/builder/src/builder/panels/properties/catalog/CatalogComponentSection.tsx:107-160` 목록 · `:199-225` 실행).
   - 목록: 루트 own `props` · `visual` 키 + 각 patch 의 `props` · `visual` · `sizing` · `layout` 키.
   - 목록에 없는 것: `enabled: false` (자리 지우기가 쓰는 숨김 — `commands/structure.ts:1101-1107`) · `fills` · `stateRules` · `responsive` · `visibility` · `replace`.
   - 실행: prop 은 `catalogPropertiesPatchCommand`, 그 밖은 `setFields` remove. 토스트에 undo 가 있다.
3. **shared 에 쓰이지 않는 명령이 있다** — `resetDescendant` (`commands/fields.ts:460-516`) 는 patch 하나 전체 또는 한 scope 의 키를 지우고 `fillSlot` 의 `childIds` 는 남긴다. export 됐지만 (`commands/index.ts:26`) 테스트 밖 호출자가 0 이다.
4. **원본에 반영하는 길이 없다**. 반영 대상이 될 원본 노드는 세 모양이다 (ADR-260 Decision 1):
   - `originRef: true` — page 의 원본 노드. 주소의 `templatePath` id 가 곧 원본 서브트리의 `project:node:` id 다.
   - 소유 template (`originRef` 없음 · `false`) — 정의가 소유한 노드. 역시 `project:node:` id 다.
   - 기본 원본 — `lib:template:` id 라 쓸 수 없다. 프로젝트 기본값 (`setLibraryDefault`, `commands/components.ts:53-105`) 은 **루트만** 받는다 (`apps/builder/src/builder/catalogRuntime/originView.ts:120-166` — 루트 밖 쓰기는 `CatalogOriginEditError`).
5. **투영 순서와 병합 규칙** (리뷰 Round 1 h1 로 추가):
   - 자리의 visual 은 원본 노드 기본값 → 원본 breakpoint 층 → instance patch 기본값 → patch 층 순으로 덮인다 (`resolution/resolver.ts:1734-1750`). 그래서 **instance 기본값은 원본의 breakpoint 층을 이긴다**.
   - 중첩 override 병합 (`resolution/templateOwners.ts:100-115`) 은 축마다 다르다. `props` · `visual` · `sizing` · `layout` 은 키 단위, `stateRules` 는 상태별 키 단위로 병합한다. `fills` · `fillSizing` · `responsive` · `visibility` · `enabled` 는 바깥 값이 통째로 이긴다.
6. **원본 편집은 다른 instance 로 퍼진다** — 원본 첫 편집에서 「N개 instance 영향」 을 묻는다 (`catalogRuntime/componentConfirm.ts:117-190`). 다른 instance 가 같은 자리 · 키를 override 하면 그 instance 의 값이 이긴다 (resolver 투영 순서 — `resolution/templateOwners.ts`).

### 제약

- **Hard**: **반영 불변식** — 반영한 instance 의 **표시 결과** 는 반영 전후가 같다. 표시 결과 = 그 instance 가 그리는 template 루트와 자손의 resolved record 이고, 노드 id 와 instance 자신의 래퍼 record 필드는 뺀다 (리뷰 m1 — 루트 override 를 원본으로 옮기면 instance 래퍼의 `visual` 은 비지만 그려지는 루트는 같다). 다른 instance 는 그 자리 · 키를 override 하지 않은 것만 바뀐다.
- **Hard**: **되돌리기 불변식** — Reset all 뒤 표시 결과는 「같은 원본의 새 instance」 와 같다. 비교에서 빼는 것은 slot 내용과, 남기기로 한 루트 배치 필드 (`placement` · 사용자 결정 3 의 `sizing` · `layout`) 다. pen.dev 의 「새 instance 넣기」 가 기준이다.
- 두 불변식은 같은 resolver 의 두 출력을 비교하므로 독립 oracle 이 아니다 (리뷰 m1). 독립 기준은 Phase 0 의 **손계산 기대값 표** (칸마다 반영 · 되돌리기 뒤의 기대 표시값) 와 live 사용자 동작이다.
- **Hard**: 한 동작 = 한 transaction = undo 한 번. 소유 불변식 · 무작위 명령 500 단계 하니스는 그대로 통과한다.
- **Hard**: slot 내용 (`fillSlot.childIds`) 은 instance 의 것이다 (사용자 2026-10-14). 기본 원본 template 은 쓰지 않는다.
- **Hard**: pre-push perf ratchet (ADR-246) · initial 번들 상한 (그때의 상한).
- **Soft**: Figma 와 같은 결과를 낸다.

### 생성기 질문 (반복 패턴 #2)

해당 없음 — rule · CSS · template 변경 0.

## Alternatives Considered

### 대안 A: Figma 그대로 — 반영 = override 를 원본 노드에 쓰고 instance 에서 지운다 · Reset all = 그 instance 의 override 전부 제거

- 설명:
  - 반영: shared 명령 `pushInstanceOverrides({id})` 가 한 transaction 에서 일을 끝낸다.
    - 루트 own `props` · `visual` → 원본 루트 노드.
    - 각 `patch` · `fillSlot` 의 필드 → 주소가 가리키는 원본 노드 (`templatePath` 마지막 id).
    - 그 뒤 instance 의 같은 키를 지운다.
    - 중첩 주소 (`instances` 2개 이상) 는 원본 안의 그 중첩 instance 노드에 **주소를 한 단계 줄여** override 로 붙인다. 원본이 자기 중첩 instance 를 override 하는 것과 같다.
  - Reset all: `resetInstance({id})` 가 루트 own `props` · `visual` 과 모든 `patch` 를 지운다. `fillSlot` 은 `childIds` 를 남기고 필드만 지운다 (`resetDescendant` 와 같은 규칙).
- 위험: 기술 **HIGH** / 성능 LOW / 유지보수 LOW / 마이그레이션 LOW.
  - 기술 HIGH: 주소 → 원본 노드 매핑. 세 모양 · 중첩 · 숨김 (`enabled: false`) · breakpoint 층 (`responsive`) 이 모두 맞아야 반영 불변식이 선다. 반영은 모든 instance 에 퍼지는 쓰기다.

### 대안 B: 반영 대신 「instance 에서 새 컴포넌트」 — instance 를 해체하고 그 노드로 Create component

- 설명: 반영하지 않고, 바뀐 instance 를 새 원본으로 만든다 (Figma 의 「Detach + Create component」 수작업).
- 위험: 기술 LOW / 성능 LOW / 유지보수 MEDIUM (원본이 갈라져 같은 컴포넌트가 둘) / 마이그레이션 LOW.
- 문제: 사용자가 요청한 「원본에 반영」 이 아니다 — 다른 instance 가 바뀌지 않는다.

### 대안 C: Reset all 만 · 반영은 원본에서 직접 편집으로

- 설명: Reset all 만 만든다. 반영은 「Go to component」 → 원본에서 같은 값을 다시 편집하게 둔다 (pen.dev 의 지금 상태).
- 위험: 기술 LOW / 성능 LOW / 유지보수 LOW / 마이그레이션 LOW.
- 문제: 승인된 범위 (원본에 반영) 를 채우지 못한다.

### Risk Threshold Check

| 대안 | HIGH+              | 판정                                                                                               |
| ---- | ------------------ | -------------------------------------------------------------------------------------------------- |
| A    | 기술 HIGH          | **채택** — HIGH 는 주소 매핑 하나로 모이고, 반영 · 되돌리기 불변식이 외부 oracle 로 잰다 (G1 · G2) |
| B    | 없음 (요구 불일치) | 기각                                                                                               |
| C    | 없음 (요구 미충족) | 기각                                                                                               |

루프 1회: A 의 HIGH 를 피하는 대안은 범위를 줄이는 C 뿐이다. A 의 HIGH 는 「주소 → 원본 노드」 한 함수에 모이고, 결과가 resolved record 의 동일성으로 검사된다 — 수용.

## Decision

**대안 A 채택.**

1. **원본에 반영 (`pushInstanceOverrides`)**.
   - 대상: 사용자 컴포넌트 instance (원본이 page 원본이든 숨은 template 이든). Figma 대로 **instance 자신을 골랐을 때만** 열린다 (Component 절 · Canvas 오른쪽 클릭).
   - 원본 안 중첩 instance 의 안쪽 자리를 골랐을 때는 열지 않는다 (Figma 「nested within another component」).
   - 쓰기 규칙 = **키별로 breakpoint 마다의 결과값을 맞춘다** (리뷰 h1, Round 2 에서 개정). 매핑 함수와 맞추기 함수를 하나씩 둔다.
     - instance 가 쓴 키 k (어느 층이든) 마다 반영 전 표시값을 breakpoint 마다 (기본 · 각 breakpoint 층) resolver 로 계산한다.
     - 원본 노드의 k 를 그 값들로 다시 쓴다. 기본값에 기본 표시값을 쓰고, 각 층은 cascade 로 같은 값이 나오면 그 층의 k 를 지우고, 다르면 그 층에 쓴다.
     - 이 방식은 구성상 반영 불변식을 지킨다. 「같은 층으로 옮기기」 는 성립하지 않는다 — 투영에서 instance 의 모든 층이 원본의 모든 층보다 뒤에 덮이기 때문이다 (`resolver.ts:1734-1750`). Round 2 재현: 원본 mobile=blue, instance tablet=red 를 원본 tablet 에 옮기면 mobile 이 red 에서 blue 로 바뀐다.
     - 루트 own 필드와 자리 (`patch` · `fillSlot` 필드) → 원본 노드.
     - 중첩 주소 → 원본의 중첩 instance 노드 N 에 한 단계 줄인 주소로 붙인다. N 의 override 도 같은 맞추기다 — 반영 전 표시값을 breakpoint 마다 계산해 그 값이 나오도록 쓴다. 축의 병합 규칙은 `layeredOverride` (`templateOwners.ts:100-115`) 를 따른다: 키 병합 축은 키 단위, 통째 교체 축은 instance 값이 통째로 이긴다.
     - `enabled: false` → 원본 노드 `enabled: false`.
     - 루트 own 필드의 범위: `props` · `visual` · `fills` · `fillSizing` · `stateRules` · `responsive` · `visibility` (리뷰 h2). `sizing` · `layout` 은 사용자 결정 3 의 답을 따른다 — Reset 에서 남기면 반영도 하지 않는다.
   - 그 뒤 instance 의 해당 키를 지운다. 한 transaction 이다.
   - slot 내용 (`childIds`) 은 반영하지 않는다 — 사용자 결정 2.
   - 다른 instance 의 같은 자리 · 키 override 는 그대로 둔다 (Figma — 반영 뒤에도 그 instance 의 값이 이긴다).
   - 확인: 원본 첫 편집 확인 대화상자 (`componentConfirm.ts`) 와 같은 「N개 instance 영향」 을 묻는다 (사용자 결정 4).
2. **전부 되돌리기 (`resetInstance`)**.
   - 지우는 것: 루트 own `props` · `visual` · `fills` · `fillSizing` · `stateRules` · `responsive` · `visibility` (리뷰 h2) · 모든 `patch` · `fillSlot` 의 필드.
   - 남기는 것: `fillSlot` 의 `childIds` (instance 의 것), 루트 `placement`, 루트 `sizing` · `layout` (사용자 결정 3).
   - 진입: Component 절 Overrides 목록 위 「Reset all changes」 · Canvas 오른쪽 클릭. 확인 없이 토스트 + undo — 지금 자리별 Reset 과 같다.
   - 자리별 Reset 목록에 빠진 종류 (`enabled` 숨김 · `fills` · `stateRules` · `responsive` · `visibility`) 를 목록에 더해 「Figma only lists properties that have changes」 와 맞춘다.
3. **기본 원본 instance**: 사용자 결정 1 (기본안 — 루트 own `props` · `visual` 만 프로젝트 기본값으로 반영 · 안쪽 자리는 반영 목록에서 뺀다).
4. **ADR-261 속성 값** (261 Phase 4 뒤): 속성 기본값 = 대상 원본 노드의 값이므로, 반영 = 대상 노드에 쓰기다. 261 이 먼저 Implemented 면 이 ADR 의 Phase 1 에 그 행을 넣는다.

**위험 수용 근거**: 기술 HIGH 는 「주소 → 원본 노드 · 필드」 와 「breakpoint 마다 결과값 맞추기」 두 함수에 모인다. 맞추기는 반영 전 표시값을 resolver 로 계산해 쓰므로 투영 순서를 따로 흉내 내지 않는다. 틀리면 반영 · 되돌리기 불변식이 바로 깨지고, 손계산 기대값 표 (독립 기준) 가 어느 칸이 틀렸는지 가리킨다. 반영은 한 단계라 undo 한 번으로 되돌린다.

**기각 사유**: B — 다른 instance 가 바뀌지 않아 「반영」 이 아니고 원본이 갈라진다. C — 승인된 범위 (반영) 를 채우지 못한다.

### 사용자 결정 (execute 때 그 Phase 에서 묻는다)

1. 기본 원본 instance 의 반영 — (기본안) 루트 `props` · `visual` 만 프로젝트 기본값으로 (지금 Library page 루트 편집과 같은 길) / Figma 대로 불가 (다른 파일 라이브러리처럼).
2. slot 내용의 반영 — (기본안) 반영하지 않는다 (instance 의 것) / 원본 slot 의 기본 내용으로 복사.
3. Reset all 이 루트 크기 · 배치를 되돌리는가 — (기본안) 남긴다 (놓은 자리 · 크기는 instance 의 배치) / Figma 처럼 크기도 되돌린다 (Phase 0 에 Figma 실물 확인).
4. 반영 확인 — (기본안) 다른 instance 가 1개 이상이면 「N개 영향」 확인 / 확인 없이 토스트 + undo.

> 구현 상세: [262-instance-override-push-and-reset-all-breakdown.md](design/262-instance-override-push-and-reset-all-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                        | 심각도 | 대응                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------- |
| R1  | 주소 → 원본 노드 매핑이나 병합이 틀려 다른 노드 · 다른 층에 쓰거나 투영 순서가 뒤집힌다 (세 모양 · 중첩 · 숨김 · breakpoint · 통째 교체 축) |  HIGH  | 매핑 · 병합 함수 하나씩 (병합은 resolver 규칙 공유) · 반영 불변식 단언 · 손계산 표 · 무작위 하니스에 반영 추가 (G1) |
| R2  | 반영이 모든 instance 에 퍼지는데 사용자가 범위를 모른다                                                                                     |  HIGH  | 「N개 영향」 확인 (사용자 결정 4) · 한 단계 undo · 토스트 (G3 live)                                                 |
| R3  | Reset all 이 slot 내용을 지운다                                                                                                             |  MED   | `childIds` 유지 단언 · 되돌리기 불변식은 slot 내용을 뺀 비교 (G2)                                                   |
| R4  | 자리별 목록에 종류를 더하며 패널 행이 늘어 선택 카운트 상승                                                                                 |  LOW   | 목록 계산은 지금 `useSyncExternalStore` 키 그대로 · pre-push ratchet (G4)                                           |
| R5  | ADR-261 속성과 순서가 엇갈려 속성 값 반영이 빠진다                                                                                          |  LOW   | Decision 4 — 261 Phase 4 의 G3 에 반영 행을 더하거나 이 ADR Phase 1 에 넣는다                                       |

## Gates

측정 대상은 사람이 만든 사용자 컴포넌트 (중첩 · 숨김 · breakpoint 층 포함) 다. 불변식 (반영 전 자기 표시 결과 · 같은 원본의 새 instance) 은 같은 resolver 의 비교라 회귀 검사용이다. 독립 기준은 Phase 0 의 손계산 기대값 표와 G3 의 live 사용자 동작이다.

| Gate | 시점     | 통과 조건                                                                                                                                                                                                                                                                                                                                                                            | 실패 시 대안                  |
| ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| G0   | Phase 0  | override 종류 · 필드 · 주소 모양 전수 표 (원본 세 모양 × 루트 own 필드 전부 · 자리 · 중첩 · 숨김 · breakpoint · 통째 교체 축) · 칸마다 손계산 기대 표시값 (반영 뒤 · 되돌리기 뒤, 리뷰 Round 1 재현 3건 포함) · Figma 실물로 Reset all 의 크기 처리 확인 (사용자 결정 3 재료).                                                                                                       | 표에 빈칸이면 Phase 1 행 추가 |
| G1   | Phase 1  | 반영: 표의 모든 칸에서 반영 instance 표시 결과 전후 동일 + 손계산 값과 일치 · override 없는 다른 instance 는 원본 값 · override 있는 instance 는 자기 값 · undo 한 번에 원상 · 무작위 500 단계 하니스에 `pushInstanceOverrides` · `resetInstance` 추가 통과 · 원복 RED (매핑에서 중첩 · 숨김을 빼거나, breakpoint 맞추기를 「같은 층으로 옮기기」 로 바꾸면 실패 — Round 2 재현 칸). | 매핑 함수 수리                |
| G2   | Phase 1  | 되돌리기: Reset all 뒤 표시 결과 = 같은 원본의 새 instance (slot 내용 · 남기는 배치 필드 제외) + 손계산 값과 일치 · 루트 `fills` · `stateRules` · `responsive` 가 남지 않음 · `childIds` 유지.                                                                                                                                                                                       | 제거 범위 수리                |
| G3   | Phase 2  | live (headed Chrome): Component 절 「Push changes to component」 · 「Reset all changes」 · Canvas 메뉴 · 확인 대화상자 · 토스트 undo · 자리별 목록에 숨김 · fills 행 · 다른 instance 반영 확인 · Compare Mode Canvas = Preview.                                                                                                                                                      | 경로 수리                     |
| G4   | 각 Phase | type-check · shared · builder 스위트 (기존 제외 `resolveContainerStylesFallback`) · pre-push perf ratchet 등급 A 통과 (초과면 원인 수리) · 번들 상한 안.                                                                                                                                                                                                                             | 원인 수리                     |
| G5   | 종료     | 사용자 Builder 확인 (Implemented 조건).                                                                                                                                                                                                                                                                                                                                              | 보고 결함 수리 후 재확인      |

### Live Exercise

- 2026-10-15 (실행자, headed Chrome · dev 5173 · Compare Mode · `apps/builder/scripts/adr262-override-push-reset-live.mjs`, 13/13 PASS): Frame > Text 「Card」 컴포넌트 + instance I · J. I 에 Text 색 빨강 (자리 patch) · 루트 opacity 0.5 · 루트 fills → Design 패널 Component 절 Overrides 목록에 `opacity` · `Fill` · `Text.color` 행 → 「Push changes to component」 → 「N개 instance 영향」 대화상자 (다른 instance J 1) → 원본 T.visual.color · F.visual.opacity · F.fills 에 쓰이고 I 는 비며, I 의 Text 는 그대로 빨강 (Canvas record `#ff0000` = Preview DOM `rgb(255, 0, 0)`) · J 도 빨강 (Canvas = Preview) → 토스트 undo 로 원상 → 「Reset all changes」 → I override 0 · Text 색 원본 (Canvas = Preview) · 대화상자 없음 → 토스트 undo → Canvas 오른쪽 클릭 메뉴에 두 항목 · 메뉴 Reset all 동작 → 자리 숨김의 「Text.Hidden」 행. console · page error 0.
- 사용자 confirm (G5): 대기.

## Consequences

### Positive

- Figma 의 override 정리 두 동작 (Push changes to main · Reset all changes) 이 생긴다. instance 에서 다듬은 값을 모든 instance 의 기본으로 올리는 길이 한 번 클릭이다.
- 쓰이지 않던 `resetDescendant` 의 규칙 (slot 내용 유지) 이 사용자 동작이 된다.
- 자리별 Reset 목록이 실제 override 종류 전부를 보인다 (지금은 숨김 · fills 등이 목록에 없어 되돌릴 길이 없다).

### Negative

- 반영은 모든 instance 에 퍼지는 쓰기라 잘못 누르면 영향이 넓다 — 확인 · undo 에 기댄다.
- 주소 → 원본 노드 매핑 함수가 원본 세 모양 · 중첩을 모두 알아야 한다. ADR-260 의 모양이 늘면 같이 고친다.
