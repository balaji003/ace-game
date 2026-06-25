import { useState, useEffect, useRef } from 'react';
import { api, setToken } from '../services/api';
import HowToPlay from './HowToPlay';

function AceCard({ style }) {
  return (
    <div style={{
      width: 140, height: 198, borderRadius: 14,
      background: 'linear-gradient(160deg,#fff 70%,#f1f5f9)',
      border: '2.5px solid #e2e8f0',
      boxShadow: '0 30px 80px #0009, 0 0 0 1px #fff3, inset 0 1px 0 #fff',
      position: 'relative', flexShrink: 0,
      ...style,
    }}>
      <div style={{ position: 'absolute', top: 8, left: 11, fontSize: 20, fontWeight: 700, color: '#111', lineHeight: 1.1, fontFamily: 'Georgia,serif' }}>
        A<br />♠
      </div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 76, color: '#111', fontFamily: 'Georgia,serif', userSelect: 'none' }}>
        ♠
      </div>
      <div style={{ position: 'absolute', bottom: 8, right: 11, fontSize: 20, fontWeight: 700, color: '#111', lineHeight: 1.1, transform: 'rotate(180deg)', fontFamily: 'Georgia,serif' }}>
        A<br />♠
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 9,
  border: '1.5px solid #16653488', background: '#06281a', color: '#f0fdf4',
  fontSize: 15, fontFamily: 'Georgia,serif', outline: 'none',
};

const popupBtnStyle = {
  flex: 1, padding: '10px 0', borderRadius: 8, border: '1.5px solid #16653488',
  background: '#06281a', fontSize: 13, fontFamily: 'Georgia,serif', cursor: 'pointer',
};

