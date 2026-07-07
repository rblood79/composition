---
title: "@composition/specs 빌드 동기화"
impact: CRITICAL
impactDescription: dist/ 미갱신 시 소비자(Builder)가 구 버전 참조하여 Skia/CSS 렌더링 불일치 발생
tags: [spec, build, monorepo]
---

`@composition/specs` 는 tsup 으로 빌드되어 `dist/` 를 통해 export 됩니다 (`packages/specs/package.json` — `"main": "./dist/index.js"`). **소스 수정 후 반드시 빌드를 실행**해야 합니다. 빌드에는 `generate:css` 가 포함되어 generated CSS 도 함께 재생성됩니다.

## Incorrect

```bash
# ❌ specs 소스만 수정하고 빌드 생략
# packages/specs/src/renderers/buildCatalogShapes.ts 또는 components/Frame.spec.ts 수정
# → dist/ 는 이전 코드 유지 → Builder 가 구 버전 참조
pnpm type-check  # 타입 체크만으로는 dist/ 갱신 안 됨
```

## Correct

```bash
# ✅ specs 소스 수정 후 반드시 빌드 (generate:css 포함)
pnpm --filter @composition/specs build   # = tsup + pnpm generate:css
# 루트 단축 스크립트 (package.json:12)
pnpm build:specs

# 개발 중 watch 모드
pnpm --filter @composition/specs dev
```

## 대상별 재생성 경로

| 수정 대상                                                                                               | 필요 동작                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/specs/src/**` (buildCatalogShapes / skiaPrimitives / 잔존 spec Frame·Group·Slot / primitives) | `pnpm build:specs` — dist 재빌드 + generate:css                                                                                                                                   |
| `packages/shared/src/catalog/generated/componentRulesTable.ts` 의 **variant 색상**                      | shared 는 소스 직접 export(dist 없음)라 Skia 는 즉시 반영. 단 **DOM generated CSS 는 build-time 주입** — `pnpm --filter @composition/specs generate:css` (또는 build) 재실행 필요 |
| `componentRulesTable.ts` 의 **sizes 수치**                                                              | Skia/layout engine 즉시 반영 (runtime `resolveComponentRule` 파생). CSS 에 반영되는 값이면 위와 동일하게 generate:css                                                             |

generated CSS 출력 위치: `packages/shared/src/components/styles/generated/` (`packages/specs/scripts/generate-css.ts` 의 `OUTPUT_DIR`). generate-css 는 `getComponentRulesTable()` 로 rule 테이블의 variant 색상을 직접 읽습니다 — DOM/Skia same-source.

## 역사적 사례 (압축)

> 아래는 PixiJS/Yoga + 49~124개 spec 시절(v1.11~v1.14, 2026-02)의 버그 기록입니다. 해당 코드(PixiButton, ElementSprite, 컴포넌트별 spec)는 삭제됐지만, **"소스 수정 → dist 미빌드 → 소비자 구 값 참조"** 라는 실패 형태 자체는 현행 구조에서도 동일하게 재현됩니다.

- **padding/borderWidth 불일치** (v1.11/v1.12): spec 수정 후 dist 미빌드 → layout engine(새 값) vs 렌더러(구 값) 불일치 → 버튼 간 공백/테두리 미표시
- **props.style 오버라이드 미반영** (v1.13): 49개 spec 일괄 수정 후 dist 미빌드 → Inspector 변경이 캔버스에 미반영
- **배경 미렌더링** (v1.14): 배경 box `width` 에 숫자 값 유입 + dist 미빌드 → bgBox 추출 실패. 현행 규칙: 배경 box `width/height: "auto"` ([spec-shape-rendering](spec-shape-rendering.md) §1)

## 참조

- `packages/specs/package.json` — `"main": "./dist/index.js"`, `"build": "tsup ... && pnpm generate:css"`
- `package.json:12` — `"build:specs": "pnpm -F @composition/specs build"`
- `packages/specs/scripts/generate-css.ts` — rule 테이블 기반 CSS 생성
- [spec-value-sync](spec-value-sync.md) — catalog ↔ layout engine ↔ CSS 값 동기화
