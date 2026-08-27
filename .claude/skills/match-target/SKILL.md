---
name: match-target
description: 참조 이미지/디자인과 화면을 반복 조정으로 시각 수렴시켜야 할 때 사용 — "이 이미지처럼 만들어줘", "이 디자인에 맞춰줘", "참조와 똑같이", "픽셀 맞춰", "visual tuning", "match target", "이 화면처럼" 요청 또는 reference image + target selector 조합 제공 시 발동.
user-invocable: true
---

# Match-Target: Vision-based Visual Tuning Loop

참조 이미지(또는 URL/screenshot)와 대상 selector 를 입력받아 **자율 수렴 루프**로 코드 mutate → screenshot → vision diff → 재 mutate 반복. drag-and-drop Pencil parity / separator 센터링 / dark theme 색상 / Skia↔CSS 시각 정합 등 반복적 픽셀 조정 작업의 사용량 제한 위험 회피.

## SSOT 체인 내 위상

본 skill 은 [ssot-hierarchy.md](../../rules/ssot-hierarchy.md) **D3(시각 스타일) 검증 수단**. 단, mutation 은 항상 Catalog / 잔존 Spec / 토큰 / 수동 CSS layer 에 한정 — D1(DOM 구조) / D2(Props API) 변경 금지.

## 입력 요구사항 (3종 필수)

| 입력                        | 형식                                                                                  | 예시                                                         |
| --------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **참조 (target reference)** | (1) 로컬 이미지 경로 / (2) URL / (3) Chrome MCP 다른 탭 ID                            | `/tmp/pencil-drag.png` / `https://...` / `tabId: pencil-app` |
| **대상 selector**           | composition app 내 비교 대상 — Builder Skia / Preview iframe / Style Panel 셋 중 하나 | `canvas[data-testid=skia-canvas-unified]` / `iframe`         |
| **iteration budget**        | 정수 (default 30, max 60)                                                             | `budget: 30`                                                 |

선택 입력:

- **수렴 임계 (similarity threshold)**: default 0.95 (vision 모델의 시각 유사도 0~1 점수)
- **mutation scope**: `catalog` / `spec` / `tokens` / `manual-css` / `factory` 중 허용 layer 명시 (default: `catalog` + `tokens`). `catalog` = `componentRulesTable.ts` + `catalog/bindings/*.binding.ts`, `spec` 은 잔존 3개 (Frame/Group/Slot) 한정
- **stuck strategy**: 동일 점수 3회 연속 시 alternative 시도. default `switch-layer` (다른 mutation scope 로 전환)

## Phase 0: 사전 조건 (CRITICAL)

Phase 1 진입 전 반드시 통과:

- [ ] dev 서버 실행 중 (`localhost:5173`) — `cross-check` skill Phase 5.0 dist 신선도 게이트 통과
- [ ] Chrome MCP 페어링 활성 — `mcp__claude-in-chrome__tabs_context_mcp` 호출 시 에러 없음
- [ ] 참조가 이미지면 파일 존재 확인 / URL 이면 fetch 가능 확인
- [ ] 대상 selector 가 현재 페이지에 존재 — `mcp__claude-in-chrome__find` 로 1회 확증

미충족 시 처리 (호출 방식별 이원화):

- **대화형 호출** (사용자 직접): 부족 항목 질문 → 보충 받으면 Phase 0 재검증 후 진행
- **비대화형 호출** (agent 위임): 부족 항목 보고 후 종료

어느 경우든 budget 소진 금지.

## Phase 1: 베이스라인 캡처

```javascript
// 개념 절차 (의사코드 — loadReference/visionDiff 는 실존 함수 아님, 모델이 수행하는 단계 서술)

// 1) 참조 캡처 (이미지/URL/탭 모두 normalize 하여 buffer 로)
const ref = await loadReference(input.target);

// 2) 대상 현재 상태 캡처 — screenshot 은 탭 전체 캡처 (selector 파라미터 없음).
//    요소 영역 캡처는 find 로 대상 위치/영역 확인 후 zoom 으로 해당 region 캡처:
mcp__claude-in-chrome__find({ query: "<대상 요소 자연어 서술>", tabId });
mcp__claude-in-chrome__computer({ action: "zoom", region: [x0, y0, x1, y1], tabId });

// 3) vision 모델로 초기 similarity 점수 산출
const baseline = await visionDiff(ref, currentScreenshot);
//  → { similarity: 0~1, deltas: [...] }
```

`baseline.deltas` 는 구체적 차이 구조화:

- `color`: 토큰 / hex 차이 (어느 element 의 어느 속성)
- `spacing`: padding/margin/gap 차이 (px)
- `alignment`: flex/grid 배치 차이
- `size`: width/height 차이
- `border-radius` / `shadow` / `font` 등

이미 `similarity ≥ threshold` 이면 즉시 종료 + "이미 수렴" 보고.

## Phase 2: 수렴 루프

