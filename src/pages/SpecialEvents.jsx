import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, Clock, Sparkles } from 'lucide-react';
import { fetchSpecialEvents, addSpecialEvent, deleteSpecialEvent } from '../services/events';
import { calculateTimeRemaining } from '../utils/dates';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/common/Modal';

export default function SpecialEvents({ isOpen, onClose }) {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [category, setCategory] = useState('anniversary');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadEvents();
    }
  }, [isOpen]);

  const loadEvents = async () => {
    try {
      const data = await fetchSpecialEvents();
      setEvents(data);
    } catch (err) {
      console.warn('Error loading events:', err);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title.trim() || !eventDate || submitting || !user) return;

    setSubmitting(true);
    try {
      const created = await addSpecialEvent({
        userId: user.id,
        title: title.trim(),
        eventDate,
        category,
        notes
      });
      setEvents(prev => [...prev, created]);
      setTitle('');
      setEventDate('');
      setNotes('');
      setShowAddModal(false);
    } catch (err) {
      console.error('Failed to create special event:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteSpecialEvent(id);
      setEvents(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      console.error('Failed to delete event:', err);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Special-Day Countdowns ⏳">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary"
          style={{ width: '100%', padding: '10px', fontSize: '13px', gap: '6px' }}
        >
          <Plus size={15} /> Add New Countdown Date
        </button>

        {events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '13px' }}>
            No countdowns added yet. Add an anniversary, upcoming trip, or birthday!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '380px', overflowY: 'auto' }}>
            {events.map((ev) => {
              const remaining = calculateTimeRemaining(ev.event_date);
              const isMine = ev.created_by === user?.id;

              return (
                <div
                  key={ev.id}
                  style={{
                    padding: '14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span
                        style={{
                          fontSize: '10px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          fontWeight: 700,
                          color: 'var(--accent-primary)'
                        }}
                      >
                        {ev.category}
                      </span>
                      <h4 style={{ fontSize: '15px', color: 'var(--text-primary)', margin: '2px 0 0 0' }}>
                        {ev.title}
                      </h4>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        {new Date(ev.event_date).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>

                    {isMine && (
                      <button
                        onClick={() => handleDelete(ev.id)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>

                  {/* Countdown Timer Display */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      background: 'rgba(139, 92, 246, 0.1)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      alignItems: 'center',
                      justifyContent: 'space-around',
                      border: '1px solid rgba(139, 92, 246, 0.2)'
                    }}
                  >
                    {remaining.isPast ? (
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#10b981' }}>
                        🎉 Event arrived! Celebrate this moment.
                      </span>
                    ) : (
                      <>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{remaining.days}</span>
                          <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block' }}>DAYS</span>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{remaining.hours}</span>
                          <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block' }}>HOURS</span>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{remaining.minutes}</span>
                          <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block' }}>MINS</span>
                        </div>
                      </>
                    )}
                  </div>

                  {ev.notes && (
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                      {ev.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Event Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="New Countdown Event 📅">
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Event Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Next Flight to Paris, or Anniversary"
              required
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                marginTop: '4px',
                outline: 'none'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Date
            </label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              required
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                marginTop: '4px',
                outline: 'none'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                marginTop: '4px',
                outline: 'none'
              }}
            >
              <option value="anniversary">Anniversary</option>
              <option value="birthday">Birthday</option>
              <option value="trip">Trip / Vacation</option>
              <option value="special">Special Milestone</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Flight 204 departs at 7 AM..."
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontSize: '13px',
                marginTop: '4px',
                outline: 'none',
                resize: 'none'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={!title.trim() || !eventDate || submitting}
            className="btn btn-primary"
            style={{ padding: '12px' }}
          >
            {submitting ? 'Creating Countdown...' : 'Start Countdown'}
          </button>
        </form>
      </Modal>
    </Modal>
  );
}
