# Skeleton Loading System Implementation Plan

> **폐기 (2026-09-09)**: 설계의 핵심인 `withSkeleton` HOC 와 `useSkeleton` 훅은 구현되지 않았고 저장소에 존재하지 않는다. 실제로 남은 것은 `packages/shared/src/components/Skeleton.tsx` 와 그 catalog binding 뿐이다. 미구현 설계 문서로 보존한다.

> **Status**: ✅ Complete
> **Created**: 2025-12-09
> **Target**: src/shared/components/

## Overview

모든 63개 shared 컴포넌트에 대응하는 범용 Skeleton 로딩 시스템 구현.
Claude AI, OpenAI 등 현대 UI 트렌드를 반영한 shimmer/pulse 애니메이션 기반.

## Implementation Status

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 0 | Core Skeleton Component | ✅ Complete |
| Phase 1 | Button, Badge, Link | ✅ Complete |
| Phase 2 | Form Inputs (TextField, Checkbox, Switch, Slider) | ✅ Complete |
| Phase 3 | ListBox, Card | ✅ Complete |
| Phase 4 | Select | ✅ Complete |
| Phase 5 | ComboBox | ✅ Complete |
| Phase 6 | Table | ✅ Complete |
| Phase 7 | Calendar, ProgressBar, Meter | ✅ Complete |
| Phase 8 | Tabs, Breadcrumbs, Tree | ✅ Complete |

---

## 📖 Usage Examples (사용 예시)

### 1. Basic Skeleton Component

```tsx
import { Skeleton } from '@/shared/components';

// Text skeleton (1줄)
<Skeleton variant="text" width="80%" height={16} />

// Text skeleton (여러 줄)
<Skeleton variant="text" lines={3} />

// Circular skeleton (아바타)
<Skeleton variant="circular" width={48} height={48} />

// Rectangular skeleton (이미지)
<Skeleton variant="rectangular" width={200} height={150} />

// Rounded skeleton
<Skeleton variant="rounded" width={100} height={40} />
```

### 2. Animation Types

```tsx
// Shimmer animation (Claude AI style) - Default
<Skeleton animation="shimmer" />

// Pulse animation
<Skeleton animation="pulse" />

// Wave animation
<Skeleton animation="wave" />

// No animation
<Skeleton animation="none" />
```

### 3. Component-specific Skeleton Variants

```tsx
// Button skeleton
<Skeleton componentVariant="button" size="md" />

// Badge skeleton
<Skeleton componentVariant="badge" />

// Input skeleton
<Skeleton componentVariant="input" size="md" />

// Checkbox skeleton
<Skeleton componentVariant="checkbox" />

// Switch skeleton
<Skeleton componentVariant="switch" />

// Slider skeleton
<Skeleton componentVariant="slider" />

// List item skeleton
<Skeleton componentVariant="list-item" size="md" />

// Table row skeleton
<Skeleton componentVariant="table-row" />

// Table cell skeleton
<Skeleton componentVariant="table-cell" />

// Tree node skeleton
<Skeleton componentVariant="tree-node" />

// Card skeleton
<Skeleton componentVariant="card" />

// Card gallery skeleton
<Skeleton componentVariant="card-gallery" />

// Card horizontal skeleton
<Skeleton componentVariant="card-horizontal" />

// Tab skeleton
<Skeleton componentVariant="tab" />

// Calendar skeleton
<Skeleton componentVariant="calendar" />

// Progress bar skeleton
<Skeleton componentVariant="progress" />

// Meter skeleton
<Skeleton componentVariant="meter" />

// Breadcrumb skeleton
<Skeleton componentVariant="breadcrumb" />
```

---

## 📦 Component Usage (컴포넌트별 사용법)

### Button

```tsx
import { Button } from '@/shared/components';

// Loading state
<Button isLoading>Submit</Button>

// With loading label (screen reader)
<Button isLoading loadingLabel="Submitting...">Submit</Button>

// Controlled loading
const [loading, setLoading] = useState(false);

const handleClick = async () => {
  setLoading(true);
  await submitForm();
  setLoading(false);
};

<Button isLoading={loading} onPress={handleClick}>
  Save
</Button>
```

### Badge

```tsx
import { Badge } from '@/shared/components';

// Loading state
<Badge isLoading>New</Badge>

// Controlled loading
<Badge isLoading={isLoadingCount}>{count}</Badge>
```

### Link

```tsx
import { Link } from '@/shared/components';

// Loading state
<Link isLoading href="/profile">My Profile</Link>
```

### TextField

```tsx
import { TextField } from '@/shared/components';

// Loading state
<TextField isLoading label="Email" />

// Controlled loading
<TextField
  isLoading={isLoadingUserData}
  label="Name"
  value={userName}
/>
```

### Checkbox

