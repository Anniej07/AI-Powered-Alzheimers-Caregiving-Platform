import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import './AuthPage.css';

const ROLES = [
  { value: 'patient',   label: 'Patient',   icon: '🧑' },
  { value: 'family',    label: 'Family Member',      icon: '👨‍👩‍👧' },
  { value: 'caregiver', label: 'Caregiver', icon: '🤝' },
  { value: 'doctor',    label: 'Doctor',    icon: '👨‍⚕️' },
];

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate     = useNavigate();
  const [form, setForm]     = useState({ name:'', email:'', password:'', role:'patient', phone:'', specialization:'' });
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await register(form);
      toast.success(`Welcome, ${user.name.split(' ')[0]}!`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  const fill = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  return (
    <div className="auth-page">
      <div className="auth-art">
        <div className="auth-art__content">
          <div className="auth-art__icon">
            <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
          </div>
          <h1>Join the care network</h1>
          <p>Create your account to connect with patients, caregivers, and medical professionals.</p>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-form-wrap anim-fade-up">
          <h2 className="auth-form-title">Create account</h2>
          <p className="auth-form-sub">Choose your role to get started</p>

          <form onSubmit={handle} className="auth-form">
            <div className="input-group">
              <label className="input-label">I am a…</label>
              <div className="role-selector">
                {ROLES.map(r => (
                  <React.Fragment key={r.value}>
                    <input type="radio" id={`role-${r.value}`} name="role" value={r.value} checked={form.role === r.value} onChange={fill} className="role-option" />
                    <label htmlFor={`role-${r.value}`} className="role-label">
                      <span style={{ fontSize: 22 }}>{r.icon}</span>
                      {r.label}
                    </label>
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="form-grid">
              <div className="input-group full">
                <label className="input-label">Full name</label>
                <input className="input" name="name" value={form.name} onChange={fill} placeholder="Dr. Jane Smith" required />
              </div>
              <div className="input-group">
                <label className="input-label">Email</label>
                <input className="input" type="email" name="email" value={form.email} onChange={fill} placeholder="you@example.com" required />
              </div>
              <div className="input-group">
                <label className="input-label">Phone</label>
                <input className="input" name="phone" value={form.phone} onChange={fill} placeholder="+1 234 567 8900" />
              </div>
              <div className="input-group full">
                <label className="input-label">Password</label>
                <input className="input" type="password" name="password" value={form.password} onChange={fill} placeholder="At least 6 characters" required minLength={6} />
              </div>
              {form.role === 'doctor' && (
                <>
                  <div className="input-group">
                    <label className="input-label">Specialization</label>
                    <input className="input" name="specialization" value={form.specialization} onChange={fill} placeholder="Neurology" />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Hospital</label>
                    <input className="input" name="hospital" value={form.hospital || ''} onChange={fill} placeholder="City General" />
                  </div>
                </>
              )}
            </div>

            <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ width:'100%', justifyContent:'center' }}>
              {loading ? <><span className="spinner" />Creating account…</> : 'Create account'}
            </button>
          </form>

          <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
}
