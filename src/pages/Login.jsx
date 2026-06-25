import React, { useState } from 'react';
import { supabase } from '../supabase';
import { KeyRound, Mail, User, AlertCircle, CheckCircle2, Phone, Calendar } from 'lucide-react';

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);

    try {
      if (isSignUp) {
        if (!name.trim()) {
          setError('Please enter your full name.');
          setLoading(false);
          return;
        }

        // Validate Ghana Phone number formatting
        const cleanPhone = phone.replace(/\s+/g, '');
        const ghanaPhoneRegex = /^(?:\+233|0)[235][0-9]{8}$/;
        if (!ghanaPhoneRegex.test(cleanPhone)) {
          setError('Please enter a valid Ghana phone number (e.g. 0241234567).');
          setLoading(false);
          return;
        }
        const formattedPhone = cleanPhone.startsWith('0') ? '+233' + cleanPhone.substring(1) : cleanPhone;

        // Validate Age
        const parsedAge = parseInt(age);
        if (isNaN(parsedAge) || parsedAge < 18 || parsedAge > 120) {
          setError('You must be 18 or older to register.');
          setLoading(false);
          return;
        }

        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
              phone: formattedPhone,
              age: parsedAge,
              name: name // for backwards compatibility
            }
          }
        });
        if (err) throw err;
        setSuccess('Registration successful! Check your email or try logging in.');
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
    } catch (err) {
      let msg = err.message || 'An error occurred.';
      if (msg.includes('Email not confirmed')) {
        msg = 'Email not confirmed. Please check your inbox, confirm your email manually, or disable "Confirm Email" in your Supabase Auth Settings.';
      }
      setError(msg);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px', backgroundColor: '#F4F0FB' }}>
      <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '440px', boxShadow: '0 20px 40px rgba(91,46,173,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '1.8rem' }}>🚗</div>
          <h1 style={{ fontSize: '2rem', fontWeight: '800', margin: 0, color: 'var(--primary)' }}>RideTogether</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '0.9rem' }}>
            {isSignUp ? 'Create your account' : 'Sign in to your account'}
          </p>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', color: 'var(--danger)', fontSize: '0.85rem' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} /> <span>{error}</span>
          </div>
        )}
        {success && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#DCFCE7', border: '1px solid #BBF7D0', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', color: 'var(--success)', fontSize: '0.85rem' }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} /> <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {isSignUp && (
            <>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <div style={{ position: 'relative' }}>
                  <User size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input type="text" placeholder="John Doe" className="form-input" value={name} onChange={(e) => setName(e.target.value)} style={{ paddingLeft: '48px' }} required />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <div style={{ position: 'relative' }}>
                  <Phone size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input type="text" placeholder="e.g. 0241234567" className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ paddingLeft: '48px' }} required />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Age</label>
                <div style={{ position: 'relative' }}>
                  <Calendar size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input type="number" placeholder="e.g. 25" className="form-input" value={age} onChange={(e) => setAge(e.target.value)} style={{ paddingLeft: '48px' }} required />
                </div>
              </div>
            </>
          )}
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input type="email" placeholder="name@example.com" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} style={{ paddingLeft: '48px' }} required />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: '28px' }}>
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <KeyRound size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input type="password" placeholder="••••••••" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} style={{ paddingLeft: '48px' }} required />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1.05rem' }} disabled={loading}>
            {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-color)', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          {isSignUp ? (
            <span>Already have an account? <button onClick={() => setIsSignUp(false)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '700', cursor: 'pointer', padding: 0 }}>Sign In</button></span>
          ) : (
            <span>Don't have an account? <button onClick={() => setIsSignUp(true)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '700', cursor: 'pointer', padding: 0 }}>Create Account</button></span>
          )}
        </div>
      </div>
    </div>
  );
}
