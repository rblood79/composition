---
title: "@composition/specs 빌드 동기화"
impact: CRITICAL
impactDescription: dist/ 미갱신 시 소비자(Builder)가 구 버전 참조하여 Canvas/CSS 렌더링 불일치 발생
tags: [spec, build, monorepo]
---

`@composition/specs`는 tsup으로 빌드되어 `dist/`를 통해 export됩니다. **소스 수정 후 반드시 빌드를 실행**해야 합니다.

## Incorrect

```bash
# ❌ specs 소스만 수정하고 빌드 생략
# packages/specs/src/components/Button.spec.ts 수정
# → dist/는 이전 값 유지 → Builder가 구 값 참조
pnpm typecheck  # 타입 체크만으로는 dist/ 갱신 안됨
```

## Correct

```bash
# ✅ specs 소스 수정 후 반드시 빌드
pnpm --filter @composition/specs build

# 또는 개발 중 watch 모드 사용
pnpm --filter @composition/specs dev
```

## 실제 버그 사례

**사례 1 — padding 불일치 (v1.11)**:

- **증상**: 버튼 간 공백 발생 (button_width + gap = CSS button width)
- **원인**: ButtonSpec paddingX 수정 후 dist/ 미빌드 → layout engine(새 값) vs Canvas renderer(구 값) 불일치
- **해결**: `pnpm --filter @composition/specs build` 실행

**사례 2 — borderWidth 누락 (v1.12)**:

- **증상**: WebGL 모드에서 border가 일부 variant(primary 등)에서 표시되지 않음
- **원인**: ButtonSpec variants에 border/borderHover 추가 후 dist/ 미빌드 → Canvas renderer가 구 Spec 참조
- **해결**: `pnpm --filter @composition/specs build` 실행

**사례 3 — props.style 오버라이드 미반영 (v1.13)**:

- **증상**: Inspector에서 backgroundColor, borderRadius 등 변경 시 Canvas에 반영 안 됨
- **원인**: Spec shapes가 variant/size 기본값만 사용, `props.style` 우선 참조 누락 + 49개 spec 수정 후 dist/ 미빌드
- **해결**: 모든 49개 spec의 `render.shapes()`에서 `props.style?.X ?? variant.X` 패턴 적용 + `pnpm --filter @composition/specs build`

**사례 4 — 배경 높이 불일치 (v1.13)**:

- **증상**: CSS Selection 영역은 정상이나 Canvas 배경이 더 크게 렌더링 (spec height > layout height)
- **원인**: Spec의 배경 roundRect에 `height: size.height` (고정값 32px)가 Yoga 계산 높이(28px)와 불일치
- **해결**: 배경 roundRect `height: 'auto'` + ElementSprite에서 `specHeight = finalHeight` + `pnpm --filter @composition/specs build`

**사례 5 — px/% width 설정 시 배경 미렌더링 (v1.14)**:

- **증상**: Button에 `width: 200px` 또는 `width: 50%` 설정 시 Skia 배경이 사라짐 (Selection은 정상)
- **원인**: 9개 spec 파일에서 배경 roundRect `width`에 `props.style?.width || 'auto'` 사용 → 숫자 값이면 `specShapesToSkia` bgBox 추출 실패. 소스 수정 후 dist/ 미빌드로 구 코드 참조
- **해결**: 배경 roundRect `width: 'auto' as const` (Button, Section, ToggleButton, Card, Form, List, FancyButton, ScrollBox, MaskedFrame) + `pnpm --filter @composition/specs build`

## 참조

- `packages/specs/package.json` — `"main": "./dist/index.js"`
- `docs/COMPONENT_SPEC.md` §4.7.4.0
