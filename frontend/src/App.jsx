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

// ─── Sample complaint texts ─────────────────────────────────────────────────
const SAMPLES = {
  dissolution: `From: quality@meditrade-distributors.com
Date: 2026-07-15
Subject: URGENT – Out-of-Specification Dissolution – Metformin HCl 500mg Tablets – Batch MT-2026-0342

Dear Quality Assurance Team,

Product: Metformin HCl 500mg Tablets (Immediate Release)
Batch Number: MT-2026-0342
Manufacturing Date: March 2026
Expiry Date: February 2028
Quantity Affected: 3,200 units
Originating Site: NovaChem Plant A, Hyderabad
Customer: City General Hospital, Bengaluru
Country: India

Our hospital client City General Hospital conducted incoming quality testing per their QMS protocol.
Dissolusion results (USP App II, 75 RPM, 900 mL pH 6.8 phosphate buffer, 45 min):
  Specification: NLT 80% (Q)
  Observed: ~52% — OUT OF SPECIFICATION

Additional defects observed:
  - Visible surface cracks on ~15% of tablets examined
  - Slight yellowish discolouration on 5% of tablets

Clinical significance: Metformin HCl is a first-line oral antidiabetic for Type 2 Diabetes.
Subtherapeutic dissolution means inadequate blood glucose control — risk of hyperglycaemia.

Actions taken: Batch quarantined at hospital. Alternate stock sourced.

Request:
1. Acknowledge complaint and issue formal complaint number within 24 hours.
2. Investigate root cause — granulation parameters, binder concentration, compression force.
3. Confirm whether other distributed batches may be impacted.
4. Provide written CAPA response within 10 working days.

Reporter: Ms. Priya Nair, Quality Manager
Organisation: MediTrade Distributors Pvt. Ltd.
Email: quality@meditrade-distributors.com`,

  contamination: `PHARMACEUTICAL COMPLAINT REPORT
Date: 2026-07-20
Channel: Email — Pharmacy Chain QA Department

From: Dr. Anand Kapoor, Head of Quality, Apollo Pharmacy Chain
To: Customer Quality Department, NovaChem Pharmaceuticals Ltd.
RE: POSSIBLE CROSS-CONTAMINATION – Amoxicillin Trihydrate Capsules 500mg – Batch AMX-2026-0198

Product Name: Amoxicillin Trihydrate Capsules 500mg
Batch Number: AMX-2026-0198
Manufacturing Date: May 2026
Expiry Date: April 2028
Quantity Affected: ~500 capsule packs (250 units)
Country: India

Incident Description:
During dispensing at HealthPlus Branch 14, Mumbai, pharmacist noticed capsules had unusual
colour — light pink instead of expected opaque white. Contents appeared brownish-orange
rather than characteristic white/off-white powder.

Laboratory Findings (Preliminary):
External HPLC analysis at ClinLabs India Pvt. Ltd. (NABL Accredited, Lab No. 2287) showed
presence of a secondary compound peak NOT corresponding to Amoxicillin Trihydrate —
suggesting cross-contamination with another active pharmaceutical ingredient (API).

Severity: CRITICAL — Patient safety risk
Amoxicillin is a beta-lactam antibiotic. Cross-contamination may cause:
  - Allergic reactions if contaminated with penicillin-class or other drugs
  - Inadequate therapeutic effect due to reduced Amoxicillin potency
  - Medication error if visual change goes unnoticed by pharmacists

Actions Taken:
  - All stock of Batch AMX-2026-0198 quarantined across 46 distribution points nationally
  - CDSCO and state drug controller notified (Ref: MH-ADR-2026-874)

Formal Request:
  1. Immediate acknowledgment within 24 hours
  2. Batch retention sample testing by internal QC
  3. Root cause investigation: equipment cleaning validation, campaign manufacturing logs
  4. Determine if other batches are affected
  5. Initiate field alert or voluntary recall if systemic failure confirmed

Reporter: Dr. Anand Kapoor | Apollo Pharmacy Chain
Email: anand.kapoor@apollopharmacy.in`,

  labeling: `CUSTOMER COMPLAINT – LABELING / PACKAGING ERROR
Date: 2026-07-22
Received via: Written complaint letter

Product: Atorvastatin Calcium Tablets
Expected Strength: 20mg
Batch Number: ATV-2026-0277
Expiry Date: September 2027
Quantity Affected: 5 packs (150 tablets)
Customer: HealthFirst Retail Pharmacy, Bengaluru
Country: India

Complaint Details:
Pharmacist Mr. Rajesh Mehta noticed tablets inside the blister packs were larger than expected
for a 20mg formulation. Investigation revealed:
  - The reverse foil printed: ATORVA 40 (40mg strength)
  - The outer carton label read: Atorvastatin 20mg
All 5 inspected packs from the same batch showed the same discrepancy.

Patient Safety Impact:
Two patients had already been dispensed this batch. Both may have received 2x their
prescribed dose (40mg instead of 20mg) for up to 7 days.
Atovastatin overdose risk: myopathy, rhabdomyolysis, elevated liver enzymes, liver toxicity.

Complaint Source: Retail pharmacy
Reporter: Mr. Rajesh Mehta, Pharmacist
Organisation: HealthFirst Retail Pharmacy, MG Road, Bengaluru
Contact: rajesh.mehta@healthfirst.in`,

  adverse_event: `PHARMACOVIGILANCE / ADVERSE EVENT COMPLAINT
Date: 2026-07-25
Channel: Physician written report

Product Name: Ibuprofen Oral Suspension 100mg/5mL
Batch Number: IBU-2026-0311
Manufacturing Date: April 2026
Expiry Date: March 2028
Quantity Involved: 1 bottle (100mL)
Customer: Dr. Fatima Sheikh, Paediatric Department, Rainbow Children's Hospital
Country: India

Adverse Event Description:
A 4-year-old male patient (weight 16 kg) was prescribed Ibuprofen 100mg/5mL suspension for
febrile seizure management. Correct dose (5 mL = 100mg) was administered as per prescription.
Within 2 hours of administration, the patient developed:
  - Urticarial rash over trunk and arms
  - Mild facial oedema
  - Increased irritability

The patient was managed with antihistamine and recovered within 6 hours.

Clinical Assessment by Reporting Physician:
Likely allergic reaction — causality assessment: POSSIBLE (WHO-UMC scale).
The patient had no prior allergy history to Ibuprofen or NSAIDs.
Physician suspects possible formulation excipient (e.g., artificial colouring, sodium benzoate)
may have triggered the reaction.

Severity: HIGH — adverse event in a paediatric patient
Regulatory Reportable: Yes (CDSCO ADR reporting within 15 days required)

Actions Taken:
  - Batch sample retained and sent to QC for analysis
  - Patient details documented in pharmacovigilance database
  - Suspected ADR filed with PvPI (Ref: PVPI-2026-04511)

Reporter: Dr. Fatima Sheikh
Hospital: Rainbow Children's Hospital, Hyderabad
Department: Paediatrics`,

  stability: `STABILITY / SHELF-LIFE COMPLAINT
Date: 2026-07-18
Channel: Email — Importer QA Department

From: Ms. Sunita Rao, Quality Assurance Manager
Organisation: PharmaExport Gulf LLC, UAE
To: Export Quality Team, NovaChem Pharmaceuticals Ltd.
Subject: Premature Degradation – Azithromycin 500mg Tablets – Batch AZI-2026-0155

Product Name: Azithromycin 500mg Tablets
Batch Number: AZI-2026-0155
Manufacturing Date: February 2026
Expiry Date: January 2028
Quantity Received: 50,000 tablets (500 packs × 100 tablets)
Quantity Affected: ~8,000 tablets (16%)
Originating Site: NovaChem Export Facility, Vizag
Country: UAE (imported product)

Complaint Description:
During routine stability monitoring at our Gulf distribution centre (ambient: 30°C/65% RH),
our QC team identified the following anomalies in Batch AZI-2026-0155 at the 6-month
stability check point (July 2026):

  1. Appearance: ~16% of tablets showed brown discolouration and surface mottling
  2. Assay: 87.2% (Specification: 95.0%–105.0%) — FAIL
  3. Related Substances: Unknown impurity at 0.42% (Specification: NMT 0.20%) — FAIL
  4. Dissolution: 71% at 30 min (Specification: NLT 80%) — FAIL

This batch was received 6 months ago with only 24 months shelf life. It has failed stability
testing at only 25% of its claimed shelf-life. The degradation pattern is inconsistent with
normal API degradation and may indicate a cold-chain excursion or packaging barrier failure.

Impact: Azithromycin is a critical antibiotic used for respiratory and STI infections.
Sub-potent product reaching patients poses serious treatment failure risk.

Request:
  1. Issue formal complaint acknowledgment within 48 hours.
  2. Review temperature data loggers for this export shipment.
  3. Test retention samples from the same batch under ICH Zone IVb conditions.
  4. Perform packaging integrity testing — assess foil barrier properties.
  5. Initiate market recall if shelf-life claim cannot be supported.
  6. Investigate root cause: API quality, manufacturing process, packaging, or cold chain.

Reporter: Ms. Sunita Rao, QA Manager
Organisation: PharmaExport Gulf LLC
Email: sunita.rao@pharmaexport-gulf.ae`,
};

