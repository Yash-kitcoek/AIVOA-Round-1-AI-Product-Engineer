import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { analyzeComplaint, fetchComplaints, saveComplaint } from './features/complaints/complaintsSlice';

function App() {
  const dispatch = useDispatch();
  const { loading, analysis, complaints, error } = useSelector((state) => state.complaints);
  const [text, setText] = useState('');
  const [draft, setDraft] = useState({
    complaint_number: '',
    product: '',
    batch: '',
    customer: '',
    complaint_type: '',
    complaint_date: '',
    description: '',
    severity: '',
    risk_level: '',
    quality_impact: '',
    root_cause: '',
    recommendations: '',
    completeness_score: 0,
    duplicate_flag: false,
    duplicate_reference: '',
  });

  useEffect(() => {
    dispatch(fetchComplaints());
  }, [dispatch]);

  useEffect(() => {
    if (analysis) {
      setDraft({
        complaint_number: analysis.complaint_number || '',
        product: analysis.product || '',
        batch: analysis.batch || '',
        customer: analysis.customer || '',
        complaint_type: analysis.complaint_type || '',
        complaint_date: analysis.complaint_date || '',
        severity: analysis.severity || '',
        risk_level: analysis.risk_level || '',
        quality_impact: analysis.quality_impact || '',
        root_cause: analysis.root_cause || '',
        recommendations: analysis.recommendations || '',
        completeness_score: analysis.completeness_score || 0,
        duplicate_flag: Boolean(analysis.duplicate_flag),
        duplicate_reference: analysis.duplicate_reference || '',
        description: analysis.description || '',
      });
    }
  }, [analysis]);

  const statSummary = useMemo(() => ({
    open: complaints.filter((item) => item.status !== 'Closed').length,
    highRisk: complaints.filter((item) => item.risk_level === 'High').length,
  }), [complaints]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData();
    formData.append('text', text);
    dispatch(analyzeComplaint(formData));
  };

  const handleSave = async () => {
    await dispatch(saveComplaint(draft));
    setText('');
    setDraft({
      complaint_number: '',
      product: '',
      batch: '',
      customer: '',
      complaint_type: '',
      complaint_date: '',
      description: '',
      severity: '',
      risk_level: '',
      quality_impact: '',
      root_cause: '',
      recommendations: '',
      completeness_score: 0,
      duplicate_flag: false,
      duplicate_reference: '',
    });
  };

  return (
    <div className="app-shell">
      <header className="hero-card">
        <div>
          <p className="eyebrow">AI-powered QMS workflow</p>
          <h1>AIVOA Complaint Copilot</h1>
          <p>Transform distributor emails and complaint notes into a structured pharmaceutical complaint record with AI triage.</p>
        </div>
        <div className="stats-grid">
          <div>
            <strong>{statSummary.open}</strong>
            <span>Open complaints</span>
          </div>
          <div>
            <strong>{statSummary.highRisk}</strong>
            <span>High risk</span>
          </div>
        </div>
      </header>

      <section className="grid-layout">
        <div className="panel">
          <h2>Upload complaint intake</h2>
          <form onSubmit={handleSubmit} className="stack">
            <label className="field-label">
              Complaint text
              <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Paste a distributor email, complaint note, or product issue summary here." rows={9} />
            </label>
            <label className="field-label">
              Optional file upload
              <input type="file" accept=".txt,.md,.pdf" />
            </label>
            <button type="submit" disabled={loading}>{loading ? 'Analyzing...' : 'Analyse with AI'}</button>
            {error ? <p className="error">{error}</p> : null}
          </form>
        </div>

        <div className="panel">
          <h2>AI analysis summary</h2>
          {analysis ? (
            <div className="summary-card">
              <div className="pill-row">
                <span className="pill">Risk: {analysis.risk_level}</span>
                <span className="pill">Completeness: {analysis.completeness_score}%</span>
                {analysis.duplicate_flag ? <span className="pill warning">Duplicate</span> : null}
              </div>
              <p><strong>Recommendation:</strong> {analysis.recommendations}</p>
              <p><strong>Quality impact:</strong> {analysis.quality_impact}</p>
              <p><strong>Evidence:</strong> Missing fields: {analysis.evidence?.missing_fields?.join(', ') || 'None'}</p>
            </div>
          ) : (
            <p className="muted">Analysis appears here after you submit a complaint. The workflow shows completeness, duplicate detection, risk, and CAPA guidance.</p>
          )}
        </div>
      </section>

      <section className="grid-layout lower-grid">
        <div className="panel">
          <h2>Log customer complaint</h2>
          <div className="stack">
            <div className="field-grid">
              <label className="field-label">Complaint number<input value={draft.complaint_number} onChange={(event) => setDraft({ ...draft, complaint_number: event.target.value })} /></label>
              <label className="field-label">Product<input value={draft.product} onChange={(event) => setDraft({ ...draft, product: event.target.value })} /></label>
              <label className="field-label">Batch<input value={draft.batch} onChange={(event) => setDraft({ ...draft, batch: event.target.value })} /></label>
              <label className="field-label">Customer<input value={draft.customer} onChange={(event) => setDraft({ ...draft, customer: event.target.value })} /></label>
              <label className="field-label">Complaint type<input value={draft.complaint_type} onChange={(event) => setDraft({ ...draft, complaint_type: event.target.value })} /></label>
              <label className="field-label">Complaint date<input value={draft.complaint_date} onChange={(event) => setDraft({ ...draft, complaint_date: event.target.value })} /></label>
              <label className="field-label">Severity<input value={draft.severity} onChange={(event) => setDraft({ ...draft, severity: event.target.value })} /></label>
              <label className="field-label">Risk level<input value={draft.risk_level} onChange={(event) => setDraft({ ...draft, risk_level: event.target.value })} /></label>
            </div>
            <label className="field-label">Description<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={5} /></label>
            <label className="field-label">Root cause<textarea value={draft.root_cause} onChange={(event) => setDraft({ ...draft, root_cause: event.target.value })} rows={3} /></label>
            <label className="field-label">Recommendations<textarea value={draft.recommendations} onChange={(event) => setDraft({ ...draft, recommendations: event.target.value })} rows={3} /></label>
            <button onClick={handleSave}>Save to complaint register</button>
          </div>
        </div>

        <div className="panel">
          <h2>Complaint register</h2>
          <div className="list-stack">
            {complaints.length === 0 ? <p className="muted">No complaints saved yet.</p> : complaints.map((item) => (
              <article key={item.id} className="record-card">
                <div className="record-header">
                  <strong>{item.complaint_number}</strong>
                  <span className="pill">{item.risk_level}</span>
                </div>
                <p>{item.product} · {item.batch}</p>
                <p>{item.customer}</p>
                <p className="muted">{item.recommendations}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;
