# composition

**Visual Application Builder**

## Quick Start

```bash
# 의존성 설치 (자동으로 specs 빌드 포함)
pnpm install

# 개발 서버 실행
pnpm dev

# Turbo 로컬 캐시를 읽기만 하는 개발 서버
# upstream build 캐시를 새로 저장하지 않음
pnpm dev:lean

# 개발 서버 종료
# ✅ 올바른 방법: Ctrl+C 사용 (정상 종료)
# ❌ 잘못된 방법: Ctrl+Z 사용 금지 (프로세스가 계속 실행됨)

# 포트 충돌 발생 시 (이전 서버가 종료되지 않은 경우)
pnpm dev:kill  # 모든 dev 서버 종료
pnpm dev       # 재시작
```

### 다른 PC에서 작업한 내용 동기화 후

```bash
# Git pull 후
git pull

# 의존성 및 빌드 산출물 동기화
pnpm install  # specs 자동 빌드됨

# WASM 바인딩이 변경된 경우 (선택사항)
pnpm wasm:build:engine
```

## Project Structure

```
composition/
├── apps/
│   ├── builder/     # 메인 빌더 앱 (@composition/builder)
│   └── publish/     # 배포 런타임 (@composition/publish)
├── packages/
│   ├── shared/      # catalog·공용 타입/유틸 (@composition/shared)
│   ├── specs/       # 잔존 spec 3개·CSS 생성 (@composition/specs)
│   ├── composition-engine/  # Rust 레이아웃 엔진 (wasm)
│   └── config/      # 공유 설정 (@composition/config)
└── docs/            # 문서
```

## Commands

| Command                  | Description                                                                       |
| ------------------------ | --------------------------------------------------------------------------------- |
| `pnpm dev`               | Builder 개발 서버 실행; 필요한 upstream build만 준비하고 dev task는 캐시하지 않음 |
| `pnpm dev:lean`          | 로컬 Turbo 캐시를 read-only로 사용하는 개발 서버                                  |
| `pnpm dev:specs`         | `@composition/specs` watch 실행 (Builder와 별도 터미널)                           |
| `pnpm cache:clean`       | `.turbo/cache`만 명시적으로 삭제                                                  |
| `pnpm build`             | 프로덕션 빌드                                                                     |
| `pnpm type-check`        | 타입 검사                                                                         |
| `pnpm lint`              | 린트 실행                                                                         |
| `pnpm test`              | 테스트 실행                                                                       |
| `pnpm wasm:build:engine` | Rust 엔진 wasm 빌드 (산출물 gitignored, Rust+wasm-pack 필요)                      |

### 개발 모드와 캐시 운용

`pnpm dev`는 `@composition/builder`를 대상으로 Turbo의 `dev` task graph를
실행합니다. Builder의 dev task는 persistent이며 캐시하지 않고, 필요한
upstream package의 `build`만 먼저 실행합니다. 이전 명령의
`build --filter=...^@composition/builder`는 Turbo filter 문법상 dependents-only라
Builder 의존성을 준비하지 못하므로 사용하지 않습니다.

`packages/specs` 소스를 수정하면서 watch하려면 두 터미널을 사용합니다.

```bash
# 터미널 1
pnpm dev:specs

# 터미널 2
pnpm -F @composition/builder dev
```

Spec의 palette/CSS 생성 입력을 바꾼 경우에는 watch만으로 생성 단계가
실행되지 않으므로 다음을 먼저 실행한 뒤 Builder를 재시작합니다.

```bash
pnpm build:specs
pnpm -F @composition/builder dev
```

Turbo 캐시는 기본 개발 모드에서 upstream build 결과를 재사용합니다. 새 캐시
기록을 막고 확인하려면 `pnpm dev:lean`을 사용하세요. 이 모드는 캐시 miss가
발생해도 결과를 저장하지 않으므로 서버를 다시 시작할 때 빌드 시간이 늘 수
있습니다.

정상적인 개발에서는 Vite의 `node_modules/.vite` 캐시를 유지하는 편이
빠릅니다. 의존성 pre-bundle이 오래되었거나 잘못되었을 때만 다음처럼
`--force`로 재생성합니다.

```bash
pnpm -F @composition/builder dev -- --force
```

Turbo 캐시가 과도하게 커졌을 때는 개발 서버를 종료한 뒤 `.turbo/cache`만
정리합니다. 이 명령은 전체 `node_modules`나 pnpm store는 삭제하지 않습니다.

```bash
pnpm cache:clean
pnpm dev
```

관련 공식 문서: [Turbo filtering](https://turborepo.dev/docs/crafting-your-repository/running-tasks),
[Turbo caching](https://turborepo.dev/docs/crafting-your-repository/caching),
[Vite dependency pre-bundling](https://vite.dev/guide/dep-pre-bundling.html),
[pnpm filtering](https://pnpm.io/filtering)

## Documentation

- [모노레포 구조](docs/reference/architecture/MONOREPO.md)
- [변경 이력](./docs/CHANGELOG.md)
