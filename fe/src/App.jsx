import { useState, useEffect } from 'react';
import { api, clearToken, getToken } from './services/api';
import AuthScreen from './screens/AuthScreen';
import Lobby from './screens/Lobby';
import GameScreen from './screens/GameScreen';
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
  const [gameConfig, setGameConfig] = useState({ watch_countdown_secs: 10, afk_warn_secs: 20, afk_grace_secs: 10, recent_games_limit: 10 });
  const [screen, setScreen] = useState('lobby');   // 'lobby' | 'game'
  const [gameOptions, setGameOptions] = useState({ opponents: 3, useAI: true });
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory,  setShowHistory]  = useState(false);

  // Restore session on first load by validating the stored JWT
  useEffect(() => {
    (async () => {
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
  }, []);

  const refreshStats = async () => {
    try { setStats(await fetchStats(gameConfig.recent_games_limit)); } catch {}
  };

  const handleLogin = u => { setUser(u); setScreen('lobby'); };

  const handleLogout = async () => {
    try { await api.logout(); } catch {}
    clearToken();
    setUser(null); setStats(null); setShowSettings(false); setScreen('lobby');
  };

  const handleDelete = async () => {
    await api.deleteAccount();
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
      {screen === 'lobby' ? (
        <Lobby username={user} onStart={startGame} onOpenSettings={openSettings} />
      ) : (
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
