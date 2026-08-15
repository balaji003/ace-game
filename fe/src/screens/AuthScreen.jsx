import { useState, useEffect, useRef } from 'react';
import { api, setToken } from '../services/api';
import { PAGE_BG_GREEN } from '../theme';
import HowToPlay from './HowToPlay';
import PrivacyPolicy from './PrivacyPolicy';
import Logo from '../components/Logo';
import { isNative, renderGoogleButton, nativeGoogleSignIn } from '../native/googleAuth';
import { recordConsent } from '../utils/consent';

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
      <div style={{ position: 'absolute', top: 8, left: 11, fontSize: 20, fontWeight: 700, color: '#111', lineHeight: 1.1, fontFamily: 'Verdana, sans-serif' }}>
        A<br />♠
      </div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 76, color: '#111', fontFamily: 'Verdana, sans-serif', userSelect: 'none' }}>
        ♠
      </div>
      <div style={{ position: 'absolute', bottom: 8, right: 11, fontSize: 20, fontWeight: 700, color: '#111', lineHeight: 1.1, transform: 'rotate(180deg)', fontFamily: 'Verdana, sans-serif' }}>
        A<br />♠
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 9,
  border: '1.5px solid #16653488', background: '#06281a', color: '#f0fdf4',
  fontSize: 15, fontFamily: 'Verdana, sans-serif', outline: 'none',
};

