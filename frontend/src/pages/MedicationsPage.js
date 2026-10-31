import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth }   from '../context/AuthContext';
import { medsAPI, usersAPI } from '../services/api';
import useFetch      from '../hooks/useFetch';
import { formatDate, formatTime, getAdherenceColor } from '../utils/helpers';

const FREQ_LABELS = {
  once_daily:'Once daily', twice_daily:'Twice daily', three_times_daily:'3× daily',
  four_times_daily:'4× daily', every_6h:'Every 6h', every_8h:'Every 8h',
  weekly:'Weekly', as_needed:'As needed',
};

export default function MedicationsPage() {
  const { user }  = useAuth();
 const isPatient = user?.role === 'patient';
const isFamily  = user?.role === 'family';
const [selectedPatientId, setSelectedPatientId] = useState(isPatient ? user._id : '');
const [showModal, setShowModal] = useState(false);
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
    () => patientId ? medsAPI.getAll(patientId) : Promise.resolve({ data: { medications: [] } }),
    [patientId]
  );

  const meds     = data?.medications || [];
  const patients = patientsData?.patients || [];

  const handleDose = async (medId, logId, status) => {
    try { await medsAPI.logDose(medId, { doseLogId: logId, status }); toast.success(`Dose marked as ${status}`); refetch(); }
    catch { toast.error('Failed to update dose'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Deactivate this medication?')) return;
    try { await medsAPI.remove(id); toast.success('Medication deactivated'); refetch(); }
    catch { toast.error('Failed to deactivate'); }
  };

  return (
    <div className="anim-fade-up">
      <div className="page-header">
        <div className="page-header__left">
          <h1>Medications</h1>
          <p>{patientId ? `${meds.length} active medication${meds.length !== 1 ? 's' : ''}` : 'Select a patient'}</p>
        </div>
        {['doctor','caregiver'].includes(user?.role) && !['family'].includes(user?.role) && patientId && (
          <div className="page-header__actions">
            <button className="btn btn-primary" onClick={() => { setEditing(null); setShowModal(true); }}>
              + Add medication
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
          <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24"><path d="M10.5 20.5 3.5 13.5a5 5 0 0 1 7.07-7.07l7 7a5 5 0 0 1-7.07 7.07z"/><line x1="8.5" y1="11.5" x2="15.5" y2="11.5"/></svg>
          <h3>No patient selected</h3>
          <p>Select a patient above to view their medications.</p>
        </div>
      ) : loading ? (
        <div className="page-loader"><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {meds.length === 0 && (
            <div className="empty-state card">
              <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24"><path d="M10.5 20.5 3.5 13.5a5 5 0 0 1 7.07-7.07l7 7a5 5 0 0 1-7.07 7.07z"/><line x1="8.5" y1="11.5" x2="15.5" y2="11.5"/></svg>
              <h3>No medications</h3>
              <p>No medications have been added yet.</p>
            </div>
          )}
          {meds.map(med => (
            <MedicationCard key={med._id} med={med} user={user}
              onDose={handleDose}
              onEdit={() => { setEditing(med); setShowModal(true); }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {showModal && (
        <MedicationModal
          editing={editing}
          patientId={patientId}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); refetch(); }}
        />
      )}
    </div>
  );
}

function MedicationCard({ med, user, onDose, onEdit, onDelete }) {
  const today = new Date();
  const todayDoses = (med.doseLogs || []).filter(l => {
    const d = new Date(l.scheduledTime);
    return d.getFullYear() === today.getFullYear() &&
           d.getMonth()    === today.getMonth() &&
           d.getDate()     === today.getDate();
  });

  return (
    <div className="card" style={{ display:'flex', gap:20, alignItems:'flex-start', flexWrap:'wrap' }}>
      <div style={{ flex:1, minWidth:200 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8, flexWrap:'wrap' }}>
          <h3 style={{ fontSize:17, fontWeight:500 }}>{med.name}</h3>
          {med.genericName && <span style={{ fontSize:12, color:'var(--ink-muted)' }}>({med.genericName})</span>}
          <span className={`badge ${med.isActive ? 'badge-success' : 'badge-neutral'}`}>
            {med.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div style={{ display:'flex', gap:16, flexWrap:'wrap', fontSize:13, color:'var(--ink-soft)', marginBottom:8 }}>
          <span>💊 {med.dosage?.amount}{med.dosage?.unit}</span>
          <span>🔁 {FREQ_LABELS[med.frequency] || med.frequency}</span>
          <span>📅 From {formatDate(med.startDate)}</span>
          {med.scheduledTimes?.length > 0 && <span>⏰ {med.scheduledTimes.join(', ')}</span>}
          {med.route && <span style={{ textTransform:'capitalize' }}>🩺 {med.route}</span>}
        </div>
        {med.instructions && (
          <p style={{ fontSize:13, color:'var(--ink-muted)', marginBottom:8, fontStyle:'italic' }}>
            {med.instructions}
          </p>
        )}
        {med.sideEffects?.length > 0 && (
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {med.sideEffects.map((s,i) => <span key={i} className="badge badge-warn" style={{ fontSize:11 }}>{s}</span>)}
          </div>
        )}
        {med.adherenceRate !== null && med.adherenceRate !== undefined && (
          <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ flex:1, height:4, borderRadius:2, background:'var(--cream-dark)' }}>
              <div style={{
                width:`${med.adherenceRate}%`, height:'100%', borderRadius:2,
                background: getAdherenceColor(med.adherenceRate), transition:'width 0.5s',
              }} />
            </div>
            <span style={{ fontSize:12, color:getAdherenceColor(med.adherenceRate), fontWeight:500 }}>
              {med.adherenceRate}% adherence
            </span>
          </div>
        )}
      </div>

      {todayDoses.length > 0 && (
        <div style={{ minWidth:160 }}>
          <p style={{ fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--ink-muted)', marginBottom:8 }}>
            Today's doses
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {todayDoses.map(log => (
              <div key={log._id} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13 }}>
                <span style={{ color:'var(--ink-muted)', minWidth:52 }}>{formatTime(log.scheduledTime)}</span>
                {log.status === 'pending' && user?.role !== 'doctor' ? (
                  <div style={{ display:'flex', gap:4 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => onDose(med._id, log._id, 'taken')}>✓ Taken</button>
                    <button className="btn btn-outline btn-sm"   onClick={() => onDose(med._id, log._id, 'skipped')}>Skip</button>
                  </div>
                ) : (
                  <span className={`badge badge-${log.status === 'taken' ? 'success' : log.status === 'missed' ? 'danger' : log.status === 'skipped' ? 'warn' : 'neutral'}`}>
                    {log.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {['doctor','caregiver'].includes(user?.role) && !['family'].includes(user?.role) && (
        <div style={{ display:'flex', gap:8, flexShrink:0 }}>
          <button className="btn btn-outline btn-sm" onClick={onEdit}>Edit</button>
          {user?.role === 'doctor' && (
            <button className="btn btn-danger btn-sm" onClick={() => onDelete(med._id)}>Remove</button>
          )}
        </div>
      )}
    </div>
  );
}

function MedicationModal({ editing, patientId, onClose, onSaved }) {
  const [form, setForm] = useState(editing ? {
    ...editing,
    startDate: editing.startDate?.split('T')[0] || '',
    endDate:   editing.endDate?.split('T')[0] || '',
  } : {
    patient: patientId, name:'', genericName:'', dosage:{ amount:'', unit:'mg' },
    frequency:'once_daily', scheduledTimes:['08:00'], route:'oral',
    instructions:'', startDate: new Date().toISOString().split('T')[0],
    endDate:'', pillsRemaining:'', sideEffects:'',
  });
  const [loading, setLoading] = useState(false);

  const fill  = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const fillD = e => setForm(f => ({ ...f, dosage: { ...f.dosage, [e.target.name]: e.target.value } }));

  const handleSubmit = async e => {
    e.preventDefault(); setLoading(true);
    try {
      // Normalise scheduled times to HH:MM (e.g. "8:00" → "08:00")
      const normalizeTime = t => {
        const [h, m] = t.split(':');
        return `${h.padStart(2,'0')}:${(m||'00').padStart(2,'0')}`;
      };
      const payload = {
        ...form,
        patient: patientId,
        scheduledTimes: (form.scheduledTimes || [])
          .map(t => normalizeTime(t.trim()))
          .filter(t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)),
        sideEffects: typeof form.sideEffects === 'string'
          ? form.sideEffects.split(',').map(s => s.trim()).filter(Boolean)
          : form.sideEffects,
      };
      if (editing) await medsAPI.update(editing._id, payload);
      else         await medsAPI.add(payload);
      toast.success(editing ? 'Medication updated' : 'Medication added');
      onSaved();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{editing ? 'Edit medication' : 'Add medication'}</h2>
          <button onClick={onClose} style={{ color:'var(--ink-muted)', padding:4 }}>✕</button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="input-group">
                <label className="input-label">Medication name *</label>
                <input className="input" name="name" value={form.name} onChange={fill} required placeholder="e.g. Donepezil" />
              </div>
              <div className="input-group">
                <label className="input-label">Generic name</label>
                <input className="input" name="genericName" value={form.genericName||''} onChange={fill} placeholder="Optional" />
              </div>
              <div className="input-group">
                <label className="input-label">Dosage amount *</label>
                <input className="input" type="number" name="amount" value={form.dosage?.amount||''} onChange={fillD} required min="0" step="0.1" />
              </div>
              <div className="input-group">
                <label className="input-label">Unit *</label>
                <select className="input select" name="unit" value={form.dosage?.unit||'mg'} onChange={fillD}>
                  {['mg','ml','mcg','g','tablet','capsule'].map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Frequency *</label>
                <select className="input select" name="frequency" value={form.frequency} onChange={fill}>
                  {Object.entries(FREQ_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Route</label>
                <select className="input select" name="route" value={form.route||'oral'} onChange={fill}>
                  {['oral','topical','injection','inhalation','sublingual','rectal'].map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Scheduled times (HH:MM, comma-separated)</label>
                <input className="input" name="scheduledTimes"
                  value={Array.isArray(form.scheduledTimes) ? form.scheduledTimes.join(', ') : form.scheduledTimes}
                  onChange={e => setForm(f => ({ ...f, scheduledTimes: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }))}
                  placeholder="08:00, 20:00" />
              </div>
              <div className="input-group">
                <label className="input-label">Pills remaining</label>
                <input className="input" type="number" name="pillsRemaining" value={form.pillsRemaining||''} onChange={fill} min="0" />
              </div>
              <div className="input-group">
                <label className="input-label">Start date *</label>
                <input className="input" type="date" name="startDate" value={form.startDate||''} onChange={fill} required />
              </div>
              <div className="input-group">
                <label className="input-label">End date</label>
                <input className="input" type="date" name="endDate" value={form.endDate||''} onChange={fill} />
              </div>
              <div className="input-group full">
                <label className="input-label">Side effects (comma-separated)</label>
                <input className="input" name="sideEffects"
                  value={Array.isArray(form.sideEffects) ? form.sideEffects.join(', ') : form.sideEffects||''}
                  onChange={fill} placeholder="Nausea, Dizziness" />
              </div>
              <div className="input-group full">
                <label className="input-label">Instructions</label>
                <textarea className="input" name="instructions" value={form.instructions||''} onChange={fill}
                  rows={2} placeholder="Take with food, avoid alcohol..." style={{ resize:'vertical' }} />
              </div>
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
              <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <span className="spinner" /> : editing ? 'Update' : 'Add medication'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