```tsx
import { Checkbox } from '@/shared/components';

// Loading state
<Checkbox isLoading>Accept terms</Checkbox>
```

### Switch

```tsx
import { Switch } from '@/shared/components';

// Loading state
<Switch isLoading>Enable notifications</Switch>
```

### Slider

```tsx
import { Slider } from '@/shared/components';

// Loading state
<Slider isLoading label="Volume" />
```

### ListBox

```tsx
import { ListBox, ListBoxItem } from '@/shared/components';

// Loading state with custom skeleton count
<ListBox isLoading skeletonCount={5}>
  <ListBoxItem>Item 1</ListBoxItem>
</ListBox>

// With DataBinding loading
const { data, loading } = useCollectionData({ dataBinding });

<ListBox isLoading={loading} skeletonCount={8}>
  {data.map(item => (
    <ListBoxItem key={item.id}>{item.name}</ListBoxItem>
  ))}
</ListBox>
```

### Card

```tsx
import { Card } from '@/shared/components';

// Default skeleton layout
<Card isLoading>
  <h3>Card Title</h3>
  <p>Card content...</p>
</Card>

// Gallery skeleton layout
<Card isLoading skeletonLayout="gallery">
  <img src="..." />
  <h3>Gallery Card</h3>
</Card>

// Horizontal skeleton layout
<Card isLoading skeletonLayout="horizontal" orientation="horizontal">
  <img src="..." />
  <div>Content</div>
</Card>

// Auto-detect from variant/orientation
<Card
  isLoading
  variant="gallery"  // Auto-uses gallery skeleton
>
  Content
</Card>
```

### Select

```tsx
import { Select, SelectItem } from '@/shared/components';

// Loading state
<Select isLoading label="Country">
  <SelectItem>USA</SelectItem>
  <SelectItem>Korea</SelectItem>
</Select>

// With DataBinding loading
<Select
  isLoading={isLoadingCountries}
  label="Country"
>
  {countries.map(c => (
    <SelectItem key={c.id}>{c.name}</SelectItem>
  ))}
</Select>
```

### ComboBox

```tsx
import { ComboBox, ComboBoxItem } from '@/shared/components';

// Loading state
<ComboBox isLoading label="Search users">
  <ComboBoxItem>User 1</ComboBoxItem>
</ComboBox>

// With async search loading
const { data, loading } = useAsyncSearch(query);

<ComboBox
  isLoading={loading}
  label="Search"
  inputValue={query}
  onInputChange={setQuery}
>
  {data.map(item => (
    <ComboBoxItem key={item.id}>{item.name}</ComboBoxItem>
  ))}
</ComboBox>
```

### Table

```tsx
import Table from '@/shared/components/Table';

// Loading state with default 5 skeleton rows
<Table
  isLoading
  columns={columns}
/>

// Custom skeleton row count
<Table
  isLoading
  skeletonRowCount={10}
  columns={columns}
/>

// With API loading
const { data, loading } = useTableData();

<Table
  isLoading={loading}
  skeletonRowCount={itemsPerPage}
  columns={columns}
  data={data}
/>

// Uses provided columns for skeleton header
<Table
  isLoading={loading}
  columns={[
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role' },
  ]}
/>
```

### Calendar

```tsx
import { Calendar } from '@/shared/components';

// Loading state
<Calendar isLoading />

// With size variant
<Calendar isLoading size="lg" />

// Controlled loading
<Calendar
  isLoading={isLoadingEvents}
  value={selectedDate}
  onChange={setSelectedDate}
/>
```

### ProgressBar

```tsx
import { ProgressBar } from '@/shared/components';

// Loading state (shows skeleton, not indeterminate)
<ProgressBar isLoading value={50} />

// Controlled loading
const { progress, loading } = useUploadProgress();

<ProgressBar
  isLoading={loading}
  value={progress}
  label="Uploading..."
/>
```

### Meter

```tsx
import { Meter } from '@/shared/components';

// Loading state
<Meter isLoading value={75} />

// With variant and size
<Meter
  isLoading={isLoadingStats}
  variant="primary"
  size="lg"
  value={usage}
  label="Storage"
/>
```

### Tabs

```tsx
import { Tabs, TabList, Tab, TabPanel } from '@/shared/components';

// Loading state with default 3 skeleton tabs
<Tabs isLoading>
  <TabList>
    <Tab>Tab 1</Tab>
  </TabList>
  <TabPanel>Content</TabPanel>
</Tabs>

// Custom skeleton tab count
<Tabs isLoading skeletonTabCount={5}>
  <TabList>
    <Tab>Tab 1</Tab>
  </TabList>
  <TabPanel>Content</TabPanel>
</Tabs>

// With DataBinding loading
<Tabs
  isLoading={isLoadingTabs}
  skeletonTabCount={4}
>
  <TabList>
    {tabs.map(t => <Tab key={t.id}>{t.title}</Tab>)}
  </TabList>
  {tabs.map(t => <TabPanel key={t.id}>{t.content}</TabPanel>)}
</Tabs>
```