// Props:
//   onLogin — called with username string after successful login or signup
export default function AuthScreen({ onLogin }) {
  // step: 'signin' | 'username'
  const [step, setStep]           = useState('signin');
  const [signupToken, setSignupToken] = useState('');
  const [username, setUsername]   = useState('');
  const [err, setErr]             = useState('');
  const [busy, setBusy]           = useState(false);

  const [intro, setIntro] = useState(true); // true = show card zoom-out intro
  const [showHowTo, setShowHowTo] = useState(false);

  // Privacy consent gate. Deliberately starts false on every visit rather than
  // restoring a stored acceptance — the user agrees at the moment they sign in.
  // Sign-in only happens once per install, so this is not a recurring prompt.
  const [accepted, setAccepted]     = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);

  const googleBtnRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setIntro(false), 2800);
    return () => clearTimeout(t);
  }, []);

  // ── Exchange a Google ID token for a session (or a signup token) ───────────
  const handleCredential = async (idToken) => {
    setErr(''); setBusy(true);
    try {
      const data = await api.googleAuth(idToken);
      if (data.needs_username) {
        setSignupToken(data.signup_token);
        setStep('username');
      } else {
        setToken(data.token);
        recordConsent();
        onLogin(data.username);
      }
    } catch (e) {
      setErr(e.message || 'Google sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  // Web: render Google's official button. Native: a plain button (below).
  // Google's own button cannot be intercepted once rendered, so on web it is not
  // mounted at all until the policy is accepted — the tick is what creates it.
  useEffect(() => {
    if (intro || showHowTo || showPolicy || step !== 'signin' || !accepted || isNative() || !googleBtnRef.current) return;
    renderGoogleButton(googleBtnRef.current, handleCredential, e => setErr(e.message || 'Could not load Google sign-in'));
  }, [intro, showHowTo, showPolicy, step, accepted]);

  const handleNativeSignIn = async () => {
    if (!accepted) return setErr('Please accept the Privacy Policy to continue');
    setErr(''); setBusy(true);
    try {
      const idToken = await nativeGoogleSignIn();
      await handleCredential(idToken);
    } catch (e) {
      setErr(e.message || 'Google sign-in failed');
      setBusy(false);
    }
  };

  // ── Pick a username → create the account ──────────────────────────────────
  const handleCreateAccount = async () => {
    setErr('');
    const u = username.trim().toLowerCase();
    if (u.length < 3) return setErr('Username must be at least 3 characters');
    if (!/^[a-z0-9]+$/.test(u)) return setErr('Use only letters and numbers');

    setBusy(true);
    try {
      const { taken } = await api.checkUsername(u);
      if (taken) { setErr(`@${u} is already taken`); setBusy(false); return; }

      const data = await api.googleComplete(signupToken, u);
      setToken(data.token);
      recordConsent();
      onLogin(data.username);
    } catch (e) {
      if (e.conflict === 'username') setErr(`@${u} is already taken`);
      else if (e.message?.includes('expired')) { setErr('Sign-in expired — please sign in again'); setStep('signin'); setSignupToken(''); }
      else setErr(e.message || 'Could not create account');
      setBusy(false);
    }
  };

  const primaryBtn = (label, onClick, disabled = false) => (
    <button onClick={onClick} disabled={disabled || busy} style={{
      width: '100%', marginTop: 18, padding: 12, borderRadius: 9, border: 'none',
      background: disabled || busy ? '#166534' : 'linear-gradient(135deg,#16a34a,#15803d)',
      color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'Verdana, sans-serif',
      letterSpacing: 1, cursor: disabled || busy ? 'not-allowed' : 'pointer',
      boxShadow: '0 4px 14px #0004',
    }}>
      {busy ? '…' : label}
    </button>
  );

  const linkBtn = (label, onClick) => (
    <button onClick={onClick} style={{
      background: 'none', border: 'none', color: '#86efac88', fontSize: 12,
      marginTop: 14, cursor: 'pointer', fontFamily: 'Verdana, sans-serif', textDecoration: 'underline',
    }}>{label}</button>
  );

  if (intro) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: PAGE_BG_GREEN,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 24,
        animation: 'introFade 2.8s ease forwards',
      }}>
        <AceCard style={{ animation: 'cardZoomOut 1.6s cubic-bezier(.1,1,.4,1) both' }} />
        <div style={{
          fontSize: 32, fontWeight: 700, letterSpacing: 10, color: '#15803d',
          animation: 'cardZoomOut 1.6s cubic-bezier(.1,1,.4,1) 0.1s both',
          fontFamily: 'Verdana, sans-serif',
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

  if (showHowTo)  return <HowToPlay onBack={() => setShowHowTo(false)} />;
  if (showPolicy) return <PrivacyPolicy onBack={() => setShowPolicy(false)} />;

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: PAGE_BG_GREEN,
      fontFamily: 'Verdana, sans-serif', padding: 20,
      animation: 'formFadeIn 0.4s ease both',
    }}>
      <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>

        {/* Logo */}
        <div style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Logo size={96} showText={false} focus="50% 22%" />
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: 8, color: '#111', marginTop: 10 }}>ACE</div>
          <div style={{ fontSize: 12, color: '#000000aa', letterSpacing: 2, marginTop: 2 }}>THE LAST HAND</div>
        </div>

        <div style={{
          background: '#0f3d28cc', border: '1.5px solid #16653488', borderRadius: 16,
          padding: '26px 22px', marginTop: 24, boxShadow: '0 12px 40px #0006', backdropFilter: 'blur(4px)',
        }}>

          {/* ── Sign in with Google ─────────────────────────────────────── */}
          {step === 'signin' && (
            <>
              <div style={{ fontSize: 15, color: '#f0fdf4', fontWeight: 700, marginBottom: 6 }}>
                Welcome to the table
              </div>
              <div style={{ fontSize: 12, color: '#86efac88', marginBottom: 22, lineHeight: 1.6 }}>
                Sign in with Google to play, save your stats, and pick up on any device.
              </div>

              {/* ── Privacy consent gate ─────────────────────────────────── */}
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: 9, textAlign: 'left',
                cursor: 'pointer', marginBottom: 16,
              }}>
                <input type="checkbox" checked={accepted}
                  onChange={e => { setAccepted(e.target.checked); setErr(''); }}
                  style={{ width: 17, height: 17, marginTop: 1, accentColor: '#16a34a', flexShrink: 0, cursor: 'pointer' }} />
                <span style={{ fontSize: 12, color: '#dcfce7', lineHeight: 1.55 }}>
                  I have read and agree to the{' '}
                  <span role="button" tabIndex={0}
                    onClick={e => { e.preventDefault(); setShowPolicy(true); }}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowPolicy(true); } }}
                    style={{ color: '#86efac', textDecoration: 'underline', fontWeight: 700 }}>
                    Privacy Policy
                  </span>.
                </span>
              </label>

              {isNative() ? (
                primaryBtn('Continue with Google', handleNativeSignIn, !accepted)
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', minHeight: 44 }}>
                  {busy
                    ? <span style={{ color: '#86efac', fontSize: 13 }}>Signing in…</span>
                    : accepted
                      ? <div ref={googleBtnRef} />
                      : <span style={{ color: '#86efac66', fontSize: 12, alignSelf: 'center' }}>
                          Accept the Privacy Policy to sign in
                        </span>}
                </div>
              )}

              {err && <div style={{ color: '#fca5a5', fontSize: 12, marginTop: 14 }}>⚠ {err}</div>}
            </>
          )}

          {/* ── Pick a username (first-time users) ──────────────────────── */}
          {step === 'username' && (
            <>
              <div style={{ fontSize: 14, color: '#f0fdf4', fontWeight: 700, marginBottom: 4 }}>Choose your username</div>
              <div style={{ fontSize: 12, color: '#86efac88', marginBottom: 16 }}>
                This is how other players will see you at the table.
              </div>
              <input value={username}
                onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16))}
                onKeyDown={e => e.key === 'Enter' && handleCreateAccount()}
                placeholder="username" autoCapitalize="off" autoCorrect="off"
                maxLength={16} autoFocus style={inputStyle} />

              {err && <div style={{ color: '#fca5a5', fontSize: 12, marginTop: 12, textAlign: 'left' }}>⚠ {err}</div>}

              {primaryBtn('Start Playing →', handleCreateAccount)}
              {linkBtn('← Use a different account', () => { setStep('signin'); setSignupToken(''); setUsername(''); setErr(''); })}
            </>
          )}

        </div>

        <button onClick={() => setShowHowTo(true)} style={{
          background: 'none', border: 'none', color: '#111', fontSize: 13,
          marginTop: 18, cursor: 'pointer', fontFamily: 'Verdana, sans-serif',
        }}>New here? <span style={{ textDecoration: 'underline', color: '#111' }}>How to play 🂡</span></button>
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
