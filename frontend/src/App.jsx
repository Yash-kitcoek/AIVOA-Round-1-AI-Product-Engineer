import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  analyzeComplaint,
  clearAnalysis,
  clearError,
  clearSaveSuccess,
  deleteComplaint,
  fetchComplaints,
  fetchStats,
  saveComplaint,
  setSelectedComplaint,
  setView,
  updateComplaint,
} from './features/complaints/complaintsSlice';

// ─── Sample complaint texts for quick demo ────────────────────────────────
const SAMPLES = {
  dissolution: `From: quality@meditrade-distributors.com
Date: 2026-07-15
Subject: URGENT – Dissolution Failure – Metformin HCl 500mg Tablets – Batch MT-2026-0342

Dear Quality Assurance Team,

Product: Metformin HCl 500mg Tablets (Immediate Release)
Batch Number: MT-2026-0342
Date of Manufacture: March 2026

Our hospital client City General Hospital reported significant dissolution profile deviation. At 45 minutes the dissolution was ~52%, against the specification of NLT 80% (Q). Visible cracks on ~15% of tablets were also noted.

Metformin is critical for Type 2 Diabetes management. Subtherapeutic dissolution may result in inadequate blood glucose control.

Reporter: Ms. Priya Nair, MediTrade Distributors Pvt. Ltd.`,
  contamination: `PHARMACEUTICAL COMPLAINT REPORT
Date: 2026-07-20

Product Name: Amoxicillin Trihydrate Capsules 500mg
Batch Number: AMX-2026-0198

During dispensing, pharmacist noticed capsules from this batch had different color — light pink instead of expected white. Contents appeared brownish-orange instead of white/off-white powder, suggesting possible cross-contamination.

External lab HPLC analysis shows presence of secondary compound peak not expected in pure Amoxicillin.

SEVERITY: CRITICAL. Amoxicillin is beta-lactam. Cross-contamination poses serious patient safety risk.
Reporter: Dr. Anand Kapoor, Apollo Pharmacy Chain`,
  labeling: `CUSTOMER COMPLAINT – LABELING ERROR
Date: 2026-07-22

Product: Atorvastatin Calcium Tablets
Expected Strength: 20mg Batch: ATV-2026-0277

Pharmacist noticed tablets inside blister were larger than normal. Reverse foil printed ATORVA 40 (40mg) while outer carton read Atorvastatin 20mg. All 5 checked boxes from same batch showed same discrepancy.

Two patients may have received incorrect dose (2x overdose). Atorvastatin overdose can cause myopathy, rhabdomyolysis, liver toxicity.

Reporter: Mr. Rajesh Mehta, HealthFirst Retail Pharmacy, Bengaluru`,
};

// ─── Helpers ─────────────────────────────────────────────────────────────

function getBadgeClass(value, type) {
  if (!value) return 'badge badge-closed';
  const v = value.toLowerCase();
  if (type === 'risk') {
    if (v === 'high') return 'badge badge-high';
    if (v === 'medium') return 'badge badge-medium';
    return 'badge badge-low';
  }
  if (type === 'status') {
    if (v === 'open') return 'badge badge-open';
    if (v === 'under investigation') return 'badge badge-investigating';
    return 'badge badge-closed';
  }
  return 'badge';
}

