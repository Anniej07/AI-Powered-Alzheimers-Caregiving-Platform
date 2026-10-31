import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { medsAPI, usersAPI } from '../services/api';
import useFetch from '../hooks/useFetch';
import { formatDate } from '../utils/helpers';
import './SchedulePage.css';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function SchedulePage() {
  const { user } = useAuth();
  const isPatient = user?.role === 'patient';
const isFamily  = user?.role === 'family';
  // For caregiver/doctor — let them pick which patient to view
  const [selectedPatientId, setSelectedPatientId] = useState(isPatient ? user._id : '');

const { data: patientsData } = useFetch(
  () => !isPatient ? usersAPI.getMyPatients() : Promise.resolve({ data: { patients: [] } }),
  [isPatient]
);

const patients  = patientsData?.patients || [];
const patientId = isPatient
  ? user._id
  : isFamily && patients.length > 0
    ? patients[0]._id
    : selectedPatientId;
  const { data, loading, refetch } = useFetch(
    () => patientId ? medsAPI.getSchedule(patientId) : Promise.resolve({ data: { schedule: [] } }),
    [patientId]
  );
  const { data: adherenceData } = useFetch(
    () => patientId ? medsAPI.getAdherence(patientId, 14) : Promise.resolve({ data: { medications: [] } }),
    [patientId]
  );

  const schedule = data?.schedule || [];

  // Map hour → dose entries
  const hourMap = {};
  schedule.forEach(med => {
    (med.todaysDoses || []).forEach(dose => {
      const h = new Date(dose.scheduledTime).getHours();
      if (!hourMap[h]) hourMap[h] = [];
      hourMap[h].push({ med, dose });
    });
  });

  const handleMarkDose = async (medId, doseLogId, status) => {
    try {
      await medsAPI.logDose(medId, { doseLogId, status });
      toast.success(`Dose marked as ${status}`);
      refetch();
    } catch { toast.error('Failed to update dose'); }
  };

  const now         = new Date();
  const currentHour = now.getHours();
  const totalDoses  = schedule.reduce((s, m) => s + (m.todaysDoses?.length || 0), 0);
  const takenDoses  = schedule.reduce((s, m) => s + (m.todaysDoses?.filter(d => d.status === 'taken').length || 0), 0);
  

  return (
    <div className="anim-fade-up">
      <div className="page-header">
        <div className="page-header__left">
          <h1>Medication schedule</h1>
          <p>{formatDate(now)} · {takenDoses}/{totalDoses} doses completed</p>
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
          <p>Select a patient to view their medication schedule.</p>
        </div>
      ) : loading ? (
        <div className="page-loader"><div className="spinner" /></div>
      ) : (
        <>
          {/* Progress bar */}
          {totalDoses > 0 && (
            <div className="schedule-summary">
              <div className="schedule-summary__bar-wrap">
                <div className="schedule-summary__bar" style={{ width: `${Math.round((takenDoses / totalDoses) * 100)}%` }} />
              </div>
              <span className="schedule-summary__pct">{Math.round((takenDoses / totalDoses) * 100)}% complete</span>
            </div>
          )}

          <div className="schedule-layout">
            {/* 24h timeline */}
            <div className="timeline card">
              {HOURS.map(hour => {
                const entries   = hourMap[hour] || [];
                const isCurrent = hour === currentHour;
                const label     = hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;
                if (!entries.length && !isCurrent) return (
                  <div key={hour} className="timeline__row timeline__row--empty">
                    <div className="timeline__time"><span>{label}</span></div>
                    <div className="timeline__content" />
                  </div>
                );
                return (
                  <div key={hour} className={`timeline__row ${isCurrent ? 'timeline__row--current' : ''} ${entries.length ? 'timeline__row--has-events' : ''}`}>
                    <div className="timeline__time">
                      <span>{label}</span>
                      {isCurrent && <div className="timeline__now-dot" />}
                    </div>
                    <div className="timeline__content">
                      {entries.map(({ med, dose }, i) => (
                        <div key={i} className={`timeline__event timeline__event--${dose.status}`}>
                          <div className="timeline__event-info">
                            <span className="timeline__event-name">{med.name}</span>
                            <span className="timeline__event-dose">{med.dosage?.amount}{med.dosage?.unit} · {med.route}</span>
                          </div>
                          <div className="timeline__event-actions">
                            {dose.status === 'pending' && user?.role !== 'doctor' ? (
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button className="btn btn-secondary btn-sm" onClick={() => handleMarkDose(med.medicationId, dose._id, 'taken')}>
                                  ✓ Taken
                                </button>
                                <button className="btn btn-outline btn-sm" onClick={() => handleMarkDose(med.medicationId, dose._id, 'skipped')}>
                                  Skip
                                </button>
                              </div>
                            ) : (
                              <span className={`badge badge-${dose.status === 'taken' ? 'success' : dose.status === 'missed' ? 'danger' : dose.status === 'skipped' ? 'warn' : 'neutral'}`}>
                                {dose.status}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Side panel */}
            <div className="schedule-side">
              <div className="card">
                <p style={{ fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-muted)', marginBottom: 12 }}>
                  Active medications
                </p>
                {schedule.length === 0 ? (
                  <p style={{ fontSize: 14, color: 'var(--ink-muted)' }}>No active medications</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {schedule.map((med, i) => (
                      <div key={i} style={{ fontSize: 13 }}>
                        <div style={{ fontWeight: 500, marginBottom: 2 }}>{med.name}</div>
                        <div style={{ color: 'var(--ink-muted)' }}>{med.dosage?.amount}{med.dosage?.unit} · {med.scheduledTimes?.join(', ')}</div>
                        {med.instructions && <div style={{ color: 'var(--ink-muted)', fontStyle: 'italic', marginTop: 2 }}>{med.instructions}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {adherenceData?.medications?.length > 0 && (
                <div className="card">
                  <p style={{ fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-muted)', marginBottom: 12 }}>
                    14-day adherence
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {adherenceData.medications.map((m, i) => (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                          <span style={{ fontWeight: 500 }}>{m.medication}</span>
                          <span style={{ color: m.adherenceRate >= 80 ? 'var(--success)' : m.adherenceRate >= 60 ? 'var(--warn)' : 'var(--danger)', fontWeight: 500 }}>
                            {m.adherenceRate !== null ? `${m.adherenceRate}%` : '—'}
                          </span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: 'var(--cream-dark)' }}>
                          <div style={{
                            width: `${m.adherenceRate || 0}%`, height: '100%', borderRadius: 3,
                            background: m.adherenceRate >= 80 ? 'var(--success)' : m.adherenceRate >= 60 ? 'var(--warn)' : 'var(--danger)',
                            transition: 'width 0.5s',
                          }} />
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 3 }}>
                          {m.takenDoses} taken · {m.missedDoses} missed of {m.totalDoses}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
