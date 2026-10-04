# @composition/rendering

Builder와 shared catalog가 함께 사용하는 텍스트 측정, token, shape, chart,
아이콘 데이터와 CSS generator 구현이다. `packages/specs`에서 공용 구현을
이전했으며 native Frame/Group/Slot spec이나 tag registry를 포함하지 않는다.

- 시각·편집 계약의 정본은 `packages/shared/src/catalog`다.
- Builder와 shared는 이 패키지를 직접 소비한다.
- `@composition/specs`는 Publish 후속과 기존 CSS 생성 진입점의 호환 경계로
  공용 API를 재수출한다. Builder runtime에서 역참조하면 안 된다.
- palette와 Lucide 생성기는 이 패키지의 `scripts/`에서 실행한다.
  생성 파일은 직접 수정하지 않는다.

repo root에서 `pnpm -F @composition/rendering test`,
`pnpm -F @composition/rendering type-check`, `pnpm run build:specs`로 검증한다.
`pnpm run gate:catalog-runtime`은 Builder production chunk에 남는 구 spec 및
구 편집 resolver를 검사한다. 번들 용량·성능 측정은 별도 gate다.
