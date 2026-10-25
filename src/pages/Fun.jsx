import React, { useState } from 'react';
import DailyQuestionCard from '../components/fun/DailyQuestionCard';
import MysteryCardModal from '../components/fun/MysteryCardModal';
import WhoKnowsWhom from '../components/fun/WhoKnowsWhom';
import ThisOrThat from '../components/fun/ThisOrThat';
import GuessAnswer from '../components/fun/GuessAnswer';
import EmojiRiddle from '../components/fun/EmojiRiddle';
import TruthOrDare from '../components/fun/TruthOrDare';
import { Sparkles, Brain, Shuffle, HelpCircle, Smile, Flame, Gamepad2 } from 'lucide-react';

const GAMES_LIST = [
  {
    id: 'who_knows_whom',
    title: 'Who Knows Whom Better?',
    description: 'Test your deep knowledge of each other’s habits and quirks.',
    icon: Brain,
    color: '#8b5cf6',
    badge: 'Popular'
  },
  {
    id: 'this_or_that',
    title: 'This or That',
    description: 'Rapid-fire preference choices to discover your vibe match.',
    icon: Shuffle,
    color: '#ec4899',
    badge: 'Quick'
  },
  {
    id: 'guess_answer',
    title: 'Guess My Answer',
    description: 'Lock a secret answer and let your partner guess.',
    icon: HelpCircle,
    color: '#38bdf8',
    badge: 'Interactive'
  },
  {
    id: 'emoji_riddle',
    title: 'Emoji Guessing',
    description: 'Crack movie and song riddles composed entirely of emojis.',
    icon: Smile,
    color: '#f59e0b',
    badge: 'Fun'
  },
  {
    id: 'truth_or_dare',
    title: 'Truth or Silly Dare',
    description: 'Playful questions and lighthearted dares made for two.',
    icon: Sparkles,
    color: '#10b981',
    badge: 'Spicy'
  }
];

export default function Fun() {
  const [activeGameId, setActiveGameId] = useState(null);
  const [showMysteryModal, setShowMysteryModal] = useState(false);

  // If a game is active, render its component
  if (activeGameId === 'who_knows_whom') {
    return (
      <div style={{ padding: '16px' }}>
        <WhoKnowsWhom onBack={() => setActiveGameId(null)} />
      </div>
    );
  }

  if (activeGameId === 'this_or_that') {
    return (
      <div style={{ padding: '16px' }}>
        <ThisOrThat onBack={() => setActiveGameId(null)} />
      </div>
    );
  }

  if (activeGameId === 'guess_answer') {
    return (
      <div style={{ padding: '16px' }}>
        <GuessAnswer onBack={() => setActiveGameId(null)} />
      </div>
    );
  }

  if (activeGameId === 'emoji_riddle') {
    return (
      <div style={{ padding: '16px' }}>
        <EmojiRiddle onBack={() => setActiveGameId(null)} />
      </div>
    );
  }

  if (activeGameId === 'truth_or_dare') {
    return (
      <div style={{ padding: '16px' }}>
        <TruthOrDare onBack={() => setActiveGameId(null)} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '16px' }}>
      {/* Daily Question of the Day */}
      <DailyQuestionCard />

      {/* Daily Mystery Card Banner */}
      <div
        onClick={() => setShowMysteryModal(true)}
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(236, 72, 153, 0.15) 100%)',
          border: '1px solid rgba(168, 85, 247, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          padding: '16px 18px',
          boxShadow: 'var(--shadow-glow)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'var(--accent-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}
          >
            <Sparkles size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '15.5px', color: 'var(--text-primary)', margin: 0 }}>
              Daily Mystery Card
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Tap to flip today’s surprise prompt or joke
            </p>
          </div>
        </div>
        <span className="badge badge-purple">Open</span>
      </div>

      {/* Mini-Games Section Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Gamepad2 size={18} color="var(--accent-primary)" />
          <h2 style={{ fontSize: '17px', color: 'var(--text-primary)', margin: 0 }}>
            Sanctuary Mini-Games
          </h2>
        </div>

        {/* Games Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {GAMES_LIST.map((game) => {
            const Icon = game.icon;

            return (
              <div
                key={game.id}
                onClick={() => setActiveGameId(game.id)}
                className="card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '12px',
                      backgroundColor: `${game.color}20`,
                      border: `1px solid ${game.color}40`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: game.color
                    }}
                  >
                    <Icon size={22} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {game.title}
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '1px 6px',
                          borderRadius: '10px',
                          backgroundColor: `${game.color}15`,
                          color: game.color,
                          fontWeight: 700
                        }}
                      >
                        {game.badge}
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {game.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mystery Card Modal */}
      <MysteryCardModal
        isOpen={showMysteryModal}
        onClose={() => setShowMysteryModal(false)}
      />
    </div>
  );
}
