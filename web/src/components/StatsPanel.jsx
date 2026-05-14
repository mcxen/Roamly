import { useEffect, useState } from 'react';
import { api } from '../api.js';

const BAND_COLORS = {
  red: '#ef4444', orange: '#f97316', yellow: '#eab308',
  green: '#22c55e', cyan: '#06b6d4', blue: '#3b82f6', purple: '#a855f7',
  '未设置': '#94a3b8'
};

export default function StatsPanel() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
  }, []);

  if (!stats) return null;

  const pct = (n) => stats.total ? Math.round((n / stats.total) * 100) : 0;

  return (
    <div className="stats-panel">
      <div className="stats-cards">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">总量</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.favorites}</div>
          <div className="stat-label">收藏</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.withOcr} <small>({pct(stats.withOcr)}%)</small></div>
          <div className="stat-label">已 OCR</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.withCoords} <small>({pct(stats.withCoords)}%)</small></div>
          <div className="stat-label">有坐标</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.withBounds} <small>({pct(stats.withBounds)}%)</small></div>
          <div className="stat-label">有范围</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.withAI} <small>({pct(stats.withAI)}%)</small></div>
          <div className="stat-label">AI 已提取</div>
        </div>
      </div>

      <div className="stats-sections">
        <div className="stats-section">
          <h4>彩虹存储分布</h4>
          <div className="stats-bars">
            {stats.storageBands.map((item) => (
              <div key={item.band} className="stats-bar-row">
                <span className="stats-bar-label">
                  <span className="stats-dot" style={{ background: BAND_COLORS[item.band] || '#94a3b8' }} />
                  {item.band}
                </span>
                <div className="stats-bar-track">
                  <div className="stats-bar-fill" style={{ width: `${pct(item.count)}%`, background: BAND_COLORS[item.band] || '#94a3b8' }} />
                </div>
                <span className="stats-bar-count">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="stats-section">
          <h4>国家 Top 10</h4>
          <div className="stats-bars">
            {stats.countries.map((item) => (
              <div key={item.name} className="stats-bar-row">
                <span className="stats-bar-label">{item.name}</span>
                <div className="stats-bar-track">
                  <div className="stats-bar-fill" style={{ width: `${pct(item.count)}%` }} />
                </div>
                <span className="stats-bar-count">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="stats-section">
          <h4>年代分布</h4>
          <div className="stats-bars">
            {stats.decades.map((item) => (
              <div key={item.decade} className="stats-bar-row">
                <span className="stats-bar-label">{item.decade}</span>
                <div className="stats-bar-track">
                  <div className="stats-bar-fill" style={{ width: `${pct(item.count)}%` }} />
                </div>
                <span className="stats-bar-count">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