### Breadcrumbs

```tsx
import { Breadcrumbs, Breadcrumb, Link } from '@/shared/components';

// Loading state with default 3 skeleton items
<Breadcrumbs isLoading>
  <Breadcrumb><Link href="/">Home</Link></Breadcrumb>
</Breadcrumbs>

// Custom skeleton count
<Breadcrumbs isLoading skeletonCount={4}>
  <Breadcrumb><Link href="/">Home</Link></Breadcrumb>
</Breadcrumbs>

// With dynamic navigation loading
<Breadcrumbs
  isLoading={isLoadingPath}
  skeletonCount={breadcrumbs.length || 3}
>
  {breadcrumbs.map(b => (
    <Breadcrumb key={b.id}>
      <Link href={b.href}>{b.label}</Link>
    </Breadcrumb>
  ))}
</Breadcrumbs>
```

### Tree

```tsx
import { Tree, TreeItem } from '@/shared/components';

// Loading state with default 3 skeleton nodes
<Tree isLoading>
  <TreeItem title="Folder 1" />
</Tree>

// Custom skeleton node count
<Tree isLoading skeletonNodeCount={5}>
  <TreeItem title="Folder 1" />
</Tree>

// With hierarchical data loading
<Tree
  isLoading={isLoadingTree}
  skeletonNodeCount={7}
  dataBinding={dataBinding}
>
  {treeData.map(node => renderTreeItem(node))}
</Tree>
```

---

## 🎨 Styling Customization

### Custom Skeleton Colors

```css
/* Override skeleton colors */
:root {
  --skeleton-bg: #e5e7eb;           /* Base color */
  --skeleton-highlight: #f3f4f6;    /* Highlight color */
}

/* Dark mode */
[data-theme="dark"] {
  --skeleton-bg: #374151;
  --skeleton-highlight: #4b5563;
}
```

### Custom Animation Duration

```css
:root {
  --skeleton-animation-duration: 2s;  /* Slower animation */
}
```

### Disable Animation Globally

```css
/* For users with reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  .react-aria-Skeleton {
    animation: none !important;
  }
}
```

---

## 🔧 Advanced Patterns

### Staggered Animation for Lists

```tsx
// Skeleton items automatically get staggered animation delays
<ListBox isLoading skeletonCount={5}>
  {/* Each skeleton gets --skeleton-index: 0, 1, 2, 3, 4 */}
</ListBox>
```

### Conditional Skeleton with Delay

```tsx
// Avoid flash of skeleton for fast loads
const [showSkeleton, setShowSkeleton] = useState(false);

useEffect(() => {
  if (loading) {
    const timer = setTimeout(() => setShowSkeleton(true), 200);
    return () => clearTimeout(timer);
  }
  setShowSkeleton(false);
}, [loading]);

<ListBox isLoading={showSkeleton}>...</ListBox>
```

### Skeleton with Error State

```tsx
const { data, loading, error } = useFetchData();

if (error) {
  return <ErrorMessage error={error} />;
}

<ListBox isLoading={loading}>
  {data.map(item => <ListBoxItem key={item.id}>{item.name}</ListBoxItem>)}
</ListBox>
```

### Composing Multiple Skeletons

```tsx
// Dashboard with multiple loading states
function Dashboard() {
  const { userLoading } = useUser();
  const { statsLoading } = useStats();
  const { recentLoading } = useRecentItems();

  return (
    <div className="dashboard">
      <Card isLoading={userLoading}>
        <UserProfile />
      </Card>

      <Meter isLoading={statsLoading} value={usage} />

      <ListBox isLoading={recentLoading} skeletonCount={5}>
        {recentItems.map(item => (
          <ListBoxItem key={item.id}>{item.name}</ListBoxItem>
        ))}
      </ListBox>
    </div>
  );
}
```

---

## Phase 0: Foundation

### 0.1 Core Skeleton Component

**파일**: `src/shared/components/Skeleton.tsx`

```typescript
export interface SkeletonProps {
  // 기본 형태
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';

  // 애니메이션
  animation?: 'shimmer' | 'pulse' | 'wave' | 'none';

  // 크기
  width?: string | number;
  height?: string | number;

  // 텍스트 라인
  lines?: number;
  lineHeight?: string | number;
  lastLineWidth?: string;  // 마지막 줄 너비 (기본: 60%)

  // 컴포넌트별 variant
  componentVariant?: ComponentSkeletonVariant;

  // 스타일
  className?: string;
  style?: React.CSSProperties;
}

type ComponentSkeletonVariant =
  | 'button'
  | 'badge'
  | 'input'
  | 'checkbox'
  | 'switch'
  | 'slider'
  | 'list-item'
  | 'table-row'
  | 'tree-node'
  | 'card'
  | 'card-gallery'
  | 'tabs'
  | 'calendar'
  | 'progress'
  | 'avatar'
  | 'nav'
  | 'color-swatch';
```

