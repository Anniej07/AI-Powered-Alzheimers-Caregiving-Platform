import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import './AuthPage.css';

export default function LoginPage() {
  const { login }  = useAuth();
  const navigate   = useNavigate();
  const [form, setForm]     = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const fill = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  return (
    <div className="auth-page">
      <div className="auth-art">
        <div className="auth-art__content">
          <div className="auth-art__icon">
            <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
          </div>
          <h1>AlzheimerCare</h1>
          <p>Intelligent monitoring and support platform for patients, caregivers, and doctors.</p>
          <div className="auth-art__features">
            {['AI emotion monitoring', 'Medication reminders', 'Real-time alerts', 'Care coordination'].map(f => (
              <div key={f} className="auth-art__feature">
                <span className="auth-art__dot" />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-form-wrap anim-fade-up">
          <h2 className="auth-form-title">Sign in</h2>
          <p className="auth-form-sub">Access your care dashboard</p>

          <form onSubmit={handle} className="auth-form">
            <div className="input-group">
              <label className="input-label">Email address</label>
              <input className="input" type="email" name="email" value={form.email} onChange={fill} placeholder="you@example.com" required />
            </div>
            <div className="input-group">
              <label className="input-label">Password</label>
              <input className="input" type="password" name="password" value={form.password} onChange={fill} placeholder="••••••••" required />
              <div style={{ textAlign:'right', marginTop:4 }}>
                <Link to="/forgot-password" style={{ fontSize:12, color:'var(--sage)', textDecoration:'none' }}>
                  Forgot password?
                </Link>
              </div>
            </div>

            <div className="auth-demo-hint">
              <strong>Demo accounts:</strong> doctor@demo.com · caregiver@demo.com · patient@demo.com
              <br />Password: <code>Demo@1234</code>
            </div>

            <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ width:'100%', justifyContent:'center' }}>
              {loading ? <><span className="spinner" />Signing in…</> : 'Sign in'}
            </button>
          </form>

          <p className="auth-switch">
            Don't have an account? <Link to="/register">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
