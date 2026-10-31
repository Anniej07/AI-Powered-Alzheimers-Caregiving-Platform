import React, { useState, useEffect } from 'react';
import { useAuth }    from '../context/AuthContext';
import useFetch       from '../hooks/useFetch';
import useSocket      from '../hooks/useSocket';
import { timeAgo }   from '../utils/helpers';
import api            from '../services/api';
import { usersAPI }   from '../services/api';

const TYPE_META = {
  dose_taken:           { icon: '✅', label: 'Dose taken',            color: 'var(--success)' },
  dose_missed:          { icon: '❌', label: 'Dose missed',           color: 'var(--danger)' },
  dose_skipped:         { icon: '⏭',  label: 'Dose skipped',         color: 'var(--ink-muted)' },
  medication_added:     { icon: '💊', label: 'Medication added',      color: 'var(--info)' },
  medication_updated:   { icon: '✏',  label: 'Medication updated',   color: 'var(--ink-muted)' },
  medication_removed:   { icon: '🗑',  label: 'Medication removed',  color: 'var(--danger)' },
  prescription_created: { icon: '📋', label: 'Prescription created',  color: 'var(--info)' },
  prescription_updated: { icon: '📝', label: 'Prescription updated',  color: 'var(--ink-muted)' },
  emotion_recorded:     { icon: '🧠', label: 'Emotion recorded',      color: 'var(--warn)' },
  alert_triggered:      { icon: '🔔', label: 'Alert triggered',       color: 'var(--danger)' },
  alert_acknowledged:   { icon: '👀', label: 'Alert acknowledged',    color: 'var(--warn)' },
  alert_resolved:       { icon: '✓',  label: 'Alert resolved',        color: 'var(--success)' },
  patient_login:        { icon: '🔐', label: 'Patient signed in',     color: 'var(--ink-muted)' },
  profile_updated:      { icon: '👤', label: 'Profile updated',       color: 'var(--ink-muted)' },
  caregiver_assigned:   { icon: '🤝', label: 'Caregiver assigned',    color: 'var(--info)' },
  doctor_assigned:      { icon: '👨‍⚕️', label: 'Doctor assigned',   color: 'var(--info)' },
  inactivity_detected:  { icon: '😴', label: 'Inactivity detected',   color: 'var(--warn)' },
};

const TYPE_FILTER_OPTIONS = [
  { value: '',                     label: 'All events' },
  { value: 'dose_taken',           label: 'Doses taken' },
  { value: 'dose_missed',          label: 'Doses missed' },
  { value: 'emotion_recorded',     label: 'Emotions' },
  { value: 'alert_triggered',      label: 'Alerts' },
  { value: 'medication_added',     label: 'Medications' },
  { value: 'prescription_created', label: 'Prescriptions' },
];

