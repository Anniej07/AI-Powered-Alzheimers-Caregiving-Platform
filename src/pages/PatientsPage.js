import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { usersAPI } from '../services/api';
import useFetch from '../hooks/useFetch';
import { formatDate, timeAgo, getInitials } from '../utils/helpers';

export default function PatientsPage() {
  const { user }    = useAuth();
  const { data, loading, refetch } = useFetch(() => usersAPI.getMyPatients(), []);
  const [showAssign, setShowAssign] = useState(false);
  const [selected, setSelected]     = useState(null);

  const patients = data?.patients || [];

  const handleRemove = async (id, name) => {
    if (!window.confirm(`Remove ${name} from your patient list?`)) return;
    try { await usersAPI.removePatient(id); toast.success('Patient removed'); refetch(); }
    catch { toast.error('Failed to remove patient'); }
  };

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  return (
    <div className="anim-fade-up">
      <div className="page-header">
        <div className="page-header__left">
          <h1>Patients</h1>
          <p>{patients.length} assigned patient{patients.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn-primary" onClick={() => setShowAssign(true)}>+ Assign patient</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {patients.length === 0 && (
          <div className="empty-state card" style={{ gridColumn: '1/-1' }}>
            <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <h3>No patients yet</h3>
            <p>Assign a patient using their email address to start monitoring.</p>
          </div>
        )}
        {patients.map(p => (
          <div key={p._id} className="card" style={{ cursor: 'pointer' }} onClick={() => setSelected(p)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'var(--sage-light)', color: 'var(--sage-dark)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 600, flexShrink: 0,
              }}>
                {getInitials(p.name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: 16, fontWeight: 500, marginBottom: 2 }}>{p.name}</h3>
                <p style={{ fontSize: 12, color: 'var(--ink-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</p>
              </div>
              <span className={`badge ${p.isActive ? 'badge-success' : 'badge-neutral'}`}>
                {p.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="divider" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 13, color: 'var(--ink-soft)' }}>
              <div>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--ink-muted)', marginBottom: 2 }}>Stage</span>
                <span style={{ textTransform: 'capitalize' }}>{p.diagnosisStage || '—'}</span>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--ink-muted)', marginBottom: 2 }}>Last active</span>
                <span>{timeAgo(p.lastActive)}</span>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--ink-muted)', marginBottom: 2 }}>DOB</span>
                <span>{p.dateOfBirth ? formatDate(p.dateOfBirth) : '—'}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }} onClick={e => e.stopPropagation()}>
              <button className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }} onClick={() => handleRemove(p._id, p.name)}>
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAssign && <AssignPatientModal onClose={() => setShowAssign(false)} onSaved={() => { setShowAssign(false); refetch(); }} />}
      {selected   && <PatientDetailModal patient={selected} user={user} onClose={() => setSelected(null)} onRefresh={refetch} />}
    </div>
  );
}

/* ── Assign Modal ─────────────────────────────────────────────── */
function AssignPatientModal({ onClose, onSaved }) {
  const [email, setEmail]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await usersAPI.assignPatient({ patientEmail: email });
      toast.success('Patient assigned successfully');
      onSaved();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to assign'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>Assign patient</h2>
          <button onClick={onClose} style={{ color: 'var(--ink-muted)', padding: 4 }}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 14, color: 'var(--ink-muted)' }}>
            Enter the patient's registered email address to link them to your care list.
          </p>
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label className="input-label">Patient email *</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="patient@example.com" required />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Assign patient'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ── Patient Detail Modal ─────────────────────────────────────── */
function PatientDetailModal({ patient: p, user, onClose, onRefresh }) {
  const [stage, setStage]   = useState(p.diagnosisStage || '');
  const [saving, setSaving] = useState(false);

  const handleSaveStage = async () => {
    if (user?.role !== 'doctor') return;
    setSaving(true);
    try {
      await usersAPI.updatePatientMedical(p._id, { diagnosisStage: stage });
      toast.success('Medical record updated');
      onRefresh();
    } catch { toast.error('Failed to update'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h2>{p.name}</h2>
          <button onClick={onClose} style={{ color: 'var(--ink-muted)', padding: 4 }}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
            <div><span style={{ color: 'var(--ink-muted)' }}>Email</span><br /><strong>{p.email}</strong></div>
            <div><span style={{ color: 'var(--ink-muted)' }}>Phone</span><br />{p.phone || '—'}</div>
            <div><span style={{ color: 'var(--ink-muted)' }}>Date of birth</span><br />{p.dateOfBirth ? formatDate(p.dateOfBirth) : '—'}</div>
            <div><span style={{ color: 'var(--ink-muted)' }}>Gender</span><br />{p.gender || '—'}</div>
            <div><span style={{ color: 'var(--ink-muted)' }}>Last active</span><br />{timeAgo(p.lastActive)}</div>
            <div><span style={{ color: 'var(--ink-muted)' }}>Status</span><br /><span className={`badge ${p.isActive ? 'badge-success' : 'badge-neutral'}`}>{p.isActive ? 'Active' : 'Inactive'}</span></div>
          </div>

          {p.emergencyContact?.name && (
            <>
              <div className="divider" />
              <h4 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--ink-soft)' }}>Emergency contact</h4>
              <p style={{ fontSize: 13 }}>{p.emergencyContact.name} ({p.emergencyContact.relation}) — {p.emergencyContact.phone}</p>
            </>
          )}

          {p.medicalHistory?.length > 0 && (
            <>
              <div className="divider" />
              <h4 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--ink-soft)' }}>Medical history</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {p.medicalHistory.map((h, i) => <span key={i} className="badge badge-neutral">{h}</span>)}
              </div>
            </>
          )}

          {user?.role === 'doctor' && (
            <>
              <div className="divider" />
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Diagnosis stage</label>
                  <select className="input select" value={stage} onChange={e => setStage(e.target.value)}>
                    <option value="">— Select —</option>
                    <option value="early">Early</option>
                    <option value="moderate">Moderate</option>
                    <option value="severe">Severe</option>
                  </select>
                </div>
                <button className="btn btn-primary" onClick={handleSaveStage} disabled={saving}>
                  {saving ? <span className="spinner" /> : 'Save'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