### 0.2 CSS Foundation

**파일**: `src/shared/components/styles/Skeleton.css`

```css
@layer components {
  /* Base skeleton */
  .react-aria-Skeleton {
    --skeleton-bg: var(--surface-container);
    --skeleton-highlight: var(--surface-container-highest);
    background: var(--skeleton-bg);
    border-radius: var(--radius-sm);
  }

  /* Shimmer animation (Claude AI style) */
  @keyframes skeleton-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* Pulse animation */
  @keyframes skeleton-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  /* Wave animation */
  @keyframes skeleton-wave {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
}
```

### Deliverables
- [ ] `Skeleton.tsx` 기본 컴포넌트
- [ ] `Skeleton.css` 기본 스타일 + 애니메이션
- [ ] 3가지 애니메이션 타입 (shimmer, pulse, wave)
- [ ] 기본 variant (text, circular, rectangular, rounded)

---

## Phase 1: Text & Button Components

### 대상 컴포넌트 (8개)

| 컴포넌트 | Skeleton 형태 | 비고 |
|---------|-------------|------|
| Button | 버튼 형태 박스 | children 동적 로딩 |
| Badge | 작은 pill 형태 | 숫자/텍스트 로딩 |
| Link | 인라인 텍스트 | 텍스트 로딩 |
| Breadcrumb | 단일 경로 아이템 | 텍스트 로딩 |
| Breadcrumbs | 경로 아이템 그룹 | 여러 아이템 |
| Tooltip | 텍스트 박스 | 내용 로딩 |
| Content | 텍스트 블록 | children 로딩 |
| Field | 라벨 + 값 | 데이터 로딩 |

### 구현 패턴

```typescript
// Button with isLoading
export interface ButtonProps extends RACButtonProps {
  isLoading?: boolean;
  loadingText?: string;  // "Loading..." 등
}

export function Button({ isLoading, loadingText, children, ...props }: ButtonProps) {
  if (isLoading) {
    return (
      <RACButton {...props} isDisabled>
        <Skeleton componentVariant="button" />
        {loadingText && <span className="sr-only">{loadingText}</span>}
      </RACButton>
    );
  }
  return <RACButton {...props}>{children}</RACButton>;
}
```

### CSS Variants

```css
/* Button skeleton */
.react-aria-Skeleton.button {
  height: var(--button-height-md);
  width: 80px;
  border-radius: var(--radius-md);
}

.react-aria-Skeleton.button.sm { height: var(--button-height-sm); width: 60px; }
.react-aria-Skeleton.button.lg { height: var(--button-height-lg); width: 100px; }

/* Badge skeleton */
.react-aria-Skeleton.badge {
  height: 20px;
  width: 40px;
  border-radius: var(--radius-full);
}
```

### Deliverables
- [ ] Button `isLoading` prop
- [ ] Badge `isLoading` prop
- [ ] Link `isLoading` prop
- [ ] Breadcrumb/Breadcrumbs skeleton
- [ ] 텍스트 기반 컴포넌트 skeleton 스타일

---

## Phase 2: Form Input Components

### 대상 컴포넌트 (12개)

| 컴포넌트 | Skeleton 형태 | 비고 |
|---------|-------------|------|
| TextField | 라벨 + 입력 박스 | placeholder 로딩 |
| NumberField | 라벨 + 입력 + 버튼 | 초기값 로딩 |
| SearchField | 검색 입력 박스 | - |
| DateField | 날짜 입력 박스 | - |
| TimeField | 시간 입력 박스 | - |
| ColorField | 컬러 입력 + 스와치 | - |
| Checkbox | 체크박스 + 라벨 | 라벨 로딩 |
| Radio | 라디오 + 라벨 | 라벨 로딩 |
| Switch | 토글 스위치 | - |
| Slider | 슬라이더 트랙 + 썸 | 값 로딩 |
| ToggleButton | 토글 버튼 | 텍스트 로딩 |
| Form | 폼 전체 | 필드들 로딩 |

### 구현 패턴

```typescript
// TextField with isLoading
export interface TextFieldProps extends AriaTextFieldProps {
  isLoading?: boolean;
}

export function TextField({ isLoading, label, ...props }: TextFieldProps) {
  if (isLoading) {
    return (
      <div className="react-aria-TextField skeleton-container" aria-busy="true">
        {label && <Skeleton variant="text" width="30%" height={14} />}
        <Skeleton componentVariant="input" />
      </div>
    );
  }
  return <AriaTextField {...props}>{/* ... */}</AriaTextField>;
}
```

