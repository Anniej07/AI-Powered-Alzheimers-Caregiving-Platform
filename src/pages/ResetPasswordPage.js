import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';
import './AuthPage.css';

export default function ResetPasswordPage() {
  const { token }  = useParams();
  const navigate   = useNavigate();
  const [form, setForm]     = useState({ password: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  const fill = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handle = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) { toast.error('Passwords do not match'); return; }
    if (form.password.length < 6)       { toast.error('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await authAPI.resetPassword(token, { password: form.password });
      toast.success('Password reset successfully!');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Link is invalid or has expired');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-art">
        <div className="auth-art__content">
          <div className="auth-art__icon">
            <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h1>New password</h1>
          <p>Choose a strong password for your AlzheimerCare account.</p>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-form-wrap anim-fade-up">
          <h2 className="auth-form-title">Set new password</h2>
          <p className="auth-form-sub">Your link is valid for 30 minutes.</p>
          <form onSubmit={handle} className="auth-form">
            <div className="input-group">
              <label className="input-label">New password</label>
              <input className="input" type="password" name="password" value={form.password}
                onChange={fill} placeholder="At least 6 characters" required minLength={6} />
            </div>
            <div className="input-group">
              <label className="input-label">Confirm password</label>
              <input className="input" type="password" name="confirm" value={form.confirm}
                onChange={fill} placeholder="Same as above" required />
            </div>

            {/* Password strength indicator */}
            {form.password && (
              <div>
                {(() => {
                  const len    = form.password.length;
                  const hasUpper = /[A-Z]/.test(form.password);
                  const hasNum   = /\d/.test(form.password);
                  const score    = (len >= 8 ? 1 : 0) + (len >= 12 ? 1 : 0) + (hasUpper ? 1 : 0) + (hasNum ? 1 : 0);
                  const labels   = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
                  const colors   = ['#C0392B','#C0392B','#B8670A','#2D6A4F','#2D6A4F'];
                  return (
                    <div>
                      <div style={{ display:'flex', gap:4, marginBottom:4 }}>
                        {[0,1,2,3].map(i => (
                          <div key={i} style={{ flex:1, height:4, borderRadius:2,
                            background: i < score ? colors[score] : 'var(--cream-dark)',
                            transition: 'background 0.3s' }} />
                        ))}
                      </div>
                      <p style={{ fontSize:12, color: colors[score] }}>{labels[score]}</p>
                    </div>
                  );
                })()}
              </div>
            )}

            <button className="btn btn-primary btn-lg" type="submit" disabled={loading}
              style={{ width:'100%', justifyContent:'center' }}>
              {loading ? <><span className="spinner" /> Resetting…</> : 'Reset password'}
            </button>
          </form>
          <p className="auth-switch"><Link to="/login">← Back to sign in</Link></p>
        </div>
      </div>
    </div>
  );
}
