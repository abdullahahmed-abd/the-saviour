import React, { useState, useEffect } from 'react';
import {
  MessageCircle,
  Flame,
  Camera,
  Heart,
  Calendar,
  Clock,
  Sparkles,
  Trophy,
  Award,
  ChevronRight,
  Info
} from 'lucide-react';
import { getSanctuaryStatistics, calculateAchievements } from '../services/stats';
import DonutChart from '../components/stats/DonutChart';
import ActivityChart from '../components/stats/ActivityChart';
import ChatWrapped from './ChatWrapped';
import { useAuth } from '../context/AuthContext';
import LoadingSkeleton from '../components/common/LoadingSkeleton';

export default function Statistics() {
  const { user, profile, partnerProfile } = useAuth();
  const [timeframe, setTimeframe] = useState('all'); // 'all' | 'month' | 'week'
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showWrapped, setShowWrapped] = useState(false);

  useEffect(() => {
    loadStats();
  }, [timeframe]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await getSanctuaryStatistics(timeframe);
      setStats(data);
    } catch (err) {
      console.warn('Error loading statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  const user1Count = stats?.userMessageCounts?.[user?.id] || 0;
  const partnerId = partnerProfile?.id;
  const user2Count = partnerId ? (stats?.userMessageCounts?.[partnerId] || 0) : (stats?.totalMessages - user1Count || 0);

  const achievements = stats ? calculateAchievements(stats) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
      {/* Header & Filter Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '20px', color: 'var(--text-primary)', margin: 0 }}>Sanctuary Insights</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Backed by real records</p>
        </div>

        {/* Timeframe pill filter */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--bg-input)',
            borderRadius: 'var(--radius-full)',
            padding: '3px',
            border: '1px solid var(--border-subtle)'
          }}
        >
          {['all', 'month', 'week'].map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                background: timeframe === tf ? 'var(--accent-primary)' : 'transparent',
                color: timeframe === tf ? '#ffffff' : 'var(--text-muted)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {tf === 'all' ? 'All' : tf === 'month' ? '30d' : '7d'}
            </button>
          ))}
        </div>
      </div>

      {loading || !stats ? (
        <LoadingSkeleton count={4} />
      ) : (
        <>
          {/* Chat Wrapped Celebration Banner */}
          <div
            onClick={() => setShowWrapped(true)}
            className="card"
            style={{
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(236, 72, 153, 0.2) 100%)',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              padding: '14px 18px',
              boxShadow: 'var(--shadow-glow)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Sparkles size={24} color="#ec4899" />
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  View Chat Wrapped
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                  Your celebratory recap card
                </div>
              </div>
            </div>
            <ChevronRight size={18} color="var(--accent-primary)" />
          </div>

          {/* Quick Metrics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            {/* Total Messages */}
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-primary)', fontSize: '12px', fontWeight: 600 }}>
                <MessageCircle size={15} /> Messages
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                {stats.totalMessages}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Across {stats.activeDays} active days
              </div>
            </div>

            {/* Streak */}
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontSize: '12px', fontWeight: 600 }}>
                <Flame size={15} /> Streak
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                {stats.currentStreak} <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>days</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Record: {stats.longestStreak} days
              </div>
            </div>

            {/* Photos Exchanged */}
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-cyan)', fontSize: '12px', fontWeight: 600 }}>
                <Camera size={15} /> Photos
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                {stats.photosCount}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Private uploads</div>
            </div>

            {/* Reactions */}
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-warm)', fontSize: '12px', fontWeight: 600 }}>
                <Heart size={15} /> Reactions
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                {stats.reactionsCount}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Emoji sparks</div>
            </div>
          </div>

          {/* Message Share Donut Card */}
          <div className="card">
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Message Participation Split
            </div>
            <DonutChart
              user1Count={user1Count}
              user2Count={user2Count}
              user1Name={profile?.display_name || 'You'}
              user2Name={partnerProfile?.display_name || 'Partner'}
            />
          </div>

          {/* Hourly Activity Bar Chart */}
          <div className="card">
            <ActivityChart data={stats.hourlyChartData} title="When We Talk Most (Hourly Heatmap)" />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)' }}>
                <Clock size={14} color="var(--accent-primary)" />
                Busiest Hour: <strong>{stats.busiestHour}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)' }}>
                <Calendar size={14} color="var(--accent-cyan)" />
                Top Day: <strong>{stats.busiestDay}</strong>
              </div>
            </div>
          </div>

          {/* Streaks & Milestones / Achievements */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Trophy size={18} color="#eab308" />
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Sanctuary Milestones
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {achievements.map((ach) => (
                <div
                  key={ach.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: ach.unlocked ? 'rgba(139, 92, 246, 0.1)' : 'var(--bg-input)',
                    border: `1px solid ${ach.unlocked ? 'rgba(139, 92, 246, 0.3)' : 'var(--border-subtle)'}`
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: ach.unlocked ? 'var(--accent-glow)' : 'rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: ach.unlocked ? 'var(--accent-primary)' : 'var(--text-muted)'
                      }}
                    >
                      <Award size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: ach.unlocked ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {ach.title}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {ach.description}
                      </div>
                    </div>
                  </div>

                  <span className={ach.unlocked ? 'badge badge-green' : 'badge'} style={{ fontSize: '10.5px' }}>
                    {ach.unlocked ? 'Unlocked' : `${ach.progress}/${ach.max}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Privacy & Relationship Health Note */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              fontSize: '11.5px',
              color: 'var(--text-muted)',
              lineHeight: 1.45
            }}
          >
            <Info size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>
              <strong>Note on connection:</strong> Message count is simply a fun milestone, not a measure of relationship depth, quality, or love. Enjoy every shared moment at your own natural pace.
            </span>
          </div>
        </>
      )}

      {/* Chat Wrapped Modal */}
      {stats && (
        <ChatWrapped
          isOpen={showWrapped}
          onClose={() => setShowWrapped(false)}
          stats={stats}
        />
      )}
    </div>
  );
}
