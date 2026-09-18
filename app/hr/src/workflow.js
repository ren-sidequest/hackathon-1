export const STORAGE_KEY = "evidencebridge.hr.demo.v1";
export const defaultInstructions =
  "Investigate what is driving the conversion decline. Use the supplied data to identify the strongest signals, form testable hypotheses, and recommend a prioritised next step. Distinguish what the data shows from what still needs to be validated.";
export const alternativeInstructions =
  "Start by comparing conversion across channels, then examine device and landing-page patterns. Explain the likely drivers, cite supporting data, and propose the additional evidence and next action that would most reduce uncertainty.";
export const initialState = {
  stage: "initial",
  revision: 1,
  instructions: defaultInstructions,
  decision: null,
  notes: "",
  sentAt: null,
  reviewedAt: null,
};
export const hasSubmission = (state) =>
  ["submitted", "reviewed"].includes(state.stage);
export const isVerified = (state) =>
  state.stage === "reviewed" && state.decision === "confirm";
export function workflowReducer(state, action) {
  switch (action.type) {
    case "EDIT_TASK":
      return state.stage === "initial"
        ? { ...state, instructions: action.value }
        : state;
    case "REGENERATE":
      return state.stage === "initial"
        ? {
            ...state,
            revision: state.revision + 1,
            instructions:
              state.revision % 2
                ? alternativeInstructions
                : defaultInstructions,
          }
        : state;
    case "SEND":
      return state.stage === "initial" && state.instructions.trim()
        ? { ...state, stage: "sent", sentAt: action.at }
        : state;
    case "LOAD_SUBMISSION":
      return state.stage === "sent" ? { ...state, stage: "submitted" } : state;
    case "DECIDE": {
      if (
        state.stage !== "submitted" ||
        !["confirm", "more", "insufficient"].includes(action.decision)
      )
        return state;
      if (action.decision !== "confirm" && !action.notes?.trim()) return state;
      return {
        ...state,
        stage: "reviewed",
        decision: action.decision,
        notes: action.notes?.trim() || "",
        reviewedAt: action.at,
      };
    }
    case "REOPEN":
      return state.stage === "reviewed"
        ? { ...state, stage: "submitted", decision: null, reviewedAt: null }
        : state;
    case "RESET":
      return { ...initialState };
    default:
      return state;
  }
}
export function restoreState(raw) {
  try {
    const state = JSON.parse(raw);
    if (
      !state ||
      !["initial", "sent", "submitted", "reviewed"].includes(state.stage) ||
      typeof state.instructions !== "string" ||
      !Number.isInteger(state.revision) ||
      typeof state.notes !== "string"
    )
      return { ...initialState };
    if (
      state.stage === "reviewed" &&
      !["confirm", "more", "insufficient"].includes(state.decision)
    )
      return { ...initialState };
    return { ...initialState, ...state };
  } catch {
    return { ...initialState };
  }
}
export function workflowLabel(state) {
  if (state.stage === "initial") return "Pending";
  if (state.stage === "sent") return "Sent";
  if (state.stage === "submitted") return "In Review";
  return {
    confirm: "Review Complete",
    more: "Needs More Evidence",
    insufficient: "Evidence Still Insufficient",
  }[state.decision];
}
