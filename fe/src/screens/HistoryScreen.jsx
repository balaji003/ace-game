import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { timeAgo } from '../utils/time';

const PAGE_SIZE = 20;

export default function HistoryScreen({ onBack }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const offsetRef  = useRef(0);
  const sentinelRef = useRef(null);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const data = await api.getHistory(PAGE_SIZE, offsetRef.current);
      setItems(prev => [
        ...prev,
        ...data.map(g => ({
          at:        new Date(g.played_at).getTime(),
          won:       g.won,
          placement: g.placement,
          mode:      g.mode,
          opponents: g.opponents,
        })),
      ]);
      offsetRef.current += data.length;
      if (data.length < PAGE_SIZE) {
        hasMoreRef.current = false;
        setHasMore(false);
      }
    } catch {}
    loadingRef.current = false;
    setLoading(false);
  }, []);

  useEffect(() => { loadMore(); }, [loadMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) loadMore();
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1500, overflowY: 'auto',
      background: 'radial-gradient(ellipse at 50% 30%,#0f3d28,#061a10)',
      fontFamily: 'Georgia,serif', color: '#fff',
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: '#0a2e1cee', backdropFilter: 'blur(6px)',
        borderBottom: '1px solid #16653466',
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'transparent', border: '1px solid #4ade8066', color: '#4ade80',
            borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
            fontSize: 13, fontFamily: 'Georgia,serif',
          }}
        >← Back</button>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#4ade80', letterSpacing: 1 }}>
          Game History
        </span>
      </div>

      {/* List */}
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.length === 0 && !loading && (
          <div style={{ color: '#86efac66', fontSize: 13, textAlign: 'center', marginTop: 60 }}>
            No games played yet.
          </div>
        )}

        {items.map((h, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: '#06281a', border: '1px solid #16653433', borderRadius: 10,
            padding: '10px 14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>{h.won ? '🏆' : '💀'}</span>
              <div>
                <div style={{ fontSize: 13, color: h.won ? '#4ade80' : '#fca5a5', fontWeight: 700 }}>
                  {h.won ? 'Won' : 'Lost'}
                  {h.placement ? (
                    <span style={{ color: '#86efac88', fontWeight: 400 }}> · #{h.placement}</span>
                  ) : null}
                  <span style={{ color: '#86efac88', fontWeight: 400 }}> · {h.mode}</span>
                </div>
                <div style={{ fontSize: 11, color: '#86efac77', marginTop: 2 }}>
                  vs {h.opponents?.join(', ')}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#86efac77', flexShrink: 0, marginLeft: 8 }}>
              {timeAgo(h.at)}
            </div>
          </div>
        ))}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} style={{ height: 1 }} />

        {loading && (
          <div style={{ textAlign: 'center', color: '#4ade8066', fontSize: 12, padding: '12px 0' }}>
            Loading…
          </div>
        )}
        {!hasMore && items.length > 0 && (
          <div style={{ textAlign: 'center', color: '#86efac44', fontSize: 11, padding: '12px 0' }}>
            — All games loaded —
          </div>
        )}
      </div>
    </div>
  );
}
