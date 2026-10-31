import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { getInitials, roleLabel } from '../utils/helpers';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [tab, setTab] = useState('profile');

  return (
    <div className="anim-fade-up" style={{ maxWidth: 680 }}>
      <div className="page-header">
        <div className="page-header__left">
          <h1>Profile</h1>
          <p>Manage your account details and preferences</p>
        </div>
      </div>

      {/* Avatar header */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'var(--sage-light)', color: 'var(--sage-dark)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, fontWeight: 600, flexShrink: 0,
        }}>
          {getInitials(user?.name)}
        </div>
        <div>
          <h2 style={{ fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 400 }}>{user?.name}</h2>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <span className="badge badge-info">{roleLabel(user?.role)}</span>
            {user?.specialization && <span className="badge badge-neutral">{user.specialization}</span>}
            {user?.hospital && <span className="badge badge-neutral">{user.hospital}</span>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        <button className={`tab ${tab === 'profile' ? 'tab--active' : ''}`} onClick={() => setTab('profile')}>Profile</button>
        <button className={`tab ${tab === 'password' ? 'tab--active' : ''}`} onClick={() => setTab('password')}>Password</button>
        <button className={`tab ${tab === 'notifications' ? 'tab--active' : ''}`} onClick={() => setTab('notifications')}>Notifications</button>
      </div>

      {tab === 'profile'       && <ProfileForm user={user} onSaved={refreshUser} />}
      {tab === 'password'      && <PasswordForm />}
      {tab === 'notifications' && <NotificationsForm user={user} onSaved={refreshUser} />}
    </div>
  );
}

function ProfileForm({ user, onSaved }) {
  const [form, setForm] = useState({
    name:  user?.name  || '',
    phone: user?.phone || '',
    gender: user?.gender || '',
    specialization: user?.specialization || '',
    hospital: user?.hospital || '',
    emergencyContact: user?.emergencyContact || { name: '', phone: '', relation: '' },
  });
  const [loading, setLoading] = useState(false);
  const fill = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const fillEC = (e) => setForm(f => ({ ...f, emergencyContact: { ...f.emergencyContact, [e.target.name]: e.target.value } }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await authAPI.updateProfile(form);
      await onSaved();
      toast.success('Profile updated');
    } catch { toast.error('Failed to update profile'); }
    finally { setLoading(false); }
  };

  return (
    <div className="card">
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="input-group full">
            <label className="input-label">Full name</label>
            <input className="input" name="name" value={form.name} onChange={fill} required />
          </div>
          <div className="input-group">
            <label className="input-label">Phone</label>
            <input className="input" name="phone" value={form.phone} onChange={fill} placeholder="+1 234 567 8900" />
          </div>
          <div className="input-group">
            <label className="input-label">Gender</label>
            <select className="input select" name="gender" value={form.gender} onChange={fill}>
              <option value="">— Select —</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          {user?.role === 'doctor' && (
            <>
              <div className="input-group">
                <label className="input-label">Specialization</label>
                <input className="input" name="specialization" value={form.specialization} onChange={fill} />
              </div>
              <div className="input-group">
                <label className="input-label">Hospital</label>
                <input className="input" name="hospital" value={form.hospital} onChange={fill} />
              </div>
            </>
          )}

          {user?.role === 'patient' && (
            <>
              <div className="divider full" />
              <p className="input-label full" style={{ marginBottom: 0 }}>Emergency contact</p>
              <div className="input-group">
                <label className="input-label">Name</label>
                <input className="input" name="name" value={form.emergencyContact.name} onChange={fillEC} />
              </div>
              <div className="input-group">
                <label className="input-label">Phone</label>
                <input className="input" name="phone" value={form.emergencyContact.phone} onChange={fillEC} />
              </div>
              <div className="input-group">
                <label className="input-label">Relation</label>
                <input className="input" name="relation" value={form.emergencyContact.relation} onChange={fillEC} placeholder="Spouse, Son, etc." />
              </div>
            </>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

function PasswordForm() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const fill = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) { toast.error('Passwords do not match'); return; }
    if (form.newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await authAPI.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast.success('Password changed');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="card">
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="input-group">
            <label className="input-label">Current password</label>
            <input className="input" type="password" name="currentPassword" value={form.currentPassword} onChange={fill} required />
          </div>
          <div className="input-group">
            <label className="input-label">New password</label>
            <input className="input" type="password" name="newPassword" value={form.newPassword} onChange={fill} required minLength={6} />
          </div>
          <div className="input-group">
            <label className="input-label">Confirm new password</label>
            <input className="input" type="password" name="confirm" value={form.confirm} onChange={fill} required />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Change password'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function NotificationsForm({ user, onSaved }) {
  const [prefs, setPrefs] = useState(user?.notificationPreferences || { email: true, sms: true });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await authAPI.updateProfile({ notificationPreferences: prefs });
      await onSaved();
      toast.success('Preferences saved');
    } catch { toast.error('Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="card">
      <p style={{ fontSize: 14, color: 'var(--ink-muted)', marginBottom: 20 }}>
        Choose how you receive alerts and medication reminders.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[['email', '📧 Email notifications'], ['sms', '📱 SMS notifications']].map(([key, label]) => (
          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontSize: 15 }}>
            <input
              type="checkbox"
              checked={prefs[key]}
              onChange={e => setPrefs(p => ({ ...p, [key]: e.target.checked }))}
              style={{ width: 18, height: 18, accentColor: 'var(--sage)' }}
            />
            {label}
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
          {loading ? <span className="spinner" /> : 'Save preferences'}
        </button>
      </div>
    </div>
  );
}