### CSS Variants

```css
/* Input skeleton */
.react-aria-Skeleton.input {
  height: var(--input-height-md);
  width: 100%;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}

/* Checkbox skeleton */
.react-aria-Skeleton.checkbox {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.react-aria-Skeleton.checkbox::before {
  content: '';
  width: 18px;
  height: 18px;
  border-radius: var(--radius-sm);
  background: var(--skeleton-bg);
}

/* Switch skeleton */
.react-aria-Skeleton.switch {
  width: 44px;
  height: 24px;
  border-radius: var(--radius-full);
}

/* Slider skeleton */
.react-aria-Skeleton.slider {
  height: 4px;
  width: 100%;
  border-radius: var(--radius-full);
}
```

### Deliverables
- [ ] TextField `isLoading` prop
- [ ] NumberField `isLoading` prop
- [ ] Checkbox/CheckboxGroup skeleton
- [ ] Radio/RadioGroup skeleton
- [ ] Switch skeleton
- [ ] Slider skeleton
- [ ] 입력 컴포넌트 skeleton 스타일

---

## Phase 3: Collection Components

### 대상 컴포넌트 (13개)

| 컴포넌트 | Skeleton 형태 | 비고 |
|---------|-------------|------|
| ListBox | 리스트 아이템 N개 | DataBinding 로딩 |
| ListBoxItem | 단일 아이템 | - |
| GridList | 그리드 아이템 N개 | DataBinding 로딩 |
| GridListItem | 단일 그리드 아이템 | - |
| Select | 드롭다운 + 아이템 | DataBinding 로딩 |
| ComboBox | 검색 + 아이템 | DataBinding 로딩 |
| Menu | 메뉴 아이템 N개 | DataBinding 로딩 |
| MenuItem | 단일 메뉴 아이템 | - |
| TagGroup | 태그 N개 | DataBinding 로딩 |
| Tree | 트리 노드 N개 | 계층 데이터 로딩 |
| RadioGroup | 라디오 N개 | DataBinding 로딩 |
| CheckboxGroup | 체크박스 N개 | DataBinding 로딩 |
| ToggleButtonGroup | 토글 버튼 N개 | DataBinding 로딩 |

### 구현 패턴

```typescript
// ListBox with isLoading
export interface ListBoxProps<T> extends RACListBoxProps<T> {
  isLoading?: boolean;
  skeletonCount?: number;  // 스켈레톤 아이템 개수 (기본: 5)
}

export function ListBox<T>({ isLoading, skeletonCount = 5, ...props }: ListBoxProps<T>) {
  if (isLoading) {
    return (
      <div className="react-aria-ListBox" aria-busy="true" aria-label="Loading...">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <Skeleton
            key={i}
            componentVariant="list-item"
            style={{ '--skeleton-index': i } as React.CSSProperties}
          />
        ))}
      </div>
    );
  }
  return <RACListBox {...props} />;
}
```

### CSS Variants

```css
/* List item skeleton - 너비 변화로 자연스러움 */
.react-aria-Skeleton.list-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2xs);
  padding: var(--spacing) var(--spacing-md);
}

.react-aria-Skeleton.list-item .skeleton-line.title {
  width: calc(70% + (var(--skeleton-index, 0) * 5%));
  max-width: 90%;
}

.react-aria-Skeleton.list-item .skeleton-line.desc {
  width: calc(50% - (var(--skeleton-index, 0) * 3%));
  min-width: 30%;
}

/* Tree node skeleton */
.react-aria-Skeleton.tree-node {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing);
}

.react-aria-Skeleton.tree-node::before {
  content: '';
  width: 16px;
  height: 16px;
  border-radius: var(--radius-xs);
  background: var(--skeleton-bg);
}
```

### 기존 collections.css 통합

현재 `src/shared/components/styles/collections.css`의 스켈레톤 시스템을 확장:

```css
/* 기존 코드 유지하면서 확장 */
.react-aria-ListBoxItem.skeleton,
.react-aria-GridListItem.skeleton,
/* ... 기존 선택자 ... */
.react-aria-TreeItem.skeleton {  /* 추가 */
  pointer-events: none;
  user-select: none;
}
```

### Deliverables
- [ ] ListBox/GridList `isLoading` prop
- [ ] Select/ComboBox `isLoading` prop
- [ ] Menu skeleton
- [ ] TagGroup skeleton
- [ ] Tree skeleton (계층 구조 표현)
- [ ] RadioGroup/CheckboxGroup skeleton
- [ ] 기존 collections.css 확장

---

## Phase 4: Table Component

### 대상

