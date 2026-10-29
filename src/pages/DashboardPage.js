import React from 'react';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI } from '../services/api';
import useFetch from '../hooks/useFetch';
import { timeAgo, emotionIcon, getAdherenceColor } from '../utils/helpers';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import './DashboardPage.css';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
};

export default function DashboardPage() {
  const { user } = useAuth();

  const { data, loading } = useFetch(() => {
    if (user?.role === 'family')    return dashboardAPI.getFamily();
    if (user?.role === 'caregiver') return dashboardAPI.getCaregiver();
    if (user?.role === 'doctor')    return dashboardAPI.getDoctor();
    return dashboardAPI.getMe();
  }, [user?.role]);

  const d = data?.dashboard || data;

  if (loading) return (
    <div className="page-loader">
      <div className="spinner" />
      <span>Loading your dashboard…</span>
    </div>
  );

  if (user?.role === 'caregiver') return <CaregiverDashboard data={d} user={user} />;
  if (user?.role === 'doctor')    return <DoctorDashboard    data={d} user={user} />;
  if (user?.role === 'family')    return <FamilyDashboard    data={d} user={user} />;
  return <PatientDashboard data={d} user={user} />;
}

/* ── Patient Dashboard ──────────────────────────────────────── */
function PatientDashboard({ data: d, user }) {
  const doses   = d?.medications?.todaySummary || {};
  const emotion = d?.emotions?.latestFace;
  const sent    = d?.emotions?.sentimentLast7Days || {};
  const chartData = Object.entries(sent).map(([k, v]) => ({ name: k, value: v }));

  return (
    <div className="dash anim-fade-up">
      <div className="page-header">
        <div className="page-header__left">
          <h1>Good {greeting()}, {d?.patient?.name?.split(' ')[0] || 'there'}</h1>
          <p>Here's your health summary for today</p>
        </div>
      </div>

      <div className="dash-stats">
        <div className="stat-card">
          <span className="stat-label">Doses today</span>
          <span className="stat-value">
            {doses.taken || 0}
            <span style={{ fontSize: 18, color: 'var(--ink-muted)' }}>/{doses.total || 0}</span>
          </span>
          <span className="stat-sub">{doses.missed ? `${doses.missed} missed` : 'All on track'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Active medications</span>
          <span className="stat-value">{d?.medications?.activeCount || 0}</span>
          <span className="stat-sub">Current prescriptions</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Open alerts</span>
          <span className="stat-value" style={{ color: d?.alerts?.openCount > 0 ? 'var(--danger)' : 'inherit' }}>
            {d?.alerts?.openCount || 0}
          </span>
          <span className="stat-sub">{d?.alerts?.openCount > 0 ? 'Needs attention' : 'All clear'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Current mood</span>
          <span className="stat-value" style={{ fontSize: 36 }}>
            {emotion ? emotionIcon(emotion.emotion) : '—'}
          </span>
          <span className="stat-sub">{emotion ? emotion.emotion : 'No reading yet'}</span>
        </div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <h3 className="card-title">Sentiment this week</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barSize={32}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', fontSize: 13 }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="var(--sage)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="card-title">Today's medications</h3>
          {doses.total === 0 ? (
            <p style={{ color: 'var(--ink-muted)', fontSize: 14 }}>No medications scheduled today</p>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {[
                  { label: 'Taken',   value: doses.taken   || 0, color: 'var(--success)' },
                  { label: 'Pending', value: doses.pending || 0, color: 'var(--warn)' },
                  { label: 'Missed',  value: doses.missed  || 0, color: 'var(--danger)' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ flex: 1, textAlign: 'center', background: 'var(--cream)', borderRadius: 8, padding: '10px 0' }}>
                    <div style={{ fontSize: 22, fontWeight: 500, color }}>{value}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--cream-dark)', overflow: 'hidden' }}>
                <div style={{
                  width: `${doses.total ? Math.round((doses.taken / doses.total) * 100) : 0}%`,
                  height: '100%', background: 'var(--sage)', borderRadius: 4, transition: 'width 0.5s',
                }} />
              </div>
              <p style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 6, textAlign: 'right' }}>
                {doses.total ? Math.round(((doses.taken || 0) / doses.total) * 100) : 0}% complete
              </p>
            </div>
          )}
        </div>
      </div>

      {d?.alerts?.recent?.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 className="card-title">Recent alerts</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {d.alerts.recent.map((alert, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: alert.severity === 'critical' || alert.severity === 'high' ? 'var(--danger)' : 'var(--warn)',
                }} />
                <span style={{ flex: 1 }}>{alert.title}</span>
                <span style={{ color: 'var(--ink-muted)' }}>{timeAgo(alert.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Caregiver Dashboard ─────────────────────────────────────── */
function CaregiverDashboard({ data: d, user }) {
  const patients = d?.patients || [];

  return (
    <div className="anim-fade-up">
      <div className="page-header">
        <div className="page-header__left">
          <h1>Good {greeting()}, {user?.name?.split(' ')[0]}</h1>
          <p>{patients.length} patient{patients.length !== 1 ? 's' : ''} under your care</p>
        </div>
      </div>

      <div className="dash-stats" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <span className="stat-label">Total patients</span>
          <span className="stat-value">{d?.totalPatients || 0}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Pending alerts</span>
          <span className="stat-value" style={{ color: d?.totalAlerts > 0 ? 'var(--danger)' : 'inherit' }}>
            {d?.totalAlerts || 0}
          </span>
        </div>
      </div>

      {patients.length === 0 ? (
        <div className="empty-state card">
          <h3>No patients assigned</h3>
          <p>Ask a doctor to assign patients to your account.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
          {patients.map((p, i) => (
            <div key={i} className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: 'var(--sage-light)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 500, color: 'var(--sage-dark)',
                }}>
                  {p.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <p style={{ fontWeight: 500 }}>{p.name}</p>
                  <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                    {p.diagnosisStage || 'Stage unknown'} · Last active {p.lastActive ? timeAgo(p.lastActive) : 'unknown'}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, background: 'var(--cream)', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
                  <div style={{ fontWeight: 500 }}>{p.latestEmotion?.emotion || '—'}</div>
                  <div style={{ color: 'var(--ink-muted)', fontSize: 11 }}>Latest mood</div>
                </div>
                <div style={{ flex: 1, background: 'var(--cream)', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
                  <div style={{ fontWeight: 500, color: p.openAlerts > 0 ? 'var(--danger)' : 'inherit' }}>
                    {p.openAlerts || 0}
                  </div>
                  <div style={{ color: 'var(--ink-muted)', fontSize: 11 }}>Open alerts</div>
                </div>
                <div style={{ flex: 1, background: 'var(--cream)', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
                  <div style={{ fontWeight: 500 }}>{p.dosesTaken || 0}/{p.dosesTotal || 0}</div>
                  <div style={{ color: 'var(--ink-muted)', fontSize: 11 }}>Doses today</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Doctor Dashboard ────────────────────────────────────────── */
function DoctorDashboard({ data: d, user }) {
  const patients = d?.patients || [];

  return (
    <div className="anim-fade-up">
      <div className="page-header">
        <div className="page-header__left">
          <h1>Good {greeting()}, {user?.name?.split(' ')[0]}</h1>
          <p>Clinical overview — {patients.length} patient{patients.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="dash-stats" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <span className="stat-label">Total patients</span>
          <span className="stat-value">{d?.totalPatients || 0}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Active medications</span>
          <span className="stat-value">{d?.totalActiveMedications || 0}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Pending alerts</span>
          <span className="stat-value" style={{ color: d?.totalAlerts > 0 ? 'var(--danger)' : 'inherit' }}>
            {d?.totalAlerts || 0}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Avg adherence</span>
          <span className="stat-value" style={{ color: getAdherenceColor(d?.avgAdherenceRate) }}>
            {d?.avgAdherenceRate !== null && d?.avgAdherenceRate !== undefined ? `${d.avgAdherenceRate}%` : '—'}
          </span>
        </div>
      </div>

      {patients.length === 0 ? (
        <div className="empty-state card">
          <h3>No patients assigned</h3>
          <p>Go to the Patients page to assign patients.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--cream)', borderBottom: '0.5px solid var(--cream-dark)' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500 }}>Patient</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500 }}>Stage</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500 }}>Adherence</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500 }}>Alerts</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500 }}>Last active</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p, i) => (
                <tr key={i} style={{ borderBottom: '0.5px solid var(--cream-dark)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 500 }}>{p.name}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--ink-muted)', textTransform: 'capitalize' }}>
                    {p.diagnosisStage || '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ color: getAdherenceColor(p.adherenceRate), fontWeight: 500 }}>
                      {p.adherenceRate !== null && p.adherenceRate !== undefined ? `${p.adherenceRate}%` : '—'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ color: p.openAlerts > 0 ? 'var(--danger)' : 'var(--ink-muted)' }}>
                      {p.openAlerts || 0}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--ink-muted)' }}>
                    {p.lastActive ? timeAgo(p.lastActive) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Family Dashboard ────────────────────────────────────────── */
function FamilyDashboard({ data: d, user }) {
  if (!d?.patient) return (
    <div className="empty-state card">
      <h3>No patient assigned yet</h3>
      <p>Ask the doctor to assign a patient to your account.</p>
    </div>
  );

  const doses   = d?.medications?.todaySummary || {};
  const emotion = d?.emotions?.latestFace;

  return (
    <div className="anim-fade-up">
      <div className="page-header">
        <div className="page-header__left">
          <h1>Good {greeting()}, {user?.name?.split(' ')[0]}</h1>
          <p>Caring for {d?.patient?.name}</p>
        </div>
      </div>

      {/* Patient info card */}
      <div className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--sage-light)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 20, fontWeight: 500, color: 'var(--sage-dark)',
        }}>
          {d.patient.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </div>
        <div>
          <p style={{ fontWeight: 500, fontSize: 17 }}>{d.patient.name}</p>
          <p style={{ color: 'var(--ink-muted)', fontSize: 13 }}>
            Stage: {d.patient.diagnosisStage || 'Not set'} ·
            Last active: {d.patient.lastActive ? timeAgo(d.patient.lastActive) : 'Unknown'}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 16, marginBottom: 24 }}>
        <div className="stat-card">
          <span className="stat-label">Active medications</span>
          <span className="stat-value">{d?.medications?.activeCount || 0}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Doses taken today</span>
          <span className="stat-value" style={{ color: 'var(--success)' }}>{doses.taken || 0}</span>
          <span className="stat-sub">of {doses.total || 0} scheduled</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Doses missed</span>
          <span className="stat-value" style={{ color: doses.missed > 0 ? 'var(--danger)' : 'inherit' }}>
            {doses.missed || 0}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Open alerts</span>
          <span className="stat-value" style={{ color: d?.alerts?.openCount > 0 ? 'var(--danger)' : 'inherit' }}>
            {d?.alerts?.openCount || 0}
          </span>
          <span className="stat-sub">{d?.alerts?.openCount > 0 ? 'Needs attention' : 'All clear'}</span>
        </div>
      </div>

      {/* Latest emotion */}
      {emotion && (
        <div className="card" style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-muted)', marginBottom: 12 }}>
            Latest emotion detected
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 36 }}>{emotionIcon(emotion.emotion)}</span>
            <div>
              <p style={{ fontWeight: 500, fontSize: 17, textTransform: 'capitalize' }}>{emotion.emotion}</p>
              <p style={{ color: 'var(--ink-muted)', fontSize: 13 }}>
                {emotion.confidence?.toFixed(1)}% confidence · {timeAgo(emotion.recordedAt)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent alerts */}
      {d?.alerts?.recent?.length > 0 && (
        <div className="card">
          <p style={{ fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-muted)', marginBottom: 12 }}>
            Recent alerts
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {d.alerts.recent.map((alert, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: alert.severity === 'critical' || alert.severity === 'high' ? 'var(--danger)' : 'var(--warn)',
                }} />
                <span style={{ flex: 1 }}>{alert.title}</span>
                <span style={{ color: 'var(--ink-muted)' }}>{timeAgo(alert.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}