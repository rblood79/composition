/**
 * ADR-248 G6: the Skia scene node shape the Canvas renderers read, without the old canonical
 * scene builder (`canvasSceneNode.ts`, which reads the old adapters) — the catalog Canvas binding
 * fills it from composition root records.
 */
import type {
  CanonicalNode,
  DescendantOverride,
  StateDependency,
} from "@composition/shared";
import type { FillItem } from "../../../../types/builder/fill.types";
import type { CanvasProjectionMetadata } from "../canvasProjection";

export interface CanvasSceneNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  parentId: string | null;
  pageId: string | null;
  layoutId: string | null;
  /**
   * @deprecated ADR-126 transition alias. Prefer `parentId` in new Skia code.
   */
  parent_id?: string | null;
  /**
   * @deprecated ADR-126 transition alias. Prefer `pageId` in new Skia code.
   */
  page_id?: string | null;
  /**
   * Canonical scene nodes are omitted instead of marked deleted. Legacy
   * bootstrap adapters may still pass falsey deleted markers during transition.
   */
  deleted?: boolean;
  customId?: string;
  /**
   * @deprecated ADR-126 transition alias. Prefer `name`.
   */
  componentName?: string;
  name?: string;
  metadata?: CanonicalNode["metadata"];
  /**
   * Background fill 스택 — canonical 1차 필드 `CanonicalNode.fills` 운반.
   * Skia 소비: buildBoxNodeData(전체 fill 모델) / buildSpecNodeData catalog
   * 배경 채널(color fill). 빈 배열 대신 필드 생략. canonical boundary 는
   * unknown[] — Element 구조 호환을 위해 여기서 FillItem[] 로 narrow.
   */
  fills?: FillItem[];
  reusable?: true;
  /**
   * data-bound collection projection 컨테이너(box 경로)가 catalog "shell variant" 배경
   * (`{color.raised}` 등)을 그리도록 하는 마커 — catalog 컴포넌트 key("ListBox"/"GridList").
   * box 경로(buildBoxNodeData)는 catalog shell lookup 을 안 하므로, scene 이 collection 임을
   * 아는 시점에 마커를 심어 render 단에서 theme-aware 로 배경을 복원한다(사용자 배경 없을 때만).
   * 투명 컨테이너에서 drop-shadow 가 자식 행 실루엣을 캡처하던 문제 봉쇄(box-shadow = border-box).
   */
  collectionShellTag?: string;
  projection?: CanvasProjectionMetadata;
  ref?: string;
  descendants?: Record<string, DescendantOverride>;
  slot?: false | string[];
  /**
   * ADR-154 반응형 override. layout/render resolve 경로(useLayoutPublisher /
   * renderCommands)가 activeBreakpoint 기준 base⊕override merge 에 사용.
   * canonical `CanonicalNode.responsive` 에서 복사.
   */
  responsive?: CanonicalNode["responsive"];
  sizing?: CanonicalNode["sizing"];
  /** ADR-234 — 숨김 필드 (부재 = 상속 · false = 숨김 · true = 표시). */
  enabled?: boolean;
  /**
   * ADR-214 — 이 노드의 string prop 이 `{{ name }}` 으로 소비하는 상태 정의 digest
   * (이름 → id · type · defaultValue). projection signature 입력 — 소비 정의가 바뀌면 이
   * 노드만 갱신된다. 참조가 없으면 필드 생략 (비소비 노드 signature 무변경). Phase 3 이
   * 기본값으로 해석한 문자열을 `props` 에 얹을 때도 name/type 축 감시로 남는다.
   */
  stateDeps?: StateDependency[];
  /**
   * ADR-238 G4 — popover owner (Select · ComboBox · Menu) 의 항목을 scene 에서 뺐지만 canonical 에는 있다 — 빈 slot
   * 표시 (`hasVisibleSlotContent`) 가 "내용 있음" 으로 읽는다.
   */
  hasPopoverContent?: true;
  sourceNode: CanonicalNode;
}