| 컴포넌트 | Skeleton 형태 | 비고 |
|---------|-------------|------|
| Table | 헤더 + 행 N개 | DataBinding 로딩 |
| TableHeader | 컬럼 헤더들 | - |
| TableBody | 행 스켈레톤 N개 | - |
| TableRow | 셀 스켈레톤들 | - |
| TableCell | 개별 셀 | - |

### 구현 패턴

```typescript
// Table with isLoading
export interface TableProps<T> {
  isLoading?: boolean;
  skeletonRows?: number;     // 기본: 10
  skeletonColumns?: number;  // columns prop에서 자동 계산 가능
}

function TableSkeleton({ rows, columns }: { rows: number; columns: number }) {
  return (
    <div className="react-aria-Table skeleton" aria-busy="true">
      {/* Header skeleton */}
      <div className="table-header-skeleton">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} variant="text" width={`${80 + Math.random() * 40}px`} />
        ))}
      </div>

      {/* Row skeletons */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="table-row-skeleton">
          {Array.from({ length: columns }).map((_, colIdx) => (
            <Skeleton
              key={colIdx}
              variant="text"
              width={`${60 + (colIdx * 10)}%`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
```

### CSS Variants

```css
/* Table skeleton */
.react-aria-Table.skeleton {
  width: 100%;
}

.table-header-skeleton {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--border-color);
  background: var(--surface-container-low);
}

.table-row-skeleton {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing) var(--spacing-md);
  border-bottom: 1px solid var(--border-color-light);
}

.table-row-skeleton:nth-child(even) {
  background: var(--surface-container-lowest);
}
```

### Deliverables
- [ ] Table `isLoading` prop
- [ ] TableHeader skeleton
- [ ] TableRow skeleton with varying cell widths
- [ ] 테이블 스켈레톤 스타일

---

## Phase 5: Card & Container Components

### 대상 컴포넌트 (10개)

| 컴포넌트 | Skeleton 형태 | 비고 |
|---------|-------------|------|
| Card | 이미지 + 헤더 + 본문 | 콘텐츠 로딩 |
| Panel | 컨테이너 박스 | 내부 콘텐츠 로딩 |
| Disclosure | 헤더 + 내용 | 접힘 콘텐츠 로딩 |
| DisclosureGroup | Disclosure N개 | - |
| Dialog | 모달 내용 | 동적 콘텐츠 로딩 |
| Modal | 오버레이 + 콘텐츠 | - |
| Popover | 팝오버 내용 | - |
| Slot | 슬롯 영역 | 자식 로딩 |
| Group | 그룹 컨테이너 | 자식 로딩 |
| Tabs | 탭 + 패널 | 패널 콘텐츠 로딩 |

### Card Skeleton 패턴

```typescript
export interface CardProps {
  isLoading?: boolean;
  skeletonLayout?: 'default' | 'gallery' | 'horizontal' | 'compact';
}

function CardSkeleton({ layout = 'default' }: { layout: CardProps['skeletonLayout'] }) {
  if (layout === 'gallery') {
    return (
      <div className="react-aria-Card skeleton gallery">
        <Skeleton variant="rectangular" height={200} />  {/* 이미지 */}
        <div className="card-content-skeleton">
          <Skeleton variant="text" width="70%" />
          <Skeleton variant="text" width="50%" height={12} />
        </div>
      </div>
    );
  }

  return (
    <div className="react-aria-Card skeleton">
      <div className="card-header-skeleton">
        <Skeleton variant="text" width="60%" height={18} />
        <Skeleton variant="text" width="40%" height={14} />
      </div>
      <div className="card-content-skeleton">
        <Skeleton variant="text" lines={3} />
      </div>
      <div className="card-footer-skeleton">
        <Skeleton variant="text" width="30%" height={12} />
      </div>
    </div>
  );
}
```

### CSS Variants

```css
/* Card skeleton */
.react-aria-Card.skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
}

.react-aria-Card.skeleton.gallery {
  padding: 0;
}

.react-aria-Card.skeleton.gallery .card-content-skeleton {
  padding: var(--spacing-md);
}

/* Tabs skeleton */
.react-aria-Tabs.skeleton .tab-list-skeleton {
  display: flex;
  gap: var(--spacing-sm);
  border-bottom: 1px solid var(--border-color);
  padding-bottom: var(--spacing-sm);
}

.react-aria-Tabs.skeleton .tab-panel-skeleton {
  padding: var(--spacing-lg);
}
```

### Deliverables
- [ ] Card `isLoading` prop (3가지 레이아웃)
- [ ] Panel skeleton
- [ ] Disclosure skeleton
- [ ] Dialog/Modal skeleton
- [ ] Tabs skeleton (탭 리스트 + 패널)
- [ ] 컨테이너 스켈레톤 스타일

