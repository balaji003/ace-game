import { PAGE_BG_GREEN } from '../theme';
import { POLICY_VERSION } from '../utils/consent';

// Standalone privacy policy, reachable from the sign-in screen, where it must be
// accepted before signing in.
//
// The contents describe what the backend actually stores — see be/schema.sql:
// users (email, Google account id, username), user_stats (aggregate counters),
// and games (one row per finished game). Keep this text in step with that
// schema, and bump POLICY_VERSION in utils/consent.js on any material change.
//
// No third-party service receives game data: single-player opponents are the
// local rule-based bot in game/ai.js and never leave the device.
//
// Props:
//   onBack — return to the previous screen

// TODO: replace with the address you want privacy requests sent to before shipping.
const CONTACT_EMAIL = 'privacy@example.com';

const SECTION_TITLE = {
  fontSize: 13, color: '#111', letterSpacing: 1.5, fontWeight: 700,
  textTransform: 'uppercase', marginBottom: 8, marginTop: 26,
};
const PARA = { fontSize: 14, color: '#111', lineHeight: 1.7, marginBottom: 10 };
const HL = { color: '#b45309', fontWeight: 700 };
const LI = { ...PARA, marginBottom: 6 };

export default function PrivacyPolicy({ onBack }) {
  return (
    <div style={{
      minHeight: '100vh', background: PAGE_BG_GREEN,
      fontFamily: 'Verdana, sans-serif', padding: '20px 18px 48px',
    }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        <button onClick={onBack} style={{
          background: 'none', border: 'none', color: '#111', fontSize: 14,
          cursor: 'pointer', fontFamily: 'Verdana, sans-serif', padding: '4px 0',
        }}>← Back</button>

        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 4, color: '#111', marginTop: 10 }}>
          Privacy Policy
        </div>
        <div style={{ fontSize: 12, color: '#000000aa', letterSpacing: 1, marginTop: 4 }}>
          ACE — THE LAST HAND · Version {POLICY_VERSION}
        </div>

        <div style={SECTION_TITLE}>The short version</div>
        <div style={PARA}>
          ACE stores the minimum needed to give you an account and keep your game record.
          We <span style={HL}>do not sell your data</span>, we do not run advertising, and we
          do not track you across other apps or websites.
        </div>

        <div style={SECTION_TITLE}>What we collect</div>
        <div style={LI}>
          <strong>· Your Google account.</strong> When you sign in with Google we receive your
          {' '}<span style={HL}>email address</span> and your <span style={HL}>Google account ID</span>,
          and we store both. We never receive or store your Google password.
        </div>
        <div style={LI}>
          <strong>· Your username.</strong> The handle you choose. Other players see this at the table.
        </div>
        <div style={LI}>
          <strong>· Your game record.</strong> For each finished game: the date, whether you won,
          your finishing position, the game mode, and the display names of your opponents.
        </div>
        <div style={LI}>
          <strong>· Your stats.</strong> Running totals of games played, wins, losses, and streaks.
        </div>
        <div style={LI}>
          <strong>· A session token</strong> stored on your own device so you stay signed in. It
          never leaves your device except to authenticate you to our server.
        </div>
        <div style={PARA}>
          We do not collect your contacts, location, photos, or any advertising identifier.
        </div>

        <div style={SECTION_TITLE}>Why we collect it</div>
        <div style={PARA}>
          To identify your account across devices, show you at the table to other players, keep
          your stats and history, and match you into online games. That is all.
        </div>

        <div style={SECTION_TITLE}>Who else sees it</div>
        <div style={LI}>
          <strong>· Google</strong> — handles sign-in and confirms your identity to us.
        </div>
        <div style={LI}>
          <strong>· Our hosting provider</strong> — runs the servers and database that store the above.
        </div>
        <div style={PARA}>
          Nobody else. We do not share or sell your data to advertisers, brokers, or analytics firms,
          and we do not send your game data to any third-party service. Computer opponents in
          single-player games run <span style={HL}>entirely on your own device</span> — those games
          send nothing to our servers while you play.
        </div>

        <div style={SECTION_TITLE}>Deleting your data</div>
        <div style={PARA}>
          You can delete your account from inside the app at any time. Deleting it removes your
          account, your stats, and your entire game history from our database
          {' '}<span style={HL}>permanently</span> — this cannot be undone, and we keep no copy
          afterwards. You may also email us at {CONTACT_EMAIL} to request deletion.
        </div>

        <div style={SECTION_TITLE}>How long we keep it</div>
        <div style={PARA}>
          For as long as your account exists. Once you delete your account, it is gone.
        </div>

        <div style={SECTION_TITLE}>Children</div>
        <div style={PARA}>
          ACE is not directed at children under 13, and we do not knowingly collect their data.
          If you believe a child has created an account, contact us and we will remove it.
        </div>

        <div style={SECTION_TITLE}>Changes to this policy</div>
        <div style={PARA}>
          If we change this policy in a way that matters, we will ask you to accept the new
          version the next time you sign in. The version is shown at the top of this page.
        </div>

        <div style={SECTION_TITLE}>Contact</div>
        <div style={PARA}>
          Questions about your data, or want a copy of it? Email {CONTACT_EMAIL}.
        </div>

        <button onClick={onBack} style={{
          width: '100%', marginTop: 32, padding: 12, borderRadius: 9, border: 'none',
          background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff',
          fontSize: 15, fontWeight: 700, fontFamily: 'Verdana, sans-serif',
          letterSpacing: 1, cursor: 'pointer', boxShadow: '0 4px 14px #0004',
        }}>Done</button>

      </div>
    </div>
  );
}
