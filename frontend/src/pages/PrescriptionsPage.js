import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { rxAPI, usersAPI } from '../services/api';
import useFetch from '../hooks/useFetch';
import { formatDate } from '../utils/helpers';

export default function PrescriptionsPage() {
  const { user }  = useAuth();
  const isPatient = user?.role === 'patient';
const isFamily  = user?.role === 'family';
const [selectedPatientId, setSelectedPatientId] = useState(isPatient ? user._id : '');
const [showModal, setShowModal] = useState(false);
const [viewing,   setViewing]   = useState(null);
const [editing,   setEditing]   = useState(null);
  const { data: patientsData } = useFetch(
    () => !isPatient ? usersAPI.getMyPatients() : Promise.resolve({ data: { patients: [] } }),
    [isPatient]
  );

  const patientId = isPatient
  ? user._id
  : isFamily && (patientsData?.patients || []).length > 0
    ? (patientsData?.patients || [])[0]._id
    : selectedPatientId;

  const { data, loading, refetch } = useFetch(
    () => patientId ? rxAPI.getAll(patientId) : Promise.resolve({ data: { prescriptions: [] } }),
    [patientId]
  );

  const prescriptions = data?.prescriptions || [];
  const patients      = patientsData?.patients || [];

  const handleDelete = async id => {
    if (!window.confirm('Delete this prescription?')) return;
    try { await rxAPI.remove(id); toast.success('Deleted'); refetch(); }
    catch { toast.error('Failed to delete'); }
  };

  return (
    <div className="anim-fade-up">
      <div className="page-header">
        <div className="page-header__left">
          <h1>Prescriptions</h1>
          <p>{patientId ? `${prescriptions.length} prescription${prescriptions.length !== 1 ? 's' : ''} on file` : 'Select a patient'}</p>
        </div>
        {user?.role === 'doctor' && patientId && (
          <div className="page-header__actions">
            <button className="btn btn-primary" onClick={() => { setEditing(null); setShowModal(true); }}>
              + New prescription
            </button>
          </div>
        )}
      </div>

      {/* Patient selector for caregiver/doctor */}
      {!isPatient && (
        <div style={{ marginBottom: 20 }}>
          <select className="input select" style={{ maxWidth: 300 }}
            value={selectedPatientId} onChange={e => setSelectedPatientId(e.target.value)}>
            <option value="">— Select a patient —</option>
            {patients.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </div>
      )}

      {!patientId ? (
        <div className="empty-state card">
          <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <h3>No patient selected</h3>
          <p>Select a patient to view their prescriptions.</p>
        </div>
      ) : loading ? (
        <div className="page-loader"><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {prescriptions.length === 0 && (
            <div className="empty-state card">
              <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <h3>No prescriptions</h3>
              <p>No prescriptions have been issued yet.</p>
            </div>
          )}
          {prescriptions.map(rx => (
            <div key={rx._id} className="card" style={{ display:'flex', gap:20, alignItems:'flex-start', flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:220 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8, flexWrap:'wrap' }}>
                  <h3 style={{ fontSize:16, fontWeight:500 }}>{rx.diagnosis}</h3>
                  <span className={`badge ${rx.isActive ? 'badge-success' : 'badge-neutral'}`}>
                    {rx.isActive ? 'Active' : 'Expired'}
                  </span>
                </div>
                <div style={{ fontSize:13, color:'var(--ink-muted)', display:'flex', gap:16, flexWrap:'wrap', marginBottom:10 }}>
                  <span>👨‍⚕️ Dr. {rx.doctor?.name}</span>
                  <span>📅 {formatDate(rx.prescriptionDate)}</span>
                  {rx.followUpDate && <span>🔄 Follow-up: {formatDate(rx.followUpDate)}</span>}
                  {rx.expiryDate   && <span>⏳ Expires: {formatDate(rx.expiryDate)}</span>}
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {rx.medications?.map((m,i) => (
                    <span key={i} className="badge badge-info">{m.name} {m.dosage}</span>
                  ))}
                </div>
                {rx.notes && (
                  <p style={{ fontSize:13, color:'var(--ink-soft)', marginTop:10, fontStyle:'italic' }}>
                    "{rx.notes}"
                  </p>
                )}
              </div>
              <div style={{ display:'flex', gap:8, flexShrink:0, flexWrap:'wrap' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setViewing(rx)}>View</button>
                {user?.role === 'doctor' && (
                  <>
                    <button className="btn btn-outline btn-sm" onClick={() => { setEditing(rx); setShowModal(true); }}>Edit</button>
                    <button className="btn btn-danger btn-sm"  onClick={() => handleDelete(rx._id)}>Delete</button>
                  </>
                )}
                {rx.fileUrl && (
                  <a href={`${process.env.REACT_APP_API_URL?.replace('/api','')}/${rx.fileUrl}`}
                    target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
                    📎 File
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewing && <PrescriptionViewModal rx={viewing} onClose={() => setViewing(null)} />}
      {showModal && (
        <PrescriptionFormModal
          editing={editing}
          patientId={patientId}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); refetch(); }}
        />
      )}
    </div>
  );
}

function PrescriptionViewModal({ rx, onClose }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{rx.diagnosis}</h2>
          <button onClick={onClose} style={{ color:'var(--ink-muted)', padding:4 }}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, fontSize:13 }}>
            <div><span style={{ color:'var(--ink-muted)' }}>Doctor</span><br /><strong>Dr. {rx.doctor?.name}</strong></div>
            <div><span style={{ color:'var(--ink-muted)' }}>Specialization</span><br />{rx.doctor?.specialization || '—'}</div>
            <div><span style={{ color:'var(--ink-muted)' }}>Date issued</span><br />{formatDate(rx.prescriptionDate)}</div>
            <div><span style={{ color:'var(--ink-muted)' }}>Expires</span><br />{rx.expiryDate ? formatDate(rx.expiryDate) : '—'}</div>
            <div><span style={{ color:'var(--ink-muted)' }}>Follow-up</span><br />{rx.followUpDate ? formatDate(rx.followUpDate) : '—'}</div>
            <div><span style={{ color:'var(--ink-muted)' }}>Status</span><br /><span className={`badge ${rx.isActive ? 'badge-success' : 'badge-neutral'}`}>{rx.isActive ? 'Active' : 'Expired'}</span></div>
          </div>
          <div className="divider" />
          <h4 style={{ fontSize:13, fontWeight:500, marginBottom:10, color:'var(--ink-soft)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Prescribed medications</h4>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {rx.medications?.map((m,i) => (
              <div key={i} style={{ background:'var(--cream)', borderRadius:'var(--radius-md)', padding:'10px 14px', fontSize:13 }}>
                <strong>{m.name}</strong> — {m.dosage} · {m.frequency?.replace(/_/g,' ')}
                {m.duration && <span style={{ color:'var(--ink-muted)' }}> · {m.duration}</span>}
                {m.instructions && <p style={{ color:'var(--ink-muted)', marginTop:4, marginBottom:0 }}>{m.instructions}</p>}
              </div>
            ))}
          </div>
          {rx.notes && (
            <>
              <div className="divider" />
              <p style={{ fontSize:13, color:'var(--ink-soft)', fontStyle:'italic' }}>{rx.notes}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PrescriptionFormModal({ editing, patientId, onClose, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [meds, setMeds] = useState(editing?.medications || [{ name:'', dosage:'', frequency:'', duration:'', instructions:'' }]);
  const [form, setForm] = useState({
    patient:     patientId,
    diagnosis:   editing?.diagnosis   || '',
    notes:       editing?.notes       || '',
    followUpDate:editing?.followUpDate?.split('T')[0] || '',
    expiryDate:  editing?.expiryDate?.split('T')[0]   || '',
  });
  const [file, setFile] = useState(null);

  const fill    = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const fillMed = (i, field, val) => setMeds(m => m.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  const addMed  = () => setMeds(m => [...m, { name:'', dosage:'', frequency:'', duration:'', instructions:'' }]);
  const remMed  = i  => setMeds(m => m.filter((_,idx) => idx !== i));

  const handleSubmit = async e => {
    e.preventDefault(); setLoading(true);
    try {
      const fd = new FormData();
      Object.entries({ ...form, patient: patientId }).forEach(([k,v]) => v && fd.append(k, v));
      fd.append('medications', JSON.stringify(meds));
      if (file) fd.append('prescription', file);
      if (editing) await rxAPI.update(editing._id, fd);
      else         await rxAPI.create(fd);
      toast.success(editing ? 'Prescription updated' : 'Prescription created');
      onSaved();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:600 }}>
        <div className="modal-header">
          <h2>{editing ? 'Edit prescription' : 'New prescription'}</h2>
          <button onClick={onClose} style={{ color:'var(--ink-muted)', padding:4 }}>✕</button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="input-group full">
                <label className="input-label">Diagnosis *</label>
                <input className="input" name="diagnosis" value={form.diagnosis} onChange={fill} required placeholder="e.g. Moderate Alzheimer's Disease" />
              </div>
              <div className="input-group">
                <label className="input-label">Follow-up date</label>
                <input className="input" type="date" name="followUpDate" value={form.followUpDate} onChange={fill} />
              </div>
              <div className="input-group">
                <label className="input-label">Expiry date</label>
                <input className="input" type="date" name="expiryDate" value={form.expiryDate} onChange={fill} />
              </div>
            </div>

            <div style={{ margin:'8px 0' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <label className="input-label">Medications</label>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addMed}>+ Add</button>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {meds.map((m,i) => (
                  <div key={i} style={{ background:'var(--cream)', borderRadius:'var(--radius-md)', padding:14, display:'flex', flexDirection:'column', gap:8 }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                      <input className="input" placeholder="Name *" value={m.name} onChange={e => fillMed(i,'name',e.target.value)} required />
                      <input className="input" placeholder="Dosage (e.g. 10mg)" value={m.dosage} onChange={e => fillMed(i,'dosage',e.target.value)} />
                      <input className="input" placeholder="Frequency" value={m.frequency} onChange={e => fillMed(i,'frequency',e.target.value)} />
                      <input className="input" placeholder="Duration" value={m.duration} onChange={e => fillMed(i,'duration',e.target.value)} />
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <input className="input" placeholder="Instructions" value={m.instructions} onChange={e => fillMed(i,'instructions',e.target.value)} style={{ flex:1 }} />
                      {meds.length > 1 && <button type="button" className="btn btn-danger btn-sm" onClick={() => remMed(i)}>✕</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Notes</label>
              <textarea className="input" name="notes" value={form.notes} onChange={fill} rows={2}
                placeholder="Additional clinical notes…" style={{ resize:'vertical' }} />
            </div>
            <div className="input-group">
              <label className="input-label">Upload file (PDF / image)</label>
              <input className="input" type="file" accept=".pdf,.jpg,.jpeg,.png"
                onChange={e => setFile(e.target.files[0])} style={{ padding:8 }} />
            </div>

            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
              <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <span className="spinner" /> : editing ? 'Update' : 'Create prescription'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
