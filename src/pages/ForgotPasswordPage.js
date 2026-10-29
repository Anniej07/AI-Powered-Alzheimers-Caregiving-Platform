import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';
import './AuthPage.css';

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('');
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.forgotPassword({ email });
      setSent(true);
    } catch {
      toast.error('Something went wrong. Please try again.');
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
          <h1>Reset password</h1>
          <p>We'll send a secure reset link to your email address.</p>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-form-wrap anim-fade-up">
          {sent ? (
            <>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
              <h2 className="auth-form-title">Check your email</h2>
              <p className="auth-form-sub" style={{ marginBottom: 24 }}>
                If <strong>{email}</strong> is registered, you'll receive a reset link within a few minutes. Check your spam folder if you don't see it.
              </p>
              <Link to="/login" className="btn btn-primary btn-lg" style={{ display:'flex', justifyContent:'center' }}>
                Back to sign in
              </Link>
            </>
          ) : (
            <>
              <h2 className="auth-form-title">Forgot password?</h2>
              <p className="auth-form-sub">Enter your registered email and we'll send a reset link.</p>
              <form onSubmit={handle} className="auth-form">
                <div className="input-group">
                  <label className="input-label">Email address</label>
                  <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com" required />
                </div>
                <button className="btn btn-primary btn-lg" type="submit" disabled={loading}
                  style={{ width:'100%', justifyContent:'center' }}>
                  {loading ? <><span className="spinner" /> Sending…</> : 'Send reset link'}
                </button>
              </form>
              <p className="auth-switch"><Link to="/login">← Back to sign in</Link></p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
