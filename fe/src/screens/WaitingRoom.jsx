// Lobby for online matchmaking — shown after "Find Match" until the room fills.
// Connection + join_queue are kicked off by App; this screen renders queue
// progress and lets the player cancel. App owns the socket subscriptions, so
// the 'start' message (which navigates away) can't be missed during mount.
//
// Props:
//   opponents    — number of opponents requested
//   queueInfo    — { joined, needed } from the server, or null while connecting
//   socketStatus — 'connecting' | 'open' | 'reconnecting' | 'idle'
//   error        — error string, if any
//   onCancel     — leave the queue and return to the lobby
export default function WaitingRoom({ opponents, queueInfo, socketStatus, error, onCancel }) {
  const needed = queueInfo?.needed ?? opponents + 1;
  const joined = queueInfo?.joined ?? 0;
  const connecting = socketStatus !== 'open';

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 30%,#0c4a6e,#04293d 75%)',
      fontFamily: 'Georgia,serif', color: '#fff', padding: 16,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ maxWidth: 380, width: '100%', textAlign: 'center' }}>
        <div style={{
          fontSize: 56, marginBottom: 16,
          animation: 'spin 2.4s linear infinite', display: 'inline-block',
        }}>🌐</div>

        <div style={{ fontSize: 24, fontWeight: 700, color: '#e0f2fe', marginBottom: 6 }}>
          {error ? 'Matchmaking error' : connecting ? 'Connecting…' : 'Finding players…'}
        </div>

        {error ? (
          <div style={{ fontSize: 13, color: '#fca5a5', marginBottom: 22 }}>{error}</div>
        ) : (
          <>
            <div style={{ fontSize: 14, color: '#7dd3fc', marginBottom: 24 }}>
              {socketStatus === 'reconnecting'
                ? 'Reconnecting to server…'
                : `Waiting for ${needed} players to join the room`}
            </div>

            {/* Joined / needed pills */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 10 }}>
              {Array.from({ length: needed }).map((_, i) => (
                <div key={i} style={{
                  width: 44, height: 56, borderRadius: 8,
                  border: i < joined ? '2px solid #38bdf8' : '1.5px dashed #1e6a8e',
                  background: i < joined ? 'linear-gradient(135deg,#0ea5e9,#0369a1)' : '#0a2233',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, color: i < joined ? '#fff' : '#3f6079',
                  transition: 'all 0.25s',
                }}>{i < joined ? '🙂' : '…'}</div>
              ))}
            </div>
            <div style={{ fontSize: 13, color: '#7dd3fc', marginBottom: 26 }}>
              {joined} / {needed} joined
            </div>
          </>
        )}

        <button onClick={onCancel} style={{
          background: 'transparent', border: '1.5px solid #38bdf866', color: '#7dd3fc',
          borderRadius: 8, padding: '11px 28px', cursor: 'pointer', fontSize: 14, fontFamily: 'Georgia,serif',
        }}>Cancel</button>
      </div>

      <style>{`@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