```
for i in 1..budget:
    1. PROPOSE — deltas[0] (가장 큰 차이) 해소를 위한 minimal change 제안
       - mutation_scope 안에서만 (catalog / spec / tokens / manual-css / factory)
       - 변경할 파일 + 변경할 라인 + 변경 후 값을 명시
    2. APPLY — Edit 도구로 파일 수정
    3. WAIT — Vite HMR 또는 hard reload (~400ms)
    4. CAPTURE — 동일 region 으로 재캡처 (zoom)
    5. SCORE — visionDiff() → 새 similarity
    6. RECORD — TaskUpdate (deferred tool — ToolSearch 로 로드 후 사용) 로 iteration log:
         { iter, applied_change, similarity_before, similarity_after, deltas_remaining }
    7. STOP CHECK:
       - similarity ≥ threshold → 수렴, break
       - similarity 가 3회 연속 동일 ± 0.01 → stuck, stuck strategy 발동
       - budget 소진 → 비수렴 종료
```

### Stuck strategy

| strategy           | 동작                                                                            |
| ------------------ | ------------------------------------------------------------------------------- |
| `switch-layer`     | 현재 mutation scope (예: catalog) 에서 다른 scope (tokens / manual-css) 로 전환 |
| `revert-and-retry` | 마지막 3 변경 revert 후 deltas[1] (두 번째 큰 차이) 부터 재시도                 |
| `ask-user`         | 사용자에게 "stuck — 어느 layer 가 본질입니까" 질문 후 hint 받아 재진입          |

default `switch-layer`. 사용자가 명시 시 override.

## Phase 3: 종료 보고

```markdown
## Match-Target 결과

- 입력: ref=`{path}` / target=`{selector}` / budget=`{N}`
- 결과: 수렴 ✅ (iteration {n}, similarity {0.97}) / 비수렴 ❌ (budget 소진, similarity {0.83})
- 적용된 변경 N건:
  | iter | layer | file | change | sim |
- 최종 unresolved deltas (비수렴 시):
  - color: ...
  - spacing: ...
- 다음 권장:
  - 수렴: type-check + cross-check 실행 후 commit
  - 비수렴: ask-user 모드 재진입 또는 mutation scope 확장 (factory 허용)
```

## 안전 가드 (CRITICAL)

- ❌ **D1 침범 금지**: HTML 태그 / ARIA / 키보드 동작 변경 금지. 시각 차이가 DOM 구조에서 기인하면 즉시 stop + ask-user
- ❌ **D2 침범 금지**: RSP 미규정 prop 신규 도입 금지
- ❌ **수동 CSS skipCSSGeneration 부활 금지** (ADR-059 위반): mutation scope `manual-css` 는 이미 generated 가 아닌 manual CSS 파일에 한정
- ❌ **자동 commit / push 금지**: 수렴 후에도 사용자 승인 받기 전 git 작업 금지
- ❌ **budget 60 초과 금지**: 60 회 수렴 못 하면 본질 의문 → `/fix` root-cause 4단계로 escalate

## 적용 사례 (예상 시나리오)

| 시나리오                         | 입력 예시                                                                | mutation scope |
| -------------------------------- | ------------------------------------------------------------------------ | -------------- |
| Skia ↔ CSS Breadcrumbs separator | `ref=preview iframe screenshot` / `target=Skia canvas`                   | `catalog`      |
| Pencil drag-and-drop parity      | `ref=pencil app screenshot` / `target=Builder canvas`                    | `factory`      |
| Dark theme value text 정합       | `ref=light theme value text screenshot` / `target=dark theme value text` | `tokens`       |
| Calendar grid 셀 alignment       | `ref=design mock` / `target=Calendar canvas`                             | `catalog`      |

## Evals

### Positive (발동해야 함)

- "이 [이미지/디자인]이랑 똑같이 맞춰줘" + 참조 제공 → ✅
- "Pencil drag 동작 픽셀 단위로 맞춰" + 참조 제공 → ✅
- "다크 테마 색상 라이트 모드처럼 변환" + 참조 제공 → ✅
- "match-target Button {ref}" 직접 호출 → ✅

### Negative (발동 안 함)

- "Button 색상 #abc 로 바꿔줘" → ❌ 단발성 변경 (Edit 도구 직접)
- "왜 다르게 보이는지 분석해줘" → ❌ 분석 작업 → `/fix` (root-cause 4단계)
- 참조 이미지 미제공 → ❌ Phase 0 사전 조건 미충족
- "디자인 검토만 해줘" → ❌ mutation 없음

## Phase 0 사전 조건 미충족 시 동작

```
Phase 0 검증 실패 →
  1. 대화형 호출: 부족한 입력/조건 질문 → 보충 시 Phase 0 재검증 후 진행
  2. 비대화형(agent 위임) 호출: 부족 항목 보고 후 종료
  3. budget 사용 0
```

budget 보존이 핵심 — Phase 1 이후만 budget 차감.
