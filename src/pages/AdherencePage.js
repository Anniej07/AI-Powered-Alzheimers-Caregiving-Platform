import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { medsAPI, usersAPI } from '../services/api';
import useFetch from '../hooks/useFetch';
import { getAdherenceColor } from '../utils/helpers';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,

} from 'recharts';

const PERIOD_OPTIONS = [7, 14, 30, 60, 90];

export default function AdherencePage() {
  const { user } = useAuth();
  const isPatient = user?.role === 'patient';
const isFamily  = user?.role === 'family';
const [selectedPatientId, setSelectedPatientId] = useState(isPatient ? user._id : '');
const [days, setDays] = useState(30);

  const { data: patientsData } = useFetch(
    () => !isPatient ? usersAPI.getMyPatients() : Promise.resolve({ data: { patients: [] } }),
    [isPatient]
  );

 const patientId = isPatient
  ? user._id
  : isFamily && (patientsData?.patients || []).length > 0
    ? (patientsData?.patients || [])[0]._id
    : selectedPatientId;

  const { data, loading } = useFetch(
    () => patientId ? medsAPI.getAdherence(patientId, days) : Promise.resolve({ data: { medications: [] } }),
    [patientId, days]
  );

  const medications = data?.medications || [];
  const overall     = data?.overallAdherenceRate;
  const patients    = patientsData?.patients || [];

  return (
    <div className="anim-fade-up">
      <div className="page-header">
        <div className="page-header__left">
          <h1>Adherence report</h1>
          <p>Medication compliance across {days} days</p>
        </div>
        <div className="page-header__actions">
          <div style={{ display: 'flex', gap: 4, background: 'var(--cream-dark)', padding: 4, borderRadius: 'var(--radius-md)' }}>
            {PERIOD_OPTIONS.map(d => (
              <button key={d} onClick={() => setDays(d)} style={{
                padding: '6px 14px', borderRadius: 'var(--radius-sm)', fontSize: 13,
                fontWeight: days === d ? 500 : 400,
                background: days === d ? 'var(--white)' : 'transparent',
                color: days === d ? 'var(--ink)' : 'var(--ink-muted)',
                boxShadow: days === d ? 'var(--shadow-sm)' : 'none',
                transition: 'all var(--transition)',
              }}>{d}d</button>
            ))}
          </div>
        </div>
      </div>

      {/* Patient selector for caregiver/doctor */}
      {!isPatient && (
        <div style={{ marginBottom: 20 }}>
          <select className="input select" style={{ maxWidth: 300 }} value={selectedPatientId}
            onChange={e => setSelectedPatientId(e.target.value)}>
            <option value="">— Select a patient —</option>
            {patients.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </div>
      )}

      {!patientId ? (
        <div className="empty-state card"><p>Select a patient to view their adherence report.</p></div>
      ) : loading ? (
        <div className="page-loader"><div className="spinner" /></div>
      ) : (
        <>
          {/* Summary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 16, marginBottom: 24 }}>
            <div className="stat-card">
              <span className="stat-label">Overall adherence</span>
              <span className="stat-value" style={{ color: getAdherenceColor(overall) }}>
                {overall !== null && overall !== undefined ? `${overall}%` : '—'}
              </span>
              <span className="stat-sub">{days}-day average</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Medications tracked</span>
              <span className="stat-value">{medications.length}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Total doses taken</span>
              <span className="stat-value">{medications.reduce((s, m) => s + m.takenDoses, 0)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Total doses missed</span>
              <span className="stat-value" style={{ color: 'var(--danger)' }}>
                {medications.reduce((s, m) => s + m.missedDoses, 0)}
              </span>
            </div>
          </div>

          {/* Overview bar chart */}
          {medications.length > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-muted)', marginBottom: 16 }}>
                Adherence by medication
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={medications.map(m => ({
                  name: m.medication,
                  adherence: m.adherenceRate || 0,
                }))} barSize={40}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', fontSize: 13 }}
                    formatter={v => [`${v}%`, 'Adherence']} />
                  <Bar dataKey="adherence" radius={[6, 6, 0, 0]} fill="var(--sage)"
                    label={{ position: 'top', fontSize: 11, fill: 'var(--ink-muted)', formatter: v => v > 0 ? `${v}%` : '' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {medications.length === 0 ? (
            <div className="empty-state card"><p>No medication data for this period.</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {medications.map((med, i) => <MedicationDetailCard key={i} med={med} days={days} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MedicationDetailCard({ med, days }) {
  const rate  = med.adherenceRate;
  const color = getAdherenceColor(rate);

  // Build complete date range
  const dateRange = [];
  for (let d = days - 1; d >= 0; d--) {
    const dt = new Date();
    dt.setDate(dt.getDate() - d);
    dateRange.push(dt.toISOString().split('T')[0]);
  }
  const dailyMap = {};
  (med.dailyBreakdown || []).forEach(d => { dailyMap[d.date] = d; });
  const chartData = dateRange.map(date => ({
    date:    date.slice(5),
    taken:   dailyMap[date]?.taken   || 0,
    missed:  dailyMap[date]?.missed  || 0,
    skipped: dailyMap[date]?.skipped || 0,
  }));

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontSize: 17, fontWeight: 500, marginBottom: 4 }}>{med.medication}</h3>
          <div style={{ display: 'flex', gap: 12, fontSize: 13, color: 'var(--ink-muted)', flexWrap: 'wrap' }}>
            {med.dosage && <span>💊 {med.dosage.amount}{med.dosage.unit}</span>}
            {med.frequency && <span>🔁 {med.frequency.replace(/_/g, ' ')}</span>}
            <span>📊 {med.totalDoses} doses scheduled</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 28, fontWeight: 300, fontFamily: 'var(--font-display)', color, lineHeight: 1 }}>
            {rate !== null && rate !== undefined ? `${rate}%` : '—'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 2 }}>adherence</div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ height: 8, borderRadius: 4, background: 'var(--cream-dark)', overflow: 'hidden' }}>
          <div style={{ width: `${rate || 0}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.5s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-muted)', marginTop: 4 }}>
          <span>{med.takenDoses} taken</span>
          <span>{med.missedDoses} missed</span>
          <span>{(med.totalDoses || 0) - (med.takenDoses || 0) - (med.missedDoses || 0)} skipped/pending</span>
        </div>
      </div>

      {chartData.length > 0 && (
        <>
          <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-muted)', marginBottom: 8 }}>
            Daily breakdown
          </p>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={chartData} barSize={days <= 14 ? 16 : days <= 30 ? 8 : 4} barGap={1}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                interval={days <= 14 ? 0 : days <= 30 ? 3 : 6} />
              <YAxis hide />
              <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', fontSize: 12 }} />
              <Bar dataKey="taken"   stackId="a" fill="#2D6A4F" name="Taken" />
              <Bar dataKey="missed"  stackId="a" fill="#C0392B" name="Missed" />
              <Bar dataKey="skipped" stackId="a" fill="#8A9490" radius={[2, 2, 0, 0]} name="Skipped" />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
