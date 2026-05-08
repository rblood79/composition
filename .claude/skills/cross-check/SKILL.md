---
name: cross-check
description: CSS↔WebGL↔Canvas 렌더링 경로 정합성 검증. 변경된 컴포넌트의 모든 렌더링 경로를 교차 검증합니다.
TRIGGER when: user mentions "정합성 체크", "정합성 검증", "렌더링 체크", "cross check", "CSS WebGL 비교", "렌더링 경로 확인", "Preview Canvas 비교", "CSS↔WebGL", or asks to verify rendering parity across paths.
user_invocable: true
---

## SSOT 체인 내 위상 (CRITICAL)

본 skill은 [ssot-hierarchy.md](../../rules/ssot-hierarchy.md) 3-domain 중 **D3(시각 스타일) symmetric consumer 대칭 집행 수단**. Builder(Skia)와 Preview(DOM+CSS)가 동일 Spec source에서 **시각 결과의 동일성**을 생성하는지 검증. 한쪽을 다른 쪽의 "기준"으로 취급 금지.

## Superpowers Integration (중요)

이 스킬은 Superpowers 프레임워크와 함께 사용되도록 설계되었습니다.

- Systematic Debugging 스킬 실행 중 rendering parity 관련 이슈 발견 시 **즉시** 이 스킬 호출
- TDD (RED-GREEN-REFACTOR) 사이클의 REFACTOR 단계 종료 후 **반드시** cross-check 실행
- Structured Planning 완료 후 rendering 관련 작업인 경우 cross-check를 verification step으로 포함
- CRITICAL 이슈 발견 시 즉시 수정 후 `pnpm build:specs && pnpm type-check` 실행

# Cross-Check: 렌더링 경로 정합성 검증

변경된 컴포넌트의 CSS(Preview) ↔ Skia Canvas (Builder, ADR-100 단일 렌더러) 렌더링 경로가 일관되게 동작하는지 검증합니다.

## Phase 1: 변경 대상 식별

`git diff --name-only`로 변경된 파일에서 영향받는 컴포넌트를 식별합니다.

변경 파일 → 컴포넌트 매핑:

- `*.spec.ts` → 해당 컴포넌트
- `*.css` → 해당 컴포넌트
- `ElementSprite.tsx` → TAG_SPEC_MAP에 등록된 모든 변경 컴포넌트
- `fullTreeLayout.ts` / `utils.ts` → 영향받는 모든 컴포넌트
- `implicitStyles.ts` → 해당 컨테이너 컴포넌트
- `*Renderers.tsx` → 해당 Preview 렌더러 컴포넌트

## Phase 2: 컴포넌트별 5-레이어 교차 검증

각 컴포넌트에 대해 아래 테이블을 작성합니다:

| 레이어               | 파일                                                  | 검증 항목                                           | 상태 |
| -------------------- | ----------------------------------------------------- | --------------------------------------------------- | ---- |
| **Spec**             | `packages/specs/src/components/{Name}.spec.ts`        | variants, sizes, render.shapes(), properties        |
| **Factory**          | `apps/builder/src/builder/factories/definitions/*.ts` | 기본 props, style, 자식 구조                        |
| **CSS Renderer**     | `packages/shared/src/components/styles/{Name}.css`    | data-variant/data-size 선택자, 토큰                 |
| **WebGL Renderer**   | `ElementSprite.tsx` + `specTextStyle.ts` + `utils.ts` | TAG_SPEC_MAP, TEXT_BEARING_SPECS, INLINE_BLOCK_TAGS |
| **Preview Renderer** | `packages/shared/src/renderers/*.tsx`                 | variant/size props 전달, data-\* 속성               |

## Phase 3: 정합성 검증 항목

각 컴포넌트에 대해 아래를 확인합니다:

### 3.1 Variant 정합성

- [ ] Spec `defaultVariant`와 React 컴포넌트 기본값 일치
- [ ] Spec `variants` 키와 CSS `[data-variant="..."]` 선택자 일치
- [ ] Preview 렌더러가 `variant` prop을 컴포넌트에 전달

### 3.2 Size 정합성

- [ ] Spec `defaultSize`와 React 컴포넌트 기본값 일치
- [ ] Size casing 일관성 (sm/md/lg, S/M/L 혼용 금지)
- [ ] Spec sizes의 fontSize/paddingX/paddingY/lineHeight/borderWidth가 CSS와 일치
- [ ] Preview 렌더러가 `size` prop을 컴포넌트에 전달

