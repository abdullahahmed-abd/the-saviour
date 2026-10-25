import React, { useState, useEffect } from 'react';
import { Trash2, History } from 'lucide-react';
import Modal from '../common/Modal';
import { MOOD_OPTIONS, setMood, getMoodHistory, deleteMood } from '../../services/moods';
import { useAuth } from '../../context/AuthContext';
import { formatRelativeTime } from '../../utils/dates';

export default function MoodModal({ isOpen, onClose, onMoodUpdated }) {
  const { user } = useAuth();
  const [selectedMood, setSelectedMood] = useState(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('checkin'); // 'checkin' | 'history'

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = async () => {
    try {
      const data = await getMoodHistory(20);
      setHistory(data);
    } catch (err) {
      console.warn('Failed to load mood history:', err);
    }
  };

  const handleSave = async () => {
    if (!selectedMood || !user || submitting) return;
    setSubmitting(true);
    try {
      await setMood(user.id, selectedMood.id, note);
      setSelectedMood(null);
      setNote('');
      if (onMoodUpdated) onMoodUpdated();
      onClose();
    } catch (err) {
      console.error('Failed to submit mood:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEntry = async (id) => {
    try {
      await deleteMood(id);
      setHistory(prev => prev.filter(m => m.id !== id));
      if (onMoodUpdated) onMoodUpdated();
    } catch (err) {
      console.error('Failed to delete mood:', err);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mood Sanctuary 💫">
      {/* Sub Tabs */}
      <div
        style={{
          display: 'flex',
          backgroundColor: 'var(--bg-input)',
          borderRadius: 'var(--radius-md)',
          padding: '4px',
          marginBottom: '16px'
        }}
      >
        <button
          onClick={() => setActiveTab('checkin')}
          style={{
            flex: 1,
            padding: '8px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: activeTab === 'checkin' ? 'var(--bg-surface)' : 'transparent',
            color: activeTab === 'checkin' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          Check In
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            flex: 1,
            padding: '8px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: activeTab === 'history' ? 'var(--bg-surface)' : 'transparent',
            color: activeTab === 'history' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <History size={14} />
          History
        </button>
      </div>

      {activeTab === 'checkin' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Mood Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
            {MOOD_OPTIONS.map((mood) => {
              const isSelected = selectedMood?.id === mood.id;
              return (
                <button
                  key={mood.id}
                  onClick={() => setSelectedMood(mood)}
                  style={{
                    background: isSelected ? 'var(--accent-glow)' : 'var(--bg-input)',
                    border: `1.5px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 4px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ fontSize: '24px' }}>{mood.emoji}</span>
                  <span style={{ fontSize: '11px', fontWeight: 600 }}>{mood.label}</span>
                </button>
              );
            })}
          </div>

          {/* Selected mood label */}
          {selectedMood && (
            <div style={{ textAlign: 'center', fontSize: '12.5px', color: 'var(--accent-cyan)' }}>
              {selectedMood.desc}
            </div>
          )}

          {/* Optional Note */}
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a small note (e.g. Tough meeting, or counting down to our call)..."
            style={{
              width: '100%',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
              color: 'var(--text-primary)',
              fontSize: '13.5px',
              outline: 'none',
              resize: 'none'
            }}
          />

          {/* Submit */}
          <button
            onClick={handleSave}
            disabled={!selectedMood || submitting}
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px' }}
          >
            {submitting ? 'Sharing with Partner...' : 'Share My Mood'}
          </button>
        </div>
      ) : (
        /* Mood History View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto' }}>
          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>
              No recorded moods yet. Check in above!
            </div>
          ) : (
            history.map((item) => {
              const moodDef = MOOD_OPTIONS.find(m => m.id === item.mood) || { emoji: '💫', label: item.mood };
              const isOwn = item.user_id === user?.id;

              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '22px' }}>{moodDef.emoji}</span>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {item.profiles?.display_name || (isOwn ? 'You' : 'Partner')} • {moodDef.label}
                      </div>
                      {item.note && (
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          "{item.note}"
                        </div>
                      )}
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                        {formatRelativeTime(item.created_at)}
                      </div>
                    </div>
                  </div>

                  {isOwn && (
                    <button
                      onClick={() => handleDeleteEntry(item.id)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '6px' }}
                      title="Delete Entry"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </Modal>
  );
}
