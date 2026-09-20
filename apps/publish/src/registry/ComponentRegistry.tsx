/**
 * Component Registry
 *
 * 🚀 Phase 10 B2.3: Publish App 컴포넌트 레지스트리
 *
 * Element type를 실제 React 컴포넌트로 매핑합니다.
 * @composition/shared의 컴포넌트를 사용하여 Builder Preview와 동일한 렌더링을 보장합니다.
 *
 * @since 2025-12-11 Phase 10 B2.3
 * @updated 2025-01-02 shared 컴포넌트 통합
 * @updated 2026-09-20 등록 블록 60개 → 표 하나 (/simplify). 소비처는 `getComponent` 뿐이다.
 */

import type { ComponentType, FunctionComponent } from "react";

// @composition/shared 컴포넌트 import
import {
  Button,
  TextField,
  NumberField,
  SearchField,
  Checkbox,
  CheckboxGroup,
  Radio,
  RadioGroup,
  Switch,
  Slider,
  Select,
  ComboBox,
  Form,
  ToggleButton,
  ToggleButtonGroup,
  DateField,
  TimeField,
  DatePicker,
  DateRangePicker,
  Calendar,
  RangeCalendar,
  ListBox,
  GridList,
  MenuButton,
  TagGroup,
  Tree,
  Table,
  Tabs,
  Link,
  Breadcrumbs,
  Pagination,
  Separator,
  Toolbar,
  Card,
  Disclosure,
  DisclosureGroup,
  Badge,
  Icon,
  ProgressBar,
  Meter,
  Skeleton,
  Dialog,
  Modal,
  Popover,
  Tooltip,
  Chart,
  FileUpload,
  Avatar,
  StatusLight,
  ProgressCircle,
  IllustratedMessage,
} from "@composition/shared/components";

type AnyComponent = ComponentType<Record<string, unknown>>;
type HtmlComponent = FunctionComponent<Record<string, unknown>>;

/** publish 는 실서버 전송 — preview 의 dryRun 기본값을 뒤집는다 (ADR-201 breakdown §3-4). */
function PublishFileUpload(props: Record<string, unknown>) {
  return <FileUpload {...(props as object)} dryRun={false} />;
}

/**
 * HTML 요소 컴포넌트 팩토리. `fixedClassName` 은 Card 구조 자식(CardHeader 등)의
 * 생성 CSS selector 용 — prop className 이 있으면 뒤에 붙는다.
 */
function createHtmlElement(
  type: string,
  fixedClassName?: string,
): HtmlComponent {
  const HtmlElement = (props: Record<string, unknown>) => {
    const { children, className: propClass, ...rest } = props;
    const className =
      [fixedClassName, propClass].filter(Boolean).join(" ") || undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Tag = type as any;
    return (
      <Tag className={className} {...rest}>
        {children}
      </Tag>
    );
  };
  HtmlElement.displayName = `Html${type.charAt(0).toUpperCase() + type.slice(1)}`;
  return HtmlElement;
}