### 3.3 WebGL 레이아웃 정합성

- [ ] `INLINE_BLOCK_TAGS` 또는 `BUTTON_LIKE_TAGS` 등록 여부 (fit-content 필요 시)
- [ ] `TEXT_BEARING_SPECS` 등록 여부 (텍스트 폭 측정 필요 시)
- [ ] `DEFAULT_SIZE_BY_TAG` 등록 여부
- [ ] `calculateContentWidth`의 `isFormElement` 경로 포함 여부
- [ ] `calculateContentHeight`의 `isButtonLike` 경로 포함 여부

### 3.4 토큰 정합성

- [ ] Spec TokenRef와 CSS 변수 매핑 일치 (css-tokens.md 참조)
- [ ] 금지된 M3 토큰 사용 없음
- [ ] `--bg-inset` / `{color.layer-2}` 필드 배경 통일 (해당 시)

### 3.5 상태 정합성

- [ ] disabled 상태: opacity 0.38, pointerEvents: none (Spec ↔ CSS)
- [ ] focusVisible: outline 2px solid var(--focus-ring) (CSS) / var(--accent) (Spec)

## Phase 4: 결과 보고

검증 결과를 테이블로 보고합니다:

| 컴포넌트 | 레이어 | 이슈                      | 심각도   | 수정 여부 |
| -------- | ------ | ------------------------- | -------- | --------- |
| Menu     | WebGL  | TEXT_BEARING_SPECS 미등록 | CRITICAL | 수정 완료 |

발견된 이슈는 즉시 수정합니다. 수정 후 `pnpm build:specs && pnpm type-check`로 검증합니다.

### Phase 4.1: Validate → Fix → Repeat 루프 (CRITICAL)

단발성 검증이 아닌 **수렴 루프**로 실행합니다. Playbook §6.3 Feedback Loop 패턴 적용.

```
while (이슈 테이블에 미해결 CRITICAL/HIGH 존재):
    1. Validate — Phase 2~3 재실행 (수정 대상 레이어만)
    2. Fix      — CRITICAL/HIGH 즉시 수정
    3. Verify   — pnpm build:specs && pnpm type-check
    4. Re-scan  — 수정이 다른 레이어에 회귀 유발했는지 Phase 2 재확인
루프 종료 조건: CRITICAL/HIGH 0건, 또는 3회 반복 후에도 수렴 실패 시 사용자에게 보고
```

**종료 게이트 (모두 통과 필수)**:

- [ ] CRITICAL 이슈 0건
- [ ] HIGH 이슈 0건 또는 사용자 수용 근거 명시
- [ ] `pnpm type-check` 성공
- [ ] 마지막 Fix가 새 이슈를 유발하지 않음 (회귀 재검증 완료)

3회 초과 루프 시 근본 원인 의심 → systematic-debugging 스킬 전환.

## Phase 5: 시각 파리티 검증 — Chrome MCP (dev 서버 실행 시)

개발 서버(`localhost:5173`)가 실행 중이면 Chrome MCP로 **Skia Canvas ↔ Preview iframe ↔ Style Panel** 세 축 대칭을 프로그래매틱 + visual 이중 확증합니다. 세션 16 (2026-04-22) ADR-082 G4 / ADR-056 / ADR-064 재확증에서 확립된 패턴.

### 5.0 사전 게이트 — dist 신선도 확인 (CRITICAL)

> **Why**: spec source 변경 후 `pnpm build:specs` 누락 시 dev 서버는 stale dist 를 서빙하여 Phase 5 시각 검증이 거짓 통과/거짓 실패를 낳음. ADR-057/058 verification 중 "stale specs/dist requiring rebuild" hidden cause 재발 방지.

Chrome MCP 진입 전 반드시 아래 절차 수행:

```bash
# 1) flag 파일 확인 (PostToolUse spec-rebuild-flag.sh 가 생성)
test -f "$CLAUDE_PROJECT_DIR/.claude/.spec-rebuild-pending" && echo "STALE" || echo "FRESH"

# 2) STALE 또는 mtime 비교에서 stale 감지 시 강제 rebuild
SRC_MAX=$(find packages/specs/src -name '*.ts' -newer packages/specs/dist/index.js 2>/dev/null | head -1)
GEN_MAX=$(find packages/shared/src/components/styles/generated -name '*.css' 2>/dev/null | head -1)
if [ -n "$SRC_MAX" ] || [ ! -d packages/specs/dist ] || [ -z "$GEN_MAX" ]; then
  pnpm build:specs
  rm -f "$CLAUDE_PROJECT_DIR/.claude/.spec-rebuild-pending"
fi

# 3) dev 서버 hard reload (Vite HMR 이 spec dist 변경을 항상 picks up 하지 않음)
#    Chrome MCP javascript_tool 또는 reload navigation 사용
```