---

## Phase 6: Calendar & Date Components

### 대상 컴포넌트 (4개)

| 컴포넌트 | Skeleton 형태 | 비고 |
|---------|-------------|------|
| Calendar | 월 헤더 + 날짜 그리드 | - |
| DatePicker | 입력 + 캘린더 팝오버 | - |
| DateRangePicker | 시작/종료 입력 + 캘린더 | - |
| Pagination | 페이지 버튼들 | - |

### Calendar Skeleton 패턴

```typescript
function CalendarSkeleton() {
  return (
    <div className="react-aria-Calendar skeleton" aria-busy="true">
      {/* Header: Month/Year + Nav */}
      <div className="calendar-header-skeleton">
        <Skeleton variant="text" width={100} />
        <div className="calendar-nav-skeleton">
          <Skeleton variant="circular" width={32} height={32} />
          <Skeleton variant="circular" width={32} height={32} />
        </div>
      </div>

      {/* Weekday headers */}
      <div className="calendar-weekdays-skeleton">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((_, i) => (
          <Skeleton key={i} variant="text" width={24} />
        ))}
      </div>

      {/* Date grid (6 rows x 7 cols) */}
      <div className="calendar-grid-skeleton">
        {Array.from({ length: 42 }).map((_, i) => (
          <Skeleton
            key={i}
            variant="circular"
            width={32}
            height={32}
            style={{ opacity: (i < 3 || i > 38) ? 0.3 : 1 }}
          />
        ))}
      </div>
    </div>
  );
}
```

### CSS Variants

```css
/* Calendar skeleton */
.react-aria-Calendar.skeleton {
  padding: var(--spacing-md);
}

.calendar-header-skeleton {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.calendar-weekdays-skeleton {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-sm);
}

.calendar-grid-skeleton {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: var(--spacing-xs);
}

/* Pagination skeleton */
.react-aria-Pagination.skeleton {
  display: flex;
  gap: var(--spacing-xs);
}
```

### Deliverables
- [ ] Calendar `isLoading` prop
- [ ] DatePicker skeleton
- [ ] DateRangePicker skeleton
- [ ] Pagination skeleton
- [ ] 캘린더/날짜 스켈레톤 스타일

---

## Phase 7: Progress & Visual Components

### 대상 컴포넌트 (7개)

| 컴포넌트 | Skeleton 형태 | 비고 |
|---------|-------------|------|
| ProgressBar | 진행 바 트랙 | 값 로딩 중 |
| Meter | 미터 바 트랙 | 값 로딩 중 |
| ColorPicker | 컬러 에리어 + 슬라이더 | - |
| ColorArea | 2D 컬러 영역 | - |
| ColorSlider | 컬러 슬라이더 | - |
| ColorWheel | 원형 컬러 휠 | - |
| ColorSwatch | 컬러 스와치 | - |
| ColorSwatchPicker | 스와치 그리드 | - |

### 구현 패턴

```typescript
// ProgressBar with isLoading (indeterminate 상태로 표시)
export interface ProgressBarProps {
  isLoading?: boolean;  // true면 indeterminate 애니메이션
}

// ColorSwatch skeleton
function ColorSwatchSkeleton() {
  return (
    <Skeleton
      variant="rounded"
      width={32}
      height={32}
      animation="pulse"
    />
  );
}
```

### CSS Variants

```css
/* Progress skeleton - indeterminate animation */
.react-aria-ProgressBar.skeleton .progress-track {
  overflow: hidden;
}

.react-aria-ProgressBar.skeleton .progress-track::after {
  content: '';
  position: absolute;
  top: 0;
  left: -50%;
  width: 50%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    var(--skeleton-highlight),
    transparent
  );
  animation: progress-shimmer 1.5s ease-in-out infinite;
}

@keyframes progress-shimmer {
  0% { left: -50%; }
  100% { left: 100%; }
}

/* Color swatch skeleton */
.react-aria-Skeleton.color-swatch {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
}

/* Color area skeleton */
.react-aria-Skeleton.color-area {
  width: 200px;
  height: 200px;
  border-radius: var(--radius-md);
}
```

### Deliverables
- [ ] ProgressBar `isLoading` (indeterminate)
- [ ] Meter `isLoading`
- [ ] ColorPicker skeleton
- [ ] ColorSwatch/ColorSwatchPicker skeleton
- [ ] 시각적 컴포넌트 스켈레톤 스타일

---

## Phase 8: Integration & Testing

### 8.1 withSkeleton HOC (Optional)

반복 패턴을 줄이기 위한 HOC:

