// Waiting room for a private (code-based) match. The host creates a room and
// shares the code; friends join with it. The game auto-starts once the room
// fills — at which point App swaps this screen for the board on the 'start'
// message. Connection + create_room/join_room are kicked off by App.
//
// Props:
//   lobby        — { code, joined, needed, names, isHost } or null while connecting
//   socketStatus — 'connecting' | 'open' | 'reconnecting' | 'idle'
//   error        — error string (bad code, room full, host left), if any
//   onCancel     — leave the room and return to the lobby
import { useState } from 'react';
import { PAGE_BG_BLUE } from '../theme';
import { shareText, copyText } from '../native/share';

export default function RoomLobby({ lobby, socketStatus, error, onCancel }) {
  // Transient confirmation under the buttons. The share sheet is the OS's job,
  // so the only feedback worth giving is for the clipboard paths.
  const [toast, setToast] = useState(null);
  const flash = msg => { setToast(msg); setTimeout(() => setToast(null), 1800); };
  const connecting = socketStatus !== 'open';
  const code   = lobby?.code;
  const needed = lobby?.needed ?? 0;
  const joined = lobby?.joined ?? 0;
  const names  = lobby?.names ?? [];
  const isHost = lobby?.isHost;

  return (
    <div style={{
      minHeight: '100vh',
      background: PAGE_BG_BLUE,
      fontFamily: 'Verdana, sans-serif', color: '#fff', padding: 16,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ maxWidth: 380, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 10 }}>🔒</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#e0f2fe', marginBottom: 6 }}>
          {error ? 'Room error' : isHost ? 'Your private room' : 'Joined room'}
        </div>

        {error ? (
          <div style={{ fontSize: 13.5, color: '#fca5a5', marginBottom: 24, lineHeight: 1.5 }}>{error}</div>
        ) : !lobby ? (
          <div style={{ fontSize: 14, color: '#7dd3fc', marginBottom: 24 }}>
            {connecting ? 'Connecting…' : 'Setting up room…'}
          </div>
        ) : (
          <>
            {/* The shareable code, shown big */}
            <div style={{ fontSize: 12, color: '#7dd3fc', letterSpacing: 1.5, marginBottom: 6 }}>ROOM CODE</div>
            <div style={{
              fontSize: 44, fontWeight: 700, letterSpacing: 12, color: '#fff',
              background: '#0a2233', border: '1.5px solid #38bdf8', borderRadius: 12,
              padding: '12px 0 12px 12px', marginBottom: 8,
            }}>{code}</div>
            <div style={{ fontSize: 12, color: '#7dd3fc99', marginBottom: 14 }}>
              {isHost
                ? 'Share this code with your friends so they can join'
                : 'Waiting for the room to fill…'}
            </div>

            {/* Invite actions. Shown to everyone in the room, not just the host —
                any member may be the one with the right group chat open. */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button
                onClick={async () => {
                  const res = await shareText({
                    title: 'ACE — join my game',
                    dialogTitle: 'Invite friends to ACE',
                    text: `Join my ACE game! Room code: ${code}\n\nOpen ACE, tap Play Online, then Join with code.`,
                  });
                  if (res === 'copied') flash('Invite copied to clipboard');
                  if (res === 'failed') flash(`Share unavailable — code is ${code}`);
                }}
                style={{
                  flex: 2, padding: '12px 0', borderRadius: 9, border: 'none',
                  background: 'linear-gradient(135deg,#0ea5e9,#0369a1)', color: '#fff',
                  fontFamily: 'Verdana, sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}
              >Share invite</button>
              <button
                onClick={async () => flash(await copyText(code) ? 'Code copied' : `Code is ${code}`)}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 9,
                  border: '1.5px solid #38bdf866', background: '#0a2233', color: '#7dd3fc',
                  fontFamily: 'Verdana, sans-serif', fontSize: 14, cursor: 'pointer',
                }}
              >Copy</button>
            </div>
            <div style={{ fontSize: 11.5, color: '#4ade80', height: 16, marginBottom: 14 }}>
              {toast || ''}
            </div>

            {/* Seat pills */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
              {Array.from({ length: needed }).map((_, i) => (
                <div key={i} style={{
                  width: 44, height: 56, borderRadius: 8,
                  border: i < joined ? '2px solid #38bdf8' : '1.5px dashed #1e6a8e',
                  background: i < joined ? 'linear-gradient(135deg,#0ea5e9,#0369a1)' : '#0a2233',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, color: i < joined ? '#fff' : '#3f6079', transition: 'all 0.25s',
                }}>{i < joined ? '🙂' : '…'}</div>
              ))}
            </div>
            <div style={{ fontSize: 13, color: '#7dd3fc', marginBottom: 14 }}>
              {joined} / {needed} joined
            </div>

            {/* Member names */}
            {names.length > 0 && (
              <div style={{ fontSize: 12.5, color: '#bae6fd', marginBottom: 24, lineHeight: 1.7 }}>
                {names.map((nm, i) => (
                  <div key={i}>
                    {nm}{i === 0 ? ' 👑' : ''}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <button onClick={onCancel} style={{
          background: 'transparent', border: '1.5px solid #38bdf866', color: '#7dd3fc',
          borderRadius: 8, padding: '11px 28px', cursor: 'pointer', fontSize: 14, fontFamily: 'Verdana, sans-serif',
        }}>{error ? 'Back' : isHost ? 'Close room' : 'Leave'}</button>
      </div>
    </div>
  );
}
