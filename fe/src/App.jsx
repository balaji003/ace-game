import { useState, useEffect, useRef } from 'react';
import { api, clearToken, getToken } from './services/api';
import { socket } from './services/socket';
import { initNativeShell } from './native';
import { hydrateToken } from './native/storage';
import AuthScreen from './screens/AuthScreen';
import Lobby from './screens/Lobby';
import GameScreen from './screens/GameScreen';
import OnlineGameScreen from './screens/OnlineGameScreen';
import WaitingRoom from './screens/WaitingRoom';
import SettingsPanel from './screens/SettingsPanel';
import HistoryScreen from './screens/HistoryScreen';

// Normalize backend stats + history into the shape SettingsPanel expects
async function fetchStats(limit = 10) {
  const [st, history] = await Promise.all([api.getStats(), api.getHistory(limit)]);
  return {
    played:     st.played,
    wins:       st.wins,
    losses:     st.losses,
    streak:     st.current_streak,
    bestStreak: st.best_streak,
    history: history.map(g => ({
      at:        new Date(g.played_at).getTime(),
      won:       g.won,
      mode:      g.mode,
      opponents: g.opponents,
    })),
  };
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);  // true while restoring session
  const [stats, setStats]         = useState(null);
  const [gameConfig, setGameConfig] = useState({ watch_countdown_secs: 10, afk_warn_secs: 20, afk_grace_secs: 10, max_turn_retries: 3, min_players: 3, max_players: 7, recent_games_limit: 10 });
  const [screen, setScreen] = useState('lobby');   // 'lobby' | 'game' | 'waiting' | 'online'
  const [gameOptions, setGameOptions] = useState({ opponents: 3, useAI: true });
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory,  setShowHistory]  = useState(false);

  // Online multiplayer state (server-driven via the shared socket)
  const [onlineOpps,   setOnlineOpps]   = useState(1);
  const [onlineStart,  setOnlineStart]  = useState(null);  // { you, n, names }
  const [onlineState,  setOnlineState]  = useState(null);  // latest 'state' message
  const [onlineEvent,  setOnlineEvent]  = useState(null);  // transient player_left/game_over
  const [onlinePrompt, setOnlinePrompt] = useState(null);  // no-response popup for me ({triesLeft,last,secondsLeft})
  const [peerIdle,     setPeerIdle]     = useState(null);  // "waiting for X" banner ({seat,secondsLeft})
  const [queueInfo,    setQueueInfo]    = useState(null);
  const [socketStatus, setSocketStatus] = useState('idle');
  const [onlineError,  setOnlineError]  = useState(null);

  // Latest screen/overlay flags for the native back-button handler (avoids stale closures).
  const navRef = useRef({});

  // Restore session on first load by validating the stored JWT
  useEffect(() => {
    (async () => {
      await hydrateToken(); // load persisted token (native secure storage / localStorage)
      if (getToken()) {
        try {
          const me = await api.getMe();
          setUser(me.username);
        } catch {
          clearToken();
        }
      }
      try { setGameConfig(await api.getConfig()); } catch {}
      setChecking(false);
    })();

    // Native shell: splash/status-bar + resume→reconnect + Android back button.
    initNativeShell({
      onResume: () => {
        const s = navRef.current.screen;
        if (s === 'online' || s === 'waiting') socket.connect();
      },
      onBack: () => {
        const n = navRef.current;
        if (n.showHistory) { n.setShowHistory(false); return true; }
        if (n.showSettings) { n.setShowSettings(false); return true; }
        if (n.screen && n.screen !== 'lobby') { n.toLobby(); return true; }
        return false; // on the lobby → let the OS exit the app
      },
    });
  }, []);

  const refreshStats = async () => {
    try { setStats(await fetchStats(gameConfig.recent_games_limit)); } catch {}
  };

  // Subscribe to online socket messages once logged in. App owns these so the
  // 'start' message (which navigates to the board) is never missed during a
  // screen transition, and the latest 'state' is always captured.
  useEffect(() => {
    if (!user) return;
    const offs = [
      socket.onStatus(setSocketStatus),
      socket.on('queue', m => setQueueInfo(m)),
      socket.on('start', m => {
        setOnlineStart(m); setOnlineState(null); setOnlineEvent(null);
        setOnlinePrompt(null); setPeerIdle(null); setOnlineError(null);
        setScreen('online');
      }),
      socket.on('state', m => setOnlineState(m)),
      socket.on('prompt', m => setOnlinePrompt(m.active ? m : null)),
      socket.on('peer_idle', m => setPeerIdle(m.active ? m : null)),
      socket.on('player_left', m => setOnlineEvent({ kind: 'player_left', ...m })),
      socket.on('game_over', m => { setOnlineEvent({ kind: 'game_over', ...m }); setOnlinePrompt(null); setPeerIdle(null); refreshStats(); }),
      socket.on('error', m => setOnlineError(m.msg || 'connection error')),
    ];
    return () => offs.forEach(off => off());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handlePlayOnline = opponents => {
    setOnlineOpps(opponents);
    setQueueInfo({ joined: 0, needed: opponents + 1 });
    setOnlineError(null);
    socket.connect();
    socket.send('join_queue', { opponents });
    setScreen('waiting');
  };

  const exitOnline = (notifyServer = true) => {
    if (notifyServer) { try { socket.send('leave'); } catch {} }
    socket.disconnect();
    setOnlineStart(null); setOnlineState(null); setOnlineEvent(null);
    setOnlinePrompt(null); setPeerIdle(null); setQueueInfo(null); setOnlineError(null);
    setScreen('lobby');
    refreshStats();
  };

  // Keep the native back-button handler pointed at the latest nav state.
  useEffect(() => {
    navRef.current = {
      screen, showSettings, showHistory, setShowSettings, setShowHistory,
      toLobby: () => { (screen === 'online' || screen === 'waiting') ? exitOnline(true) : setScreen('lobby'); },
    };
  });

  const handleLogin = u => { setUser(u); setScreen('lobby'); };

  const handleLogout = async () => {
    try { await api.logout(); } catch {}
    socket.disconnect();
    clearToken();
    setUser(null); setStats(null); setShowSettings(false); setScreen('lobby');
  };

  const handleDelete = async () => {
    await api.deleteAccount();
    socket.disconnect();
    clearToken();
    setUser(null); setStats(null); setShowSettings(false); setScreen('lobby');
  };

  const handleGameEnd = async result => {
    try {
      await api.recordGame({ ...result, mode: gameOptions.useAI ? 'vs AI' : 'vs bots' });
      await refreshStats();
    } catch {}
  };

  const openSettings = () => { refreshStats(); setShowSettings(true); };

  const startGame = (opponents, useAI) => {
    setGameOptions({ opponents, useAI });
    setScreen('game');
  };

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a2e1c', color: '#4ade80', fontFamily: 'Georgia,serif', fontSize: 40 }}>
        ♠
      </div>
    );
  }

  if (!user) return <AuthScreen onLogin={handleLogin} />;

  return (
    <>
      {screen === 'lobby' && (
        <Lobby
          username={user}
          onStart={startGame}
          onPlayOnline={handlePlayOnline}
          onOpenSettings={openSettings}
          minPlayers={gameConfig.min_players}
          maxPlayers={gameConfig.max_players}
        />
      )}

      {screen === 'waiting' && (
        <WaitingRoom
          opponents={onlineOpps}
          queueInfo={queueInfo}
          socketStatus={socketStatus}
          error={onlineError}
          onCancel={() => exitOnline(true)}
        />
      )}

      {screen === 'online' && (
        <OnlineGameScreen
          start={onlineStart}
          state={onlineState}
          event={onlineEvent}
          prompt={onlinePrompt}
          peerIdle={peerIdle}
          socketStatus={socketStatus}
          maxRetries={gameConfig.max_turn_retries}
          onImHere={() => socket.send('im_here')}
          onExit={() => exitOnline(true)}
        />
      )}

      {screen === 'game' && (
        <GameScreen
          key={`${gameOptions.opponents}-${gameOptions.useAI}`}
          username={user}
          nPlayers={gameOptions.opponents + 1}
          useAI={gameOptions.useAI}
          onExit={() => setScreen('lobby')}
          onOpenSettings={openSettings}
          onGameEnd={handleGameEnd}
          watchCountdownSecs={gameConfig.watch_countdown_secs}
          afkWarnSecs={gameConfig.afk_warn_secs}
          afkGraceSecs={gameConfig.afk_grace_secs}
          maxRetries={gameConfig.max_turn_retries}
        />
      )}

      {showHistory && (
        <HistoryScreen onBack={() => setShowHistory(false)} />
      )}

      {showSettings && !showHistory && (
        <SettingsPanel
          username={user}
          stats={stats}
          onClose={() => setShowSettings(false)}
          onLogout={handleLogout}
          onDelete={handleDelete}
          onOpenHistory={() => { setShowSettings(false); setShowHistory(true); }}
        />
      )}
    </>
  );
}