function CompletenessBar({ score }) {
  const cls = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
  const label = score >= 70 ? 'Good' : score >= 40 ? 'Incomplete' : 'Poor';
  return (
    <div className="completeness-bar-wrap">
      <div className="completeness-label">
        <span>Completeness</span>
        <span style={{ fontWeight: 700, color: cls === 'high' ? 'var(--success)' : cls === 'medium' ? 'var(--warning)' : 'var(--danger)' }}>
          {score}% — {label}
        </span>
      </div>
      <div className="completeness-bar-track">
        <div className={`completeness-bar-fill ${cls}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function RiskDisplay({ level }) {
  const cls = (level || 'medium').toLowerCase();
  return (
    <div className="risk-score-display">
      <div className={`risk-level-text ${cls}`}>{level || '—'}</div>
      <div className="risk-sub-label">AI Risk Classification</div>
    </div>
  );
}

// ─── Dashboard View ───────────────────────────────────────────────────────

function DashboardView({ stats, complaints, onNavigate }) {
  const recents = complaints.slice(0, 5);
  return (
    <div className="stack-lg fade-in">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Complaints</div>
          <div className="stat-value accent">{stats?.total ?? complaints.length}</div>
          <div className="stat-sub">All time</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Open</div>
          <div className="stat-value">{stats?.open ?? 0}</div>
          <div className="stat-sub">Awaiting action</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Under Investigation</div>
          <div className="stat-value warning">{stats?.under_investigation ?? 0}</div>
          <div className="stat-sub">Active review</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">High Risk</div>
          <div className="stat-value danger">{stats?.high_risk ?? 0}</div>
          <div className="stat-sub">Require escalation</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Regulatory Flag</div>
          <div className="stat-value danger">{stats?.regulatory_reportable ?? 0}</div>
          <div className="stat-sub">Reportable events</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Completeness</div>
          <div className="stat-value success">{stats?.avg_completeness ?? 0}%</div>
          <div className="stat-sub">Data quality</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Closed</div>
          <div className="stat-value">{stats?.closed ?? 0}</div>
          <div className="stat-sub">Resolved</div>
        </div>
      </div>

      <div className="glass-card">
        <div className="row-between" style={{ marginBottom: 16 }}>
          <div className="card-title"><span className="card-title-icon">📋</span> Recent Complaints</div>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('register')}>View all →</button>
        </div>
        {recents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <div className="empty-title">No complaints yet</div>
            <div className="empty-desc">Log your first complaint using the New Complaint form.</div>
          </div>
        ) : (
          <div className="register-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Complaint #</th>
                  <th>Product</th>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Risk</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recents.map((c) => (
                  <tr key={c.id} onClick={() => onNavigate('detail', c)}>
                    <td>{c.complaint_number}</td>
                    <td>{c.product || '—'}</td>
                    <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.customer || '—'}</td>
                    <td>{c.complaint_type || '—'}</td>
                    <td><span className={getBadgeClass(c.risk_level, 'risk')}>{c.risk_level || '—'}</span></td>
                    <td><span className={getBadgeClass(c.status, 'status')}>{c.status || '—'}</span></td>
                    <td className="text-secondary text-sm">{c.complaint_date || c.created_at?.slice(0, 10) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="two-col">
        <div className="glass-card">
          <div className="card-title"><span className="card-title-icon">⚡</span> Quick Actions</div>
          <div className="stack-sm">
            <button className="btn btn-primary btn-full" onClick={() => onNavigate('new')}>
              ＋ &nbsp;Log New Complaint
            </button>
            <button className="btn btn-secondary btn-full" onClick={() => onNavigate('register')}>
              📋 &nbsp;Open Complaint Register
            </button>
          </div>
        </div>
        <div className="glass-card">
          <div className="card-title"><span className="card-title-icon">🤖</span> AI Copilot Status</div>
          <div className="stack-sm">
            <div className="ai-summary-box" style={{ fontStyle: 'normal' }}>
              The AI Copilot uses <strong>Groq gemma2-9b-it</strong> for structured field extraction, root cause analysis, and CAPA recommendations. When no API key is configured, intelligent heuristic analysis is used as fallback.
            </div>
            <div className="row" style={{ gap: 8 }}>
              <span className="badge badge-llm">✦ gemma2-9b-it</span>
              <span className="badge badge-low">LangGraph 8-Node Pipeline</span>
              <span className="badge badge-open">GROQ API</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── New Complaint View ───────────────────────────────────────────────────

const BLANK_DRAFT = {
  complaint_number: '', product: '', batch: '', customer: '',
  complaint_type: '', complaint_date: '', description: '', severity: '',
  risk_level: '', quality_impact: '', root_cause: '', recommendations: '',
  capa_actions: '', ai_summary: '', completeness_score: 0,
  duplicate_flag: false, duplicate_reference: '', regulatory_reportable: false,
};

function NewComplaintView({ analysis, loading, error, saveSuccess, onClearSave }) {
  const dispatch = useDispatch();
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [draft, setDraft] = useState(BLANK_DRAFT);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (analysis) {
      setDraft({
        complaint_number: analysis.complaint_number || '',
        product: analysis.product || '',
        batch: analysis.batch || '',
        customer: analysis.customer || '',
        complaint_type: analysis.complaint_type || '',
        complaint_date: analysis.complaint_date || '',
        description: analysis.description || '',
        severity: analysis.severity || '',
        risk_level: analysis.risk_level || '',
        quality_impact: analysis.quality_impact || '',
        root_cause: analysis.root_cause || '',
        recommendations: analysis.recommendations || '',
        capa_actions: analysis.capa_actions || '',
        ai_summary: analysis.ai_summary || '',
        completeness_score: analysis.completeness_score || 0,
        duplicate_flag: Boolean(analysis.duplicate_flag),
        duplicate_reference: analysis.duplicate_reference || '',
        regulatory_reportable: Boolean(analysis.regulatory_reportable),
      });
    }
  }, [analysis]);

  useEffect(() => {
    if (saveSuccess) {
      setText('');
      setFile(null);
      setDraft(BLANK_DRAFT);
      dispatch(clearAnalysis());
    }
  }, [saveSuccess, dispatch]);

  const handleAnalyze = () => {
    const fd = new FormData();
    if (text.trim()) fd.append('text', text);
    if (file) fd.append('uploaded_file', file);
    dispatch(analyzeComplaint(fd));
  };

  const handleSave = () => {
    const payload = { ...draft };
    // Remove evidence (not in ComplaintCreate schema)
    delete payload.evidence;
    dispatch(saveComplaint(payload));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const useSample = (key) => {
    setText(SAMPLES[key]);
    setFile(null);
    dispatch(clearAnalysis());
    dispatch(clearError());
  };

  return (
    <div className="stack-lg fade-in">
      {saveSuccess && (
        <div className="success-banner">
          ✅ &nbsp;Complaint saved successfully to the register!
          <button className="btn btn-ghost btn-sm ml-auto" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={onClearSave}>Dismiss</button>
        </div>
      )}

      <div className="two-col">
        {/* ── Left: Intake ── */}
        <div className="stack">
          <div className="glass-card">
            <div className="card-title"><span className="card-title-icon">📥</span> Complaint Intake</div>
            <div className="stack">
              <div className="field-group">
                <div className="row-between">
                  <label className="field-label">Complaint text / Email</label>
                  <div className="sample-links">
                    <button className="sample-link" onClick={() => useSample('dissolution')}>💊 Dissolution</button>
                    <button className="sample-link" onClick={() => useSample('contamination')}>⚠️ Contamination</button>
                    <button className="sample-link" onClick={() => useSample('labeling')}>🏷️ Labeling</button>
                  </div>
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste distributor email, complaint note, or product issue description here…&#10;&#10;Or click one of the sample complaints above to load a demo."
                  rows={10}
                />
                <div className="text-xs text-muted" style={{ textAlign: 'right' }}>{text.length} chars</div>
              </div>

              <div
                className={`upload-zone${dragOver ? ' drag-over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.pdf"
                  onChange={(e) => setFile(e.target.files[0])}
                />
                <span className="upload-icon">📎</span>
                {file ? (
                  <p><span className="upload-accent">{file.name}</span><br /><span className="upload-hint">File ready to upload</span></p>
                ) : (
                  <p><span className="upload-accent">Click to upload</span> or drag &amp; drop<br /><span className="upload-hint">.txt, .md, or text-based .pdf files</span></p>
                )}
              </div>

              {error && <div className="error-banner">⚠️ &nbsp;{error}</div>}

              <button
                className="btn btn-primary btn-lg btn-full"
                onClick={handleAnalyze}
                disabled={loading || (!text.trim() && !file)}
                id="btn-analyze"
              >
                {loading ? (
                  <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Analysing with AI…</>
                ) : (
                  <>🤖 &nbsp;Analyse with AI Copilot</>
                )}
              </button>
            </div>
          </div>

          {/* AI Analysis Summary panel */}
          {analysis && (
            <div className="glass-card fade-in">
              <div className="card-title"><span className="card-title-icon">🤖</span> AI Analysis Summary</div>
              <div className="analysis-panel">
                <div className="analysis-header">
                  <div className="analysis-badges">
                    <span className={getBadgeClass(analysis.risk_level, 'risk')}>Risk: {analysis.risk_level}</span>
                    {analysis.duplicate_flag && <span className="badge badge-duplicate">⚠ Duplicate</span>}
                    {analysis.regulatory_reportable && <span className="badge badge-regulatory">🔴 Regulatory</span>}
                    <span className="badge badge-llm">{analysis.evidence?.extraction_method === 'llm' ? '✦ LLM' : '⚙ Heuristic'}</span>
                  </div>
                </div>

                {analysis.ai_summary && (
                  <div className="ai-summary-box">
                    <div className="ai-summary-label">✦ AI Executive Summary</div>
                    {analysis.ai_summary}
                  </div>
                )}

                <CompletenessBar score={analysis.completeness_score} />

                {analysis.evidence?.missing_fields?.length > 0 && (
                  <div>
                    <div className="text-xs text-muted font-bold" style={{ marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Missing fields</div>
                    <div className="chips-row">
                      {analysis.evidence.missing_fields.map((f) => <span key={f} className="chip">{f}</span>)}
                    </div>
                  </div>
                )}

                {analysis.duplicate_flag && (
                  <div className="error-banner">
                    ⚠️ &nbsp;Potential duplicate of <strong>{analysis.duplicate_reference}</strong>. Review before saving.
                  </div>
                )}

                <div className="detail-section">
                  <div className="detail-section-title">Quality Impact</div>
                  <div className="detail-row-value">{analysis.quality_impact}</div>
                </div>

                {analysis.root_cause && (
                  <div className="detail-section">
                    <div className="detail-section-title">Root Cause Hypotheses</div>
                    <div className="detail-row-value preformatted">{analysis.root_cause}</div>
                  </div>
                )}

                {analysis.capa_actions && (
                  <div className="detail-section">
                    <div className="detail-section-title">CAPA Recommendations</div>
                    <div className="detail-row-value preformatted">{analysis.capa_actions}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Log complaint form ── */}
        <div className="glass-card">
          <div className="card-title"><span className="card-title-icon">📝</span> Log Customer Complaint</div>
          <div className="stack">
            <div className="form-grid-2">
              <div className="field-group">
                <label className="field-label">Complaint Number</label>
                <input value={draft.complaint_number} onChange={(e) => setDraft({ ...draft, complaint_number: e.target.value })} placeholder="CMP-2026-0001" />
              </div>
              <div className="field-group">
                <label className="field-label">Complaint Date</label>
                <input value={draft.complaint_date} onChange={(e) => setDraft({ ...draft, complaint_date: e.target.value })} placeholder="2026-07-15" />
              </div>
              <div className="field-group">
                <label className="field-label">Product</label>
                <input value={draft.product} onChange={(e) => setDraft({ ...draft, product: e.target.value })} placeholder="Metformin HCl 500mg" />
              </div>
              <div className="field-group">
                <label className="field-label">Batch Number</label>
                <input value={draft.batch} onChange={(e) => setDraft({ ...draft, batch: e.target.value })} placeholder="MT-2026-0342" />
              </div>
            </div>

            <div className="field-group">
              <label className="field-label">Customer / Reporter</label>
              <input value={draft.customer} onChange={(e) => setDraft({ ...draft, customer: e.target.value })} placeholder="MediTrade Distributors" />
            </div>

            <div className="form-grid-2">
              <div className="field-group">
                <label className="field-label">Complaint Type</label>
                <select value={draft.complaint_type} onChange={(e) => setDraft({ ...draft, complaint_type: e.target.value })}>
                  <option value="">Select type…</option>
                  <option>Quality Concern</option>
                  <option>Contamination</option>
                  <option>Labeling/Packaging Error</option>
                  <option>Adverse Event / Patient Safety</option>
                  <option>Stability / Shelf-life Concern</option>
                  <option>Packaging Defect</option>
                  <option>Physical/Chemical Quality Defect</option>
                </select>
              </div>
              <div className="field-group">
                <label className="field-label">Severity</label>
                <select value={draft.severity} onChange={(e) => setDraft({ ...draft, severity: e.target.value })}>
                  <option value="">Select…</option>
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </div>
            </div>

            <div className="form-grid-2">
              <div className="field-group">
                <label className="field-label">Risk Level</label>
                <select value={draft.risk_level} onChange={(e) => setDraft({ ...draft, risk_level: e.target.value })}>
                  <option value="">Select…</option>
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </div>
              <div className="field-group">
                <label className="field-label">Status</label>
                <select value={draft.status || 'Open'} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                  <option>Open</option>
                  <option>Under Investigation</option>
                  <option>Closed</option>
                </select>
              </div>
            </div>

            <div className="field-group">
              <label className="field-label">Description</label>
              <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={4} placeholder="Detailed description of the complaint…" />
            </div>

            <div className="field-group">
              <label className="field-label">Quality Impact</label>
              <textarea value={draft.quality_impact} onChange={(e) => setDraft({ ...draft, quality_impact: e.target.value })} rows={2} />
            </div>

            <div className="field-group">
              <label className="field-label">Root Cause</label>
              <textarea value={draft.root_cause} onChange={(e) => setDraft({ ...draft, root_cause: e.target.value })} rows={3} placeholder="AI-suggested root cause hypotheses…" />
            </div>

            <div className="field-group">
              <label className="field-label">CAPA Actions</label>
              <textarea value={draft.capa_actions} onChange={(e) => setDraft({ ...draft, capa_actions: e.target.value })} rows={4} placeholder="Corrective and Preventive Actions…" />
            </div>

            <div className="row" style={{ gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  style={{ width: 16, height: 16, accentColor: 'var(--danger)' }}
                  checked={draft.regulatory_reportable}
                  onChange={(e) => setDraft({ ...draft, regulatory_reportable: e.target.checked })}
                />
                Regulatory reportable event
              </label>
            </div>

            <div className="divider" />

            {/* Risk panel */}
            {draft.risk_level && (
              <div className="risk-panel">
                <div className="risk-panel-header">
                  <div className="risk-panel-title">🤖 AI Copilot Risk Assessment</div>
                </div>
                <div className="risk-panel-body">
                  <RiskDisplay level={draft.risk_level} />
                  {analysis && (
                    <CompletenessBar score={draft.completeness_score} />
                  )}
                </div>
              </div>
            )}

            <button
              className="btn btn-primary btn-lg btn-full"
              onClick={handleSave}
              disabled={loading || !draft.complaint_number}
              id="btn-save-complaint"
            >
              {loading ? 'Saving…' : '💾 &nbsp;Save to Complaint Register'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Register View ────────────────────────────────────────────────────────

function RegisterView({ complaints, loading, onSelect, onDelete }) {
  const [search, setSearch] = useState('');
  const [filterRisk, setFilterRisk] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  const filtered = complaints
    .filter((c) => {
      const q = search.toLowerCase();
      if (q && !`${c.complaint_number} ${c.product} ${c.customer} ${c.batch}`.toLowerCase().includes(q)) return false;
      if (filterRisk && c.risk_level !== filterRisk) return false;
      if (filterStatus && c.status !== filterStatus) return false;
      return true;
    })
    .sort((a, b) => {
      const va = a[sortKey] || '';
      const vb = b[sortKey] || '';
      return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sortArrow = (key) => sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  return (
    <div className="stack-lg fade-in">
      <div className="glass-card">
        <div className="register-toolbar">
          <div className="search-input-wrap">
            <span className="search-icon">🔍</span>
            <input
              className="field-input search-input"
              placeholder="Search complaints…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select value={filterRisk} onChange={(e) => setFilterRisk(e.target.value)} style={{ width: 'auto', minWidth: 120 }}>
            <option value="">All Risk</option>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: 'auto', minWidth: 150 }}>
            <option value="">All Status</option>
            <option>Open</option>
            <option>Under Investigation</option>
            <option>Closed</option>
          </select>
          <div className="text-secondary text-sm" style={{ whiteSpace: 'nowrap' }}>{filtered.length} record{filtered.length !== 1 ? 's' : ''}</div>
        </div>

        {loading ? (
          <div className="loading-overlay">
            <div className="spinner" />
            <div className="loading-text">Loading complaint register…</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <div className="empty-title">No complaints found</div>
            <div className="empty-desc">Try adjusting the search or filters, or log a new complaint.</div>
          </div>
        ) : (
          <div className="register-table-wrap">
            <table>
              <thead>
                <tr>
                  <th onClick={() => toggleSort('complaint_number')}>Complaint #{sortArrow('complaint_number')}</th>
                  <th onClick={() => toggleSort('product')}>Product{sortArrow('product')}</th>
                  <th>Batch</th>
                  <th>Customer</th>
                  <th onClick={() => toggleSort('complaint_type')}>Type{sortArrow('complaint_type')}</th>
                  <th onClick={() => toggleSort('severity')}>Severity{sortArrow('severity')}</th>
                  <th onClick={() => toggleSort('risk_level')}>Risk{sortArrow('risk_level')}</th>
                  <th onClick={() => toggleSort('status')}>Status{sortArrow('status')}</th>
                  <th onClick={() => toggleSort('created_at')}>Date{sortArrow('created_at')}</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} onClick={() => onSelect(c)}>
                    <td>{c.complaint_number}</td>
                    <td>{c.product || '—'}</td>
                    <td>{c.batch || '—'}</td>
                    <td style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.customer || '—'}</td>
                    <td>{c.complaint_type || '—'}</td>
                    <td><span className={getBadgeClass(c.severity, 'risk')}>{c.severity || '—'}</span></td>
                    <td><span className={getBadgeClass(c.risk_level, 'risk')}>{c.risk_level || '—'}</span></td>
                    <td><span className={getBadgeClass(c.status, 'status')}>{c.status || '—'}</span></td>
                    <td className="text-secondary text-sm">{(c.complaint_date || c.created_at || '').slice(0, 10)}</td>
                    <td>
                      <div className="table-actions" onClick={(e) => e.stopPropagation()}>
                        <button className="btn btn-ghost btn-sm" onClick={() => onSelect(c)}>View</button>
                        <button className="btn btn-danger btn-sm" onClick={() => { if (window.confirm('Delete this complaint?')) onDelete(c.id); }}>Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Detail View ──────────────────────────────────────────────────────────

function DetailView({ complaint, loading, saveSuccess, error, onBack, onClearSave }) {
  const dispatch = useDispatch();
  const [status, setStatus] = useState(complaint.status || 'Open');
  const [notes, setNotes] = useState(complaint.investigation_notes || '');
  const [assignedTo, setAssignedTo] = useState(complaint.assigned_to || '');

  const handleUpdate = () => {
    dispatch(updateComplaint({ id: complaint.id, data: { status, investigation_notes: notes, assigned_to: assignedTo } }));
  };

  return (
    <div className="stack-lg fade-in">
      <div className="detail-header-row">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 8 }}>← Back</button>
          <h2 style={{ fontSize: '1.4rem' }}>{complaint.complaint_number}</h2>
          <div className="text-secondary text-sm" style={{ marginTop: 4 }}>Created {complaint.created_at?.slice(0, 10) || '—'}</div>
        </div>
        <div className="detail-header-badges">
          <span className={getBadgeClass(complaint.risk_level, 'risk')}>{complaint.risk_level || '—'} Risk</span>
          <span className={getBadgeClass(complaint.status, 'status')}>{complaint.status}</span>
          {complaint.duplicate_flag && <span className="badge badge-duplicate">⚠ Possible Duplicate</span>}
          {complaint.regulatory_reportable && <span className="badge badge-regulatory">🔴 Reg. Reportable</span>}
        </div>
      </div>

      {saveSuccess && (
        <div className="success-banner">✅ &nbsp;Complaint updated successfully.
          <button className="btn btn-ghost btn-sm ml-auto" style={{ padding: '2px 8px' }} onClick={onClearSave}>Dismiss</button>
        </div>
      )}
      {error && <div className="error-banner">⚠️ &nbsp;{error}</div>}

      <div className="detail-grid">
        {/* ── Left: Main info ── */}
        <div className="stack">
          <div className="glass-card">
            <div className="card-title"><span className="card-title-icon">ℹ️</span> Complaint Details</div>
            <div className="info-grid" style={{ marginBottom: 16 }}>
              {[
                ['Product', complaint.product],
                ['Batch Number', complaint.batch],
                ['Customer', complaint.customer],
                ['Complaint Type', complaint.complaint_type],
                ['Severity', complaint.severity],
                ['Complaint Date', complaint.complaint_date],
              ].map(([label, val]) => (
                <div key={label} className="info-item">
                  <div className="info-item-label">{label}</div>
                  <div className="info-item-value">{val || '—'}</div>
                </div>
              ))}
            </div>

            <div className="detail-section">
              <div className="detail-section-title">Description</div>
              <div className="detail-row-value">{complaint.description || '—'}</div>
            </div>
          </div>

          {complaint.ai_summary && (
            <div className="glass-card">
              <div className="card-title"><span className="card-title-icon">🤖</span> AI Executive Summary</div>
              <div className="ai-summary-box" style={{ fontStyle: 'normal' }}>{complaint.ai_summary}</div>
            </div>
          )}

          <div className="glass-card">
            <div className="card-title"><span className="card-title-icon">🔬</span> Quality & Root Cause</div>
            <div className="stack">
              <div className="detail-section">
                <div className="detail-section-title">Quality Impact</div>
                <div className="detail-row-value">{complaint.quality_impact || '—'}</div>
              </div>
              <div className="detail-section">
                <div className="detail-section-title">Root Cause Hypotheses</div>
                <div className="detail-row-value preformatted">{complaint.root_cause || '—'}</div>
              </div>
              {complaint.duplicate_reference && (
                <div className="error-banner">⚠️ &nbsp;Possible duplicate of <strong>{complaint.duplicate_reference}</strong> (similarity detected).</div>
              )}
            </div>
          </div>

          {complaint.capa_actions && (
            <div className="glass-card">
              <div className="card-title"><span className="card-title-icon">📋</span> CAPA Actions</div>
              <div className="detail-row-value preformatted">{complaint.capa_actions}</div>
            </div>
          )}

          <div className="glass-card">
            <div className="card-title"><span className="card-title-icon">📝</span> Investigation Notes</div>
            <div className="stack">
              <div className="field-group">
                <label className="field-label">Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Add investigation notes…" />
              </div>
              <div className="field-group">
                <label className="field-label">Assigned To</label>
                <input value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} placeholder="QA Officer name…" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Risk & actions ── */}
        <div className="stack">
          <div className="risk-panel">
            <div className="risk-panel-header">
              <div className="risk-panel-title">🤖 AI Risk Assessment</div>
            </div>
            <div className="risk-panel-body">
              <RiskDisplay level={complaint.risk_level} />
              {complaint.completeness_score != null && (
                <CompletenessBar score={complaint.completeness_score} />
              )}
              {complaint.regulatory_reportable && (
                <div className="error-banner" style={{ fontSize: '0.82rem' }}>
                  🔴 This complaint has been flagged as a <strong>regulatory reportable event</strong>. Ensure CDSCO / FDA reporting obligations are met within required timelines.
                </div>
              )}
              <div className="divider" />
              <div className="field-group">
                <label className="field-label">Update Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option>Open</option>
                  <option>Under Investigation</option>
                  <option>Closed</option>
                </select>
              </div>
              <button
                className="btn btn-primary btn-full"
                onClick={handleUpdate}
                disabled={loading}
              >
                {loading ? 'Updating…' : '💾 Save Updates'}
              </button>
            </div>
          </div>

          <div className="glass-card">
            <div className="card-title"><span className="card-title-icon">📊</span> Complaint Summary</div>
            <div className="stack-sm">
              {[
                ['Recommendations', complaint.recommendations],
                ['Completeness', `${complaint.completeness_score ?? '—'}%`],
              ].map(([label, val]) => (
                <div key={label} className="info-item">
                  <div className="info-item-label">{label}</div>
                  <div className="info-item-value text-sm" style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>{val || '—'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────

export default function App() {
  const dispatch = useDispatch();
  const { complaints, stats, analysis, selectedComplaint, view, loading, error, saveSuccess } = useSelector((s) => s.complaints);

  useEffect(() => {
    dispatch(fetchComplaints());
    dispatch(fetchStats());
  }, [dispatch]);

  const navigate = (v, complaint = null) => {
    dispatch(setView(v));
    if (complaint) dispatch(setSelectedComplaint(complaint));
  };

  const handleClearSave = () => dispatch(clearSaveSuccess());

  const PAGE_TITLES = {
    dashboard: { title: 'Dashboard', desc: 'Overview of pharmaceutical complaint management activity.' },
    new: { title: 'New Complaint', desc: 'Intake and AI-analyse a new customer complaint.' },
    register: { title: 'Complaint Register', desc: 'View, filter, and manage all logged complaints.' },
    detail: { title: selectedComplaint?.complaint_number || 'Complaint Detail', desc: 'Full complaint record with AI risk assessment and CAPA.' },
  };

  const currentPage = PAGE_TITLES[view] || PAGE_TITLES.dashboard;

  return (
    <div className="app-layout">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">
            <div className="logo-icon">Ai</div>
            <div className="logo-text">
              <div className="logo-name">AIVOA</div>
              <div className="logo-tagline">Complaint Copilot</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Navigation</div>
          {[
            { key: 'dashboard', icon: '⬛', label: 'Dashboard' },
            { key: 'new', icon: '➕', label: 'New Complaint' },
            { key: 'register', icon: '📋', label: 'Complaint Register' },
          ].map(({ key, icon, label }) => (
            <button
              key={key}
              className={`nav-item${view === key ? ' active' : ''}`}
              onClick={() => navigate(key)}
              title={label}
            >
              <span className="nav-icon">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="ai-status">
            <div className="status-dot" />
            <span>AI Copilot Active</span>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="main-content">
        <div className="page-header">
          <div className="page-title-block">
            <h1>{currentPage.title}</h1>
            <p>{currentPage.desc}</p>
          </div>
          {view !== 'new' && (
            <button className="btn btn-primary" onClick={() => navigate('new')}>
              ＋ &nbsp;New Complaint
            </button>
          )}
        </div>

        <div className="page-body">
          {view === 'dashboard' && (
            <DashboardView stats={stats} complaints={complaints} onNavigate={navigate} />
          )}
          {view === 'new' && (
            <NewComplaintView
              analysis={analysis}
              loading={loading}
              error={error}
              saveSuccess={saveSuccess}
              onClearSave={handleClearSave}
            />
          )}
          {view === 'register' && (
            <RegisterView
              complaints={complaints}
              loading={loading}
              onSelect={(c) => navigate('detail', c)}
              onDelete={(id) => dispatch(deleteComplaint(id))}
            />
          )}
          {view === 'detail' && selectedComplaint && (
            <DetailView
              complaint={selectedComplaint}
              loading={loading}
              saveSuccess={saveSuccess}
              error={error}
              onBack={() => navigate('register')}
              onClearSave={handleClearSave}
            />
          )}
        </div>
      </main>
    </div>
  );
}
