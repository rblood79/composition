/**
 * ADR-313 Decision 7 · §2.5 · G3 — 생성 미리보기 · API 저장의 열 표: 열마다 「타입 + 값 표현」 (감지한
 * 타입 · 표본에서 제안한 후보 — 자동으로 확정하지 않는다) 과 표 하나의 key 필드, 그리고 지금 선택으로 읽은
 * 셀의 어긋남 수 (타입과 다른 셀 · 읽지 못한 셀 · 정밀도를 잃는 셀). 패널 어법: `fieldset-row` +
 * `PropertySelect` (라벨 = 열 이름), 상태 문구는 필드 안 `slot="description"`.
 */
import type { IntakeReport } from "../../../../../../../packages/shared/src/collections/intake/normalizeRows";
import { PropertySelect } from "../../../components/property/PropertySelect";
import type { DetectedColumn } from "../utils/columnDetector";
import {
  choiceId,
  choiceLabel,
  columnChoices,
  type ColumnChoice,
} from "../utils/encodingChoices";

type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

export interface ColumnIntakeTableProps {
  /** 감지한 열 (선택 전). */
  detected: readonly DetectedColumn[];
  /** 열 key → 사용자가 고른 선택 (없으면 감지 그대로). */
  choices: Readonly<Record<string, ColumnChoice>>;
  onChoice: (key: string, choice: ColumnChoice) => void;
  /** key 필드로 고른 열 key (없음 = `null`). */
  keyColumn: string | null;
  onKeyColumn: (key: string | null) => void;
  /** 지금 선택으로 읽은 결과의 셈. */
  report?: IntakeReport;
  dt: Translate;
}

const NONE = "";

export function ColumnIntakeTable({
  detected,
  choices,
  onChoice,
  keyColumn,
  onKeyColumn,
  report,
  dt,
}: ColumnIntakeTableProps) {
  const candidateKeys = new Set(
    detected.filter((c) => c.keyCandidate).map((c) => c.key),
  );
  return (
    <div className="datatable-intake-table">
      <div className="fieldset-row" data-wide>
        <PropertySelect
          className="datatable-intake-key"
          label={dt("intakeKeyField")}
          value={keyColumn ?? NONE}
          optionValueMode="literal"
          translateOptions={false}
          options={[
            { value: NONE, label: dt("intakeKeyNone") },
            ...detected.map((c) => ({ value: c.key, label: c.key })),
          ]}
          descriptions={Object.fromEntries(
            [...candidateKeys].map((key) => [key, dt("intakeKeySuggested")]),
          )}
          onChange={(value) => onKeyColumn(value === NONE ? null : value)}
        />
      </div>
      {detected.map((column) => {
        const base: ColumnChoice = {
          type: column.type,
          ...(column.encoding ? { encoding: column.encoding } : {}),
        };
        const current = choices[column.key] ?? base;
        const options = columnChoices(
          { type: column.type },
          [...(column.encoding ? [base] : []), ...column.candidates],
          current,
        );
        const suggested = new Set(column.candidates.map(choiceId));
        const counts = [
          ["intakeTypeMismatch", report?.typeMismatch[column.key]],
          ["intakeUnread", report?.unread[column.key]],
          ["intakePrecision", report?.precision[column.key]],
        ].filter((entry): entry is [string, number] => !!entry[1]);
        return (
          <div className="fieldset-row" data-wide key={column.key}>
            <PropertySelect
              className="datatable-intake-column"
              label={column.key}
              value={choiceId(current)}
              optionValueMode="literal"
              translateOptions={false}
              options={options.map((choice) => ({
                value: choiceId(choice),
                label: choiceLabel(choice, dt),
              }))}
              descriptions={Object.fromEntries(
                options
                  .filter((choice) => suggested.has(choiceId(choice)))
                  .map((choice) => [choiceId(choice), dt("intakeSuggested")]),
              )}
              onChange={(value) => {
                const choice = options.find((item) => choiceId(item) === value);
                if (choice) onChoice(column.key, choice);
              }}
              afterControl={
                counts.length ? (
                  <span slot="description" className="datatable-intake-counts">
                    {counts
                      .map(([key, count]) => dt(key, { count }))
                      .join(" · ")}
                  </span>
                ) : undefined
              }
            />
          </div>
        );
      })}
    </div>
  );
}
