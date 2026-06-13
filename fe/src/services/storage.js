// Async wrapper around localStorage so callers don't need to change if
// we later swap to IndexedDB or a remote API.

const storage = {
  async get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  async set(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) {
      console.error('storage.set failed', e);
      return false;
    }
  },
  async del(key) {
    try { localStorage.removeItem(key); } catch {}
  },
};

// Trivial obfuscation — NOT real security (backend hashes with bcrypt server-side)
const hashPin = pin => btoa(String(pin).split('').reverse().join('') + '·ace');

export async function loadAccounts() {
  return storage.get('accounts', {});
}

export async function saveAccounts(accounts) {
  return storage.set('accounts', accounts);
}

export async function getSession() {
  return storage.get('session', null);
}

export async function saveSession(username) {
  return storage.set('session', { username });
}

export async function clearSession() {
  return storage.del('session');
}

export async function loadStats(username) {
  return storage.get(`stats:${username}`, {
    played: 0, wins: 0, losses: 0, streak: 0, bestStreak: 0, history: [],
  });
}

export async function recordGame(username, { won, placement, opponents }) {
  const stats = await loadStats(username);
  stats.played += 1;
  if (won) {
    stats.wins += 1;
    stats.streak += 1;
    stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
  } else {
    stats.losses += 1;
    stats.streak = 0;
  }
  stats.history.unshift({ at: Date.now(), won, placement, opponents, mode: 'vs AI' });
  stats.history = stats.history.slice(0, 50);
  await storage.set(`stats:${username}`, stats);
  return stats;
}

export async function deleteAccount(username) {
  const accounts = await loadAccounts();
  delete accounts[username];
  await saveAccounts(accounts);
  await storage.del(`stats:${username}`);
  await clearSession();
}

export { hashPin };
