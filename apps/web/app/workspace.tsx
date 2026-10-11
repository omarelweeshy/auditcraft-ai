"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  categories,
  stages,
  type Finding,
  type FindingInput,
  type Evidence,
  type Settings,
} from "../../../packages/core/src/model";
const reportSections = [
  "Summary",
  "Score",
  "Strengths",
  "Findings",
  "Plan",
  "Services",
  "Methodology",
];
type View =
  | "Overview"
  | "Prospects"
  | "Automation"
  | "Settings"
  | "New audit"
  | "Workspace";
const label = (s: string) => s.replaceAll("_", " ").toLowerCase();
const date = (s: string) =>
  new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const stamp = (s: string) =>
  new Date(s).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
function Badge({ value }: { value: string }) {
  return <span className={`badge ${value.toLowerCase()}`}>{label(value)}</span>;
}
function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    Overview: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    Prospects: (
      <>
        <circle cx="9" cy="8" r="4" />
        <path d="M2 21v-3a7 7 0 0 1 14 0v3m0-17a4 4 0 0 1 0 8m4 9v-3a7 7 0 0 0-3-6" />
      </>
    ),
    Automation: (
      <>
        <path d="m13 2-9 12h7l-1 8 10-12h-7z" />
      </>
    ),
    Settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="m9 3 6 0 1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z" />
      </>
    ),
  };
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      {paths[name] ?? <path d="M5 12h14m-7-7 7 7-7 7" />}
    </svg>
  );
}
export default function Workspace() {
  const [auth, setAuth] = useState<"loading" | "out" | "in">("loading"),
    [csrf, setCsrf] = useState(""),
    [view, setView] = useState<View>("Overview"),
    [dashboard, setDashboard] = useState<any>(null),
    [audit, setAudit] = useState<any>(null),
    [auditId, setAuditId] = useState<string | null>(null),
    [tab, setTab] = useState("Review"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [settings, setSettings] = useState<Settings | null>(null);
  const api = useCallback(
    async (url: string, method = "GET", data?: unknown, key?: string) => {
      const res = await fetch("/api/" + url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
          ...(key ? { "idempotency-key": key } : {}),
        },
        ...(data ? { body: JSON.stringify(data) } : {}),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401) setAuth("out");
        throw new Error(json.error ?? "Request failed");
      }
      return json;
    },
    [csrf],
  );
  const refresh = useCallback(async () => {
    const d = await api("dashboard");
    setDashboard(d);
  }, [api]);
  useEffect(() => {
    fetch("/api/session")
      .then(async (r) => {
        if (r.ok) {
          const s = await r.json();
          setCsrf(s.csrf);
          setAuth("in");
        } else setAuth("out");
      })
      .catch(() => setAuth("out"));
  }, []);
  useEffect(() => {
    if (auth !== "in") return;
    void refresh().catch((e) => setError(e.message));
    void api("settings")
      .then(setSettings)
      .catch((e) => setError(e.message));
    const timer = setInterval(() => void refresh().catch(() => {}), 4000);
    return () => clearInterval(timer);
  }, [auth, api, refresh]);
  const load = useCallback(
    async (id: string) => {
      setAudit(await api("audits/" + id));
    },
    [api],
  );
  useEffect(() => {
    if (!auditId || auth !== "in") return;
    void load(auditId).catch((e) => setError(e.message));
    const timer = setInterval(() => void load(auditId).catch(() => {}), 3000);
    return () => clearInterval(timer);
  }, [auditId, auth, load]);
  async function work(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function open(id: string) {
    setAudit(null);
    setAuditId(id);
    setView("Workspace");
    setTab("Review");
  }
  async function signIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password"));
    await work(async () => {
      await api("login", "POST", { password });
      const s = await api("session");
      setCsrf(s.csrf);
      setAuth("in");
    });
  }
  if (auth === "loading")
    return <div className="loading">AuditCraft / Opening your workspace…</div>;
  if (auth === "out")
    return (
      <main className="login">
        <div className="login-story">
          <div className="wordmark">
            a<span>c</span>
            <small>AUDITCRAFT AI</small>
          </div>
          <p className="eyebrow">THE EVIDENCE-LED CONSULTANCY WORKSPACE</p>
          <h1>
            See the detail.
            <br />
            Make the case.
          </h1>
          <p>
            Turn measurable website observations into a thoughtful,
            human-approved proposal.
          </p>
          <div className="login-grid">
            <span>
              01
              <br />
              Collect evidence
            </span>
            <span>
              02
              <br />
              Apply judgment
            </span>
            <span>
              03
              <br />
              Propose better
            </span>
          </div>
          <p className="fine">
            Single-user portfolio MVP · Fictional demo included
          </p>
        </div>
        <form onSubmit={signIn} className="login-form">
          <p className="eyebrow">YOUR PRIVATE WORKSPACE</p>
          <h2>Welcome back.</h2>
          <p>Sign in to review evidence and build your next proposal.</p>
          <label>
            Workspace password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={16}
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Signing in…" : "Open workspace ↗"}
          </button>
          <p className="fine">
            Use ADMIN_PASSWORD from your local .env file. Credentials are never
            stored in the browser.
          </p>
        </form>
      </main>
    );
  const audits = dashboard?.audits ?? [];
  const reviewing = audits.filter(
    (a: any) => a.status === "REVIEW_REQUIRED",
  ).length;
  const queued = audits.filter(
    (a: any) =>
      !["REVIEW_REQUIRED", "COMPLETE", "FAILED", "CANCELLED"].includes(
        a.status,
      ),
  ).length;
  return (
    <div className="shell">
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => setView("Overview")}
          aria-label="AuditCraft overview"
        >
          <span className="monogram">
            ac<span>↗</span>
          </span>
          <span>
            AuditCraft<small>EVIDENCE INTO OPPORTUNITY</small>
          </span>
        </button>
        <p className="nav-label">WORKSPACE</p>
        <nav>
          {(["Overview", "Prospects", "Automation"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={view === v ? "active" : ""}
            >
              <Icon name={v} />
              {v}
              {v === "Automation" && queued > 0 && (
                <span className="nav-count">{queued}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="signal" />
          DEMO ENVIRONMENT
          <p>
            Real tools.
            <br />
            Fictional prospects.
          </p>
          <small>
            Every conclusion starts with evidence. You make the final call.
          </small>
        </div>
        <nav className="bottom-nav">
          <button
            onClick={() => setView("Settings")}
            className={view === "Settings" ? "active" : ""}
          >
            <Icon name="Settings" />
            Settings
          </button>
          <button
            onClick={() =>
              void work(async () => {
                await api("logout", "POST");
                setAuth("out");
              })
            }
          >
            ↪ Sign out
          </button>
        </nav>
        <div className="identity">
          <span>AC</span>
          <div>
            {settings?.businessName ?? "Your studio"}
            <small>Single-user workspace</small>
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <span>
            Workspace <span className="slash">/</span>{" "}
            <strong>
              {view === "Workspace"
                ? (audit?.prospect?.businessName ?? "Audit")
                : view}
            </strong>
          </span>
          <div>
            <span
              className={`status-dot ${dashboard?.worker?.online ? "online" : ""}`}
            />
            {dashboard?.worker?.online ? "Worker online" : "Worker offline"}
            <span className="top-pill">LOCAL MVP</span>
          </div>
        </header>
        <main className="content">
          {error && (
            <div className="error" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                ×
              </button>
            </div>
          )}
          {notice && (
            <div className="success" role="status">
              {notice}
            </div>
          )}
          {(view === "Overview" || view === "Prospects") && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">
                    YOUR NEXT OPPORTUNITY STARTS WITH EVIDENCE
                  </p>
                  <h1>
                    {view === "Overview"
                      ? "A little clarity. A better proposal."
                      : "Your prospect notebook."}
                  </h1>
                  <p>
                    {view === "Overview"
                      ? "Inspect the details, shape the story, and put your expertise to work."
                      : "A considered workflow from first observation to final conversation."}
                  </p>
                </div>
                <button
                  className="primary"
                  onClick={() => setView("New audit")}
                >
                  ＋ New audit
                </button>
              </div>
              <div className="metrics">
                <Metric
                  label="TOTAL PROSPECTS"
                  value={dashboard?.prospects?.length ?? 0}
                  note="Your opportunity notebook"
                />
                <Metric
                  label="READY FOR REVIEW"
                  value={reviewing}
                  note="Waiting for your judgment"
                  accent
                />
                <Metric
                  label="REPORTS CREATED"
                  value={dashboard?.stats?.reports ?? 0}
                  note="Saved as immutable versions"
                />
                <Metric
                  label="AUDITS IN QUEUE"
                  value={queued}
                  note={
                    dashboard?.worker?.online
                      ? "Worker is connected"
                      : "Start the worker to process"
                  }
                />
              </div>
              <div className="overview-grid">
                <section className="panel prospects-panel">
                  <div className="section-title">
                    <div>
                      <p className="eyebrow">THE WORK IN PROGRESS</p>
                      <h2>Recent audits</h2>
                    </div>
                    <span className="muted">{audits.length} runs</span>
                  </div>
                  {!audits.length ? (
                    <div className="empty">
                      <h3>Your first proposal starts here.</h3>
                      <p>
                        Run a real browser audit of the controlled Fieldwork
                        Studio fixture.
                      </p>
                      <button
                        className="secondary"
                        onClick={() => setView("New audit")}
                      >
                        Start a fixture audit ↗
                      </button>
                    </div>
                  ) : (
                    <div className="audit-list">
                      {audits
                        .slice(0, view === "Overview" ? 6 : 100)
                        .map((a: any, i: number) => (
                          <button
                            className="audit-row"
                            key={a.id}
                            onClick={() => open(a.id)}
                          >
                            <span className={`prospect-mark mark-${i % 3}`}>
                              {a.prospect.businessName.slice(0, 1)}
                            </span>
                            <span className="prospect-name">
                              <strong>{a.prospect.businessName}</strong>
                              <small>
                                {a.prospect.industry ||
                                  "Fictional demonstration"}{" "}
                                · v{a.version}
                              </small>
                            </span>
                            <Badge value={a.status} />
                            <span className="row-date">
                              {date(a.created_at)}
                            </span>
                            <span className="arrow">↗</span>
                          </button>
                        ))}
                    </div>
                  )}
                </section>
                <section className="editorial-card">
                  <p className="eyebrow">BUILT FOR YOUR JUDGMENT</p>
                  <h2>
                    Evidence first.
                    <br />
                    Your expertise next.
                  </h2>
                  <div className="orbital">
                    <span>ac</span>
                    <i>01</i>
                    <i>02</i>
                    <i>03</i>
                  </div>
                  <p>
                    Automated observations are a starting point. Review the
                    context before a finding reaches your client.
                  </p>
                  <span className="fine">COLLECT → REVIEW → PROPOSE</span>
                </section>
              </div>
              <div className="lower-grid">
                <section className="panel">
                  <p className="eyebrow">WORKSPACE PULSE</p>
                  <div className="pulse">
                    <div>
                      <strong>
                        {dashboard?.stats?.duration
                          ? `${Math.round(dashboard.stats.duration)}s`
                          : "—"}
                      </strong>
                      <span>Average completed audit</span>
                    </div>
                    <div>
                      <strong>
                        {
                          audits.filter((a: any) => a.status === "FAILED")
                            .length
                        }
                      </strong>
                      <span>Failed runs to investigate</span>
                    </div>
                  </div>
                </section>
                <section className="panel">
                  <p className="eyebrow">COMMON FINDING CATEGORIES</p>
                  <div className="category-chips">
                    {dashboard?.common?.length ? (
                      dashboard.common.slice(0, 4).map((c: any) => (
                        <span key={c.category}>
                          {c.category} <b>{c.count}</b>
                        </span>
                      ))
                    ) : (
                      <p className="muted">
                        Patterns will appear after your first audit.
                      </p>
                    )}
                  </div>
                </section>
              </div>
            </>
          )}
          {view === "New audit" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">01 / COLLECT</p>
                  <h1>A closer look starts here.</h1>
                  <p>
                    Run the complete workflow with our controlled, fictional
                    website.
                  </p>
                </div>
              </div>
              <NewAudit
                settings={settings}
                busy={busy}
                onSubmit={(data) =>
                  void work(async () => {
                    const a = await api(
                      "audits",
                      "POST",
                      data,
                      crypto.randomUUID(),
                    );
                    await refresh();
                    open(a.id);
                    setTab("Timeline");
                  })
                }
              />
            </>
          )}
          {view === "Automation" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">BEHIND THE EVIDENCE</p>
                  <h1>The work, in motion.</h1>
                  <p>
                    Durable jobs, bounded retries, and a record of every stage.
                  </p>
                </div>
                <Badge
                  value={dashboard?.worker?.online ? "ONLINE" : "OFFLINE"}
                />
              </div>
              <section className="panel">
                <div className="run-table">
                  <div className="run-row run-head">
                    <span>Prospect / correlation ID</span>
                    <span>Stage</span>
                    <span>Attempts</span>
                    <span>Status</span>
                    <span>Action</span>
                  </div>
                  {audits.map((a: any) => (
                    <div className="run-row" key={a.id}>
                      <button
                        className="text-button"
                        onClick={() => open(a.id)}
                      >
                        <strong>{a.prospect.businessName}</strong>
                        <small>
                          {a.id.slice(0, 8)} · v{a.version}
                        </small>
                      </button>
                      <span>{label(a.stage)}</span>
                      <span>{a.attempts} / 3</span>
                      <div>
                        <Badge value={a.status} />
                        {a.error && <p className="fine">{a.error.message}</p>}
                      </div>
                      <button
                        className="secondary small"
                        disabled={busy}
                        onClick={() =>
                          void work(async () => {
                            if (
                              [
                                "FAILED",
                                "CANCELLED",
                                "COMPLETE",
                                "REVIEW_REQUIRED",
                              ].includes(a.status)
                            ) {
                              const run = await api(
                                `audits/${a.id}/retry`,
                                "POST",
                                {},
                                crypto.randomUUID(),
                              );
                              open(run.id);
                            } else
                              await api(`audits/${a.id}/cancel`, "POST", {});
                            await refresh();
                          })
                        }
                      >
                        {[
                          "FAILED",
                          "CANCELLED",
                          "COMPLETE",
                          "REVIEW_REQUIRED",
                        ].includes(a.status)
                          ? "New version"
                          : "Cancel"}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
          {view === "Settings" && settings && (
            <SettingsForm
              value={settings}
              busy={busy}
              save={(s) =>
                void work(async () => {
                  await api("settings", "PUT", s);
                  setSettings(s);
                  setNotice(
                    "Settings saved. Existing report versions retain their original configuration.",
                  );
                })
              }
            />
          )}
          {view === "Workspace" &&
            (!audit ? (
              <div className="empty">Loading evidence…</div>
            ) : (
              <>
                <div className="page-heading audit-heading">
                  <div>
                    <button
                      className="back"
                      onClick={() => setView("Prospects")}
                    >
                      ← All prospects
                    </button>
                    <p className="eyebrow">
                      FICTIONAL PROSPECT / AUDIT{" "}
                      {String(audit.version).padStart(2, "0")}
                    </p>
                    <h1>
                      {audit.prospect.businessName}
                      <span className="heading-dot">.</span>
                    </h1>
                    <p>
                      {audit.prospect.website}{" "}
                      <span className="divider">|</span>{" "}
                      {audit.prospect.industry}{" "}
                      <span className="divider">|</span>{" "}
                      {audit.prospect.location}
                    </p>
                  </div>
                  <div className="heading-actions">
                    <Badge value={audit.status} />
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        void work(async () => {
                          const a = await api(
                            `audits/${audit.id}/rerun`,
                            "POST",
                            {},
                            crypto.randomUUID(),
                          );
                          open(a.id);
                          await refresh();
                        })
                      }
                    >
                      ↻ Run new version
                    </button>
                  </div>
                </div>
                <div
                  className="workspace-tabs"
                  role="tablist"
                  aria-label="Prospect workspace"
                >
                  {[
                    "Review",
                    "Evidence",
                    "Captures",
                    "Timeline",
                    "Report",
                    "History",
                  ].map((t) => (
                    <button
                      key={t}
                      role="tab"
                      aria-selected={tab === t}
                      className={tab === t ? "active" : ""}
                      onClick={() => setTab(t)}
                    >
                      {t}
                      {t === "Review" && <span>{audit.findings.length}</span>}
                    </button>
                  ))}
                </div>
                {tab === "Review" && (
                  <Review
                    audit={audit}
                    busy={busy}
                    save={(f, approval) =>
                      void work(async () => {
                        const {
                          id,
                          auditId: _auditId,
                          approval: _approval,
                          revision,
                          ...input
                        } = f;
                        await api("findings/" + id, "PUT", {
                          finding: input,
                          approval,
                          revision,
                        });
                        await load(audit.id);
                        setNotice(
                          "Finding saved. Previous revision preserved.",
                        );
                      })
                    }
                    revisions={(id) => api(`findings/${id}/revisions`)}
                    manual={(f) =>
                      void work(async () => {
                        await api(`audits/${audit.id}/findings`, "POST", f);
                        await load(audit.id);
                        setNotice("Manual finding added for review.");
                      })
                    }
                  />
                )}
                {tab === "Evidence" && (
                  <EvidenceExplorer
                    evidence={audit.evidence}
                    findings={audit.findings}
                  />
                )}
                {tab === "Captures" && (
                  <div className="capture-grid">
                    {audit.captures.map((c: any) => (
                      <section className="panel" key={c.id}>
                        <p className="eyebrow">
                          {new URL(c.finalUrl).pathname} · {c.status} ·{" "}
                          {c.contentType}
                        </p>
                        <h2>{c.title}</h2>
                        <div className="capture-pair">
                          {["desktop", "mobile"].map((v) => (
                            <a
                              key={v}
                              href={"/api/artifacts/" + c.screenshots[v]}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <img
                                src={"/api/artifacts/" + c.screenshots[v]}
                                alt={`${v} full-page capture of ${c.title}`}
                              />
                              <span>
                                {v} · {c.viewports[v].width} ×{" "}
                                {c.viewports[v].height}
                              </span>
                            </a>
                          ))}
                        </div>
                        <p className="fine">
                          {c.robots} · {new Date(c.timestamp).toLocaleString()}
                        </p>
                        {c.warnings.map((w: string) => (
                          <p key={w} className="fine">
                            {w}
                          </p>
                        ))}
                      </section>
                    ))}
                  </div>
                )}
                {tab === "Timeline" && (
                  <div className="timeline-grid">
                    <section className="panel">
                      <p className="eyebrow">AUTOMATION TIMELINE</p>
                      <h2>From page to proposal.</h2>
                      <ol className="timeline">
                        {stages.map((s, i) => {
                          const events = audit.events.filter(
                            (e: any) => e.stage === s,
                          );
                          return (
                            <li key={s} className={events.length ? "done" : ""}>
                              <span>
                                {events.length
                                  ? "✓"
                                  : String(i + 1).padStart(2, "0")}
                              </span>
                              <div>
                                <strong>{label(s)}</strong>
                                <p>
                                  {events.at(-1)?.message ??
                                    "Waiting for this stage"}
                                </p>
                              </div>
                              {events.length > 0 && (
                                <time>{stamp(events.at(-1).created_at)}</time>
                              )}
                            </li>
                          );
                        })}
                      </ol>
                    </section>
                    <section className="panel">
                      <p className="eyebrow">RUN DETAILS</p>
                      <h2>Observable by design.</h2>
                      <dl>
                        <dt>Correlation ID</dt>
                        <dd className="mono">{audit.id}</dd>
                        <dt>Attempts</dt>
                        <dd>{audit.attempts} / 3</dd>
                        <dt>Inspected pages</dt>
                        <dd>
                          {audit.captures.length} / {audit.config.input.depth}
                        </dd>
                        <dt>Request budget</dt>
                        <dd>{audit.config.limits?.maxRequests ?? "Not recorded"}</dd>
                        <dt>Time budget</dt>
                        <dd>{audit.config.limits ? `${audit.config.limits.timeoutMs / 1000}s` : "Not recorded"}</dd>
                        <dt>Explanation provider</dt>
                        <dd>Deterministic templates</dd>
                      </dl>
                      {audit.error && (
                        <div className="error">{audit.error.message}</div>
                      )}
                      {![
                        "COMPLETE",
                        "REVIEW_REQUIRED",
                        "CANCELLED",
                        "FAILED",
                      ].includes(audit.status) && (
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() =>
                            void work(async () => {
                              await api(
                                `audits/${audit.id}/cancel`,
                                "POST",
                                {},
                              );
                              await load(audit.id);
                            })
                          }
                        >
                          Cancel audit
                        </button>
                      )}
                    </section>
                  </div>
                )}
                {tab === "Report" && (
                  <ReportEditor
                    audit={audit}
                    busy={busy}
                    api={api}
                    act={work}
                    onFinalized={() => load(audit.id)}
                  />
                )}
                {tab === "History" && (
                  <section className="panel">
                    <div className="section-title">
                      <h2>A complete paper trail.</h2>
                      <label>
                        Prospect status
                        <select
                          value={audit.prospect_status}
                          onChange={(e) =>
                            void work(async () => {
                              await api(
                                "prospects/" + audit.prospect_id,
                                "PUT",
                                { status: e.target.value },
                              );
                              await load(audit.id);
                            })
                          }
                        >
                          {[
                            "NEW",
                            "AUDITING",
                            "REVIEW_REQUIRED",
                            "REPORT_READY",
                            "PROPOSAL_READY",
                            "CONTACTED",
                            "WON",
                            "LOST",
                            "ARCHIVED",
                          ].map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="version-links">
                      {audits
                        .filter((a: any) => a.prospect_id === audit.prospect_id)
                        .map((a: any) => (
                          <button
                            className="secondary small"
                            key={a.id}
                            onClick={() => open(a.id)}
                          >
                            Audit v{a.version} · {label(a.status)}
                          </button>
                        ))}
                    </div>
                    {audit.events.map((e: any, i: number) => (
                      <div className="history-row" key={i}>
                        <time>
                          {date(e.created_at)} · {stamp(e.created_at)}
                        </time>
                        <Badge value={e.stage} />
                        <p>{e.message}</p>
                      </div>
                    ))}
                  </section>
                )}
              </>
            ))}
          <footer className="app-footer">
            <span>
              AuditCraft AI{" "}
              <span className="muted">/ Independent portfolio project</span>
            </span>
            <span>Public evidence only. Human judgment always.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
function Metric({
  label,
  value,
  note,
  accent = false,
}: {
  label: string;
  value: string | number;
  note: string;
  accent?: boolean;
}) {
  return (
    <div className={"metric " + (accent ? "accent" : "")}>
      <p className="eyebrow">
        {label}
        <span>↗</span>
      </p>
      <strong>{String(value).padStart(2, "0")}</strong>
      <p>{note}</p>
    </div>
  );
}
function NewAudit({
  settings,
  busy,
  onSubmit,
}: {
  settings: Settings | null;
  busy: boolean;
  onSubmit: (data: any) => void;
}) {
  return (
    <div className="form-layout">
      <form
        className="panel form-panel"
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          onSubmit({
            businessName: d.get("businessName"),
            website: d.get("website"),
            industry: d.get("industry"),
            location: d.get("location"),
            notes: d.get("notes"),
            services: d.getAll("services"),
            depth: Number(d.get("depth")),
            responsibleUse: d.get("responsibleUse") === "on",
            mode: "fixture",
            simulateFailure: d.get("failure") === "on",
            simulateAiFailure: d.get("aiFailure") === "on",
          });
        }}
      >
        <div className="section-title">
          <h2>Meet the prospect.</h2>
          <Badge value="FICTIONAL DEMO" />
        </div>
        <div className="form-grid">
          <label>
            Business name
            <input
              name="businessName"
              defaultValue="Fieldwork Studio"
              required
              maxLength={120}
            />
          </label>
          <label>
            Website URL
            <input
              name="website"
              value="https://fixture.auditcraft.test/"
              readOnly
            />
          </label>
          <label>
            Industry
            <input
              name="industry"
              defaultValue="Interior design"
              maxLength={100}
            />
          </label>
          <label>
            Location
            <input
              name="location"
              defaultValue="Cairo, Egypt (fictional)"
              maxLength={100}
            />
          </label>
        </div>
        <label>
          Prospect notes
          <textarea
            name="notes"
            placeholder="Context for your review. Avoid personal or sensitive information."
            maxLength={2000}
          />
        </label>
        <fieldset>
          <legend>Services you could offer</legend>
          <div className="checkbox-grid">
            {settings?.services.map((s) => (
              <label className="check" key={s}>
                <input
                  type="checkbox"
                  name="services"
                  value={s}
                  defaultChecked
                />
                {s}
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          Audit depth
          <select name="depth" defaultValue="1">
            <option value="1">Homepage only · focused review</option>
            <option value="4">Homepage + up to 3 discovered pages</option>
          </select>
        </label>
        <details>
          <summary>Failure recovery demonstration</summary>
          <label className="check">
            <input type="checkbox" name="failure" />
            Simulate one failure, then retry automatically
          </label>
          <label className="check">
            <input type="checkbox" name="aiFailure" />
            Simulate explanation failure; retain raw evidence
          </label>
        </details>
        <label className="check responsible">
          <input type="checkbox" name="responsibleUse" required />I will review
          evidence before using it in a proposal. I understand this is a
          fictional fixture and no third-party site is scanned.
        </label>
        <button className="primary" disabled={busy}>
          {busy ? "Creating audit…" : "Start evidence collection ↗"}
        </button>
      </form>
      <aside className="guide">
        <p className="eyebrow">WHAT HAPPENS NEXT</p>
        <h2>
          A measured
          <br />
          first impression.
        </h2>
        <ol>
          <li>Isolated browser captures the fixture.</li>
          <li>Deterministic checks collect evidence.</li>
          <li>Templates explain observed findings.</li>
          <li>You edit and approve the final story.</li>
        </ol>
        <div className="notice">
          <strong>Public-site audits are disabled.</strong>
          <p>
            This release exercises the complete fixture workflow. Live browser
            egress and external AI providers require further security
            verification.
          </p>
        </div>
        <p className="fine">
          No login bypass, vulnerability scanning, sensitive data collection,
          automatic pricing, or email sending.
        </p>
      </aside>
    </div>
  );
}
function Review({
  audit,
  busy,
  save,
  manual,
  revisions,
}: {
  audit: any;
  busy: boolean;
  save: (f: Finding, approval: string) => void;
  manual: (f: FindingInput) => void;
  revisions: (id: string) => Promise<any>;
}) {
  const [selected, setSelected] = useState<string | null>(null),
    [draft, setDraft] = useState<Finding | null>(null),
    [viewport, setViewport] = useState("desktop"),
    [history, setHistory] = useState<any[]>([]),
    [filter, setFilter] = useState("ALL");
  const current =
    audit.findings.find((f: Finding) => f.id === selected) ?? audit.findings[0];
  useEffect(() => {
    setDraft(current ? structuredClone(current) : null);
    setHistory([]);
  }, [current?.id, current?.revision]);
  const refs = draft
    ? audit.evidence.filter((e: Evidence) => draft.evidenceIds.includes(e.id))
    : [];
  const capture =
    audit.captures.find((c: any) => c.finalUrl === refs[0]?.pageUrl) ??
    audit.captures[0];
  if (!draft)
    return (
      <section className="panel empty">
        <h2>
          {audit.evidence.length
            ? "Evidence is ready for your interpretation."
            : ["FAILED", "CANCELLED"].includes(audit.status)
              ? "This audit stopped before review."
              : "The browser is collecting your evidence."}
        </h2>
        <p>
          {audit.evidence.length
            ? "The explanation stage may have failed. Add a manual finding linked to a recorded observation."
            : ["FAILED", "CANCELLED"].includes(audit.status)
              ? audit.error?.message ?? "The run was cancelled. Open the timeline or start a new version."
              : "Open the timeline to follow each stage."}
        </p>
        {audit.evidence.length > 0 && (
          <button
            className="primary"
            onClick={() => manual(manualFrom(audit.evidence[0], 0))}
          >
            Add evidence-linked manual finding
          </button>
        )}
      </section>
    );
  const change = (key: keyof Finding, value: unknown) =>
    setDraft({ ...draft, [key]: value });
  return (
    <>
      <div className="review-summary">
        <div
          className="score-ring"
          style={
            { "--score": `${audit.score.total ?? 0}%` } as React.CSSProperties
          }
        >
          <strong>{audit.score.total ?? "—"}</strong>
          <small>/ 100</small>
        </div>
        <div>
          <p className="eyebrow">DETERMINISTIC HEALTH SCORE</p>
          <h3>The detail behind the number.</h3>
          <span className="muted">
            {audit.evidence.length} observations · {audit.captures.length} pages
            · {Math.round(audit.score.coverage * 100)}% category coverage
          </span>
        </div>
        <div className="review-count">
          <strong>
            {
              audit.findings.filter((f: Finding) => f.approval === "APPROVED")
                .length
            }
            <small> / {audit.findings.length}</small>
          </strong>
          <span>findings approved</span>
        </div>
      </div>
      <details className="score-details">
        <summary>Inspect category scores and deductions</summary>
        <div className="score-categories">
          {audit.score.breakdown.map((c: any) => (
            <article key={c.category}>
              <strong>
                {c.category} <b>{c.score ?? "—"}/100</b>
              </strong>
              <meter min="0" max="100" value={c.score ?? 0} />
              <p>{c.formula}</p>
              <small>
                {c.deductions.length} deductions ·{" "}
                {Math.round(c.confidence * 100)}% confidence
              </small>
              {c.deductions.map((d: any) => (
                <p className="fine" key={d.evidenceId}>
                  {d.check}: −{d.points} · {d.evidenceId.slice(0, 8)}
                </p>
              ))}
            </article>
          ))}
        </div>
      </details>
      <div className="review-layout">
        <aside className="finding-list">
          <div className="section-title">
            <p className="eyebrow">FINDINGS</p>
            <select
              aria-label="Filter finding approval"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              {["ALL", "PENDING", "APPROVED", "REJECTED", "EDITED"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          {audit.findings
            .filter((f: Finding) => filter === "ALL" || f.approval === filter)
            .map((f: Finding, i: number) => (
              <button
                key={f.id}
                className={
                  "finding-item " + (f.id === draft.id ? "selected" : "")
                }
                onClick={() => setSelected(f.id)}
              >
                <span className="finding-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <span className="fine">{f.category}</span>
                  <strong>{f.title}</strong>
                  <Badge value={f.approval} />
                </div>
              </button>
            ))}
          <button
            className="text-button add-manual"
            disabled={busy}
            onClick={() =>
              manual(
                manualFrom(refs[0] ?? audit.evidence[0], audit.findings.length),
              )
            }
          >
            ＋ Add manual finding
          </button>
        </aside>
        <div className="review-main">
          <section className="evidence-pane">
            <div className="section-title">
              <p className="eyebrow">THE OBSERVATION</p>
              <div className="segmented">
                {["desktop", "mobile"].map((v) => (
                  <button
                    className={viewport === v ? "active" : ""}
                    key={v}
                    onClick={() => setViewport(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="browser-frame">
              <div className="browser-bar">
                <i />
                <i />
                <i />
                <span>{refs[0]?.pageUrl ?? audit.prospect.website}</span>
                <a
                  href={
                    capture
                      ? "/api/artifacts/" + capture.screenshots[viewport]
                      : undefined
                  }
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open full screenshot"
                >
                  ↗
                </a>
              </div>
              {capture && (
                <div className={"screenshot " + viewport}>
                  <img
                    src={"/api/artifacts/" + capture.screenshots[viewport]}
                    alt={`${viewport} evidence capture for the selected finding`}
                  />
                </div>
              )}
            </div>
            <div className="evidence-cards">
              {refs.map((e: Evidence) => (
                <article key={e.id}>
                  <div>
                    <span className="evidence-tag">
                      EVIDENCE {e.id.slice(0, 8)}
                    </span>
                    <Badge value={e.kind} />
                  </div>
                  <strong>{e.observed}</strong>
                  <p>{e.expected}</p>
                  <small>
                    {e.tool} {e.toolVersion} · {Math.round(e.confidence * 100)}%
                    confidence
                  </small>
                </article>
              ))}
            </div>
          </section>
          <section className="interpretation">
            <div className="section-title">
              <p className="eyebrow">YOUR INTERPRETATION</p>
              <Badge value={draft.approval} />
            </div>
            <label>
              Finding title
              <input
                value={draft.title}
                onChange={(e) => change("title", e.target.value)}
                maxLength={180}
              />
            </label>
            <div className="form-grid">
              <label>
                Severity
                <select
                  value={draft.severity}
                  onChange={(e) => change("severity", e.target.value)}
                >
                  {["info", "low", "medium", "high"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Effort
                <select
                  value={draft.effort}
                  onChange={(e) => change("effort", e.target.value)}
                >
                  {["Small", "Medium", "Large", "Needs scoping"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              What we observed
              <textarea
                value={draft.explanation}
                onChange={(e) => change("explanation", e.target.value)}
                maxLength={2000}
              />
            </label>
            <label>
              Why it may matter
              <textarea
                value={draft.businessRelevance}
                onChange={(e) => change("businessRelevance", e.target.value)}
                maxLength={1000}
              />
            </label>
            <label>
              Recommended improvement
              <textarea
                value={draft.recommendation}
                onChange={(e) => change("recommendation", e.target.value)}
                maxLength={2000}
              />
            </label>
            <label>
              Reviewer notes
              <textarea
                value={draft.reviewerNotes}
                onChange={(e) => change("reviewerNotes", e.target.value)}
                placeholder="Add context from your professional review."
                maxLength={2000}
              />
            </label>
            <label>
              Display order
              <input
                type="number"
                min="0"
                max="10000"
                value={draft.order}
                onChange={(e) => change("order", Number(e.target.value))}
              />
            </label>
            <p className="fine">
              {draft.aiGenerated
                ? "Template-assisted explanation"
                : "Manual interpretation"}{" "}
              · Revision {draft.revision}. Saving edits preserves the previous
              revision. Approval applies to the text currently shown.
            </p>
            <div className="review-actions">
              <button
                className="primary"
                disabled={busy}
                onClick={() => save(draft, "APPROVED")}
              >
                ✓ Approve finding
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => save(draft, "EDITED")}
              >
                Save revision
              </button>
              <button
                className="text-button danger"
                disabled={busy}
                onClick={() => save(draft, "REJECTED")}
              >
                Reject
              </button>
            </div>
            <button
              className="text-button history-toggle"
              onClick={() => void revisions(draft.id).then(setHistory)}
            >
              View revision history
            </button>
            {history.map((r) => (
              <details key={r.revision}>
                <summary>
                  Revision {r.revision} · {label(r.approval)}
                </summary>
                <p>{r.data.explanation}</p>
                <p>{r.data.recommendation}</p>
              </details>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}
function manualFrom(e: Evidence, order: number): FindingInput {
  return {
    title: "Manual review: " + e.check,
    category: e.category,
    severity: e.severity,
    confidence: e.confidence,
    explanation: `Recorded observation: ${e.observed}.`,
    businessRelevance:
      "Requires manual review to determine the practical impact.",
    recommendation: `Review the referenced evidence. ${e.expected}.`,
    effort: "Needs scoping",
    evidenceIds: [e.id],
    assumptions: ["Manual interpretation requires verification."],
    aiGenerated: false,
    reviewerNotes: "",
    order,
  };
}
function EvidenceExplorer({
  evidence,
  findings,
}: {
  evidence: Evidence[];
  findings: Finding[];
}) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const choices: Record<string, string[]> = {
    category: [...categories],
    severity: ["info", "low", "medium", "high"],
    pageUrl: [...new Set(evidence.map((e) => e.pageUrl))],
    tool: [...new Set(evidence.map((e) => e.tool))],
    confidence: ["High (≥90%)", "Review (<90%)"],
    usage: ["Used in findings", "Unused"],
  };
  const filtered = evidence.filter((e) =>
    Object.entries(filters).every(
      ([k, v]) =>
        !v ||
        (k === "confidence"
          ? v.startsWith("High")
            ? e.confidence >= 0.9
            : e.confidence < 0.9
          : k === "usage"
            ? findings.some((f) => f.evidenceIds.includes(e.id)) ===
              (v === "Used in findings")
            : e[k as keyof Evidence] === v),
    ),
  );
  return (
    <section className="panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">THE SOURCE OF TRUTH</p>
          <h2>Evidence explorer</h2>
        </div>
        <span>
          {filtered.length} / {evidence.length}
        </span>
      </div>
      <div className="filter-bar">
        {Object.entries(choices).map(([key, options]) => (
          <label key={key}>
            {key === "pageUrl" ? "Page" : key}
            <select
              aria-label={key}
              value={filters[key] ?? ""}
              onChange={(e) =>
                setFilters({ ...filters, [key]: e.target.value })
              }
            >
              <option value="">All</option>
              {options.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="evidence-table">
        {filtered.map((e) => (
          <details key={e.id}>
            <summary>
              <span className={"check-result " + (e.passed ? "pass" : "fail")}>
                {e.passed ? "✓" : "!"}
              </span>
              <span>
                <strong>{e.check}</strong>
                <small>
                  {e.category} · {new URL(e.pageUrl).pathname}
                </small>
              </span>
              <Badge value={e.severity} />
              <span className="observed">{e.observed}</span>
              <span className="confidence">
                {Math.round(e.confidence * 100)}%
              </span>
            </summary>
            <div className="evidence-detail">
              <p>
                <b>Expected:</b> {e.expected}
              </p>
              <p>
                <b>Method:</b> {e.method}
              </p>
              <p>
                <b>Tool:</b> {e.tool} {e.toolVersion} · {e.timestamp}
              </p>
              <p>
                <b>Scoring:</b> {e.deduction} category points deducted ·{" "}
                {e.kind}
              </p>
              <p className="mono">{e.id}</p>
              {e.artifact && (
                <a
                  href={"/api/artifacts/" + e.artifact}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open referenced capture ↗
                </a>
              )}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
function ReportEditor({
  audit,
  busy,
  api,
  act,
  onFinalized,
}: {
  audit: any;
  busy: boolean;
  api: (u: string, m?: string, d?: unknown) => Promise<any>;
  act: (f: () => Promise<void>) => Promise<void>;
  onFinalized: () => Promise<void>;
}) {
  const approved = audit.findings.filter(
    (f: Finding) => f.approval === "APPROVED",
  );
  const [summary, setSummary] = useState(
      "This review documents measurable observations from the fictional Fieldwork Studio website. The approved findings identify opportunities for a focused technical and usability review. Scope and business impact should be confirmed with the website owner.",
    ),
    [included, setIncluded] = useState<string[]>([]),
    [sections, setSections] = useState<string[]>([...reportSections]),
    [screenshot, setScreenshot] = useState(
      audit.captures[0]?.screenshots.desktopFold ?? "",
    ),
    [reportId, setReportId] = useState(audit.reports[0]?.id ?? ""),
    [outreach, setOutreach] = useState<any>(null),
    [outreachHistory, setOutreachHistory] = useState<any[]>([]);
  useEffect(() => {
    setIncluded(approved.map((f: Finding) => f.id));
  }, [audit.id, approved.map((f: Finding) => f.id).join(",")]);
  useEffect(() => {
    if (reportId)
      void api(`reports/${reportId}/outreach`).then((rows) => {
        setOutreach({ ...rows[0]?.data, revision: rows[0]?.revision });
        setOutreachHistory(rows);
      });
  }, [reportId, api]);
  function move(i: number, delta: number) {
    const copy = [...sections];
    [copy[i], copy[i + delta]] = [copy[i + delta], copy[i]];
    setSections(copy);
  }
  return (
    <>
      <div className="report-layout">
        <section className="panel">
          <p className="eyebrow">03 / PROPOSE</p>
          <h2>Make a thoughtful case.</h2>
          <label>
            Executive summary
            <textarea
              className="large-text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={3000}
            />
          </label>
          <fieldset>
            <legend>Approved findings to include ({approved.length})</legend>
            {approved.length ? (
              approved.map((f: Finding) => (
                <label key={f.id} className="check">
                  <input
                    type="checkbox"
                    checked={included.includes(f.id)}
                    onChange={(e) =>
                      setIncluded(
                        e.target.checked
                          ? [...included, f.id]
                          : included.filter((id) => id !== f.id),
                      )
                    }
                  />
                  {f.title}
                </label>
              ))
            ) : (
              <p className="notice">
                Approve at least one finding in the review workspace first.
              </p>
            )}
          </fieldset>
          <label>
            Cover screenshot
            <select
              value={screenshot}
              onChange={(e) => setScreenshot(e.target.value)}
            >
              <option value="">No screenshot</option>
              {audit.captures.flatMap((c: any) =>
                Object.entries(c.screenshots).map(([name, p]) => (
                  <option key={p as string} value={p as string}>
                    {new URL(c.finalUrl).pathname} · {name}
                  </option>
                )),
              )}
            </select>
          </label>
          <p className="eyebrow">SECTION ORDER</p>
          <ol className="section-order">
            {sections.map((s, i) => (
              <li key={s}>
                <span>
                  {String(i + 1).padStart(2, "0")} / {s}
                </span>
                <div>
                  <button
                    aria-label={`Move ${s} up`}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`Move ${s} down`}
                    disabled={i === sections.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    ↓
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <button
            className="primary"
            disabled={busy || !included.length}
            onClick={() =>
              void act(async () => {
                const r = await api(`audits/${audit.id}/reports`, "POST", {
                  summary,
                  findingIds: included,
                  sections,
                  screenshot: screenshot || null,
                });
                setReportId(r.id);
                await onFinalized();
              })
            }
          >
            Finalize version & generate PDF ↗
          </button>
          <p className="fine">
            Finalization creates an immutable snapshot. Later edits require a
            new report version. Only selected, approved findings are included.
            Scoring retains all deterministic observations.
          </p>
        </section>
        <section className="report-preview">
          <div className="section-title">
            <p className="eyebrow">SAVED REPORT PREVIEW</p>
            {reportId && (
              <a
                href={`/api/reports/${reportId}/html`}
                target="_blank"
                rel="noreferrer"
              >
                Open full report ↗
              </a>
            )}
          </div>
          {reportId ? (
            <iframe
              title="Branded report preview"
              src={`/api/reports/${reportId}/html`}
            />
          ) : (
            <div className="report-placeholder">
              <span className="monogram">ac↗</span>
              <h2>
                Your expertise.
                <br />
                Beautifully presented.
              </h2>
              <p>
                Approve findings and finalize a version to preview your
                evidence-backed proposal.
              </p>
            </div>
          )}
          <div className="version-list">
            {audit.reports.map((r: any) => (
              <div key={r.id}>
                <button
                  className="text-button"
                  onClick={() => setReportId(r.id)}
                >
                  Report v{r.version} · {date(r.created_at)}
                </button>
                <Badge value={r.pdf_status} />
                {r.pdf_status === "READY" && (
                  <a
                    className="secondary small"
                    href={`/api/reports/${r.id}/pdf`}
                  >
                    Download PDF ↓
                  </a>
                )}
                {r.pdf_error && <p className="fine">{r.pdf_error.message}</p>}
              </div>
            ))}
          </div>
        </section>
      </div>
      {outreach && (
        <section className="panel outreach">
          <div className="section-title">
            <div>
              <p className="eyebrow">A CONVERSATION STARTER</p>
              <h2>Outreach, without the overpromise.</h2>
            </div>
            <Badge value="DRAFT ONLY" />
          </div>
          <p className="fine">
            Generated from approved report findings only. Manual edits are your
            responsibility. Nothing is sent automatically.
          </p>
          <label>
            Subject
            <input
              value={outreach.subject}
              onChange={(e) =>
                setOutreach({ ...outreach, subject: e.target.value })
              }
            />
          </label>
          <label>
            Message
            <textarea
              aria-label="Message"
              value={outreach.message}
              onChange={(e) =>
                setOutreach({ ...outreach, message: e.target.value })
              }
            />
          </label>
          <div className="review-actions">
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  const r = await api(`reports/${reportId}/outreach`, "POST", {
                    subject: outreach.subject,
                    message: outreach.message,
                    revision: outreach.revision,
                  });
                  setOutreach({ ...outreach, revision: r.revision });
                  setOutreachHistory(await api(`reports/${reportId}/outreach`));
                })
              }
            >
              Save revision
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  const r = await api(`reports/${reportId}/outreach`, "POST", {
                    subject: outreach.subject,
                    message: outreach.message,
                    revision: outreach.revision,
                    exported: true,
                  });
                  setOutreach({ ...outreach, revision: r.revision });
                  const blob = new Blob(
                    [`Subject: ${outreach.subject}\n\n${outreach.message}`],
                    { type: "text/plain" },
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "outreach-draft.txt";
                  a.click();
                  URL.revokeObjectURL(url);
                })
              }
            >
              Export text draft ↓
            </button>
          </div>
          <details>
            <summary>{outreachHistory.length} saved outreach revisions</summary>
            {outreachHistory.map((r) => (
              <div key={r.id}>
                <strong>Revision {r.revision}</strong>
                <pre>{r.data.message}</pre>
              </div>
            ))}
          </details>
        </section>
      )}
    </>
  );
}
function SettingsForm({
  value,
  busy,
  save,
}: {
  value: Settings;
  busy: boolean;
  save: (s: Settings) => void;
}) {
  const [draft, setDraft] = useState(value);
  const set = (key: keyof Settings, v: unknown) =>
    setDraft({ ...draft, [key]: v });
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">MAKE IT YOUR OWN</p>
          <h1>The studio behind the work.</h1>
          <p>Your identity, methodology and audit boundaries.</p>
        </div>
      </div>
      <form
        className="settings-grid"
        onSubmit={(e) => {
          e.preventDefault();
          save(draft);
        }}
      >
        <section className="panel">
          <h2>Brand & contact</h2>
          <div className="form-grid">
            {(
              ["displayName", "businessName", "email", "portfolioUrl"] as const
            ).map((k) => (
              <label key={k}>
                {
                  {
                    displayName: "Display name",
                    businessName: "Business name",
                    email: "Email",
                    portfolioUrl: "Portfolio URL",
                  }[k]
                }
                <input
                  value={draft[k]}
                  onChange={(e) => set(k, e.target.value)}
                  type={
                    k === "email"
                      ? "email"
                      : k === "portfolioUrl"
                        ? "url"
                        : "text"
                  }
                  required={k !== "portfolioUrl"}
                />
              </label>
            ))}
          </div>
          <label>
            Brand color
            <input
              type="color"
              value={draft.brandColor}
              onChange={(e) => set("brandColor", e.target.value)}
            />
          </label>
          <label>
            Service catalogue (one per line)
            <textarea
              value={draft.services.join("\n")}
              onChange={(e) => set("services", e.target.value.split("\n"))}
            />
          </label>
          <label>
            Report disclaimer
            <textarea
              value={draft.disclaimer}
              onChange={(e) => set("disclaimer", e.target.value)}
              minLength={20}
            />
          </label>
          <button className="primary" disabled={busy}>
            Save settings
          </button>
        </section>
        <div>
          <section className="panel">
            <h2>Scoring weights</h2>
            <p className="fine">
              Total must equal 100. Each failed observation deducts explicit
              category points. Missing categories reduce coverage.
            </p>
            {categories.map((c) => (
              <label className="weight-row" key={c}>
                {c}
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={draft.weights[c]}
                  onChange={(e) =>
                    set("weights", {
                      ...draft.weights,
                      [c]: Number(e.target.value),
                    })
                  }
                />
              </label>
            ))}
            <p>
              Total:{" "}
              <strong>
                {Object.values(draft.weights).reduce((a, b) => a + b, 0)} / 100
              </strong>
            </p>
          </section>
          <section className="panel settings-limits">
            <h2>Limits & provider</h2>
            {(["maxPages", "maxRequests", "timeoutMs"] as const).map((k) => (
              <label key={k}>
                {k}
                <input
                  type="number"
                  value={draft.limits[k]}
                  onChange={(e) =>
                    set("limits", {
                      ...draft.limits,
                      [k]: Number(e.target.value),
                    })
                  }
                />
              </label>
            ))}
            <div className="notice">
              <strong>Deterministic template provider · Ready</strong>
              <p>
                No paid account required. External AI and public-site scanning
                are not enabled. Secrets are never shown here.
              </p>
            </div>
          </section>
        </div>
      </form>
    </>
  );
}