function Popup({ conflict, username, onClose, actions }) {
  if (!conflict) return null;

  const configs = {
    'username': {
      title: 'Username taken',
      message: <>Username <strong style={{ color: '#4ade80' }}>@{username}</strong> is already taken.</>,
    },
    'phone': {
      title: 'Phone already registered',
      message: 'This mobile number is already linked to an account.',
    },
    'username-not-found': {
      title: 'No account found',
      message: <>No account found for <strong style={{ color: '#4ade80' }}>@{username}</strong>. Want to create one?</>,
    },
    'recover-phone-not-found': {
      title: 'Number not registered',
      message: 'No account found with this mobile number. Want to sign up instead?',
    },
  };

  const cfg = configs[conflict];
  if (!cfg) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 320,
          background: '#0a2e1c', border: '1.5px solid #166534',
          borderRadius: 16, padding: '28px 22px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          textAlign: 'center', fontFamily: 'Georgia,serif',
          animation: 'popEmblem 0.25s cubic-bezier(.2,1.4,.5,1) both',
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#f0fdf4', marginBottom: 10 }}>
          {cfg.title}
        </div>
        <div style={{ fontSize: 13, color: '#86efac', lineHeight: 1.6, marginBottom: 22 }}>
          {cfg.message}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {actions[conflict].map(({ label, color, borderColor, onClick }) => (
            <button key={label} onClick={onClick}
              style={{ ...popupBtnStyle, color: color || '#86efac', borderColor: borderColor || '#16653488' }}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Props:
//   onLogin — called with username string after successful login or signup
export default function AuthScreen({ onLogin }) {
  // step: 'auth' | 'signup-otp' | 'signup-pin' | 'signup-success'
  //     | 'recover-phone' | 'recover-otp' | 'recover-done'
  const [step, setStep]         = useState('auth');
  const [mode, setMode]         = useState('login');
  const [username, setUsername] = useState('');
  const [phone, setPhone]       = useState('');
  const [pin, setPin]           = useState('');
  const [otp, setOtp]           = useState('');
  const [phoneToken, setPhoneToken]               = useState('');
  const [recoveredUsername, setRecoveredUsername] = useState('');
  const [err, setErr]           = useState('');
  const [conflict, setConflict] = useState(null);
  const [busy, setBusy]         = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  const [intro, setIntro] = useState(true); // true = show card zoom-out intro
  const [showHowTo, setShowHowTo] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIntro(false), 2800);
    return () => clearTimeout(t);
  }, []);

  const switchMode = m => { setMode(m); setErr(''); setConflict(null); };
  const resetToAuth = () => {
    setStep('auth'); setOtp(''); setPin(''); setPhoneToken('');
    setErr(''); setConflict(null); setResendCountdown(0);
  };

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  // Auto-login 2.5s after success screen appears
  useEffect(() => {
    if (step !== 'signup-success') return;
    const t = setTimeout(() => onLogin(username.trim().toLowerCase()), 2500);
    return () => clearTimeout(t);
  }, [step]);

  // ── Signup step 1: check username + send OTP ──────────────────────────────
  const handleSendSignupOTP = async () => {
    setErr(''); setConflict(null);
    const u = username.trim().toLowerCase();
    if (u.length < 3) return setErr('Username must be at least 3 characters');
    if (!/^[a-z0-9]+$/.test(u)) return setErr('Use only letters and numbers');
    const p = phone.replace(/\D/g, '');
    if (!/^[0-9]{10}$/.test(p)) return setErr('Enter a valid 10-digit mobile number');

    setBusy(true);
    try {
      const { taken } = await api.checkUsername(u);
      if (taken) { setConflict('username'); setBusy(false); return; }

      await api.sendOTP(p);
      setResendCountdown(30);
      setStep('signup-otp');
    } catch (e) {
      if (e.conflict === 'phone') setConflict('phone');
      else if (e.code === 'otp_cooldown') { setResendCountdown(e.retryAfter || 30); setStep('signup-otp'); }
      else if (e.code === 'otp_daily_limit') setErr('OTP limit reached for today. Try again tomorrow.');
      else setErr(e.message || 'Could not send OTP');
    } finally {
      setBusy(false);
    }
  };

  // ── Signup step 2: verify OTP only (no account creation yet) ─────────────
  const handleVerifySignupOTP = async () => {
    setErr('');
    if (otp.length !== 6) return setErr('Enter the 6-digit OTP');

    setBusy(true);
    try {
      const { phone_token } = await api.verifyOTP(phone.replace(/\D/g, ''), otp);
      setPhoneToken(phone_token);
      setStep('signup-pin');
    } catch (e) {
      setErr(e.message?.includes('invalid or expired') ? 'Wrong or expired OTP' : (e.message || 'Verification failed'));
    } finally {
      setBusy(false);
    }
  };

  // ── Signup step 3: set PIN → create account ───────────────────────────────
  const handleCreateAccount = async () => {
    setErr('');
    if (pin.length !== 4) return setErr('PIN must be exactly 4 digits');

    setBusy(true);
    try {
      const data = await api.signup(username.trim().toLowerCase(), pin, phoneToken);
      setToken(data.token);
      setStep('signup-success');
    } catch (e) {
      if (e.message?.includes('phone_token expired')) {
        setErr('Session expired — please start over');
        setPhoneToken('');
      } else {
        setErr(e.message || 'Account creation failed');
      }
    } finally {
      setBusy(false);
    }
  };

  // ── Login ─────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    setErr('');
    const u = username.trim().toLowerCase();
    if (u.length < 3) return setErr('Username must be at least 3 characters');
    if (!/^[a-z0-9]+$/.test(u)) return setErr('Use only letters and numbers');
    if (pin.length !== 4) return setErr('PIN must be exactly 4 digits');

    setBusy(true);
    try {
      const data = await api.login(u, pin);
      setToken(data.token);
      onLogin(data.username);
    } catch (e) {
      if (e.code === 'username_not_found') {
        setConflict('username-not-found');
      } else {
        setErr(e.message || 'Login failed');
      }
    } finally {
      setBusy(false);
    }
  };

  // ── Recovery step 1: send OTP to phone ────────────────────────────────────
  const handleSendRecoverOTP = async () => {
    setErr('');
    const p = phone.replace(/\D/g, '');
    if (!/^[0-9]{10}$/.test(p)) return setErr('Enter a valid 10-digit mobile number');

    setBusy(true);
    try {
      await api.sendRecoverOTP(p);
      setResendCountdown(30);
      setStep('recover-otp');
    } catch (e) {
      if (e.code === 'phone_not_found') setConflict('recover-phone-not-found');
      else if (e.code === 'otp_cooldown') { setResendCountdown(e.retryAfter || 30); setStep('recover-otp'); }
      else if (e.code === 'otp_daily_limit') setErr('OTP limit reached for today. Try again tomorrow.');
      else setErr(e.message || 'Could not send OTP');
    } finally {
      setBusy(false);
    }
  };

  // ── Recovery step 2: verify OTP → reveal username ─────────────────────────
  const handleRecover = async () => {
    setErr('');
    if (otp.length !== 6) return setErr('Enter the 6-digit OTP');

    setBusy(true);
    try {
      const { username: found } = await api.recoverUsername(phone.replace(/\D/g, ''), otp);
      setRecoveredUsername(found);
      setStep('recover-done');
    } catch (e) {
      setErr(e.message || 'Recovery failed');
    } finally {
      setBusy(false);
    }
  };

  const primaryBtn = (label, onClick, disabled = false) => (
    <button onClick={onClick} disabled={disabled || busy} style={{
      width: '100%', marginTop: 18, padding: 12, borderRadius: 9, border: 'none',
      background: disabled || busy ? '#166534' : 'linear-gradient(135deg,#16a34a,#15803d)',
      color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'Georgia,serif',
      letterSpacing: 1, cursor: disabled || busy ? 'not-allowed' : 'pointer',
      boxShadow: '0 4px 14px #0004',
    }}>
      {busy ? '…' : label}
    </button>
  );

  const linkBtn = (label, onClick) => (
    <button onClick={onClick} style={{
      background: 'none', border: 'none', color: '#86efac88', fontSize: 12,
      marginTop: 14, cursor: 'pointer', fontFamily: 'Georgia,serif', textDecoration: 'underline',
    }}>{label}</button>
  );

  // ── Popup action definitions ───────────────────────────────────────────────
  const popupActions = {
    'username': [
      { label: 'Try another', color: '#86efac', onClick: () => setConflict(null) },
      { label: 'Log in instead', color: '#4ade80', borderColor: '#16a34a88', onClick: () => { setConflict(null); switchMode('login'); } },
    ],
    'phone': [
      { label: 'Log in', color: '#4ade80', borderColor: '#16a34a88', onClick: () => { setConflict(null); switchMode('login'); } },
      { label: 'Forgot username?', color: '#86efac', onClick: () => { setConflict(null); setStep('recover-phone'); setPhone(''); setOtp(''); setErr(''); } },
    ],
    'username-not-found': [
      { label: 'Create account', color: '#4ade80', borderColor: '#16a34a88', onClick: () => { setConflict(null); switchMode('signup'); } },
      { label: 'Try another', color: '#86efac', onClick: () => { setConflict(null); setUsername(''); setPin(''); } },
    ],
    'recover-phone-not-found': [
      { label: 'Create account', color: '#4ade80', borderColor: '#16a34a88', onClick: () => { setConflict(null); resetToAuth(); switchMode('signup'); } },
      { label: 'Try another number', color: '#86efac', onClick: () => { setConflict(null); setPhone(''); setErr(''); } },
    ],
  };

  if (intro) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'radial-gradient(ellipse at 50% 40%,#0f4d2a,#061a0f)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 24,
        animation: 'introFade 2.8s ease forwards',
      }}>
        <AceCard style={{ animation: 'cardZoomOut 1.6s cubic-bezier(.1,1,.4,1) both' }} />
        <div style={{
          fontSize: 32, fontWeight: 700, letterSpacing: 10, color: '#4ade80',
          animation: 'cardZoomOut 1.6s cubic-bezier(.1,1,.4,1) 0.1s both',
          fontFamily: 'Georgia,serif',
        }}>ACE</div>
        <style>{`
          @keyframes cardZoomOut {
            0%   { transform: scale(3.5); opacity: 1; }
            100% { transform: scale(1);   opacity: 1; }
          }
          @keyframes introFade {
            0%   { opacity: 1; }
            78%  { opacity: 1; }
            100% { opacity: 0; }
          }
        `}</style>
      </div>
    );
  }

  if (showHowTo) return <HowToPlay onBack={() => setShowHowTo(false)} />;

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 50% 30%,#1a7a4f,#0a2e1c 75%)',
      fontFamily: 'Georgia,serif', padding: 20,
      animation: 'formFadeIn 0.4s ease both',
    }}>
      <Popup
        conflict={conflict}
        username={username.trim().toLowerCase()}
        onClose={() => setConflict(null)}
        actions={popupActions}
      />

      <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>

        {/* Logo */}
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 64, lineHeight: 1, filter: 'drop-shadow(0 4px 12px #0006)' }}>♠</div>
          <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: 8, color: '#4ade80', marginTop: 4 }}>ACE</div>
          <div style={{ fontSize: 12, color: '#86efac99', letterSpacing: 2, marginTop: 2 }}>THE CUTTHROAT CARD GAME</div>
        </div>

        <div style={{
          background: '#0f3d28cc', border: '1.5px solid #16653488', borderRadius: 16,
          padding: '26px 22px', marginTop: 24, boxShadow: '0 12px 40px #0006', backdropFilter: 'blur(4px)',
        }}>

          {/* ── Auth: login / signup form ──────────────────────────────── */}
          {step === 'auth' && (
            <>
              <div style={{ display: 'flex', marginBottom: 20, background: '#06281a', borderRadius: 9, padding: 3 }}>
                {['login', 'signup'].map(m => (
                  <button key={m} onClick={() => switchMode(m)} style={{
                    flex: 1, padding: 8, borderRadius: 7, border: 'none', cursor: 'pointer',
                    fontSize: 13, fontFamily: 'Georgia,serif', fontWeight: 700, letterSpacing: 0.5,
                    background: mode === m ? '#16a34a' : 'transparent',
                    color: mode === m ? '#fff' : '#86efac99',
                  }}>
                    {m === 'login' ? 'Log In' : 'Sign Up'}
                  </button>
                ))}
              </div>

              <input value={username}
                onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16))}
                onKeyDown={e => e.key === 'Enter' && (mode === 'login' ? handleLogin() : handleSendSignupOTP())}
                placeholder="username" autoCapitalize="off" autoCorrect="off"
                maxLength={16} style={inputStyle} />

              {mode === 'signup' && (
                <input value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  onKeyDown={e => e.key === 'Enter' && handleSendSignupOTP()}
                  placeholder="10-digit mobile number" type="tel" inputMode="numeric"
                  maxLength={10} style={{ ...inputStyle, marginTop: 10 }} />
              )}

              {mode === 'login' && (
                <input value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  placeholder="4-digit PIN" type="password" inputMode="numeric"
                  maxLength={4} style={{ ...inputStyle, marginTop: 10 }} />
              )}

              {err && (
                <div style={{ color: '#fca5a5', fontSize: 12, marginTop: 12, textAlign: 'left' }}>⚠ {err}</div>
              )}

              {primaryBtn(
                mode === 'login' ? 'Enter Table' : 'Send OTP →',
                mode === 'login' ? handleLogin : handleSendSignupOTP,
              )}

              {mode === 'login' && (
                linkBtn('Forgot username?', () => { setStep('recover-phone'); setPhone(''); setOtp(''); setErr(''); })
              )}
            </>
          )}

          {/* ── Signup OTP: verify phone ───────────────────────────────── */}
          {step === 'signup-otp' && (
            <>
              <div style={{ fontSize: 13, color: '#86efac', marginBottom: 16 }}>
                OTP sent to <strong>{phone}</strong>
              </div>
              <input value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={e => e.key === 'Enter' && handleVerifySignupOTP()}
                placeholder="6-digit OTP" type="text" inputMode="numeric" maxLength={6}
                autoFocus style={{ ...inputStyle, letterSpacing: 8, textAlign: 'center', fontSize: 22 }} />

              {err && <div style={{ color: '#fca5a5', fontSize: 12, marginTop: 12, textAlign: 'left' }}>⚠ {err}</div>}

              {primaryBtn('Verify OTP →', handleVerifySignupOTP)}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
                {linkBtn('← Back', resetToAuth)}
                {resendCountdown > 0
                  ? <span style={{ fontSize: 12, color: '#86efac44', marginTop: 14, fontFamily: 'Georgia,serif' }}>Resend in {resendCountdown}s</span>
                  : linkBtn('Resend OTP', () => { setOtp(''); setPhoneToken(''); handleSendSignupOTP(); })
                }
              </div>
            </>
          )}

          {/* ── Signup PIN: set PIN after phone verified ───────────────── */}
          {step === 'signup-pin' && (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                marginBottom: 18, padding: '8px 14px', borderRadius: 8,
                background: '#052e16', border: '1px solid #166534',
              }}>
                <span style={{ fontSize: 16, color: '#4ade80' }}>✓</span>
                <span style={{ fontSize: 13, color: '#86efac' }}>Phone verified — set your PIN</span>
              </div>

              <input value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onKeyDown={e => e.key === 'Enter' && handleCreateAccount()}
                placeholder="Choose a 4-digit PIN" type="password" inputMode="numeric"
                maxLength={4} autoFocus style={{ ...inputStyle, letterSpacing: 8, textAlign: 'center', fontSize: 22 }} />

              {err && <div style={{ color: '#fca5a5', fontSize: 12, marginTop: 12, textAlign: 'left' }}>⚠ {err}</div>}

              {primaryBtn('Create Account', handleCreateAccount)}
              <div style={{ marginTop: 4 }}>{linkBtn('← Back', () => { setStep('signup-otp'); setOtp(''); setErr(''); })}</div>
            </>
          )}

          {/* ── Signup success ─────────────────────────────────────────── */}
          {step === 'signup-success' && (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%', margin: '0 auto 16px',
                background: 'linear-gradient(135deg,#16a34a,#15803d)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 0 8px #16a34a22',
                animation: 'popEmblem 0.5s cubic-bezier(.2,1.4,.5,1) both',
              }}>
                <span style={{ fontSize: 36, color: '#fff', lineHeight: 1 }}>✓</span>
              </div>
              <div style={{ fontSize: 13, color: '#86efac88', letterSpacing: 1, marginBottom: 6 }}>ACCOUNT CREATED</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#4ade80', marginBottom: 6 }}>
                @{username.trim().toLowerCase()}
              </div>
              <div style={{ fontSize: 12, color: '#86efac66', marginBottom: 20 }}>Welcome to the table!</div>
              <button onClick={() => onLogin(username.trim().toLowerCase())} style={{
                width: '100%', padding: 12, borderRadius: 9, border: 'none',
                background: 'linear-gradient(135deg,#16a34a,#15803d)',
                color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'Georgia,serif',
                letterSpacing: 1, cursor: 'pointer', boxShadow: '0 4px 14px #0004',
              }}>
                Start Playing →
              </button>
            </div>
          )}

          {/* ── Recovery: enter phone ──────────────────────────────────── */}
          {step === 'recover-phone' && (
            <>
              <div style={{ fontSize: 14, color: '#f0fdf4', fontWeight: 700, marginBottom: 4 }}>Forgot your username?</div>
              <div style={{ fontSize: 12, color: '#86efac88', marginBottom: 16 }}>
                Enter the mobile number you signed up with.
              </div>
              <input value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                onKeyDown={e => e.key === 'Enter' && handleSendRecoverOTP()}
                placeholder="10-digit mobile number" type="tel" inputMode="numeric"
                maxLength={10} autoFocus style={inputStyle} />

              {err && <div style={{ color: '#fca5a5', fontSize: 12, marginTop: 12, textAlign: 'left' }}>⚠ {err}</div>}

              {primaryBtn('Send OTP →', handleSendRecoverOTP)}
              {linkBtn('← Back to login', resetToAuth)}
            </>
          )}

          {/* ── Recovery: enter OTP ────────────────────────────────────── */}
          {step === 'recover-otp' && (
            <>
              <div style={{ fontSize: 13, color: '#86efac', marginBottom: 16 }}>
                OTP sent to <strong>{phone}</strong>
              </div>
              <input value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={e => e.key === 'Enter' && handleRecover()}
                placeholder="6-digit OTP" type="text" inputMode="numeric" maxLength={6}
                autoFocus style={{ ...inputStyle, letterSpacing: 8, textAlign: 'center', fontSize: 22 }} />

              {err && <div style={{ color: '#fca5a5', fontSize: 12, marginTop: 12, textAlign: 'left' }}>⚠ {err}</div>}

              {primaryBtn('Find My Username', handleRecover)}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
                {linkBtn('← Back', () => setStep('recover-phone'))}
                {resendCountdown > 0
                  ? <span style={{ fontSize: 12, color: '#86efac44', marginTop: 14, fontFamily: 'Georgia,serif' }}>Resend in {resendCountdown}s</span>
                  : linkBtn('Resend OTP', () => { setOtp(''); handleSendRecoverOTP(); })
                }
              </div>
            </>
          )}

          {/* ── Recovery: success ─────────────────────────────────────── */}
          {step === 'recover-done' && (
            <>
              <div style={{ fontSize: 28, marginBottom: 10 }}>♠</div>
              <div style={{ fontSize: 13, color: '#86efac88', marginBottom: 6 }}>YOUR USERNAME IS</div>
              <div style={{
                fontSize: 24, fontWeight: 700, color: '#4ade80', letterSpacing: 2,
                background: '#06281a', borderRadius: 9, padding: '12px 0', marginBottom: 20,
              }}>
                @{recoveredUsername}
              </div>
              <button onClick={() => { setUsername(recoveredUsername); setMode('login'); resetToAuth(); }} style={{
                width: '100%', padding: 12, borderRadius: 9, border: 'none',
                background: 'linear-gradient(135deg,#16a34a,#15803d)',
                color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'Georgia,serif',
                letterSpacing: 1, cursor: 'pointer',
              }}>
                Log In
              </button>
            </>
          )}

        </div>

        <button onClick={() => setShowHowTo(true)} style={{
          background: 'none', border: 'none', color: '#86efacaa', fontSize: 13,
          marginTop: 18, cursor: 'pointer', fontFamily: 'Georgia,serif',
        }}>New here? <span style={{ textDecoration: 'underline', color: '#4ade80' }}>How to play ♠</span></button>
      </div>

      <style>{`
        @keyframes popEmblem {
          0%  { transform: scale(0) rotate(-12deg); opacity: 0; }
          100%{ transform: scale(1) rotate(0);      opacity: 1; }
        }
        @keyframes formFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
