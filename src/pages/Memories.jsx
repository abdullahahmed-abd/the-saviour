import React, { useState, useEffect } from 'react';
import { Bookmark, Plus, Search, Trash2, Camera, MessageCircle, HelpCircle, Gift, FileText, Image as ImageIcon } from 'lucide-react';
import { fetchMemories, saveToMemories, deleteMemory } from '../services/memories';
import { formatRelativeTime } from '../utils/dates';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/common/Modal';
import LoadingSkeleton from '../components/common/LoadingSkeleton';

const CATEGORIES = [
  { id: 'all', label: 'All', icon: Bookmark },
  { id: 'photo', label: 'Photos', icon: Camera },
  { id: 'message', label: 'Messages', icon: MessageCircle },
  { id: 'qa', label: 'Q&As', icon: HelpCircle },
  { id: 'gift', label: 'Gifts', icon: Gift },
  { id: 'note', label: 'Notes', icon: FileText }
];

export default function Memories() {
  const { user } = useAuth();
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // New Note form states
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  useEffect(() => {
    loadMemories();
  }, [category, searchQuery]);

  const loadMemories = async () => {
    setLoading(true);
    try {
      const data = await fetchMemories({ category, searchQuery });
      setMemories(data);
    } catch (err) {
      console.warn('Error fetching memories:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteTitle.trim() || !user || submittingNote) return;

    setSubmittingNote(true);
    try {
      const added = await saveToMemories({
        userId: user.id,
        category: 'note',
        title: noteTitle.trim(),
        content: noteContent.trim()
      });
      setMemories(prev => [added, ...prev]);
      setNoteTitle('');
      setNoteContent('');
      setShowAddModal(false);
    } catch (err) {
      console.error('Failed to save memory note:', err);
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleDelete = async (memoryId) => {
    if (!window.confirm('Remove this saved item from Shared Memories?')) return;
    try {
      await deleteMemory(memoryId);
      setMemories(prev => prev.filter(m => m.id !== memoryId));
    } catch (err) {
      console.error('Failed to delete memory:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '20px', color: 'var(--text-primary)', margin: 0 }}>Shared Memories</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Treasures from our sanctuary</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary"
          style={{ padding: '8px 14px', fontSize: '13px', gap: '6px' }}
        >
          <Plus size={15} /> Add Note
        </button>
      </div>

      {/* Search Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: 'var(--bg-input)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px'
        }}
      >
        <Search size={16} color="var(--text-muted)" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search saved memories..."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: '13.5px'
          }}
        />
      </div>

      {/* Category Pills */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '4px',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none'
        }}
      >
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = category === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                background: isActive ? 'var(--accent-primary)' : 'var(--bg-surface)',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={13} />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Memory Cards Timeline */}
      {loading ? (
        <LoadingSkeleton count={4} />
      ) : memories.length === 0 ? (
        <div
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <Bookmark size={36} color="var(--border-subtle)" />
          <p style={{ fontSize: '13.5px' }}>
            {searchQuery
              ? 'No memories matched your search.'
              : 'No saved memories in this category yet. Tap the bookmark icon on any message, question, or photo to save it here!'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {memories.map((mem) => {
            const isPhoto = mem.category === 'photo';
            const isMine = mem.user_id === user?.id;

            return (
              <div key={mem.id} className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span
                      style={{
                        fontSize: '10.5px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: 'var(--accent-primary)',
                        fontWeight: 700
                      }}
                    >
                      {mem.category}
                    </span>
                    <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', marginTop: '2px' }}>
                      {mem.title}
                    </h3>
                  </div>

                  {isMine && (
                    <button
                      onClick={() => handleDelete(mem.id)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                      title="Delete Memory"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                {/* Media Image if photo memory */}
                {mem.media_url && (
                  <div
                    style={{
                      borderRadius: '12px',
                      overflow: 'hidden',
                      maxHeight: '220px',
                      backgroundColor: 'rgba(0,0,0,0.2)'
                    }}
                  >
                    <img
                      src={mem.media_url}
                      alt={mem.title}
                      style={{ width: '100%', height: 'auto', maxHeight: '220px', objectFit: 'cover', display: 'block' }}
                      loading="lazy"
                    />
                  </div>
                )}

                {/* Text Content */}
                {mem.content && (
                  <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {mem.content}
                  </p>
                )}

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span>Saved by {mem.profiles?.display_name || 'Partner'}</span>
                  <span>{formatRelativeTime(mem.created_at)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Custom Note Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add to Memories 📝">
        <form onSubmit={handleAddNote} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Memory Title
            </label>
            <input
              type="text"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="e.g. Our midnight stroll in the rain"
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
              Thoughts or Details
            </label>
            <textarea
              rows={4}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Write the little moments you never want to forget..."
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontSize: '13.5px',
                marginTop: '4px',
                outline: 'none',
                resize: 'none'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={!noteTitle.trim() || submittingNote}
            className="btn btn-primary"
            style={{ padding: '12px' }}
          >
            {submittingNote ? 'Saving...' : 'Save Memory Note'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