```typescript
// src/shared/components/withSkeleton.tsx
export function withSkeleton<P extends { isLoading?: boolean }>(
  Component: React.ComponentType<P>,
  SkeletonComponent: React.ComponentType<Partial<P>>
) {
  return function WithSkeletonComponent(props: P) {
    if (props.isLoading) {
      return <SkeletonComponent {...props} />;
    }
    return <Component {...props} />;
  };
}

// Usage
export const ButtonWithSkeleton = withSkeleton(Button, ButtonSkeleton);
```

### 8.2 useSkeleton Hook

```typescript
// src/shared/hooks/useSkeleton.ts
export function useSkeleton(isLoading: boolean, delay = 200) {
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => setShowSkeleton(true), delay);
      return () => clearTimeout(timer);
    }
    setShowSkeleton(false);
  }, [isLoading, delay]);

  return showSkeleton;
}
```

### 8.3 Storybook Stories

```typescript
// src/stories/Skeleton.stories.tsx
export default {
  title: 'Components/Skeleton',
  component: Skeleton,
};

export const AllVariants = () => (
  <div className="skeleton-showcase">
    <Skeleton variant="text" />
    <Skeleton variant="circular" width={48} height={48} />
    <Skeleton variant="rectangular" width={200} height={100} />
    <Skeleton componentVariant="button" />
    <Skeleton componentVariant="input" />
    <Skeleton componentVariant="card" />
    {/* ... 모든 variant */}
  </div>
);

export const AnimationTypes = () => (
  <div className="animation-showcase">
    <Skeleton animation="shimmer" />
    <Skeleton animation="pulse" />
    <Skeleton animation="wave" />
    <Skeleton animation="none" />
  </div>
);
```

### 8.4 Testing

```typescript
// src/shared/components/__tests__/Skeleton.test.tsx
describe('Skeleton', () => {
  it('renders with correct variant class', () => {
    render(<Skeleton variant="circular" />);
    expect(screen.getByTestId('skeleton')).toHaveClass('circular');
  });

  it('applies shimmer animation by default', () => {
    render(<Skeleton />);
    expect(screen.getByTestId('skeleton')).toHaveClass('shimmer');
  });

  it('has correct aria attributes', () => {
    render(<Skeleton aria-label="Loading content" />);
    expect(screen.getByLabelText('Loading content')).toBeInTheDocument();
  });
});
```

### Deliverables
- [ ] withSkeleton HOC
- [ ] useSkeleton hook
- [ ] Storybook stories (모든 variant)
- [ ] Unit tests
- [ ] 문서화 (README, JSDoc)

---

## Timeline Summary

| Phase | Description | Components | Estimated |
|-------|-------------|------------|-----------|
| 0 | Foundation | Core Skeleton, CSS | - |
| 1 | Text & Button | 8개 | - |
| 2 | Form Input | 12개 | - |
| 3 | Collection | 13개 | - |
| 4 | Table | 5개 | - |
| 5 | Card & Container | 10개 | - |
| 6 | Calendar & Date | 4개 | - |
| 7 | Progress & Visual | 8개 | - |
| 8 | Integration | HOC, Hook, Tests | - |

**Total**: 60+ 컴포넌트 커버

---

## File Structure

```
src/shared/components/
├── Skeleton.tsx                 # Core skeleton component
├── withSkeleton.tsx             # HOC (Phase 8)
├── styles/
│   ├── Skeleton.css             # Skeleton styles
│   └── collections.css          # Extended (existing)
├── hooks/
│   └── useSkeleton.ts           # Skeleton hook
└── __tests__/
    └── Skeleton.test.tsx        # Tests
```

---

## Design Tokens Integration

```css
/* theme.css에 추가 */
:root {
  /* Skeleton tokens */
  --skeleton-bg: var(--surface-container);
  --skeleton-highlight: var(--surface-container-highest);
  --skeleton-animation-duration: 1.5s;
  --skeleton-animation-timing: ease-in-out;

  /* Dark mode */
  --skeleton-bg-dark: var(--surface-container);
  --skeleton-highlight-dark: var(--surface-container-high);
}
```

---

## Migration Strategy

기존 컴포넌트에 점진적으로 `isLoading` prop 추가:

1. **Breaking Change 없음**: `isLoading`은 optional prop
2. **Backward Compatible**: 기존 사용 코드 영향 없음
3. **점진적 적용**: Phase별로 컴포넌트 업데이트
4. **Documentation**: 각 컴포넌트 JSDoc에 `isLoading` 사용법 추가

---

## References

- [Material UI Skeleton](https://mui.com/material-ui/react-skeleton/)
- [Shadcn Skeleton](https://www.shadcn.io/ui/skeleton)
- [react-loading-skeleton](https://github.com/dvtng/react-loading-skeleton)
- [Tailwind CSS Skeleton - Flowbite](https://flowbite.com/docs/components/skeleton/)
- 현재 프로젝트: `src/shared/components/styles/collections.css`