export default function ActivityPage() {
  const { user }    = useAuth();
  const isPatient = user?.role === 'patient';
const isFamily  = user?.role === 'family';
const [selectedPatientId, setSelectedPatientId] = useState(isPatient ? user._id : '');
const [typeFilter, setTypeFilter] = useState('');
  const [days,       setDays]       = useState(30);
  const [liveEvents, setLiveEvents] = useState([]);

  const { on, off } = useSocket();

  // Load patients list for caregiver/doctor
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
    () => patientId
      ? api.get(`/activity/${patientId}`, { params: { type: typeFilter || undefined, days } })
      : Promise.resolve({ data: { activities: [], total: 0 } }),
    [patientId, typeFilter, days]
  );

  const { data: summaryData } = useFetch(
    () => patientId
      ? api.get(`/activity/${patientId}/summary`, { params: { days } })
      : Promise.resolve({ data: { byType: [] } }),
    [patientId, days]
  );

  // Real-time live events via Socket.io
  useEffect(() => {
    const handler = (activity) => {
      // Only show events for the currently viewed patient
      if (!patientId || activity.patient?.toString() !== patientId?.toString()) return;
      setLiveEvents(prev => [{ ...activity, _live: true }, ...prev].slice(0, 10));
    };
    on('new_activity', handler);
    return () => off('new_activity', handler);
  }, [on, off, patientId]);

  // Clear live events when patient changes
  useEffect(() => { setLiveEvents([]); }, [patientId]);

  const activities = [
    ...liveEvents,
    ...(data?.activities || []),
  ];

  const patients = patientsData?.patients || [];
  const summary  = summaryData;

  return (
    <div className="anim-fade-up">
      <div className="page-header">
        <div className="page-header__left">
          <h1>Activity timeline</h1>
          <p>Chronological record of all patient events</p>
        </div>
      </div>

      {/* Patient selector for caregiver/doctor */}
      {!isPatient && (
        <div style={{ marginBottom: 20 }}>
          <select
            className="input select"
            style={{ maxWidth: 300 }}
            value={selectedPatientId}
            onChange={e => setSelectedPatientId(e.target.value)}
          >
            <option value="">— Select a patient —</option>
            {patients.map(p => (
              <option key={p._id} value={p._id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {!patientId ? (
        <div className="empty-state card">
          <p>Select a patient to view their activity timeline.</p>
        </div>
      ) : (
        <>
          {/* Summary tag chips */}
          {summary?.byType?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {summary.byType.slice(0, 7).map(({ _id, count }) => {
                const meta    = TYPE_META[_id] || {};
                const active  = typeFilter === _id;
                return (
                  <button
                    key={_id}
                    onClick={() => setTypeFilter(active ? '' : _id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 12px', borderRadius: 'var(--radius-md)',
                      fontSize: 13, fontWeight: active ? 500 : 400,
                      background: active ? 'var(--sage-light)' : 'var(--white)',
                      border: `1px solid ${active ? 'var(--sage)' : 'rgba(28,31,29,0.1)'}`,
                      color: active ? 'var(--sage-dark)' : 'var(--ink-soft)',
                      cursor: 'pointer', transition: 'all var(--transition)',
                    }}
                  >
                    <span>{meta.icon || '•'}</span>
                    {meta.label || _id.replace(/_/g, ' ')}
                    <span style={{
                      marginLeft: 2, background: 'var(--cream-dark)',
                      padding: '1px 6px', borderRadius: 10,
                      fontSize: 11, color: 'var(--ink-muted)',
                    }}>{count}</span>
                  </button>
                );
              })}
              {typeFilter && (
                <button
                  onClick={() => setTypeFilter('')}
                  style={{
                    padding: '6px 12px', borderRadius: 'var(--radius-md)',
                    fontSize: 13, color: 'var(--ink-muted)',
                    background: 'var(--cream-dark)', border: 'none', cursor: 'pointer',
                  }}
                >
                  × Clear filter
                </button>
              )}
            </div>
          )}

          {/* Filters row */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              className="input select"
              style={{ width: 180 }}
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
            >
              {TYPE_FILTER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: 4, background: 'var(--cream-dark)', padding: 4, borderRadius: 'var(--radius-md)' }}>
              {[7, 14, 30, 60].map(d => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  style={{
                    padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: 13,
                    background: days === d ? 'var(--white)' : 'transparent',
                    color: days === d ? 'var(--ink)' : 'var(--ink-muted)',
                    fontWeight: days === d ? 500 : 400,
                    boxShadow: days === d ? 'var(--shadow-sm)' : 'none',
                    transition: 'all var(--transition)', cursor: 'pointer',
                  }}
                >
                  {d}d
                </button>
              ))}
            </div>

            {liveEvents.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--sage)', marginLeft: 'auto' }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: 'var(--sage)', display: 'inline-block',
                  animation: 'pulse 1.5s infinite',
                }} />
                {liveEvents.length} live event{liveEvents.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          {/* Timeline feed */}
          {loading && !liveEvents.length ? (
            <div className="page-loader"><div className="spinner" /></div>
          ) : activities.length === 0 ? (
            <div className="empty-state card">
              <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              <h3>No activity</h3>
              <p>No events found for this period and filter.</p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0 }}>
              <div style={{ position: 'relative' }}>
                {/* Vertical connecting line */}
                <div style={{
                  position: 'absolute', left: 51, top: 0, bottom: 0,
                  width: 1, background: 'rgba(28,31,29,0.06)', zIndex: 0,
                }} />

                {activities.map((act, i) => {
                  const meta = TYPE_META[act.type] || { icon: '•', label: act.type, color: 'var(--ink-muted)' };
                  return (
                    <div
                      key={act._id || `live-${i}`}
                      style={{
                        display: 'flex', gap: 16, padding: '14px 20px',
                        borderBottom: i < activities.length - 1 ? '0.5px solid rgba(28,31,29,0.05)' : 'none',
                        position: 'relative',
                        background: act._live ? 'rgba(92,122,110,0.03)' : 'transparent',
                        animation: act._live ? 'fadeUp 0.4s ease both' : 'none',
                      }}
                    >
                      {/* Event type icon */}
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: 'var(--white)',
                        border: `1.5px solid ${meta.color}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, zIndex: 1, position: 'relative',
                      }}>
                        {meta.icon}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', marginBottom: 2 }}>
                              {act.title}
                            </p>
                            {act.description && (
                              <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginBottom: 4 }}>
                                {act.description}
                              </p>
                            )}
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                              <span className="badge badge-neutral" style={{ fontSize: 11 }}>
                                {meta.label}
                              </span>
                              {act.actor?.name && (
                                <span style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
                                  by {act.actor.name} ({act.actor.role})
                                </span>
                              )}
                              {act.source === 'system' && (
                                <span style={{ fontSize: 11, color: 'var(--ink-muted)' }}>system</span>
                              )}
                            </div>
                          </div>

                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            {act._live && (
                              <span style={{
                                display: 'block', fontSize: 10, fontWeight: 600,
                                color: 'var(--sage)', textTransform: 'uppercase',
                                letterSpacing: '0.06em', marginBottom: 2,
                              }}>
                                LIVE
                              </span>
                            )}
                            <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                              {timeAgo(act.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pagination hint */}
          {data?.total > activities.length - liveEvents.length && (
            <p style={{ fontSize: 13, color: 'var(--ink-muted)', textAlign: 'center', marginTop: 16 }}>
              Showing {activities.length - liveEvents.length} of {data.total} events.
              Increase the date range to see more.
            </p>
          )}
        </>
      )}
    </div>
  );
}
