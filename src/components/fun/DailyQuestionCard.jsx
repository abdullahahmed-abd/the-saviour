import React, { useState, useEffect } from 'react';
import { HelpCircle, Send, Eye, EyeOff, CheckCircle2, ChevronRight, Bookmark } from 'lucide-react';
import { getTodayQuestion, getQuestionAnswers, submitDailyAnswer, getPastQuestions } from '../../services/questions';
import { saveToMemories } from '../../services/memories';
import { useAuth } from '../../context/AuthContext';

export default function DailyQuestionCard() {
  const { user } = useAuth();
  const [question, setQuestion] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [myAnswer, setMyAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [forceReveal, setForceReveal] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [pastQuestions, setPastQuestions] = useState([]);
  const [savedMemory, setSavedMemory] = useState(false);

  useEffect(() => {
    loadToday();
  }, []);

  const loadToday = async () => {
    try {
      const q = await getTodayQuestion();
      setQuestion(q);
      if (q) {
        const ans = await getQuestionAnswers(q.id);
        setAnswers(ans);
        const mine = ans.find(a => a.user_id === user?.id);
        if (mine) setMyAnswer(mine.answer);
      }
    } catch (err) {
      console.warn('Error loading daily question:', err);
    }
  };

  const handleAnswerSubmit = async () => {
    if (!myAnswer.trim() || !question || !user || submitting) return;
    setSubmitting(true);
    try {
      const saved = await submitDailyAnswer(question.id, user.id, myAnswer);
      setAnswers(prev => {
        const others = prev.filter(a => a.user_id !== user.id);
        return [...others, saved];
      });
    } catch (err) {
      console.error('Failed to submit daily answer:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveToMemories = async () => {
    if (!question || answers.length === 0) return;
    try {
      const content = answers.map(a => `${a.profiles?.display_name || 'User'}: "${a.answer}"`).join('\n\n');
      await saveToMemories({
        userId: user.id,
        category: 'qa',
        title: `Daily Question: ${question.question}`,
        content,
        metadata: { question_id: question.id }
      });
      setSavedMemory(true);
      setTimeout(() => setSavedMemory(false), 2000);
    } catch (e) {
      console.error('Error saving QA memory:', e);
    }
  };

  const handleTogglePast = async () => {
    if (!showPast) {
      const past = await getPastQuestions();
      setPastQuestions(past);
    }
    setShowPast(!showPast);
  };

  const hasMyAnswer = answers.some(a => a.user_id === user?.id);
  const bothAnswered = answers.length >= 2;
  const canSeeAnswers = bothAnswered || forceReveal;

  if (!question) return null;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Question Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(139, 92, 246, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)'
            }}
          >
            <HelpCircle size={18} />
          </div>
          <div>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-primary)', fontWeight: 600 }}>
              Question of the Day
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
              #{question.order_index || 1}
            </span>
          </div>
        </div>

        {/* Both answered checkmark */}
        {bothAnswered && (
          <span className="badge badge-green">
            <CheckCircle2 size={12} />
            Both Answered
          </span>
        )}
      </div>

      {/* Question Text */}
      <h3 style={{ fontSize: '16px', lineHeight: 1.4, color: 'var(--text-primary)' }}>
        "{question.question}"
      </h3>

      {/* Answer Submission Input */}
      {!hasMyAnswer ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <textarea
            rows={2}
            value={myAnswer}
            onChange={(e) => setMyAnswer(e.target.value)}
            placeholder="Write your honest answer..."
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
          <button
            onClick={handleAnswerSubmit}
            disabled={!myAnswer.trim() || submitting}
            className="btn btn-primary"
            style={{ alignSelf: 'flex-end', padding: '8px 16px', fontSize: '13px' }}
          >
            <Send size={14} />
            {submitting ? 'Submitting...' : 'Submit Answer'}
          </button>
        </div>
      ) : (
        /* Answers Revealed / Waiting state */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {!bothAnswered && !forceReveal ? (
            <div
              style={{
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px dashed var(--border-subtle)',
                textAlign: 'center',
                fontSize: '12.5px',
                color: 'var(--text-secondary)'
              }}
            >
              🔒 You answered! Partner's answer is hidden until they submit theirs.
              <div style={{ marginTop: '6px' }}>
                <button
                  onClick={() => setForceReveal(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-cyan)',
                    fontSize: '11.5px',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Peek anyway
                </button>
              </div>
            </div>
          ) : (
            /* Show Answers */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {answers.map((ans) => {
                const isMine = ans.user_id === user?.id;
                return (
                  <div
                    key={ans.id}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: isMine ? 'rgba(139, 92, 246, 0.12)' : 'var(--bg-input)',
                      border: `1px solid ${isMine ? 'rgba(139, 92, 246, 0.25)' : 'var(--border-subtle)'}`
                    }}
                  >
                    <div style={{ fontSize: '11.5px', fontWeight: 600, color: isMine ? 'var(--accent-primary)' : 'var(--accent-cyan)' }}>
                      {ans.profiles?.display_name || (isMine ? 'You' : 'Partner')}
                    </div>
                    <div style={{ fontSize: '13.5px', marginTop: '2px', color: 'var(--text-primary)' }}>
                      "{ans.answer}"
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Save to Memories button */}
          {canSeeAnswers && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                onClick={handleSaveToMemories}
                className="btn btn-ghost"
                style={{ fontSize: '12px', padding: '6px 10px', gap: '5px' }}
              >
                <Bookmark size={13} color={savedMemory ? 'var(--accent-cyan)' : 'currentColor'} />
                {savedMemory ? 'Saved to Memories!' : 'Save QA to Memories'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Past Questions Accordion Toggle */}
      <button
        onClick={handleTogglePast}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          fontSize: '12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 0'
        }}
      >
        <ChevronRight size={14} style={{ transform: showPast ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
        {showPast ? 'Hide Past Questions' : 'View Past Answered Questions'}
      </button>

      {/* Past Questions List */}
      {showPast && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
          {pastQuestions.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px' }}>
              No past questions found yet.
            </div>
          ) : (
            pastQuestions.map(pq => (
              <div
                key={pq.id}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '12px'
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{pq.question}</div>
                <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {pq.daily_answers?.map(a => `${a.profiles?.display_name || 'User'}: "${a.answer}"`).join(' | ')}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
