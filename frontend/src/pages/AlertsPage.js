import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { alertsAPI, usersAPI } from '../services/api';
import useFetch from '../hooks/useFetch';
import { timeAgo, severityColor } from '../utils/helpers';

const TYPE_LABELS = {
  negative_emotion: 'Negative emotions',
  missed_medication: 'Missed medication',
  inactivity: 'Patient inactivity',
  low_adherence: 'Low adherence',
  prescription_expiry: 'Prescription expiry',
  emergency: 'Emergency',
};

export default function AlertsPage() {
  const { user }  = useAuth();
const isFamily  = user?.role === 'family';
  const [filter, setFilter]     = useState({ status: '', type: '', severity: '' });
  const [showCreate, setCreate] = useState(false);

  const { data: patientsData } = useFetch(
  () => isFamily ? usersAPI.getMyPatients() : Promise.resolve({ data: { patients: [] } }),
  [isFamily]
);
const familyPatientId = isFamily && patientsData?.patients?.length > 0
  ? patientsData.patients[0]._id : null;

const { data, loading, refetch } = useFetch(
  () => alertsAPI.getAll(isFamily ? { patientId: familyPatientId } : {}),
  [familyPatientId]
);
  const alerts = data?.alerts || [];

  const handleAck = async (id) => {
    try { await alertsAPI.acknowledge(id); toast.success('Alert acknowledged'); refetch(); }
    catch { toast.error('Failed'); }
  };
  const handleResolve = async (id) => {
    try { await alertsAPI.resolve(id, { notes: 'Resolved from dashboard' }); toast.success('Alert resolved'); refetch(); }
    catch { toast.error('Failed'); }
  };

  return (
    <div className="anim-fade-up">
      <div className="page-header">
        <div className="page-header__left">
          <h1>Alerts</h1>
          <p>{data?.total || 0} alert{data?.total !== 1 ? 's' : ''} total</p>
        </div>
        {['doctor','caregiver'].includes(user?.role) && user?.role !== 'family' && (
          <div className="page-header__actions">
            <button className="btn btn-primary" onClick={() => setCreate(true)}>+ Create alert</button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <select className="input select" style={{ width: 160 }} value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="sent">Sent</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
        </select>
        <select className="input select" style={{ width: 180 }} value={filter.severity} onChange={e => setFilter(f => ({ ...f, severity: e.target.value }))}>
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select className="input select" style={{ width: 200 }} value={filter.type} onChange={e => setFilter(f => ({ ...f, type: e.target.value }))}>
          <option value="">All types</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {loading && <div className="page-loader"><div className="spinner" /></div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!loading && alerts.length === 0 && (
          <div className="empty-state card">
            <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <h3>No alerts</h3>
            <p>No alerts match your current filters.</p>
          </div>
        )}
        {alerts.map(alert => (
          <AlertCard key={alert._id} alert={alert} user={user} onAck={handleAck} onResolve={handleResolve} />
        ))}
      </div>

      {showCreate && (
  <CreateAlertModal
    onClose={() => setCreate(false)}
    onSaved={() => { setCreate(false); refetch(); }}
    patientId={user?.patients?.[0]}
  />
)}
    </div>
  );
}

function AlertCard({ alert, user, onAck, onResolve }) {
  const sc = severityColor(alert.severity);
  return (
    <div className={`card alert-card alert-card--${sc}`} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <div className={`alert-card__bar alert-card__bar--${sc}`} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: 15, fontWeight: 500 }}>{alert.title}</h3>
              <span className={`badge badge-${sc}`}>{alert.severity}</span>
              <span className="badge badge-neutral">{TYPE_LABELS[alert.type] || alert.type}</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 6 }}>{alert.message}</p>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--ink-muted)', flexWrap: 'wrap' }}>
              {alert.patient && <span>👤 {alert.patient.name}</span>}
              <span>🕐 {timeAgo(alert.createdAt)}</span>
              <span className={`badge badge-${alert.status === 'resolved' ? 'success' : alert.status === 'acknowledged' ? 'info' : 'warn'}`}>
                {alert.status}
              </span>
            </div>
          </div>
          {['doctor','caregiver'].includes(user?.role) && alert.status !== 'resolved' && (
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {alert.status === 'pending' || alert.status === 'sent' ? (
                <button className="btn btn-secondary btn-sm" onClick={() => onAck(alert._id)}>Acknowledge</button>
              ) : null}
              <button className="btn btn-primary btn-sm" onClick={() => onResolve(alert._id)}>Resolve</button>
            </div>
          )}
        </div>
        {alert.notifiedUsers?.length > 0 && (
          <p style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 8 }}>
            Notified {alert.notifiedUsers.length} recipient{alert.notifiedUsers.length !== 1 ? 's' : ''} via {[...new Set(alert.notifiedUsers.map(n => n.method))].join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}

function CreateAlertModal({ onClose, onSaved, patientId }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ type: 'emergency', severity: 'high', title: '', message: '' });  const [loading, setLoading] = useState(false);
  const fill = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await alertsAPI.create({ ...form, patient: patientId });
      toast.success('Alert created and notifications sent');
      onSaved();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to create alert'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>Create alert</h2>
          <button onClick={onClose} style={{ color: 'var(--ink-muted)', padding: 4 }}>✕</button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="input-group">
                <label className="input-label">Type</label>
                <select className="input select" name="type" value={form.type} onChange={fill}>
                  {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Severity</label>
                <select className="input select" name="severity" value={form.severity} onChange={fill}>
                  {['low','medium','high','critical'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="input-group full">
                <label className="input-label">Title *</label>
                <input className="input" name="title" value={form.title} onChange={fill} required placeholder="Brief alert title" />
              </div>
              <div className="input-group full">
                <label className="input-label">Message *</label>
                <textarea className="input" name="message" value={form.message} onChange={fill} required rows={3} placeholder="Describe the situation…" style={{ resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Create & notify'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
