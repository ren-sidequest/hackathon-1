import React, { useEffect, useReducer, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Badge,
  Button,
  Card,
  ChannelChart,
  EmptyState,
  FileRow,
  Icon,
  Modal,
  SectionTitle,
} from "./components.jsx";
import {
  dimensions,
  requirements,
  resources,
  timeline,
  workSections,
} from "./data.js";
import {
  hasSubmission,
  initialState,
  isVerified,
  restoreState,
  STORAGE_KEY,
  workflowLabel,
  workflowReducer,
} from "./workflow.js";
import "./styles.css";

const nav = [
  { id: "jobs", label: "Job Requirements", icon: "briefcase" },
  { id: "candidates", label: "Candidates", icon: "users" },
  { id: "report", label: "Evidence Report", icon: "report" },
  { id: "tasks", label: "Tasks", icon: "task" },
  { id: "review", label: "Review", icon: "shield" },
];
const route = () =>
  nav.some((n) => n.id === location.hash.slice(1))
    ? location.hash.slice(1)
    : "report";
const toneFor = (state) =>
  isVerified(state)
    ? "green"
    : state.decision === "insufficient"
      ? "red"
      : state.decision === "more" || state.stage === "initial"
        ? "amber"
        : "blue";
const prettyTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-AU", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
function download(name, content, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function App() {
  const [state, dispatch] = useReducer(workflowReducer, null, () => {
    try {
      return restoreState(localStorage.getItem(STORAGE_KEY));
    } catch {
      return { ...initialState };
    }
  });
  const [page, setPage] = useState(route);
  const [tab, setTab] = useState("sample");
  const [reportView, setReportView] = useState("current");
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [processFilter, setProcessFilter] = useState("All events");
  const [busy, setBusy] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setStorageWarning(false);
    } catch {
      setStorageWarning(true);
    }
  }, [state]);
  useEffect(() => {
    const onHash = () => {
      setPage(route());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  const go = (id) => {
    setPage(id);
    location.hash = id;
    window.scrollTo(0, 0);
  };
  const source = (key) => setModal({ type: "source", key });
  const notify = (text) => setToast(text);
  const send = () => {
    dispatch({ type: "SEND", at: new Date().toISOString() });
    notify("Targeted task sent to Alex Chen.");
  };
  const loadSubmission = () => {
    dispatch({ type: "LOAD_SUBMISSION" });
    setTab("sample");
    go("review");
    notify("Demo work sample received. Ready for your review.");
  };
  const decide = (decision) => {
    setNotes(state.notes);
    setModal({ type: "decision", decision });
  };
  const confirmDecision = () => {
    dispatch({
      type: "DECIDE",
      decision: modal.decision,
      notes,
      at: new Date().toISOString(),
    });
    setModal(null);
    setReportView("current");
    go("report");
    notify("Human review saved. Evidence report updated.");
  };
  const regenerate = () => {
    setBusy(true);
    setTimeout(() => {
      dispatch({ type: "REGENERATE" });
      setBusy(false);
      notify(
        "Task instructions regenerated. The evidence target is unchanged.",
      );
    }, 600);
  };
  const exportReport = () => {
    const status = isVerified(state)
      ? "Verified through targeted task"
      : "Uncertain";
    setModal({
      type: "export",
      content: `# EvidenceBridge · Evidence report\n\nAlex Chen · Junior Data Analyst\nHarbourCart Pty Ltd\n\n## Requirement mapping\n- SQL: Supported\n- Data Analysis: Supported\n- Business Problem Solving: ${status}\n\n## Current workflow\n${workflowLabel(state)}\n\n## Evidence sources\n${requirements.map((r) => `${r.title}: ${r.source}\n${r.summary}`).join("\n\n")}\n\n${
        hasSubmission(state)
          ? "## Targeted work sample\nConversion Drop Investigation\n\n" +
            Object.values(workSections)
              .map((s) => `### ${s.title}\n${s.text}`)
              .join("\n\n")
          : ""
      }\n\n## Human review\n${state.stage === "reviewed" ? `${workflowLabel(state)} · Jamie Morgan\n${state.notes || "Observed evidence supports the targeted requirement."}\n${prettyTime(state.reviewedAt)}` : "Pending"}\n\n## Remaining uncertainty\n${isVerified(state) ? "Causal explanations remain unvalidated; this task demonstrates problem-solving behavior in a bounded scenario." : state.stage === "reviewed" ? state.notes : requirements[2].uncertainty}\n\nDemo data · Pre-generated evidence · HR workspace\n`,
    });
  };
  const reviewed = state.stage === "reviewed";
  const verified = isVerified(state) && reportView === "current";
  const initialReport = reportView === "initial";
  const postTaskReport = reviewed && !initialReport;
  const activeStep =
    state.stage === "initial"
      ? 1
      : state.stage === "sent"
        ? 2
        : state.stage === "submitted"
          ? 3
          : 4;
  const heading = (
    title,
    description,
    action,
    eyebrow = "JUNIOR DATA ANALYST",
  ) => (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
  const candidateStrip = () => (
    <div className="candidate-strip">
      <span className="avatar candidate">AC</span>
      <div>
        <strong>Alex Chen</strong>
        <span>
          Junior Data Analyst <i /> Application #HC-024
        </span>
      </div>
      <Badge tone={toneFor(state)}>{workflowLabel(state)}</Badge>
      <div className="strip-meta">
        <Icon name="file" size={15} /> 3 application materials <span>·</span>{" "}
        Applied 18 Sep 2026
      </div>
    </div>
  );
  const stepper = () => (
    <div className="stepper" aria-label="Evidence review progress">
      {[
        "Existing evidence",
        "Evidence gap",
        "Targeted task",
        "Human review",
        "Updated report",
      ].map((s, i) => (
        <div
          key={s}
          className={`step ${i < activeStep ? "complete" : ""} ${i === activeStep ? "current" : ""}`}
          aria-current={i === activeStep ? "step" : undefined}
        >
          <span>
            {i < activeStep ? <Icon name="check" size={13} /> : i + 1}
          </span>
          <small>{s}</small>
          {i < 4 && <div className="step-line" />}
        </div>
      ))}
    </div>
  );
  const resourceList = () => (
    <div className="file-list">
      {Object.keys(resources).map((name) => (
        <FileRow key={name} name={name} onClick={() => source(name)} />
      ))}
    </div>
  );
  const reviewActions = () => (
    <div className="decision-bar">
      <div className="decision-caption">
        <span className="icon-tile">
          <Icon name="shield" />
        </span>
        <div>
          <strong>Your review closes the evidence gap</strong>
          <small>AI surfaces observations. You make the judgement.</small>
        </div>
      </div>
      <div className="button-row">
        <Button
          variant="ghost danger-text"
          onClick={() => decide("insufficient")}
        >
          Evidence Still Insufficient
        </Button>
        <Button onClick={() => decide("more")}>Needs More Evidence</Button>
        <Button
          variant="primary"
          icon="check"
          onClick={() => decide("confirm")}
        >
          Confirm
        </Button>
      </div>
    </div>
  );

  function Jobs() {
    return (
      <>
        {heading(
          "Job requirements",
          "The capabilities that matter for this role.",
          <Button
            variant="primary"
            icon="arrow"
            onClick={() => go("candidates")}
          >
            View candidates
          </Button>,
          "HIRING WORKSPACE",
        )}
        <Card className="job-hero">
          <div className="company-mark">
            <Icon name="briefcase" size={30} />
          </div>
          <div>
            <div className="small-label">HarbourCart Pty Ltd</div>
            <h2>Junior Data Analyst</h2>
            <p>
              Help a growing e-commerce team turn data into better business
              decisions.
            </p>
            <div className="metadata">
              <span>
                <Icon name="pin" size={15} />
                Sydney, AU
              </span>
              <span>
                <Icon name="briefcase" size={15} />
                Full-time
              </span>
              <span>
                <Icon name="users" size={15} />
                Data & Analytics
              </span>
            </div>
          </div>
          <Badge tone="green">Active role</Badge>
        </Card>
        <div className="two-columns">
          <div>
            <SectionTitle
              eyebrow="ROLE EXPECTATIONS"
              title="Three requirements. Clear evidence."
            />
            <div className="requirement-list">
              {requirements.map((r, i) => (
                <Card key={r.title} className="job-requirement">
                  <span className="number">0{i + 1}</span>
                  <div>
                    <h3>{r.title}</h3>
                    <p>{r.statement}</p>
                    <span className="small-label">
                      {i === 2
                        ? "Observe through a realistic work sample"
                        : "Map to application materials"}
                    </span>
                  </div>
                  <Icon name={r.icon} size={24} />
                </Card>
              ))}
            </div>
          </div>
          <div className="side-stack">
            <Card className="padded">
              <span className="icon-tile">
                <Icon name="compass" />
              </span>
              <h3>Review what is demonstrated</h3>
              <p>
                Map each requirement to a concrete source. Where the evidence is
                unclear, ask for a focused work sample.
              </p>
              <div className="mini-flow">
                <span>Application materials</span>
                <Icon name="arrow" />
                <span>Observable evidence</span>
              </div>
            </Card>
            <Card className="padded">
              <div className="eyebrow">CURRENT PIPELINE</div>
              <div className="pipeline-number">
                1 <span>candidate to review</span>
              </div>
              <div className="person-row">
                <span className="avatar candidate">AC</span>
                <div>
                  <strong>Alex Chen</strong>
                  <small>Application materials ready</small>
                </div>
              </div>
              <Button
                className="full-width"
                onClick={() => go("report")}
                icon="report"
              >
                Open evidence report
              </Button>
            </Card>
          </div>
        </div>
      </>
    );
  }

  function Candidates() {
    const visible = "alex chen junior data analyst".includes(
      search.toLowerCase().trim(),
    );
    return (
      <>
        {heading(
          "Candidates",
          "Review applications through the evidence they provide.",
          null,
          "HIRING WORKSPACE",
        )}
        <div className="metrics">
          <Card className="metric">
            <span>Applications</span>
            <strong>01</strong>
            <small>Junior Data Analyst</small>
          </Card>
          <Card className="metric">
            <span>Evidence requirements</span>
            <strong>03</strong>
            <small>Two supported by existing materials</small>
          </Card>
          <Card className="metric">
            <span>
              {isVerified(state)
                ? "Targeted gaps closed"
                : state.stage === "initial"
                  ? "Evidence gaps"
                  : "Targeted evidence requests"}
            </span>
            <strong>01</strong>
            <small>Business Problem Solving</small>
          </Card>
        </div>
        <Card>
          <div className="table-toolbar">
            <h2>
              Candidate overview <span className="count">1</span>
            </h2>
            <label className="search-field">
              <Icon name="search" />
              <input
                aria-label="Search candidates"
                placeholder="Search candidates…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Role</th>
                  <th>Evidence coverage</th>
                  <th>Workflow</th>
                  <th>
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible ? (
                  <tr>
                    <td>
                      <div className="person-row">
                        <span className="avatar candidate">AC</span>
                        <div>
                          <strong>Alex Chen</strong>
                          <small>Applied 18 Sep 2026</small>
                        </div>
                      </div>
                    </td>
                    <td>Junior Data Analyst</td>
                    <td>
                      <div className="coverage">
                        <i />
                        <i />
                        <i className={isVerified(state) ? "" : "uncertain"} />
                      </div>
                      <small>
                        {isVerified(state)
                          ? "2 supported · 1 verified"
                          : "2 supported · 1 uncertain"}
                      </small>
                    </td>
                    <td>
                      <Badge tone={toneFor(state)}>
                        {workflowLabel(state)}
                      </Badge>
                    </td>
                    <td>
                      <Button icon="arrow" onClick={() => go("report")}>
                        View report
                      </Button>
                    </td>
                  </tr>
                ) : (
                  <tr>
                    <td colSpan="5" className="no-results">
                      No candidates match “{search}”.{" "}
                      <button
                        className="text-button"
                        onClick={() => setSearch("")}
                      >
                        Clear search
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="subtle-note">
          <Icon name="shield" size={16} />
          Evidence supports human review. Candidates are not ranked or assigned
          a numerical score.
        </div>
      </>
    );
  }

  function Report() {
    return (
      <>
        {heading(
          reviewed && !initialReport
            ? "Updated evidence report"
            : "Evidence report",
          "A clear view of what is supported, and what needs a closer look.",
          <Button icon="download" onClick={exportReport}>
            Export report
          </Button>,
        )}
        {candidateStrip()}
        {stepper()}
        {reviewed && (
          <div className="tabs report-tabs">
            <button
              className={reportView === "current" ? "active" : ""}
              onClick={() => setReportView("current")}
            >
              Updated report
            </button>
            <button
              className={reportView === "initial" ? "active" : ""}
              onClick={() => setReportView("initial")}
            >
              Initial report
            </button>
          </div>
        )}
        {reviewed && !initialReport && (
          <Card
            className={`outcome ${isVerified(state) ? "success" : state.decision === "more" ? "pending" : "insufficient"}`}
          >
            <div className="outcome-icon">
              <Icon name={isVerified(state) ? "shield" : "alert"} size={28} />
            </div>
            <div className="outcome-body">
              <div className="eyebrow">HUMAN REVIEW COMPLETE</div>
              <h2>
                {isVerified(state)
                  ? "The evidence gap is closed."
                  : state.decision === "more"
                    ? "A focused follow-up is needed."
                    : "The evidence gap remains open."}
              </h2>
              <p>
                {isVerified(state)
                  ? "Alex demonstrated structured business problem solving through a targeted work sample."
                  : state.notes}
              </p>
              <div className="before-after">
                <div>
                  <small>BEFORE</small>
                  <Badge tone="amber">Uncertain</Badge>
                </div>
                <Icon name="arrow" />
                <div>
                  <small>AFTER</small>
                  <Badge tone={isVerified(state) ? "green" : "amber"}>
                    {isVerified(state)
                      ? "Verified through targeted task"
                      : "Uncertain"}
                  </Badge>
                </div>
              </div>
            </div>
            <span className="reviewer-stamp">
              <span className="avatar small">JM</span>Reviewed by Jamie Morgan
              <small>{prettyTime(state.reviewedAt)}</small>
            </span>
          </Card>
        )}
        <div className="report-layout">
          <div className="report-main">
            <SectionTitle title="Requirement evidence">
              <span className="small-label">
                {verified
                  ? "3 requirements with evidence"
                  : "2 supported · 1 needs evidence"}
              </span>
            </SectionTitle>
            {requirements.map((r, i) => (
              <Card
                key={r.title}
                className={`evidence-card ${i === 2 ? "focus-card" : ""}`}
              >
                <div className="evidence-card-heading">
                  <span
                    className={`icon-tile ${i === 2 && !verified ? "amber" : ""}`}
                  >
                    <Icon name={r.icon} />
                  </span>
                  <h3>{r.title}</h3>
                  <Badge tone={i === 2 && !verified ? "amber" : "green"}>
                    {i === 2
                      ? verified
                        ? "Verified through targeted task"
                        : "Uncertain"
                      : "Supported"}
                  </Badge>
                </div>
                <p className="evidence-summary">
                  {i === 2 && verified
                    ? "Framed the business issue, compared relevant segments, formed testable hypotheses and prioritised validation before increasing spend."
                    : i === 2 && postTaskReport
                      ? "The targeted work sample has been reviewed. Additional evidence is still needed to support this requirement."
                      : r.summary}
                </p>
                {i === 2 && !verified ? (
                  <div className="uncertainty-note">
                    <Icon name="bulb" size={17} />
                    <div>
                      <strong>
                        {postTaskReport
                          ? "Remaining uncertainty"
                          : "Why uncertain?"}
                      </strong>
                      <p>{postTaskReport ? state.notes : r.uncertainty}</p>
                    </div>
                  </div>
                ) : (
                  <p className="mapping-rationale">
                    {i === 2
                      ? "Reviewed against the final work sample and the candidate’s investigation process."
                      : r.rationale}
                  </p>
                )}
                <div className="evidence-footer">
                  <button
                    className="source-link"
                    onClick={() =>
                      source(i === 2 && postTaskReport ? "summary" : r.source)
                    }
                  >
                    <Icon name="file" size={14} />
                    {i === 2 && postTaskReport
                      ? "Conversion Drop Investigation"
                      : r.source}
                  </button>
                  <button
                    className="text-button"
                    onClick={() =>
                      setModal({
                        type: "requirement",
                        index: i,
                        verified,
                        postTaskReport,
                      })
                    }
                  >
                    View details <Icon name="chevron" size={14} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
          <aside className="side-stack">
            <Card className="next-step-card">
              <div className="eyebrow">
                {reviewed && !initialReport
                  ? "REVIEW OUTCOME"
                  : "NEXT BEST STEP"}
              </div>
              <span className="large-icon">
                <Icon name={verified ? "shield" : "compass"} size={26} />
              </span>
              <h2>
                {verified
                  ? "Evidence, confirmed."
                  : state.stage === "initial"
                    ? "Turn uncertainty into evidence."
                    : state.stage === "sent"
                      ? "A focused task is on its way."
                      : hasSubmission(state)
                        ? "Review the new evidence."
                        : ""}
              </h2>
              <p>
                {verified
                  ? "Your confirmation is now part of the evidence report, alongside the original sources."
                  : state.stage === "initial"
                    ? "A short, realistic investigation can reveal how Alex approaches a business problem."
                    : state.stage === "sent"
                      ? "Alex has been invited to complete the Conversion Drop Investigation."
                      : "Review the work sample, working process and extracted observations together."}
              </p>
              <div className="target-label">
                <Icon name="compass" size={15} />
                Business Problem Solving
              </div>
              <Button
                className="full-width"
                variant="primary"
                icon="arrow"
                onClick={() => {
                  if (hasSubmission(state)) {
                    setTab("sample");
                    go("review");
                  } else go("tasks");
                }}
              >
                {verified
                  ? "Revisit work sample"
                  : state.stage === "initial"
                    ? "Review targeted task"
                    : state.stage === "sent"
                      ? "View sent task"
                      : "Review work sample"}
              </Button>
            </Card>
            <Card className="padded">
              <h3>Evidence sources</h3>
              <div className="source-summary">
                <span className="mini-icon">
                  <Icon name="file" />
                </span>
                <div>
                  <strong>Application materials</strong>
                  <small>Resume + 2 project artifacts</small>
                </div>
                <Badge tone="green" dot={false}>
                  3
                </Badge>
              </div>
              <div
                className={`source-summary ${!hasSubmission(state) ? "muted" : ""}`}
              >
                <span className="mini-icon">
                  <Icon name="task" />
                </span>
                <div>
                  <strong>Targeted work sample</strong>
                  <small>
                    {hasSubmission(state)
                      ? "Final output + process evidence"
                      : "Awaiting candidate submission"}
                  </small>
                </div>
              </div>
              <div className="divider" />
              <div className="tiny-note">
                <Icon name="spark" size={16} />
                <span>
                  AI maps the evidence.
                  <br />A human makes the decision.
                </span>
              </div>
            </Card>
            {reviewed && !initialReport && (
              <Card className="padded">
                <h3>Review record</h3>
                <Badge tone={toneFor(state)}>{workflowLabel(state)}</Badge>
                <p>
                  {state.notes ||
                    "Observed evidence supports this requirement in the targeted scenario."}
                </p>
                <div className="divider" />
                <h4>Remaining uncertainty</h4>
                <p>
                  {isVerified(state)
                    ? "The causal explanation still needs validation. This task demonstrates a structured approach in a bounded scenario."
                    : state.notes}
                </p>
                <button
                  className="text-button"
                  onClick={() => {
                    dispatch({ type: "REOPEN" });
                    go("review");
                    notify(
                      "Review reopened. The previous verification is no longer active.",
                    );
                  }}
                >
                  Reopen human review <Icon name="arrow" size={14} />
                </button>
              </Card>
            )}
          </aside>
        </div>
      </>
    );
  }

  function Tasks() {
    const sent = state.stage !== "initial";
    return (
      <>
        {heading(
          "Review targeted micro-task",
          "A realistic work sample, designed around one specific evidence gap.",
          <Badge tone={sent ? "blue" : "amber"}>
            {sent ? "Sent" : "For Review"}
          </Badge>,
        )}
        <div className="context-banner">
          <span className="icon-tile amber">
            <Icon name="bulb" />
          </span>
          <div>
            <strong>Targeting: Business Problem Solving</strong>
            <p>
              Alex’s materials show technical analysis, but not how they test
              hypotheses or prioritise a business decision.
            </p>
          </div>
          <button className="text-button" onClick={() => go("report")}>
            View gap <Icon name="arrow" size={15} />
          </button>
        </div>
        {sent && (
          <Card className="sent-banner">
            <span className="icon-tile">
              <Icon name="check" />
            </span>
            <div>
              <strong>Task sent to Alex Chen</strong>
              <p>
                {prettyTime(state.sentAt)} ·{" "}
                {hasSubmission(state)
                  ? "Work sample received."
                  : "Waiting for a work sample."}
              </p>
            </div>
            {state.stage === "sent" ? (
              <Button variant="primary" icon="play" onClick={loadSubmission}>
                Load demo submission
              </Button>
            ) : (
              <Button
                variant="primary"
                icon="arrow"
                onClick={() => go("review")}
              >
                Review submission
              </Button>
            )}
          </Card>
        )}
        <div className="task-layout">
          <Card className="task-brief">
            <div className="task-title">
              <div className="eyebrow">
                TARGETED WORK SAMPLE · VERSION {state.revision}
              </div>
              <Badge tone="blue" dot={false}>
                Targeted Task
              </Badge>
            </div>
            <h2>Conversion Drop Investigation</h2>
            <div className="metadata">
              <span>HarbourCart Pty Ltd</span>
              <span>Junior Data Analyst</span>
              <span>
                <Icon name="clock" size={14} />
                15–20 minutes
              </span>
            </div>
            <div className="divider" />
            <h3>The business scenario</h3>
            <p>
              HarbourCart’s website attracted more visitors over the last four
              weeks, but fewer of them converted. The marketing team is
              considering increasing advertising spend. Help them decide what to
              investigate first.
            </p>
            <div className="scenario-metrics">
              <div>
                <small>Website traffic</small>
                <strong>
                  +18% <Icon name="chart" />
                </strong>
                <span>vs. previous month</span>
              </div>
              <div>
                <small>Conversion rate</small>
                <strong className="amber-text">
                  3.4% <span>→</span> 2.6%
                </strong>
                <span>−0.8 percentage points</span>
              </div>
              <div>
                <small>Ad spend</small>
                <strong>
                  +15% <Icon name="chart" />
                </strong>
                <span>vs. previous month</span>
              </div>
            </div>
            <label className="input-label" htmlFor="task-instructions">
              Candidate instructions{" "}
              <span>{sent ? "Sent version" : "Editable before sending"}</span>
            </label>
            <textarea
              id="task-instructions"
              value={state.instructions}
              readOnly={sent}
              onChange={(e) =>
                dispatch({ type: "EDIT_TASK", value: e.target.value })
              }
              rows="5"
            />
            <h3 className="spaced-title">What the candidate will produce</h3>
            <div className="deliverables">
              {[
                [
                  "search",
                  "Evidence-backed findings",
                  "Identify the strongest signals and cite the data.",
                ],
                [
                  "bulb",
                  "Testable hypotheses",
                  "Explain plausible causes and what would validate them.",
                ],
                [
                  "layers",
                  "Additional evidence needed",
                  "Request the specific data that would reduce uncertainty.",
                ],
                [
                  "compass",
                  "Prioritised next steps",
                  "Recommend what the business should do next.",
                ],
              ].map(([icon, title, body]) => (
                <div key={title}>
                  <span className="icon-tile">
                    <Icon name={icon} />
                  </span>
                  <div>
                    <strong>{title}</strong>
                    <p>{body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="brief-note">
              <Icon name="shield" size={18} />
              <span>
                The work sample and investigation process will be reviewed
                together. There is no single expected answer.
              </span>
            </div>
            {!sent && (
              <div className="task-footer">
                <Button icon="reset" disabled={busy} onClick={regenerate}>
                  {busy ? "Regenerating…" : "Regenerate"}
                </Button>
                <Button
                  variant="primary"
                  icon="send"
                  disabled={busy || !state.instructions.trim()}
                  onClick={send}
                >
                  Confirm & Send to Candidate
                </Button>
              </div>
            )}
          </Card>
          <aside className="side-stack">
            <Card className="padded">
              <SectionTitle title="Data & resources">
                <span className="count">6</span>
              </SectionTitle>
              <p className="small-copy">
                A realistic dataset to explore, not a blank answer box.
              </p>
              {resourceList()}
            </Card>
            <Card className="padded">
              <div className="eyebrow">OBSERVABLE CAPABILITIES</div>
              <h3>What this task can reveal</h3>
              <div className="capability-list">
                {dimensions.map((d) => (
                  <div key={d.title}>
                    <Icon name={d.icon} size={16} />
                    {d.title}
                  </div>
                ))}
              </div>
            </Card>
          </aside>
        </div>
      </>
    );
  }

  function WorkSample() {
    return (
      <div className="sample-layout">
        <div className="side-stack">
          <Card className="work-sample">
            <div className="document-heading">
              <div className="eyebrow">CANDIDATE FINAL WORK SAMPLE</div>
              <span className="document-label">
                <Icon name="file" size={14} />
                WS-024
              </span>
            </div>
            <h2>Conversion Drop Investigation</h2>
            <p className="document-byline">
              Prepared by Alex Chen <span>·</span> HarbourCart Pty Ltd
            </p>
            <div className="divider" />
            <div className="sample-section">
              <div className="section-number">01</div>
              <div>
                <h3>Executive Summary</h3>
                <p>{workSections.summary.text}</p>
              </div>
            </div>
            <div className="sample-section">
              <div className="section-number">02</div>
              <div className="grow">
                <h3>Key Findings</h3>
                <p>
                  Paid Search grew faster while converting less effectively.
                  Mobile is the segment to investigate next.
                </p>
                <div className="analysis-card">
                  <div className="analysis-heading">
                    <strong>Conversion by channel</strong>
                    <button
                      className="source-link"
                      onClick={() => source("campaigns.csv")}
                    >
                      <Icon name="link" size={13} />
                      campaigns.csv
                    </button>
                  </div>
                  <ChannelChart />
                  <div className="chart-insight">
                    <Icon name="bulb" size={17} />
                    Paid Search: traffic +42%, conversion 3.2% → 1.8%
                  </div>
                </div>
                <div className="finding-callout">
                  <div>
                    <small>PAID SEARCH · MOBILE</small>
                    <strong>1.4%</strong>
                  </div>
                  <div>
                    <small>PAID SEARCH · DESKTOP</small>
                    <strong>
                      2.8% <span>rounded</span>
                    </strong>
                  </div>
                  <button
                    className="source-link"
                    onClick={() => source("landing_pages.csv")}
                  >
                    View source <Icon name="arrow" size={14} />
                  </button>
                </div>
              </div>
            </div>
            {["hypothesis", "data", "recommendation"].map((key, i) => (
              <div className="sample-section" key={key}>
                <div className="section-number">0{i + 3}</div>
                <div>
                  <h3>{workSections[key].title}</h3>
                  <p className="preserve-lines">{workSections[key].text}</p>
                </div>
              </div>
            ))}
          </Card>
        </div>
        <aside className="side-stack">
          <Card className="padded">
            <div className="eyebrow">SUBMISSION SNAPSHOT</div>
            <h3>A visible path to the answer</h3>
            <div className="snapshot-metrics">
              <div>
                <strong>14m 35s</strong>
                <small>Task duration</small>
              </div>
              <div>
                <strong>10</strong>
                <small>Process events</small>
              </div>
            </div>
            <div className="divider" />
            <h4>Investigation artifacts</h4>
            <div className="artifact-counts">
              <span>
                Key findings <b>2</b>
              </span>
              <span>
                Hypotheses <b>2</b>
              </span>
              <span>
                Evidence request <b>1</b>
              </span>
              <span>
                Prioritised action plan <b>1</b>
              </span>
            </div>
            <Button
              className="full-width"
              icon="clock"
              onClick={() => setTab("process")}
            >
              Explore the process
            </Button>
          </Card>
          <Card className="insight-card">
            <Icon name="spark" size={24} />
            <h3>What the work makes visible</h3>
            <p>
              Alex separated a pattern in the data from a proven cause, then
              specified the evidence needed to decide.
            </p>
            <button className="text-button" onClick={() => setTab("ai")}>
              Review extracted evidence <Icon name="arrow" size={15} />
            </button>
          </Card>
          <Card className="padded">
            <h3>Referenced resources</h3>
            {["campaigns.csv", "landing_pages.csv", "business_context.md"].map(
              (name) => (
                <FileRow key={name} name={name} onClick={() => source(name)} />
              ),
            )}
          </Card>
        </aside>
      </div>
    );
  }

  function ProcessEvidence() {
    const events = timeline.filter(
      (e) =>
        processFilter === "All events" ||
        (processFilter === "Data exploration"
          ? ["Exploration", "Analysis"].includes(e.kind)
          : ["Finding", "Hypothesis", "Evidence request", "Decision"].includes(
              e.kind,
            )),
    );
    return (
      <div className="process-layout">
        <Card className="padded timeline-card">
          <SectionTitle
            eyebrow="OBSERVABLE WORKING TRACE"
            title="Investigation timeline"
          >
            <label>
              <span className="sr-only">Filter process events</span>
              <select
                value={processFilter}
                onChange={(e) => setProcessFilter(e.target.value)}
              >
                <option>All events</option>
                <option>Data exploration</option>
                <option>Reasoning & decisions</option>
              </select>
            </label>
          </SectionTitle>
          <p className="small-copy">
            Elapsed time from task start · 14m 35s total
          </p>
          <div className="timeline">
            {events.map((e) => (
              <div className="timeline-item" key={e.time}>
                <time>{e.time}</time>
                <span className="timeline-dot" />
                <div>
                  <div className="timeline-title">
                    <h3>{e.title}</h3>
                    <span>{e.kind}</span>
                  </div>
                  <p>{e.detail}</p>
                  <button
                    className="source-link"
                    onClick={() => source(e.source)}
                  >
                    <Icon name="link" size={14} />
                    {resources[e.source]
                      ? e.source
                      : workSections[e.source]?.title}{" "}
                    <Icon name="chevron" size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <aside className="side-stack">
          <Card className="padded">
            <span className="icon-tile">
              <Icon name="layers" />
            </span>
            <h3>From exploration to a decision</h3>
            <p>
              The trace connects source data, candidate reasoning and the final
              recommendation.
            </p>
            <div className="journey">
              {[
                "Explore channels",
                "Isolate Paid Search",
                "Compare devices",
                "Form hypotheses",
                "Request missing evidence",
                "Prioritise validation",
              ].map((s, i) => (
                <div key={s}>
                  <span>{i + 1}</span>
                  {s}
                </div>
              ))}
            </div>
          </Card>
          <Card className="insight-card">
            <Icon name="bulb" size={22} />
            <h3>Observe the reasoning</h3>
            <p>
              Opening a file alone does not prove a capability. Read each action
              alongside the resulting finding or recommendation.
            </p>
          </Card>
        </aside>
      </div>
    );
  }

  function AiEvidence() {
    return (
      <>
        <div className="ai-banner">
          <Icon name="spark" size={22} />
          <div>
            <strong>Observable evidence, with a source for every claim.</strong>
            <p>
              Pre-generated analysis of Alex’s work sample and process. Review
              the underlying evidence before confirming.
            </p>
          </div>
          <Badge tone={reviewed ? toneFor(state) : "blue"} dot={false}>
            {reviewed ? workflowLabel(state) : "Human review required"}
          </Badge>
        </div>
        <div className="ai-layout">
          <div className="side-stack">
            {dimensions.map((d, i) => (
              <Card key={d.title} className="dimension-card">
                <div className="dimension-heading">
                  <span className="icon-tile">
                    <Icon name={d.icon} />
                  </span>
                  <div>
                    <div className="eyebrow">OBSERVATION 0{i + 1}</div>
                    <h3>{d.title}</h3>
                  </div>
                  <Badge
                    tone={d.strength === "High" ? "green" : "amber"}
                    dot={false}
                  >
                    {d.strength} support
                  </Badge>
                </div>
                <p>{d.text}</p>
                <div className="dimension-source">
                  <button
                    className="source-link"
                    onClick={() => source(d.target)}
                  >
                    <Icon name="file" size={15} />
                    {d.source}
                    <Icon name="chevron" size={14} />
                  </button>
                  <small>
                    <Icon name="clock" size={13} />
                    {d.trace}
                  </small>
                </div>
              </Card>
            ))}
          </div>
          <aside className="side-stack">
            <Card className="padded">
              <div className="eyebrow">TARGET REQUIREMENT</div>
              <h3>Business Problem Solving</h3>
              <Badge tone={reviewed ? toneFor(state) : "amber"}>
                {reviewed
                  ? workflowLabel(state)
                  : "Awaiting human confirmation"}
              </Badge>
              <div className="divider" />
              <h4>Evidence coverage</h4>
              <p>
                The work demonstrates a structured approach across all five
                dimensions.
              </p>
              <h4>What remains uncertain</h4>
              <p>
                The root cause has not been established. The task shows how Alex
                investigates, not whether a proposed intervention will succeed.
              </p>
            </Card>
            <Card className="insight-card">
              <Icon name="shield" size={24} />
              <h3>Your judgement matters</h3>
              <p>
                Support labels describe the evidence in this work sample. They
                are not candidate scores or an automated hiring decision.
              </p>
            </Card>
          </aside>
        </div>
      </>
    );
  }

  function Review() {
    return (
      <>
        {heading(
          "Review candidate work sample",
          "Follow the evidence from the final answer back to the working process.",
          hasSubmission(state) ? (
            <Badge tone={toneFor(state)}>{workflowLabel(state)}</Badge>
          ) : null,
        )}
        {!hasSubmission(state) ? (
          <EmptyState
            icon="shield"
            title={
              state.stage === "sent"
                ? "Waiting for Alex’s work sample"
                : "No work sample to review yet"
            }
            action={
              state.stage === "sent" ? (
                <Button variant="primary" icon="play" onClick={loadSubmission}>
                  Load demo submission
                </Button>
              ) : (
                <Button
                  variant="primary"
                  icon="arrow"
                  onClick={() => go("tasks")}
                >
                  Review targeted task
                </Button>
              )
            }
          >
            {state.stage === "sent"
              ? "The targeted task has been sent. Load the predefined submission to continue this HR demo."
              : "Review and send a targeted task to collect evidence of Business Problem Solving."}
          </EmptyState>
        ) : (
          <>
            {candidateStrip()}
            <div className="review-context">
              <span>
                <Icon name="compass" size={16} />
                Business Problem Solving
              </span>
              <span>Conversion Drop Investigation</span>
              <span>
                <Icon name="clock" size={15} />
                14m 35s
              </span>
            </div>
            <div className="tabs review-tabs" aria-label="Evidence layers">
              {[
                ["sample", "file", "Final work sample"],
                ["process", "clock", "Process evidence"],
                ["ai", "spark", "AI-extracted evidence"],
              ].map(([id, icon, label], i) => (
                <button
                  className={tab === id ? "active" : ""}
                  key={id}
                  onClick={() => setTab(id)}
                >
                  <Icon name={icon} size={17} />
                  {label}
                  <span>{i === 0 ? "1" : i === 1 ? "10" : "5"}</span>
                </button>
              ))}
            </div>
            {tab === "sample"
              ? WorkSample()
              : tab === "process"
                ? ProcessEvidence()
                : AiEvidence()}
            {reviewed ? (
              <div className="decision-bar">
                <div className="decision-caption">
                  <Icon name="shield" />
                  <div>
                    <strong>{workflowLabel(state)}</strong>
                    <small>
                      Reviewed by Jamie Morgan · {prettyTime(state.reviewedAt)}
                    </small>
                  </div>
                </div>
                <Button
                  variant="primary"
                  icon="arrow"
                  onClick={() => {
                    setReportView("current");
                    go("report");
                  }}
                >
                  View updated report
                </Button>
              </div>
            ) : (
              reviewActions()
            )}
          </>
        )}
      </>
    );
  }

  const modalContent = () => {
    if (modal.type === "export")
      return (
        <Modal
          title="Export evidence report"
          onClose={() => setModal(null)}
          wide
        >
          <p>
            The current evidence report, including sources and the latest human
            review.
          </p>
          <label className="input-label" htmlFor="export-content">
            Markdown preview
          </label>
          <textarea
            id="export-content"
            className="code-snippet"
            rows="16"
            readOnly
            value={modal.content}
          />
          <div className="modal-actions">
            <Button onClick={() => setModal(null)}>Close preview</Button>
            <Button
              variant="primary"
              icon="download"
              onClick={() =>
                download("alex-chen-evidence-report.md", modal.content)
              }
            >
              Download Markdown
            </Button>
          </div>
        </Modal>
      );

    if (modal.type === "reset")
      return (
        <Modal title="Reset the HR demo?" onClose={() => setModal(null)}>
          <p>
            This clears the sent task and human review in this browser, and
            restores Alex’s initial evidence report.
          </p>
          <div className="modal-actions">
            <Button onClick={() => setModal(null)}>
              Keep current progress
            </Button>
            <Button
              variant="primary"
              icon="reset"
              onClick={() => {
                dispatch({ type: "RESET" });
                setModal(null);
                setReportView("current");
                setTab("sample");
                setSearch("");
                setProcessFilter("All events");
                go("report");
                notify("Demo reset. Ready to start the evidence loop.");
              }}
            >
              Reset demo
            </Button>
          </div>
        </Modal>
      );
    if (modal.type === "help")
      return (
        <Modal
          title="Your evidence review workspace"
          onClose={() => setModal(null)}
        >
          <p>
            One candidate. One uncertain capability. A complete evidence loop.
          </p>
          <ol className="help-steps">
            <li>Review the role and Alex’s existing materials.</li>
            <li>Open the evidence gap for Business Problem Solving.</li>
            <li>Review and send the targeted investigation.</li>
            <li>
              Load the demo submission, then inspect all three evidence layers.
            </li>
            <li>
              Make a human review decision and compare the updated report.
            </li>
          </ol>
          <div className="brief-note">
            <Icon name="play" />
            <span>
              This HR demo uses predefined candidate work and AI observations.
              Progress is saved in this browser. Candidate-side synchronisation
              is not connected.
            </span>
          </div>
          <div className="modal-actions">
            <Button variant="primary" onClick={() => setModal(null)}>
              Got it
            </Button>
          </div>
        </Modal>
      );
    if (modal.type === "decision") {
      const title = {
        confirm: "Confirm the observed evidence",
        more: "Request more evidence",
        insufficient: "Mark evidence as insufficient",
      }[modal.decision];
      return (
        <Modal title={title} onClose={() => setModal(null)}>
          <div className="decision-target">
            <Icon name="compass" />
            <div>
              <small>Alex Chen · Junior Data Analyst</small>
              <strong>Business Problem Solving</strong>
            </div>
          </div>
          <p>
            {modal.decision === "confirm"
              ? "This will mark the requirement as “Verified through targeted task” and record your human review."
              : modal.decision === "more"
                ? "Describe the specific evidence that is still needed. The requirement will remain Uncertain."
                : "Record why the submitted work does not sufficiently demonstrate the requirement. The requirement will remain Uncertain."}
          </p>
          <label className="input-label" htmlFor="review-notes">
            {modal.decision === "confirm"
              ? "Review note (optional)"
              : "Review note (required)"}
          </label>
          <textarea
            autoFocus
            id="review-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows="4"
            placeholder={
              modal.decision === "more"
                ? "For example: Show how you would compare campaign cohorts to distinguish traffic quality from mobile friction."
                : "Record the reasoning behind your decision…"
            }
          />
          <div className="modal-actions">
            <Button onClick={() => setModal(null)}>Cancel</Button>
            <Button
              variant="primary"
              icon="check"
              disabled={modal.decision !== "confirm" && !notes.trim()}
              onClick={confirmDecision}
            >
              {modal.decision === "confirm"
                ? "Confirm evidence"
                : "Save review decision"}
            </Button>
          </div>
        </Modal>
      );
    }
    if (modal.type === "requirement") {
      const r = requirements[modal.index];
      const changed = modal.index === 2 && modal.verified;
      const postTask = modal.index === 2 && modal.postTaskReport;
      return (
        <Modal title={r.title} onClose={() => setModal(null)} wide>
          <Badge tone={modal.index === 2 && !changed ? "amber" : "green"}>
            {changed
              ? "Verified through targeted task"
              : modal.index === 2
                ? "Uncertain"
                : "Supported"}
          </Badge>
          <h3 className="spaced-title">Capability statement</h3>
          <p>{r.statement}</p>
          <h3>Evidence snippet</h3>
          <blockquote className={modal.index === 0 ? "code-snippet" : ""}>
            {postTask ? workSections.summary.text : r.snippet}
          </blockquote>
          <h3>Mapping rationale</h3>
          <p>
            {changed
              ? "The final work sample and investigation trace make problem framing, hypothesis testing plans, targeted evidence seeking and prioritised decision-making observable. HR has confirmed this evidence."
              : postTask
                ? "The task adds observable work, but the human review identifies a remaining evidence gap."
                : r.rationale}
          </p>
          <h3>Remaining uncertainty</h3>
          <p>
            {changed
              ? "The causal explanation is still unvalidated. Evidence is limited to the demonstrated scenario."
              : postTask
                ? state.notes
                : r.uncertainty}
          </p>
          <div className="modal-actions">
            <Button
              icon="file"
              onClick={() => source(postTask ? "summary" : r.source)}
            >
              Open source material
            </Button>
          </div>
        </Modal>
      );
    }
    if (modal.type === "source") {
      const key = modal.key;
      const req = requirements.find((r) => r.source === key);
      const content =
        resources[key] || workSections[key]?.text || req?.snippet || "";
      const title = workSections[key]?.title || key;
      const csv = key.endsWith(".csv");
      const rows = csv ? content.split("\n").map((r) => r.split(",")) : [];
      return (
        <Modal title={title} onClose={() => setModal(null)} wide>
          <div className="source-meta">
            <Badge tone="blue" dot={false}>
              {resources[key]
                ? "Task resource"
                : req
                  ? "Application material"
                  : "Candidate work sample"}
            </Badge>
            <span>Alex Chen · Demo material</span>
          </div>
          {csv ? (
            <div className="table-scroll resource-table">
              <table>
                <thead>
                  <tr>
                    {rows[0].map((c) => (
                      <th key={c}>{c.replaceAll("_", " ")}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(1).map((r, i) => (
                    <tr key={i}>
                      {r.map((c, j) => (
                        <td key={j}>{c}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div
              className={`source-content ${key.endsWith(".sql") ? "code-snippet" : ""}`}
            >
              {content}
            </div>
          )}
          {csv && key === "campaigns.csv" && <ChannelChart compact />}
          <div className="modal-actions">
            <Button
              icon="download"
              onClick={() =>
                download(workSections[key] ? `${key}.md` : key, content)
              }
            >
              Download source
            </Button>
            <Button variant="primary" onClick={() => setModal(null)}>
              Back to review
            </Button>
          </div>
        </Modal>
      );
    }
  };

  return (
    <>
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content").focus();
        }}
      >
        Skip to content
      </a>
      <aside className="sidebar">
        <a
          className="brand"
          aria-label="EvidenceBridge home"
          href="#report"
          onClick={() => go("report")}
        >
          <span className="brand-mark">
            <Icon name="bridge" size={24} />
          </span>
          <span>EvidenceBridge</span>
        </a>
        <div className="workspace-switch">
          <div className="company-avatar">H</div>
          <div>
            <strong>HarbourCart</strong>
            <small>Hiring workspace</small>
          </div>
          <span className="workspace-badge">HR</span>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map((n) => (
            <button
              className={`nav-item ${page === n.id ? "active" : ""}`}
              key={n.id}
              aria-label={n.label}
              title={n.label}
              onClick={() => go(n.id)}
              aria-current={page === n.id ? "page" : undefined}
            >
              <Icon name={n.icon} size={19} />
              <span>{n.label}</span>
              {n.id === "review" && state.stage === "submitted" && (
                <span className="nav-count">1</span>
              )}
              {n.id === "candidates" && (
                <span className="nav-count subtle">1</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-card">
            <div>
              <span className="live-dot" />
              DEMO WORKSPACE
            </div>
            <p>
              Realistic work.
              <br />
              Evidence you can review.
            </p>
            <button
              aria-label="Reset demo"
              title="Reset demo"
              onClick={() => setModal({ type: "reset" })}
            >
              <Icon name="reset" size={14} />
              Reset demo
            </button>
          </div>
          <button
            className="nav-item help-link"
            aria-label="Demo guide"
            title="Demo guide"
            onClick={() => setModal({ type: "help" })}
          >
            <Icon name="help" />
            Demo guide
          </button>
          <div className="user-block">
            <span className="avatar user">JM</span>
            <div>
              <strong>Jamie Morgan</strong>
              <small>Hiring manager</small>
            </div>
            <Icon name="shield" size={16} />
          </div>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <Icon name="chevron" size={13} />
            <strong>{nav.find((n) => n.id === page)?.label}</strong>
          </div>
          <div className="topbar-right">
            <span className="demo-pill">
              <span />
              Local demo
            </span>
            <span className="topbar-divider" />
            <span className="avatar tiny">JM</span>
          </div>
        </header>
        <main id="main-content" tabIndex="-1">
          <div className="content">
            {storageWarning && (
              <div className="storage-warning" role="status">
                Browser storage is unavailable. This session works, but progress
                will reset on refresh.
              </div>
            )}
            {page === "jobs"
              ? Jobs()
              : page === "candidates"
                ? Candidates()
                : page === "report"
                  ? Report()
                  : page === "tasks"
                    ? Tasks()
                    : Review()}
            <footer className="page-footer">
              <span>
                EvidenceBridge <span> / </span> Evidence-led hiring
              </span>
              <span>
                <Icon name="shield" size={13} />
                Human judgement, supported by evidence
              </span>
            </footer>
          </div>
        </main>
      </div>
      {modal && modalContent()}
      {toast && (
        <div className="toast" role="status">
          <span className="toast-icon">
            <Icon name="check" size={16} />
          </span>
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