// ─── Predefined prompt metadata (for quick-select cards) ──────────────────────
const PREDEFINED_PROMPTS = [
  {
    key: 'dissolution',
    icon: '💊',
    label: 'Dissolution Failure',
    tag: 'Physical/Chemical',
    severity: 'High',
    severityCls: 'badge-high',
    desc: 'Metformin HCl OOS dissolution result reported by hospital client',
  },
  {
    key: 'contamination',
    icon: '⚗️',
    label: 'Cross-Contamination',
    tag: 'Contamination',
    severity: 'Critical',
    severityCls: 'badge-high',
    desc: 'Amoxicillin capsules with foreign API detected — HPLC confirmed',
  },
  {
    key: 'labeling',
    icon: '🏷️',
    label: 'Labeling Error',
    tag: 'Labeling/Packaging',
    severity: 'Medium',
    severityCls: 'badge-medium',
    desc: 'Atorvastatin 20mg carton filled with 40mg tablets — 2× dose dispensed',
  },
  {
    key: 'adverse_event',
    icon: '🚨',
    label: 'Adverse Event',
    tag: 'Patient Safety',
    severity: 'High',
    severityCls: 'badge-high',
    desc: 'Ibuprofen suspension — allergic reaction in paediatric patient',
  },
  {
    key: 'stability',
    icon: '📉',
    label: 'Premature Degradation',
    tag: 'Stability',
    severity: 'High',
    severityCls: 'badge-medium',
    desc: 'Azithromycin export batch failed assay, dissolution & purity tests at month 6',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────
function getBadgeClass(value, type) {
  if (!value) return 'badge badge-closed';
  const v = value.toLowerCase();
  if (type === 'risk') {
    if (v === 'high' || v === 'critical') return 'badge badge-high';
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

// ─── Dashboard ────────────────────────────────────────────────────────────
function DashboardView({ stats, complaints, onNavigate }) {
  const recents = complaints.slice(0, 5);
  return (
    <div className="stack-lg fade-in">
      <div className="stats-grid">
        {[
          { label: 'Total Complaints', value: stats?.total ?? complaints.length, cls: 'accent', sub: 'All time' },
          { label: 'Open', value: stats?.open ?? 0, cls: '', sub: 'Awaiting action' },
          { label: 'Under Investigation', value: stats?.under_investigation ?? 0, cls: 'warning', sub: 'Active review' },
          { label: 'High Risk', value: stats?.high_risk ?? 0, cls: 'danger', sub: 'Require escalation' },
          { label: 'Regulatory Flag', value: stats?.regulatory_reportable ?? 0, cls: 'danger', sub: 'Reportable events' },
          { label: 'Avg Completeness', value: `${stats?.avg_completeness ?? 0}%`, cls: 'success', sub: 'Data quality' },
          { label: 'Closed', value: stats?.closed ?? 0, cls: '', sub: 'Resolved' },
        ].map(({ label, value, cls, sub }) => (
          <div key={label} className="stat-card">
            <div className="stat-label">{label}</div>
            <div className={`stat-value ${cls}`}>{value}</div>
            <div className="stat-sub">{sub}</div>
          </div>
        ))}
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
              <thead><tr>
                <th>Complaint #</th><th>Product</th><th>Customer</th>
                <th>Type</th><th>Risk</th><th>Status</th><th>Date</th>
              </tr></thead>
              <tbody>
                {recents.map((c) => (
                  <tr key={c.id} onClick={() => onNavigate('detail', c)} style={{ cursor: 'pointer' }}>
                    <td>{c.complaint_number}</td>
                    <td>{c.product_name || '—'}</td>
                    <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.customer_name || '—'}</td>
                    <td>{c.complaint_type || '—'}</td>
                    <td><span className={getBadgeClass(c.risk_level, 'risk')}>{c.risk_level || '—'}</span></td>
                    <td><span className={getBadgeClass(c.status, 'status')}>{c.status || '—'}</span></td>
                    <td className="text-secondary text-sm">{(c.complaint_date || c.created_at || '').slice(0, 10)}</td>
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
            <button className="btn btn-primary btn-full" onClick={() => onNavigate('new')}>＋ &nbsp;Log New Complaint</button>
            <button className="btn btn-secondary btn-full" onClick={() => onNavigate('register')}>📋 &nbsp;Open Complaint Register</button>
          </div>
        </div>
        <div className="glass-card">
          <div className="card-title"><span className="card-title-icon">🤖</span> AI Copilot Status</div>
          <div className="stack-sm">
            <div className="ai-summary-box" style={{ fontStyle: 'normal' }}>
              The AI Copilot uses <strong>Groq gemma2-9b-it</strong> for structured field extraction,
              root cause analysis, and CAPA recommendations via an 8-node LangGraph pipeline.
            </div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <span className="badge badge-llm">✦ gemma2-9b-it</span>
              <span className="badge badge-low">LangGraph 8-Node</span>
              <span className="badge badge-open">GROQ API</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Blank draft matching ComplaintCreate schema ──────────────────────────
const BLANK_DRAFT = {
  complaint_source: '', customer_name: '',
  product_name: '', product_strength: '', batch_number: '',
  manufacturing_date: '', expiry_date: '', affected_quantity: '',
  originating_site: '', impacted_materials: '', country: '',
  complaint_type: '', complaint_date: '', received_date: '', description: '', source_text: '',
  severity: '', priority: '', status: 'Open',
  risk_level: '', risk_score: 0,
  quality_impact: '', root_cause: '', recommendations: '',
  capa_actions: '', ai_summary: '',
  completeness_score: 0, duplicate_flag: false,
  duplicate_reference: '', regulatory_reportable: false,
  ai_assessment: {},
};

// ─── New Complaint View ───────────────────────────────────────────────────
function NewComplaintView({ analysis, loading, error, saveSuccess, onClearSave }) {
  const dispatch = useDispatch();
  const [pasteMode, setPasteMode] = useState(false);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [draft, setDraft] = useState({ ...BLANK_DRAFT });
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', text: 'Upload a complaint document or paste text above. I will automatically extract the details and populate the form for you.' }
  ]);
  const fileInputRef = useRef(null);
  const progressTimer = useRef(null);

  // ── Populate draft from AI analysis ──────────────────────────────────────
  useEffect(() => {
    if (analysis) {
      setProgress(100);
      setDraft((prev) => ({
        ...prev,
        complaint_source: analysis.complaint_source || analysis.customer || '',
        customer_name: analysis.customer_name || analysis.customer || '',
        product_name: analysis.product_name || analysis.product || '',
        product_strength: analysis.product_strength || '',
        batch_number: analysis.batch_number || analysis.batch || '',
        manufacturing_date: analysis.manufacturing_date || '',
        expiry_date: analysis.expiry_date || '',
        affected_quantity: analysis.affected_quantity || '',
        originating_site: analysis.originating_site || '',
        impacted_materials: analysis.impacted_materials || '',
        country: analysis.country || '',
        complaint_type: analysis.complaint_type || '',
        complaint_date: analysis.complaint_date || analysis.received_date || '',
        received_date: analysis.received_date || '',
        description: analysis.description || '',
        source_text: analysis.source_text || text || '',
        severity: analysis.severity || '',
        priority: analysis.severity === 'High' ? 'Critical' : analysis.severity === 'Medium' ? 'High' : 'Medium',
        risk_level: analysis.risk_level || '',
        risk_score: analysis.risk_score || 0,
        quality_impact: analysis.quality_impact || '',
        root_cause: analysis.root_cause || '',
        recommendations: analysis.recommendations || '',
        capa_actions: analysis.capa_actions || '',
        ai_summary: analysis.ai_summary || '',
        completeness_score: analysis.completeness_score || 0,
        duplicate_flag: Boolean(analysis.duplicate_flag),
        duplicate_reference: analysis.duplicate_reference || '',
        regulatory_reportable: Boolean(analysis.regulatory_reportable),
        ai_assessment: analysis.evidence || {},
      }));
      // Add AI copilot message
      const risk = analysis.risk_level || 'Medium';
      const product = analysis.product_name || analysis.product || 'the product';
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `✅ Extraction complete! I've identified a **${risk} risk** complaint for **${product}**. The form has been populated. Review the fields and click Save Complaint when ready.`
        }
      ]);
    }
  }, [analysis]);

  // ── Reset on save ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (saveSuccess) {
      handleReset();
    }
  }, [saveSuccess]);

  // ── Animated progress bar ─────────────────────────────────────────────────
  useEffect(() => {
    if (loading) {
      setProgress(10);
      let p = 10;
      progressTimer.current = setInterval(() => {
        p = Math.min(p + Math.random() * 12, 90);
        setProgress(Math.round(p));
      }, 400);
    } else {
      clearInterval(progressTimer.current);
      if (!analysis) setProgress(0);
    }
    return () => clearInterval(progressTimer.current);
  }, [loading]);

  const handleAnalyze = () => {
    if (!text.trim() && !file) return;
    const fd = new FormData();
    if (text.trim()) fd.append('text', text);
    if (file) fd.append('uploaded_file', file);
    dispatch(analyzeComplaint(fd));
    setPasteMode(false);
  };

  const handleSave = () => {
    const payload = { ...draft };
    delete payload.evidence;
    dispatch(saveComplaint(payload));
  };

  const handleReset = () => {
    setText('');
    setFile(null);
    setDraft({ ...BLANK_DRAFT });
    setProgress(0);
    setPasteMode(false);
    setChatMessages([{ role: 'assistant', text: 'Form reset. Upload a complaint document or paste text to begin a new intake.' }]);
    dispatch(clearAnalysis());
    dispatch(clearError());
    dispatch(clearSaveSuccess());
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) { setFile(f); setPasteMode(false); }
  };

  const useSample = (key) => {
    setText(SAMPLES[key]);
    setFile(null);
    setPasteMode(true);
    dispatch(clearAnalysis());
    dispatch(clearError());
  };

  const handleChat = () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    // Run analysis on the chat message, merging into existing draft
    const fd = new FormData();
    fd.append('text', userMsg);
    dispatch(analyzeComplaint(fd));
    setChatMessages((prev) => [...prev, { role: 'assistant', text: '⏳ Analysing your input…' }]);
  };

  const hasAnalysis = Boolean(analysis);
  const canAnalyze = !loading && (text.trim().length > 0 || file);

  return (
    <div className="stack-lg fade-in">
      {saveSuccess && (
        <div className="success-banner">
          ✅ &nbsp;Complaint saved successfully to the register!
          <button className="btn btn-ghost btn-sm ml-auto" style={{ padding: '2px 10px', fontSize: '0.75rem' }} onClick={onClearSave}>Dismiss</button>
        </div>
      )}

      <div className="new-complaint-grid">
        {/* ── LEFT: Log Customer Complaint Form ─────────────────────────── */}
        <div className="glass-card complaint-form-card">
          {/* Form header */}
          <div className="complaint-form-header">
            <div>
              <div className="complaint-form-title">Log Customer Complaint</div>
              <div className="complaint-form-subtitle">API &amp; FDF Quality Assurance Module</div>
            </div>
            <span className="pending-triage-badge">Pending Triage</span>
          </div>

          {/* Duplicate warning */}
          {draft.duplicate_flag && (
            <div className="error-banner" style={{ marginBottom: 0 }}>
              ⚠️ &nbsp;Potential duplicate of <strong>{draft.duplicate_reference}</strong>. Review carefully before saving.
            </div>
          )}

          {/* ── Section 1: Origin & Customer ── */}
          <div className="form-section">
            <div className="form-section-number">1. &nbsp;ORIGIN &amp; CUSTOMER DETAILS</div>
            <div className="form-grid-2">
              <div className="field-group">
                <label className="field-label">Complaint Source</label>
                <input
                  value={draft.complaint_source}
                  onChange={(e) => setDraft({ ...draft, complaint_source: e.target.value })}
                  placeholder={hasAnalysis ? '' : 'Awaiting AI extraction…'}
                  className={!draft.complaint_source && !hasAnalysis ? 'input-awaiting' : ''}
                />
              </div>
              <div className="field-group">
                <label className="field-label">Customer Name</label>
                <input
                  value={draft.customer_name}
                  onChange={(e) => setDraft({ ...draft, customer_name: e.target.value })}
                  placeholder={hasAnalysis ? '' : 'Awaiting AI extraction…'}
                  className={!draft.customer_name && !hasAnalysis ? 'input-awaiting' : ''}
                />
              </div>
            </div>
          </div>

          {/* ── Section 2: Product & Batch ── */}
          <div className="form-section">
            <div className="form-section-number">2. &nbsp;PRODUCT &amp; BATCH IDENTIFICATION</div>
            <div className="form-grid-2">
              <div className="field-group">
                <label className="field-label">Product Name</label>
                <input
                  value={draft.product_name}
                  onChange={(e) => setDraft({ ...draft, product_name: e.target.value })}
                  placeholder={hasAnalysis ? '' : 'Awaiting AI extraction…'}
                  className={!draft.product_name && !hasAnalysis ? 'input-awaiting' : ''}
                />
              </div>
              <div className="field-group">
                <label className="field-label">Product Strength / Grade</label>
                <input
                  value={draft.product_strength}
                  onChange={(e) => setDraft({ ...draft, product_strength: e.target.value })}
                  placeholder={hasAnalysis ? '' : 'Awaiting AI extraction…'}
                  className={!draft.product_strength && !hasAnalysis ? 'input-awaiting' : ''}
                />
              </div>
              <div className="field-group">
                <label className="field-label">Batch / Lot Number</label>
                <input
                  value={draft.batch_number}
                  onChange={(e) => setDraft({ ...draft, batch_number: e.target.value })}
                  placeholder={hasAnalysis ? '' : 'Awaiting AI extraction…'}
                  className={!draft.batch_number && !hasAnalysis ? 'input-awaiting' : ''}
                />
              </div>
              <div className="field-group">
                <label className="field-label">Manufacturing Date</label>
                <input
                  value={draft.manufacturing_date}
                  onChange={(e) => setDraft({ ...draft, manufacturing_date: e.target.value })}
                  placeholder={hasAnalysis ? '' : 'Awaiting AI extraction…'}
                  className={!draft.manufacturing_date && !hasAnalysis ? 'input-awaiting' : ''}
                />
              </div>
              <div className="field-group">
                <label className="field-label">Expiry Date</label>
                <input
                  value={draft.expiry_date}
                  onChange={(e) => setDraft({ ...draft, expiry_date: e.target.value })}
                  placeholder={hasAnalysis ? '' : 'Awaiting AI extraction…'}
                  className={!draft.expiry_date && !hasAnalysis ? 'input-awaiting' : ''}
                />
              </div>
              <div className="field-group">
                <label className="field-label">Quantity Affected</label>
                <div className="input-suffix-wrap">
                  <input
                    value={draft.affected_quantity}
                    onChange={(e) => setDraft({ ...draft, affected_quantity: e.target.value })}
                    placeholder={hasAnalysis ? '' : 'Awaiting AI extraction…'}
                    className={!draft.affected_quantity && !hasAnalysis ? 'input-awaiting' : ''}
                  />
                  <span className="input-suffix">units</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 3: Complaint Details ── */}
          <div className="form-section">
            <div className="form-section-number">3. &nbsp;COMPLAINT DETAILS</div>
            <div className="form-grid-2">
              <div className="field-group">
                <label className="field-label">Complaint Type</label>
                <select
                  value={draft.complaint_type}
                  onChange={(e) => setDraft({ ...draft, complaint_type: e.target.value })}
                  className={!draft.complaint_type && !hasAnalysis ? 'input-awaiting' : ''}
                >
                  <option value="">{hasAnalysis ? 'Select type…' : 'Awaiting AI extraction…'}</option>
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
                <label className="field-label">Complaint Date</label>
                <input
                  type="text"
                  value={draft.complaint_date}
                  onChange={(e) => setDraft({ ...draft, complaint_date: e.target.value })}
                  placeholder={hasAnalysis ? 'YYYY-MM-DD' : 'Awaiting AI extraction…'}
                  className={!draft.complaint_date && !hasAnalysis ? 'input-awaiting' : ''}
                />
              </div>
            </div>
            <div className="field-group">
              <label className="field-label">Detailed Complaint Description</label>
              <textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={4}
                placeholder={hasAnalysis ? 'Enter detailed description…' : 'Awaiting AI extraction…'}
                className={!draft.description && !hasAnalysis ? 'input-awaiting' : ''}
              />
            </div>
          </div>

          {/* ── Section 4: Assessment & Priority ── */}
          <div className="form-section">
            <div className="form-section-number">4. &nbsp;INITIAL ASSESSMENT &amp; PRIORITY</div>
            <div className="form-grid-2">
              <div className="field-group">
                <label className="field-label">Initial Severity</label>
                <select
                  value={draft.severity}
                  onChange={(e) => setDraft({ ...draft, severity: e.target.value })}
                  className={!draft.severity && !hasAnalysis ? 'input-awaiting' : ''}
                >
                  <option value="">{hasAnalysis ? 'Select severity…' : 'Awaiting AI extraction…'}</option>
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Critical</option>
                </select>
              </div>
              <div className="field-group">
                <label className="field-label">Priority</label>
                <select
                  value={draft.priority}
                  onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
                  className={!draft.priority && !hasAnalysis ? 'input-awaiting' : ''}
                >
                  <option value="">{hasAnalysis ? 'Select priority…' : 'Awaiting AI extraction…'}</option>
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Critical</option>
                </select>
              </div>
              <div className="field-group">
                <label className="field-label">Risk Level</label>
                <select
                  value={draft.risk_level}
                  onChange={(e) => setDraft({ ...draft, risk_level: e.target.value })}
                >
                  <option value="">Select…</option>
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </div>
              <div className="field-group">
                <label className="field-label">Status</label>
                <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                  <option>Open</option>
                  <option>Under Investigation</option>
                  <option>Closed</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Section 5: AI Outputs (visible after analysis) ── */}
          {hasAnalysis && (
            <div className="form-section fade-in">
              <div className="form-section-number">5. &nbsp;AI COPILOT OUTPUTS</div>

              {draft.ai_summary && (
                <div className="field-group">
                  <label className="field-label">AI Executive Summary</label>
                  <div className="ai-summary-box" style={{ fontStyle: 'normal' }}>{draft.ai_summary}</div>
                </div>
              )}

              <div className="field-group">
                <label className="field-label">Quality Impact</label>
                <textarea
                  value={draft.quality_impact}
                  onChange={(e) => setDraft({ ...draft, quality_impact: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="field-group">
                <label className="field-label">Root Cause Hypotheses</label>
                <textarea
                  value={draft.root_cause}
                  onChange={(e) => setDraft({ ...draft, root_cause: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="field-group">
                <label className="field-label">CAPA Actions</label>
                <textarea
                  value={draft.capa_actions}
                  onChange={(e) => setDraft({ ...draft, capa_actions: e.target.value })}
                  rows={4}
                />
              </div>

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
          )}

          {/* ── Risk Panel ── */}
          {draft.risk_level && (
            <div className="risk-panel fade-in">
              <div className="risk-panel-header">
                <div className="risk-panel-title">🤖 AI Copilot Risk Assessment</div>
              </div>
              <div className="risk-panel-body">
                <RiskDisplay level={draft.risk_level} />
                {hasAnalysis && <CompletenessBar score={draft.completeness_score} />}
              </div>
            </div>
          )}

          {/* ── Action Buttons ── */}
          <div className="form-actions-row">
            <button
              className="btn btn-ghost btn-lg"
              onClick={handleReset}
              id="btn-reset-form"
            >
              ↺ &nbsp;Reset Form
            </button>
            <button
              className="btn btn-primary btn-lg"
              onClick={handleSave}
              disabled={loading || !draft.product_name}
              id="btn-save-complaint"
            >
              {loading ? 'Saving…' : '💾 \u00a0Save Complaint'}
            </button>
          </div>
        </div>

        {/* ── RIGHT: AI Complaint Intake Assistant ───────────────────────── */}
        <div className="ai-copilot-panel">
          <div className="glass-card" style={{ flex: 1 }}>
            {/* Panel header */}
            <div className="copilot-header">
              <div className="copilot-title-row">
                <span className="copilot-icon">✦</span>
                <span className="copilot-title">AI Complaint Intake Assistant</span>
              </div>
              <span className="beta-badge">BETA</span>
            </div>

            {/* Upload zone */}
            {!pasteMode && (
              <div
                className={`upload-zone-ref${dragOver ? ' drag-over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.pdf,.eml,.docx"
                  style={{ display: 'none' }}
                  onChange={(e) => { if (e.target.files[0]) setFile(e.target.files[0]); }}
                />
                <div className="upload-cloud-icon">☁</div>
                {file ? (
                  <p style={{ margin: 0 }}>
                    <span className="upload-accent">{file.name}</span><br />
                    <span className="upload-hint">File ready — click Analyse</span>
                  </p>
                ) : (
                  <p style={{ margin: 0, textAlign: 'center' }}>
                    <strong>Drag &amp; drop complaint document here</strong><br />
                    <span style={{ color: 'var(--primary)' }}>or click to browse</span>
                  </p>
                )}
              </div>
            )}

            {/* ── Quick Test Prompts ── */}
            <div className="quick-prompts-section">
              <div className="quick-prompts-label">⚡ QUICK TEST PROMPTS — load sample complaint instantly</div>
              <div className="quick-prompts-grid">
                {PREDEFINED_PROMPTS.map((p) => (
                  <button
                    key={p.key}
                    className="quick-prompt-card"
                    onClick={() => useSample(p.key)}
                    title={p.desc}
                  >
                    <div className="qp-top">
                      <span className="qp-icon">{p.icon}</span>
                      <span className={`badge ${p.severityCls} qp-badge`}>{p.severity}</span>
                    </div>
                    <div className="qp-label">{p.label}</div>
                    <div className="qp-tag">{p.tag}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="copilot-or-divider">OR PASTE / UPLOAD</div>

            {/* Paste text button / textarea */}
            {!pasteMode ? (
              <button className="btn btn-secondary btn-full copilot-paste-btn" onClick={() => setPasteMode(true)}>
                📄 &nbsp;Paste Complaint Text / Email
              </button>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste complaint email, letter, or description here…"
                  rows={6}
                  style={{ resize: 'vertical' }}
                />
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setPasteMode(false); setText(''); }}>✕ Close</button>
                  <span className="text-xs text-muted" style={{ marginLeft: 'auto', alignSelf: 'center' }}>Use quick prompts above to load a sample</span>
                </div>
              </div>
            )}

            {/* Supported formats info */}
            <div className="supported-formats">
              <span style={{ color: 'var(--success)', fontSize: '0.8rem' }}>ⓘ</span>
              &nbsp;Supported formats: PDF, DOCX, TXT, EML &nbsp;·&nbsp; Max file size: 10MB
            </div>

            {/* Analyse button */}
            {error && <div className="error-banner">⚠️ &nbsp;{error}</div>}

            <button
              className="btn btn-primary btn-full btn-lg"
              onClick={handleAnalyze}
              disabled={!canAnalyze}
              id="btn-analyze"
            >
              {loading
                ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> &nbsp;Analysing with AI…</>
                : '🤖 \u00a0Analyse with AI Copilot'
              }
            </button>

            {/* Progress bar */}
            {(loading || progress > 0) && (
              <div className="extraction-progress-wrap">
                <div className="extraction-progress-header">
                  <span className="text-xs" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Extraction Progress
                  </span>
                  <span className="text-xs" style={{ color: 'var(--primary)', fontWeight: 700 }}>{progress}%</span>
                </div>
                <div className="extraction-bar-track">
                  <div
                    className="extraction-bar-fill"
                    style={{ width: `${progress}%`, transition: 'width 0.4s ease' }}
                  />
                </div>
                {loading && (
                  <div className="text-xs text-secondary" style={{ marginTop: 6 }}>
                    Analyzing document content and extracting key details…<br />
                    Please wait, this may take a few moments.
                  </div>
                )}
              </div>
            )}

            {/* AI Assistant Chat */}
            <div className="ai-assistant-section">
              <div className="ai-assistant-label">AI ASSISTANT</div>
              <div className="chat-messages">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`chat-bubble ${msg.role}`}>
                    {msg.role === 'assistant' && <span className="chat-avatar">✦</span>}
                    <span>{msg.text}</span>
                  </div>
                ))}
              </div>
              <div className="chat-input-row">
                <input
                  className="chat-input"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChat(); } }}
                  placeholder="Ask me anything about this complaint…"
                />
                <button className="chat-send-btn" onClick={handleChat} disabled={!chatInput.trim() || loading}>
                  ▶
                </button>
              </div>
              <div className="chat-disclaimer">AI responses may contain errors. Please verify information.</div>
            </div>
          </div>

          {/* Bonus: Analysis summary card (shown after analysis) */}
          {hasAnalysis && (
            <div className="glass-card fade-in">
              <div className="card-title"><span className="card-title-icon">📊</span> AI Analysis Summary</div>
              <div className="analysis-badges-row">
                <span className={getBadgeClass(analysis.risk_level, 'risk')}>Risk: {analysis.risk_level}</span>
                {analysis.duplicate_flag && <span className="badge badge-duplicate">⚠ Duplicate</span>}
                {analysis.regulatory_reportable && <span className="badge badge-regulatory">🔴 Regulatory</span>}
                <span className="badge badge-llm">
                  {analysis.evidence?.extraction_method === 'llm' ? '✦ LLM' : '⚙ Heuristic'}
                </span>
              </div>
              <CompletenessBar score={analysis.completeness_score || 0} />
              {analysis.evidence?.missing_fields?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div className="text-xs text-muted" style={{ marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                    Missing fields
                  </div>
                  <div className="chips-row">
                    {analysis.evidence.missing_fields.map((f) => <span key={f} className="chip">{f}</span>)}
                  </div>
                </div>
              )}
            </div>
          )}
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
      if (q && !`${c.complaint_number} ${c.product_name} ${c.customer_name} ${c.batch_number}`.toLowerCase().includes(q)) return false;
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
  const arrow = (key) => sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  return (
    <div className="stack-lg fade-in">
      <div className="glass-card">
        <div className="register-toolbar">
          <div className="search-input-wrap">
            <span className="search-icon">🔍</span>
            <input className="field-input search-input" placeholder="Search complaints…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select value={filterRisk} onChange={(e) => setFilterRisk(e.target.value)} style={{ width: 'auto', minWidth: 120 }}>
            <option value="">All Risk</option>
            <option>High</option><option>Medium</option><option>Low</option>
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: 'auto', minWidth: 160 }}>
            <option value="">All Status</option>
            <option>Open</option><option>Under Investigation</option><option>Closed</option>
          </select>
          <div className="text-secondary text-sm" style={{ whiteSpace: 'nowrap' }}>
            {filtered.length} record{filtered.length !== 1 ? 's' : ''}
          </div>
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
              <thead><tr>
                <th onClick={() => toggleSort('complaint_number')}>Complaint #{arrow('complaint_number')}</th>
                <th onClick={() => toggleSort('product_name')}>Product{arrow('product_name')}</th>
                <th>Batch</th>
                <th>Customer</th>
                <th onClick={() => toggleSort('complaint_type')}>Type{arrow('complaint_type')}</th>
                <th onClick={() => toggleSort('severity')}>Severity{arrow('severity')}</th>
                <th onClick={() => toggleSort('risk_level')}>Risk{arrow('risk_level')}</th>
                <th onClick={() => toggleSort('status')}>Status{arrow('status')}</th>
                <th onClick={() => toggleSort('created_at')}>Date{arrow('created_at')}</th>
                <th>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} onClick={() => onSelect(c)} style={{ cursor: 'pointer' }}>
                    <td style={{ fontWeight: 600, color: 'var(--primary-light)' }}>{c.complaint_number}</td>
                    <td>{c.product_name || '—'}</td>
                    <td>{c.batch_number || '—'}</td>
                    <td style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.customer_name || '—'}</td>
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
        <div className="stack">
          <div className="glass-card">
            <div className="card-title"><span className="card-title-icon">ℹ️</span> Complaint Details</div>
            <div className="info-grid" style={{ marginBottom: 16 }}>
              {[
                ['Product Name', complaint.product_name],
                ['Product Strength', complaint.product_strength],
                ['Batch Number', complaint.batch_number],
                ['Manufacturing Date', complaint.manufacturing_date],
                ['Expiry Date', complaint.expiry_date],
                ['Quantity Affected', complaint.affected_quantity],
                ['Customer', complaint.customer_name],
                ['Complaint Source', complaint.complaint_source],
                ['Complaint Type', complaint.complaint_type],
                ['Severity', complaint.severity],
                ['Priority', complaint.priority],
                ['Complaint Date', complaint.complaint_date],
                ['Country', complaint.country],
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
            <div className="card-title"><span className="card-title-icon">🔬</span> Quality &amp; Root Cause</div>
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
                <div className="error-banner">⚠️ &nbsp;Possible duplicate of <strong>{complaint.duplicate_reference}</strong>.</div>
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
                  🔴 This complaint has been flagged as a <strong>regulatory reportable event</strong>.
                  Ensure CDSCO / FDA reporting obligations are met within required timelines.
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
              <button className="btn btn-primary btn-full" onClick={handleUpdate} disabled={loading}>
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