검증 기준:

- [ ] `packages/specs/dist/` 존재
- [ ] `packages/shared/src/components/styles/generated/` 디렉토리에 ≥1 CSS 파일
- [ ] flag 파일 (`.claude/.spec-rebuild-pending`) 미존재
- [ ] (선택) `dist/index.js` mtime ≥ 가장 최근 `packages/specs/src/**/*.ts` mtime

신선도 미충족 시 Phase 5 진입 금지. rebuild 후 재검증.

### 5.1 탭 세팅 (재사용 원칙)

```
# 기존 MCP 탭 그룹 조회 — 세션당 1 그룹 유지 원칙
mcp__claude-in-chrome__tabs_context_mcp({ createIfEmpty: true })
# Builder 미탑재 시 네비게이션
mcp__claude-in-chrome__navigate({ url: "http://localhost:5173", tabId })
```

Chrome extension 미페어링 시 `No Chrome extension connected` 에러 — 사용자에게 extension 설치/페어링 요청 후 재시도.

### 5.2 Store programmatic 조작 (요소 추가/선택)

Builder 에 `window.__composition_STORE__` 가 전역 노출되어 있어 UI 클릭 없이 요소 추가 가능:

```javascript
const store = window.__composition_STORE__;
const st = store.getState();
const bodyId = [...st.elementsMap.values()].find((e) => e.tag === "body")?.id;
const pageId = st.currentPageId;
const id = crypto.randomUUID();
await st.addElement({
  id,
  tag: "Button",
  parent_id: bodyId,
  page_id: pageId,
  order_num: 0,
  props: {},
});
store.getState().setSelectedElement(id);
await new Promise((r) => setTimeout(r, 400)); // React 리렌더 대기
```

### 5.3 3축 대칭 확증

| 축                          | 확인 방법                                                                                                           | 기대                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Skia Canvas**             | `document.querySelector('canvas[data-testid=skia-canvas-unified]')` 존재 + 스크린샷 visual                          | 컴포넌트 shape 가 canvas 에 렌더됨                                   |
| **Preview iframe DOM**      | Preview 토글 버튼 클릭 → `document.querySelector('iframe').contentDocument.querySelectorAll('.react-aria-{Tag}')`   | 해당 tag 의 RAC 인스턴스 렌더                                        |
| **Style Panel Spec preset** | `.panel-contents` 중 Transform 섹션 포함한 root 에서 섹션별 `input[aria-label]` + `.react-aria-SelectValue` 값 추출 | Spec 기본값(예: ButtonSpec.sizes.md.borderRadius=6) 이 Panel 에 표시 |

Style Panel reader (input / Select / ToggleButtonGroup 통합 — 세션 17 정밀화):

```javascript
const stylePanel = [...document.querySelectorAll(".panel-contents")].find((r) =>
  [...r.querySelectorAll(".section-title")].some(
    (e) => e.innerText.trim() === "Transform",
  ),
);

const H_ALIGN = ["left", "center", "right"];
const V_ALIGN = ["Top", "Center", "Bottom"];

const readToggleGroups = (body) => {
  const out = {};
  body.querySelectorAll(".react-aria-ToggleButtonGroup").forEach((g) => {
    const labelKey =
      g.previousElementSibling?.innerText?.trim() ||
      g.getAttribute("aria-label");
    if (!labelKey) return;
    const buttons = [...g.querySelectorAll("button")];
    const selectedIdx = buttons.findIndex(
      (b) => b.getAttribute("data-selected") === "true",
    );
    let value = null;
    if (selectedIdx >= 0) {
      const b = buttons[selectedIdx];
      const isAlignDot =
        buttons.length === 9 && b.querySelector(".alignment-dot");
      if (isAlignDot) {
        // 9-grid row-major: idx → col/row 좌표
        value = `${H_ALIGN[selectedIdx % 3]}${V_ALIGN[Math.floor(selectedIdx / 3)]}`;
      } else {
        const iconName = b
          .querySelector("svg")
          ?.getAttribute("class")
          ?.match(/lucide-([a-z-]+)/)?.[1];
        value = iconName || `#${selectedIdx}`;
      }
    }
    out[labelKey] = value;
  });
  return out;
};

