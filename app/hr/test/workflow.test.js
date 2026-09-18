import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  workflowReducer as reduce,
  isVerified,
  restoreState,
  workflowLabel,
} from "../src/workflow.js";
import { resources, dimensions, timeline } from "../src/data.js";
const sent = () =>
  reduce(initialState, { type: "SEND", at: "2026-09-19T02:00:00Z" });
const submitted = () => reduce(sent(), { type: "LOAD_SUBMISSION" });

test("full evidence loop requires a submission and explicit human confirmation", () => {
  assert.equal(isVerified(initialState), false);
  assert.equal(
    reduce(initialState, { type: "DECIDE", decision: "confirm" }),
    initialState,
  );
  const afterSend = sent();
  assert.equal(afterSend.stage, "sent");
  assert.equal(isVerified(afterSend), false);
  const afterSubmission = reduce(afterSend, { type: "LOAD_SUBMISSION" });
  assert.equal(workflowLabel(afterSubmission), "In Review");
  assert.equal(isVerified(afterSubmission), false);
  const result = reduce(afterSubmission, {
    type: "DECIDE",
    decision: "confirm",
    notes: "Sources reviewed.",
    at: "2026-09-19T02:20:00Z",
  });
  assert.equal(isVerified(result), true);
  assert.equal(workflowLabel(result), "Review Complete");
  assert.equal(result.notes, "Sources reviewed.");
  assert.deepEqual(restoreState(JSON.stringify(result)), result);
});
for (const [decision, label] of [
  ["more", "Needs More Evidence"],
  ["insufficient", "Evidence Still Insufficient"],
]) {
  test(`${label} retains uncertainty and requires a useful review note`, () => {
    const state = submitted();
    assert.equal(
      reduce(state, { type: "DECIDE", decision, notes: "  " }),
      state,
    );
    const result = reduce(state, {
      type: "DECIDE",
      decision,
      notes: "  Explain how to test the two hypotheses.  ",
      at: "2026-09-19T02:20:00Z",
    });
    assert.equal(isVerified(result), false);
    assert.equal(workflowLabel(result), label);
    assert.equal(result.notes, "Explain how to test the two hypotheses.");
    const reopened = reduce(result, { type: "REOPEN" });
    assert.equal(reopened.stage, "submitted");
    assert.equal(reopened.decision, null);
  });
}
test("send and load cannot skip steps or repeat submissions", () => {
  assert.equal(reduce(initialState, { type: "LOAD_SUBMISSION" }), initialState);
  const empty = reduce(initialState, { type: "EDIT_TASK", value: "  " });
  assert.equal(reduce(empty, { type: "SEND" }), empty);
  const state = sent();
  assert.equal(reduce(state, { type: "SEND" }), state);
  assert.equal(reduce(state, { type: "EDIT_TASK", value: "changed" }), state);
  const work = submitted();
  assert.equal(reduce(work, { type: "LOAD_SUBMISSION" }), work);
});
test("regenerate updates the editable task; reset returns a fresh demo", () => {
  const regenerated = reduce(initialState, { type: "REGENERATE" });
  assert.notEqual(regenerated.instructions, initialState.instructions);
  assert.equal(regenerated.revision, 2);
  assert.equal(reduce(sent(), { type: "REGENERATE" }).revision, 1);
  const verified = reduce(submitted(), {
    type: "DECIDE",
    decision: "confirm",
    notes: "",
  });
  assert.deepEqual(reduce(verified, { type: "RESET" }), initialState);
  assert.equal(isVerified(reduce(verified, { type: "REOPEN" })), false);
});
test("unreadable browser state restores the initial report", () => {
  for (const raw of [
    null,
    "bad json",
    "{}",
    '{"stage":"reviewed"}',
    JSON.stringify({ ...initialState, stage: "reviewed", decision: "hire" }),
  ])
    assert.deepEqual(restoreState(raw), initialState);
});
test("every displayed evidence link resolves to a source", () => {
  const workKeys = [
    "summary",
    "finding",
    "hypothesis",
    "data",
    "recommendation",
  ];
  assert.equal(dimensions.length, 5);
  for (const item of dimensions) assert.ok(workKeys.includes(item.target));
  for (const item of timeline)
    assert.ok(item.source in resources || workKeys.includes(item.source));
});
test("aggregate demo metrics match the fixed scenario", () => {
  const traffic = resources["website_traffic.csv"]
    .split("\n")
    .slice(1)
    .map((line) => line.split(","));
  const [previous, current] = traffic;
  assert.equal(Number(current[1]) / Number(previous[1]), 1.18);
  assert.equal(Number(current[2]) / Number(current[1]), 0.026);
  assert.equal(Number(previous[2]) / Number(previous[1]), 0.034);
  const channelSessions = resources["campaigns.csv"]
    .split("\n")
    .slice(1)
    .reduce((sum, line) => sum + Number(line.split(",")[2]), 0);
  assert.equal(channelSessions, Number(current[1]));
});
