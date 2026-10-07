---
title: "generated CSS 동기화 (옛 @composition/specs 빌드 규칙의 후신)"
impact: CRITICAL
impactDescription: generated CSS 미재생성 시 Preview/Publish DOM 이 옛 rule 값을 읽어 Skia/CSS 렌더링 불일치 발생
tags: [catalog, build, monorepo, generated-css]
---

`packages/specs` 패키지와 tsup `dist/` 빌드는 ADR-248 (2026-10-04, `ddc5fc603`) 에서 삭제됐다. `@composition/rendering` · `@composition/shared` 는 **소스를 직접 export** 한다 (`packages/rendering/package.json` `exports` → `./src/*`) — dist 재빌드 단계는 없다. 남은 build-time 산출물은 **generated CSS 하나**다.

## Incorrect

```bash
# ❌ COMPONENT_RULES_TABLE 의 variant 색상·크기만 고치고 CSS 재생성 생략
# packages/shared/src/catalog/generated/componentRulesTable.ts 수정
# → Skia 는 runtime resolver 로 즉시 반영, DOM generated CSS 는 옛 값 유지 → 비대칭
pnpm type-check  # 타입 체크는 CSS 를 갱신하지 않는다
```

```bash
# ❌ 삭제된 패키지 호출
pnpm --filter @composition/specs build
```

## Correct

```bash
# ✅ rule 테이블 → generated CSS 재생성
pnpm generate:css        # = pnpm -F @composition/rendering generate:css (tsx scripts/generate-css.ts)
pnpm build:specs         # 팔레트 + CSS 한 번에 (postinstall 과 같은 경로)
pnpm -F @composition/rendering validate:sync   # 생성 결과가 저장본과 같은지 --check
```

## 대상별 재생성 경로

| 수정 대상                                                                      | 필요 동작                                                                                                    |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `componentRulesTable.ts` 의 **variant 색상 · CSS 에 반영되는 size/structure**  | `pnpm generate:css` — Skia 는 `resolveComponentRule` 로 즉시 반영되지만 DOM generated CSS 는 build-time 주입 |
| `componentRulesTable.ts` 의 **Skia 만 읽는 값**                                | 없음 — runtime 파생                                                                                          |
| `packages/rendering/src/**` (buildCatalogShapes / skiaPrimitives / primitives) | 없음 — 소스 직접 export. 단 `scripts/generate-css.ts` 자체를 고쳤으면 `pnpm generate:css`                    |
| theme/tokens root collection 의 토큰 값                                        | `pnpm generate:palette` 가 포함된 `pnpm build:specs`                                                         |

generated CSS 출력 위치: `packages/shared/src/components/styles/generated/` (`packages/rendering/scripts/generate-css.ts` 의 `OUTPUT_DIR`). generate-css 는 `getComponentRulesTable()` 로 rule 테이블을 직접 읽는다 — DOM/Skia same-source. `pnpm codex:preflight` 의 format 단계가 generated CSS 를 재포맷하면 `build:specs` 로 되돌린다 (메모리 `reference-preflight-format-rewrites-generated-files`).

## 역사적 사례 (압축)

> PixiJS/Yoga + 49~~124개 spec 시절 (v1.11~~v1.14, 2026-02) 과 tsup dist 시절의 기록이다. 해당 코드는 삭제됐지만 **"소스 수정 → 산출물 미재생성 → 소비자 구 값 참조"** 라는 실패 형태는 generated CSS 에 그대로 남아 있다.

- **padding/borderWidth 불일치** (v1.11/v1.12): spec 수정 후 dist 미빌드 → layout engine(새 값) vs 렌더러(구 값) 불일치
- **props.style 오버라이드 미반영** (v1.13): 49개 spec 일괄 수정 후 dist 미빌드 → Inspector 변경이 캔버스에 미반영
- **배경 미렌더링** (v1.14): 배경 box `width` 에 숫자 값 유입 + dist 미빌드 → bgBox 추출 실패. 현행 규칙: 배경 box `width/height: "auto"` ([spec-shape-rendering](spec-shape-rendering.md) §1)

## 참조

- `package.json` — `"build:specs": "pnpm generate:palette && pnpm generate:css"` · `"generate:css": "pnpm -F @composition/rendering generate:css"`
- `packages/rendering/package.json` — `exports` (소스 직접) · `generate:css` · `validate:sync`
- `packages/rendering/scripts/generate-css.ts` — rule 테이블 기반 CSS 생성
- [spec-value-sync](spec-value-sync.md) — catalog ↔ Canvas ↔ CSS 값 동기화
