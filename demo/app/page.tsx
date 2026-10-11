"use client";
import { useState } from "react";
import sample from "../fixtures/sample.json";

type Review = "PENDING" | "APPROVED" | "REJECTED";
const initial = () =>
  sample.findings.map((f) => ({
    ...f,
    approval: "PENDING" as Review,
    reviewerNotes: "",
  }));
const tabs = [
  "Review findings",
  "Evidence ledger",
  "Page captures",
  "Sample proposal",
];

export default function Demo() {
  const [tab, setTab] = useState(tabs[0]);
  const [findings, setFindings] = useState(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("All checks");
  const [notice, setNotice] = useState("");
  const approved = findings.filter((f) => f.approval === "APPROVED").length;
  const evidence = sample.evidence.filter(
    (e) =>
      (filter === "All checks" ||
        (filter === "Issues" ? !e.passed : e.passed)) &&
      (!selected || e.id === selected),
  );
  function update(id: string, change: Partial<(typeof findings)[number]>) {
    setFindings((current) =>
      current.map((f) => (f.id === id ? { ...f, ...change } : f)),
    );
    setNotice("Your review stays in this browser tab. Reload to reset.");
  }
  function exportReview() {
    const payload = {
      demo: true,
      source: "Recorded fictional fixture audit, 9 October 2026",
      exportedAt: new Date().toISOString(),
      findings: findings.filter((f) => f.approval === "APPROVED"),
      evidence: sample.evidence,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "auditcraft-reviewed-findings.json";
    a.click();
    URL.revokeObjectURL(url);
    setNotice("Exported your approved findings with their recorded evidence.");
  }
  return (
    <div className="shell">
      <aside className="sidebar">
        <a href="/" className="brand">
          <span className="mark">a</span>
          <span>
            AuditCraft<span className="brand-ai">AI</span>
          </span>
        </a>
        <p className="sidebar-label">THE WORKSPACE</p>
        <div className="nav-active">◈ &nbsp; Audit workspace</div>
        <a
          className="nav-link"
          href="/sample-proposal.pdf"
          target="_blank"
          rel="noreferrer"
        >
          ↗ &nbsp; Sample proposal
        </a>
        <div className="sidebar-foot">
          <span className="status-dot" /> Public portfolio demo
          <p>
            Evidence first.
            <br />
            Human judgment always.
          </p>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            Workspace <span className="slash">/</span> Fieldwork Studio
          </span>
          <span className="pill">NO SIGNUP REQUIRED</span>
        </header>
        <div className="content">
          <div className="demo-banner">
            <strong>Interactive demo</strong>
            <span>
              Real measurements from a fictional website, captured 9 Oct 2026.
              Review edits stay in your tab. No live scanning or live AI.
            </span>
          </div>
          <div className="hero">
            <div>
              <p className="eyebrow">FROM EVIDENCE TO OPPORTUNITY</p>
              <h1>
                A better website.
                <br />
                <em>A clearer next step.</em>
              </h1>
              <p className="intro">
                Explore the audit. Inspect the proof. Decide what belongs in the
                proposal.
              </p>
            </div>
            <div className="score">
              <span>
                {sample.score.total}
                <small>/100</small>
              </span>
              <p>Recorded audit score</p>
              <small>Custom weighted lab score</small>
            </div>
          </div>
          <section className="project-card" aria-label="Audit details">
            <div>
              <span className="eyebrow">FICTIONAL CLIENT</span>
              <h2>Fieldwork Studio</h2>
              <p>Interior design · Cairo · Controlled test fixture</p>
            </div>
            <div className="project-stats">
              <div>
                <strong>{sample.evidence.length}</strong>
                <span>evidence checks</span>
              </div>
              <div>
                <strong>
                  {approved}/{findings.length}
                </strong>
                <span>findings approved</span>
              </div>
              <div>
                <strong>1</strong>
                <span>page captured</span>
              </div>
            </div>
          </section>
          <div className="category-grid">
            {sample.score.breakdown.map((c) => (
              <div className="category" key={c.category}>
                <span>{c.category}</span>
                <strong>
                  {c.score}
                  <small>/100</small>
                </strong>
                <div className="track">
                  <div style={{ width: `${c.score}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="tabs" role="tablist" aria-label="Audit sections"
            onKeyDown={(event) => {
              const index = tabs.indexOf(tab);
              const next = event.key === "ArrowRight" ? (index + 1) % tabs.length
                : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length
                : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
              if (next === null) return;
              event.preventDefault();
              setTab(tabs[next]);
              document.getElementById(`tab-${next}`)?.focus();
            }}>
            {tabs.map((t) => (
              <button
                role="tab"
                aria-selected={tab === t}
                tabIndex={tab === t ? 0 : -1}
                id={`tab-${tabs.indexOf(t)}`}
                aria-controls="audit-panel"
                key={t}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="notice" role="status">
            {notice}
          </p>
          <section
            id="audit-panel"
            role="tabpanel"
            aria-labelledby={`tab-${tabs.indexOf(tab)}`}
          >
            {tab === tabs[0] && (
              <>
                <div className="section-heading">
                  <div>
                    <h2>Good proposals start with judgment.</h2>
                    <p>
                      These explanations use deterministic templates. Edit,
                      approve, or reject each finding.
                    </p>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => {
                      setFindings(initial());
                      setNotice(
                        "Review reset. The recorded evidence is unchanged.",
                      );
                    }}
                  >
                    Reset review
                  </button>
                </div>
                <div className="findings">
                  {findings.map((f, i) => (
                    <article className="finding" key={f.id}>
                      <div className="finding-head">
                        <span className="number">0{i + 1}</span>
                        <div>
                          <span className="eyebrow">{f.category}</span>
                          <h3>{f.title}</h3>
                        </div>
                        <span className={`badge ${f.approval.toLowerCase()}`}>
                          {f.approval.toLowerCase()}
                        </span>
                      </div>
                      <p>{f.explanation}</p>
                      <div className="finding-meta">
                        <span>{f.severity} severity</span>
                        <span>
                          {Math.round(f.confidence * 100)}% confidence
                        </span>
                        <span>{f.effort}</span>
                      </div>
                      <label>
                        Recommended next step
                        <textarea
                          aria-label={`Recommendation for ${f.title}`}
                          value={f.recommendation}
                          maxLength={2000}
                          onChange={(e) =>
                            update(f.id, {
                              recommendation: e.target.value,
                              approval: "PENDING",
                            })
                          }
                        />
                      </label>
                      <label>
                        Reviewer notes
                        <input
                          aria-label={`Notes for ${f.title}`}
                          value={f.reviewerNotes}
                          maxLength={2000}
                          placeholder="Add your professional judgment…"
                          onChange={(e) =>
                            update(f.id, { reviewerNotes: e.target.value })
                          }
                        />
                      </label>
                      <div className="finding-actions">
                        <button
                          className="text-button"
                          onClick={() => {
                            setSelected(f.evidenceIds[0]);
                            setFilter("All checks");
                            setTab(tabs[1]);
                          }}
                        >
                          Inspect evidence ↗
                        </button>
                        <div>
                          <button
                            className="secondary"
                            onClick={() =>
                              update(f.id, { approval: "REJECTED" })
                            }
                          >
                            Reject
                          </button>
                          <button
                            className="primary"
                            disabled={!f.recommendation.trim()}
                            onClick={() =>
                              update(f.id, { approval: "APPROVED" })
                            }
                          >
                            Approve finding
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="export-bar">
                  <p>
                    <strong>
                      {approved} approved finding{approved === 1 ? "" : "s"}
                    </strong>
                    <br />
                    Download your own review with the underlying evidence.
                  </p>
                  <button
                    className="primary"
                    disabled={!approved}
                    onClick={exportReview}
                  >
                    Export reviewed findings ↓
                  </button>
                </div>
              </>
            )}
            {tab === tabs[1] && (
              <>
                <div className="section-heading">
                  <div>
                    <h2>The evidence, in plain sight.</h2>
                    <p>
                      Original observations and tool metadata from the recorded
                      fixture run.
                    </p>
                  </div>
                  <label>
                    Show
                    <select
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option>All checks</option>
                      <option>Issues</option>
                      <option>Passed</option>
                    </select>
                  </label>
                </div>
                {selected && (
                  <button
                    className="secondary"
                    onClick={() => setSelected(null)}
                  >
                    Show all evidence
                  </button>
                )}
                <p className="eyebrow">{evidence.length} CHECKS SHOWN</p>
                <div className="evidence-list">
                  {evidence.map((e) => (
                    <article className="evidence" key={e.id}>
                      <div>
                        <span
                          className={`badge ${e.passed ? "approved" : "pending"}`}
                        >
                          {e.passed ? "Passed" : "Issue"}
                        </span>
                        <span className="eyebrow">{e.category}</span>
                      </div>
                      <h3>{e.check}</h3>
                      <dl>
                        <dt>Observed</dt>
                        <dd>{e.observed}</dd>
                        <dt>Expected</dt>
                        <dd>{e.expected}</dd>
                        <dt>Method</dt>
                        <dd>{e.method}</dd>
                        <dt>Tool</dt>
                        <dd>
                          {e.tool} · {e.toolVersion}
                        </dd>
                        <dt>Recorded</dt>
                        <dd>{e.timestamp}</dd>
                      </dl>
                    </article>
                  ))}
                </div>
              </>
            )}
            {tab === tabs[2] && (
              <>
                <h2>See what the browser saw.</h2>
                <p>
                  Original desktop and mobile captures of the fictional fixture.
                  These show the audited site, including its deliberate defects.
                </p>
                <div className="captures">
                  <figure>
                    <figcaption>DESKTOP · ORIGINAL CAPTURE</figcaption>
                    <a href="/desktop.png" target="_blank" rel="noreferrer">
                      <img
                        src="/desktop.png"
                        alt="Recorded desktop view of the fictional Fieldwork Studio website"
                      />
                    </a>
                  </figure>
                  <figure>
                    <figcaption>MOBILE · ORIGINAL CAPTURE</figcaption>
                    <a href="/mobile.png" target="_blank" rel="noreferrer">
                      <img
                        src="/mobile.png"
                        alt="Recorded mobile view of the fictional Fieldwork Studio website"
                      />
                    </a>
                  </figure>
                </div>
              </>
            )}
            {tab === tabs[3] && (
              <div className="proposal">
                <p className="eyebrow">THE FINISHED DELIVERABLE</p>
                <h2>Evidence into a client conversation.</h2>
                <p>
                  Read the six-page sample proposal generated by the full
                  application. It includes reviewed findings, an action plan,
                  score methodology, and the limits of the audit.
                </p>
                <div className="sample-note">
                  This is a previously finalized sample. Your edits in this demo
                  are exported separately as JSON and do not change this PDF.
                </div>
                <a
                  className="primary"
                  href="/sample-proposal.pdf"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open sample proposal ↗
                </a>
                <a className="secondary" href="/sample-proposal.pdf" download>
                  Download PDF ↓
                </a>
                <div className="methodology">
                  <h3>What powers the full application</h3>
                  <p>
                    Playwright browser captures · axe-core accessibility checks
                    · DOM and lab performance evidence · PostgreSQL · Redis and
                    BullMQ · Human review · Immutable report versions.
                  </p>
                  <p>
                    The public demo serves recorded data without a backend. The
                    full local application runs controlled fixture audits;
                    arbitrary website scans and external AI providers are
                    disabled.
                  </p>
                </div>
              </div>
            )}
          </section>
          <footer>
            AuditCraft AI{" "}
            <span>Evidence-led audits. Human-reviewed proposals.</span>
            <small>
              Fictional data · Portfolio MVP · No tracking or account required
            </small>
          </footer>
        </div>
      </main>
    </div>
  );
}
