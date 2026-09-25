import assert from "node:assert/strict";

// 설계 모델: 각 함수는 하나의 보호 트랜잭션이 완료된 시점을 나타낸다.
// IndexedDB 구현·탭 간 트랜잭션·브라우저 G3를 실행한 결과가 아니다.
// 실행: pnpm exec node docs/adr/design/235-gc-reference-admission-model.mjs
function fixture() {
  return {
    bytes: true,
    epoch: 0,
    pins: new Set(),
    candidate: { epoch: 0, since: 0 },
    memoryRoot: false,
    durableRoot: false,
  };
}

function mark(state) {
  return {
    epoch: state.epoch,
    referenced: state.memoryRoot || state.durableRoot,
  };
}

function prepare(state, session) {
  if (!state.bytes) return false;
  state.pins.add(session);
  state.epoch += 1;
  state.candidate = null;
  return true;
}

function publish(state, session) {
  assert.ok(state.bytes && state.pins.has(session));
  state.memoryRoot = true;
}

function releaseAfterPersist(state, session) {
  assert.ok(state.durableRoot);
  state.pins.delete(session);
  state.epoch += 1;
  state.candidate = null;
}

function sweep(state, scan) {
  const candidate = state.candidate;
  if (
    !candidate ||
    state.pins.size ||
    scan.referenced ||
    state.epoch !== scan.epoch ||
    state.epoch !== candidate.epoch ||
    20 - candidate.since < 10
  )
    return false;
  state.bytes = false;
  state.candidate = null;
  state.epoch += 1; // hash 재등록에도 이 tombstone의 epoch를 이어 쓴다.
  return true;
}

const cases = [];

// 기존 조건은 두 번째 mark 뒤의 참조 추가를 관측하지 못한다.
{
  const state = fixture();
  const scan = mark(state);
  state.memoryRoot = true;
  if (!scan.referenced) state.bytes = false;
  assert.equal(state.memoryRoot && !state.bytes, true);
  cases.push("기존 설계: 참조 중인 바이트 삭제 반례 확인");
}

// 탭 A의 GC와 탭 B의 URL 참조 준비가 같은 메타데이터를 사용한다.
{
  const state = fixture();
  const scan = mark(state);
  assert.ok(prepare(state, "tab-b"));
  publish(state, "tab-b");
  assert.equal(sweep(state, scan), false);
  assert.ok(state.bytes && state.memoryRoot);
  cases.push("pin 선행: 기존 바이트 재저장 없이 참조·바이트 보존");
}

{
  const state = fixture();
  assert.equal(sweep(state, mark(state)), true);
  assert.equal(prepare(state, "tab-b"), false);
  assert.equal(state.memoryRoot, false);
  cases.push("삭제 선행: 참조 공개 거부");
}

{
  const state = fixture();
  assert.ok(prepare(state, "tab-b"));
  // 이 scan은 다른 세션의 미영속 root를 아직 보지 못한 최악의 경우다.
  const scan = mark(state);
  state.durableRoot = true;
  releaseAfterPersist(state, "tab-b");
  assert.notEqual(scan.epoch, state.epoch);
  assert.equal(sweep(state, scan), false);
  assert.ok(state.bytes);
  cases.push("영속화 뒤 pin 해제: 이전 mark 무효화");
}

{
  const state = fixture();
  assert.ok(prepare(state, "stopped-tab"));
  // 중단으로 root가 영속되지 않아도 pin은 시간만으로 해제하지 않는다.
  assert.equal(sweep(state, mark(state)), false);
  assert.ok(state.bytes);
  cases.push("세션 중단: 불명확한 pin 보존");
}

{
  const state = fixture();
  assert.equal(sweep(state, mark(state)), true);
  assert.equal(state.bytes, false);
  cases.push("대조군: 계속 미참조인 후보는 삭제");
}

console.log(JSON.stringify({ evidence: "design-model-only", cases }, null, 2));