const readSection = (root, name) => {
  const hdr = [...root.querySelectorAll(".section-header")].find(
    (h) => h.querySelector(".section-title")?.innerText.trim() === name,
  );
  const body = hdr?.nextElementSibling;
  if (!body) return null;
  const out = {};
  // NumberField / TextField 입력값
  body.querySelectorAll("input[aria-label]").forEach((i) => {
    out[i.getAttribute("aria-label")] = i.value;
  });
  // Select trigger 현재 값
  body.querySelectorAll(".react-aria-SelectValue").forEach((e) => {
    const aria = e.closest("[aria-label]")?.getAttribute("aria-label");
    if (aria) out[aria] = e.innerText.trim();
  });
  // ToggleButtonGroup (Direction / Container Align / Justify / Wrap / W Sizing / H Sizing / Self Align)
  Object.assign(out, readToggleGroups(body));
  return out;
};
```

ToggleButtonGroup 반환값 예시 (ListBoxItem Layout section):

- `Direction`: `"stretch-horizontal"` (lucide icon suffix — flexDirection=column 대응)
- `Container Align`: `"leftCenter"` (9-grid idx=3 — alignItems=flex-start + justifyContent=center + flexDirection=column 조합)
- `Justify`: `null` (SPACING_VALUES 가 아니면 9-grid 외에서는 미선택)
- `Wrap`: `"arrow-right-to-line"` (nowrap default)

icon class suffix → semantic 값 (row/column/block 등) 추가 변환은 optional. 세션 17 시점 기준 index + icon name 만으로 Spec 값 Panel 도달 충분 확증 가능.

### 5.4 스크린샷 visual 대조 (보조)

`mcp__claude-in-chrome__computer({ action: "screenshot", tabId })` 로 Builder 전체 캡처 → Left(CSS Preview) ↔ Right(Skia Canvas) 영역 대칭 육안 확인. 주요 비교 항목:

- 크기·여백 불일치 (padding, height, gap 차이)
- 색상·폰트 불일치 (토큰 매핑 오류, dark mode 차이)
- 정렬 차이 (flex/grid 배치 불일치)
- 상태 렌더링 차이 (hover, disabled, focus 시각 차이)

### 5.5 결과 기록

대칭 확증 결과를 매트릭스 형태로 Phase 4 결과 테이블 또는 ADR Addendum 에 기록:

| 컴포넌트 | Skia Canvas |     Preview iframe     | Style Panel Spec preset     | 판정 |
| -------- | :---------: | :--------------------: | --------------------------- | :--: |
| Button   |     ✅      | `.react-aria-Button` ✓ | BR=6 / BW=1 / FS=14 / LH=20 |  ✅  |

불일치 발견 시 Phase 4 결과 테이블에 CRITICAL/HIGH 로 추가하고 즉시 수정.

### 생략 조건

아래에 해당하면 Phase 5를 건너뜁니다:

- 개발 서버 또는 Storybook이 실행 중이지 않음
- Chrome extension 미페어링 (사용자에게 설치 요청 후 skip)
- 시각적 변화가 없는 수정 (로직·타입·스토어 변경만 포함)
- CI 환경 (브라우저 없음)
- 사용자가 명시적으로 생략을 요청한 경우

## Evals

### Positive (발동해야 하는 경우)

- "Button spec 수정했는데 CSS도 맞는지 확인해줘" → ✅ 렌더링 경로 교차 검증
- "이 컴포넌트 Canvas랑 Preview가 다르게 보여" → ✅ 불일치 감지 → 5-레이어 검증
- "Spec 변경 후 정합성 체크해줘" → ✅ 직접 트리거
- "렌더링 경로 확인해봐" → ✅ 직접 트리거

### Negative (발동하면 안 되는 경우)

- "TextField placeholder 텍스트만 변경" → ❌ 시각 렌더링 미변경
- "ESLint 규칙 추가" → ❌ 렌더링 무관
- "Store 로직만 수정했어" → ❌ 렌더링 경로 미관여 (시각적 변화 없으면 불필요)
- "단위 테스트 작성해줘" → ❌ 테스트 작업 → tester 에이전트
