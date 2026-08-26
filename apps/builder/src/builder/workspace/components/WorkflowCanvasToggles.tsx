import { Checkbox } from "@composition/shared/components";
import { TAILWIND_PALETTE } from "@composition/specs";
import { useStore } from "../../stores";

const EdgeStyleIcon: React.FC<{
  style: "solid" | "dashed" | "dotted" | "group";
  color: string;
}> = ({ style, color }) => {
  const w = 20;
  const h = 10;
  const y = h / 2;

  if (style === "group") {
    return (
      <svg width={w} height={h} aria-hidden="true" style={{ flexShrink: 0 }}>
        <rect
          x={1}
          y={0.5}
          width={18}
          height={9}
          rx={2}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeDasharray="4 2"
        />
      </svg>
    );
  }

  let strokeDasharray: string | undefined;
  if (style === "dashed") strokeDasharray = "6 4";
  if (style === "dotted") strokeDasharray = "3 3";

  return (
    <svg width={w} height={h} aria-hidden="true" style={{ flexShrink: 0 }}>
      <line
        x1={0}
        y1={y}
        x2={w}
        y2={y}
        stroke={color}
        strokeWidth={2}
        strokeDasharray={strokeDasharray}
        strokeLinecap="round"
      />
    </svg>
  );
};

export function WorkflowCanvasToggles() {
  const showOverlay = useStore((s) => s.showWorkflowOverlay);
  const showNavigation = useStore((s) => s.showWorkflowNavigation);
  const showEvents = useStore((s) => s.showWorkflowEvents);
  const showDataSources = useStore((s) => s.showWorkflowDataSources);
  const showLayoutGroups = useStore((s) => s.showWorkflowLayoutGroups);
  const straightEdges = useStore((s) => s.workflowStraightEdges);
  const setNavigation = useStore((s) => s.setShowWorkflowNavigation);
  const setEvents = useStore((s) => s.setShowWorkflowEvents);
  const setDataSources = useStore((s) => s.setShowWorkflowDataSources);
  const setLayoutGroups = useStore((s) => s.setShowWorkflowLayoutGroups);
  const setStraightEdges = useStore((s) => s.setWorkflowStraightEdges);

  if (!showOverlay) return null;

  return (
    <div className="workflow-canvas-toggles">
      <Checkbox
        isSelected={showNavigation}
        onChange={setNavigation}
        size="sm"
        isTreeItemChild
      >
        <span className="workflow-toggle-label">
          <EdgeStyleIcon style="solid" color={TAILWIND_PALETTE.blue[500]} />
          Navigation
        </span>
      </Checkbox>
      <Checkbox
        isSelected={showEvents}
        onChange={setEvents}
        size="sm"
        isTreeItemChild
      >
        <span className="workflow-toggle-label">
          <EdgeStyleIcon style="dashed" color={TAILWIND_PALETTE.purple[500]} />
          Events
        </span>
      </Checkbox>
      <Checkbox
        isSelected={showDataSources}
        onChange={setDataSources}
        size="sm"
        isTreeItemChild
      >
        <span className="workflow-toggle-label">
          <EdgeStyleIcon style="dotted" color={TAILWIND_PALETTE.green[500]} />
          Data Sources
        </span>
      </Checkbox>
      <Checkbox
        isSelected={showLayoutGroups}
        onChange={setLayoutGroups}
        size="sm"
        isTreeItemChild
      >
        <span className="workflow-toggle-label">
          <EdgeStyleIcon style="group" color={TAILWIND_PALETTE.violet[400]} />
          Layout Groups
        </span>
      </Checkbox>
      <div className="workflow-toggle-divider" />
      <Checkbox
        isSelected={straightEdges}
        onChange={setStraightEdges}
        size="sm"
        isTreeItemChild
      >
        <span className="workflow-toggle-label">Orthogonal</span>
      </Checkbox>
    </div>
  );
}
