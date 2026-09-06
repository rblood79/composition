/** Scene 생성과 interaction 소비가 공유하는 render-space projection 계약. */
export type CanvasProjectionMetadata =
  | {
      kind: "page-frame-element";
      pageId: string;
      sourceElementId: string;
      renderElementId: string;
      renderParentId: string | null;
      canonicalParentId: string | null;
      slotName?: string;
      descendantPath?: string;
    }
  | {
      kind: "page-slot-fill";
      pageId: string;
      sourceElementId: string;
      renderElementId: string;
      renderParentId: string;
      canonicalParentId: string | null;
      slotName: string;
      descendantPath: string;
    }
  | {
      kind: "listbox-rows";
      listBoxId: string;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  | {
      kind: "listbox-row";
      listBoxId: string;
      itemKey: string;
      rowIndex: number;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  // ADR-150 A2 (ListBox 가상화): leading/trailing spacer — window 밖 행이 차지했을 높이를
  //   채우는 layout-only 노드(비-hit, 비-render 시각). row/rows-group/cell kind 가 아니라
  //   isCollectionRow(sGroup/Cell)ProjectionKind 가 모두 false → interaction/write handler 가
  //   자동 skip. 총 content height(스크롤바) + window 행 절대 위치를 보존.
  | {
      kind: "listbox-spacer";
      listBoxId: string;
      position: "lead" | "trail";
    }
  // ADR-150 A2 (GridList/Table 확산): listbox-spacer 동형 layout-only spacer.
  //   GridList grid 모드 spacer 는 width:100% 라 wrap-flow 에서 자체 시각 행을 점유(visual row
  //   경계 정합). Table spacer 는 header 행 아래에 삽입(header 는 항상 투영). 셋 다 비-hit·비-render.
  | {
      kind: "gridlist-spacer";
      listBoxId: string;
      position: "lead" | "trail";
    }
  | {
      kind: "table-spacer";
      listBoxId: string;
      position: "lead" | "trail";
    }
  // ADR-157 (data-bound collection 표시 정책): auto-height/unbounded 소유자의 샘플 window 밖
  //   나머지 행 영역 — 계산된 높이(hiddenRows × rowHeight)의 layout-참여 Box. spacer(비-render)와
  //   달리 overlay 가 사선 hatch + "+N more" 라벨을 그린다(빌더 저작 보조 시각, D3 대칭 비대상).
  //   deep hit 시 owner(listBoxId) select redirect. hiddenRows 는 라벨 텍스트용.
  | {
      kind: "collection-remainder";
      listBoxId: string;
      hiddenRows: number;
    }
  // ADR-912 단계 4 C1 (GridList projection): listbox-row/rows 동형 메타.
  //   `listBoxId` 는 collection owner id 의미로 일반화(GridList node id). GridList 는 origin/anchor
  //   인프라 부재(factory children:[])라 templateAnchorId/templateOriginId 는 항상 null.
  //   downstream(write-target/interaction) 은 generic helper `isCollectionRowProjectionKind` 로
  //   listbox/gridlist 를 같은 handler 로 처리(본문 복제 0, OR 판정만 단일 진입점).
  | {
      kind: "gridlist-rows";
      listBoxId: string;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  | {
      kind: "gridlist-row";
      listBoxId: string;
      itemKey: string;
      rowIndex: number;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  // ADR-912 단계 4 C1 (Table 2D projection): RowsGroup → Row[i] → Cell[i][j] 2D.
  //   listbox/gridlist 의 row 1단 대비 cell 차원이 추가됨(table-cell). `listBoxId` 는
  //   collection owner(Table node id)로 의미 일반화. table-rows/row 는 downstream generic
  //   helper(isCollectionRow(sGroup)ProjectionKind) 가 listbox/gridlist 와 같은 handler 로
  //   처리, table-cell 은 columnId write-target 라우팅을 위해 별도 kind.
  | {
      kind: "table-rows";
      listBoxId: string;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  | {
      kind: "table-row";
      listBoxId: string;
      itemKey: string;
      rowIndex: number;
      isHeader: boolean;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  | {
      kind: "table-cell";
      listBoxId: string;
      itemKey: string;
      rowIndex: number;
      columnId: string;
      isHeader: boolean;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  // ADR-912 영역 B (A) — TagGroup chip projection: chip = collection row 동형(1단 row).
  //   listbox/gridlist row 와 동형 메타(listBoxId=collection owner=TagList scene node id /
  //   itemKey / rowIndex). origin/anchor 인프라 부재(TagGroup factory TagList children:[],
  //   items propagation) → templateAnchorId/templateOriginId 항상 null(GridList 동형).
  //   chip 본체(tag-row)는 deep hit 시 owner(TagGroup) select redirect.
  | {
      kind: "tag-rows";
      listBoxId: string;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  | {
      kind: "tag-row";
      listBoxId: string;
      itemKey: string;
      rowIndex: number;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  // ADR-912 영역 B (A) — TabList tab projection: tab = collection row 동형(1단 row).
  //   tag-row 와 동형 메타(listBoxId=collection owner=TabList scene node id / itemKey / rowIndex).
  //   items SSOT(Tabs.props.items → propagation → TabList.props.items) → templateAnchorId/
  //   templateOriginId 항상 null(GridList/Tag 동형). tab 본체(tab-row)는 deep hit 시 owner(Tabs)
  //   select redirect. 이전 implicitStyles virtual Tab(layout-synthetic)을 render-space 로 이전.
  | {
      kind: "tab-rows";
      listBoxId: string;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  | {
      kind: "tab-row";
      listBoxId: string;
      itemKey: string;
      rowIndex: number;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  | {
      kind: "breadcrumb-rows";
      listBoxId: string;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    }
  | {
      kind: "breadcrumb-row";
      listBoxId: string;
      itemKey: string;
      rowIndex: number;
      templateAnchorId: string | null;
      templateOriginId: string | null;
    };

export type PageProjectionMetadata = Extract<
  CanvasProjectionMetadata,
  { kind: "page-frame-element" | "page-slot-fill" }
>;