/** Heading 요소 (level prop → h1~h6) */
const HeadingElement: HtmlComponent = (props) => {
  const { children, level, ...rest } = props;
  const type = `h${Math.min(Math.max(Number(level) || 3, 1), 6)}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Tag = type as any;
  return <Tag {...rest}>{children}</Tag>;
};
HeadingElement.displayName = "Heading";

/**
 * 기본 HTML 태그 — 그대로 같은 태그로 렌더 (body 는 div). 키가 곧 element type.
 */
const HTML_TAGS = [
  // layout
  "div",
  "section",
  "article",
  "header",
  "footer",
  "main",
  "aside",
  "nav",
  // display
  "span",
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "img",
  "a",
  // input
  "input",
  "textarea",
  "button",
  "select",
  "form",
] as const;

/**
 * type → 컴포넌트 표. 키가 element type 이고, 값이 없는 항목은 키와 같은 이름의
 * shared 컴포넌트다. `__tests__/publishRegistryCoverage.test.ts` 가 이 표의 키를
 * 소스 텍스트로 읽어 팔레트와 대조한다 — 표 밖에서 등록하지 않는다.
 */
// 값의 props 형태는 제각각이라 `never` 로 받고 (어떤 컴포넌트든 들어온다) 꺼낼 때 한 번만 넓힌다.
const SHARED_COMPONENTS: Record<string, ComponentType<never>> = {
  // Form
  Button,
  TextField,
  NumberField,
  SearchField,
  Checkbox,
  CheckboxGroup,
  Radio,
  RadioGroup,
  Switch,
  Slider,
  Select,
  ComboBox,
  Form,
  ToggleButton,
  ToggleButtonGroup,
  // Date/Time
  DateField,
  TimeField,
  DatePicker,
  DateRangePicker,
  Calendar,
  RangeCalendar,
  // Collection
  ListBox,
  GridList,
  MenuButton,
  TagGroup,
  Tree,
  Table,
  // ADR-194: 차트. builder Preview 와 **같은 shared Chart** 를 쓴다 — publish 만 다른
  //   컴포넌트를 쓰면 배포본에서만 차트가 달라지고, 그건 배포 후에야 드러난다.
  Chart,
  // ADR-201: 대용량 파일 업로드 compound. builder Preview 와 **같은 shared FileUpload** — 자식
  //   (DropZone/FileTrigger/샘플 행) 은 ElementRenderer 가 children 으로 넘기고 컴포넌트가 type
  //   으로 분류한다. publish 는 실전송 (dryRun false) — endpoint 는 project.json 의 apiEndpoints.
  FileUpload: PublishFileUpload,
  Tabs,
  // Navigation
  Link,
  Breadcrumbs,
  Pagination,
  // Layout
  Separator,
  Toolbar,
  Card,
  Disclosure,
  DisclosureGroup,
  // Feedback / Display
  Badge,
  ProgressBar,
  Meter,
  Skeleton,
  Icon,
  Avatar,
  StatusLight,
  ProgressCircle,
  IllustratedMessage,
  // ADR-030 placeholder — shared 컴포넌트가 아직 없어 맨 div 로 그린다.
  AvatarGroup: createHtmlElement("div"),
  InlineAlert: createHtmlElement("div"),
  ButtonGroup: createHtmlElement("div"),
  CardView: createHtmlElement("div"),
  TableView: createHtmlElement("div"),
  Image: createHtmlElement("img"),
  // Content (Card 등 복합 컴포넌트 자식)
  Text: createHtmlElement("span"),
  Heading: HeadingElement,
  Description: createHtmlElement("p"),
  // ADR-171 Phase 6 2a (2026-07-29): kebab 클래스(`card-header` 등) → house convention
  //   `react-aria-{Type}`. 생성 CSS(`.react-aria-CardHeader`)가 노리는 selector 이고,
  //   preview 축과 같은 값이어야 두 소비자가 대칭이다.
  CardHeader: createHtmlElement("div", "react-aria-CardHeader"),
  CardContent: createHtmlElement("div", "react-aria-CardContent"),
  CardPreview: createHtmlElement("div", "react-aria-CardPreview"),
  CardFooter: createHtmlElement("div", "react-aria-CardFooter"),
  // Overlay
  Dialog,
  Modal,
  Popover,
  Tooltip,
};

const registry = new Map<string, AnyComponent>(
  Object.entries(SHARED_COMPONENTS) as [string, AnyComponent][],
);
for (const tag of HTML_TAGS) registry.set(tag, createHtmlElement(tag));
registry.set("body", createHtmlElement("div")); // body 는 div 로 렌더링

/** element type 의 컴포넌트 (미등록이면 undefined) */
export function getComponent(type: string): AnyComponent | undefined {
  return registry.get(type);
}
