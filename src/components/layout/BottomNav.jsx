import React from 'react';
import { MessageCircle, Gamepad2, BarChart3, Bookmark, Settings } from 'lucide-react';

const TABS = [
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'fun', label: 'Fun', icon: Gamepad2 },
  { id: 'statistics', label: 'Statistics', icon: BarChart3 },
  { id: 'memories', label: 'Memories', icon: Bookmark },
  { id: 'settings', label: 'Settings', icon: Settings }
];

export default function BottomNav({ activeTab, onSelectTab }) {
  return (
    <nav className="bottom-nav">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`nav-item ${isActive ? 'active' : ''}`}
            aria-label={tab.label}
          >
            <div className="nav-icon-wrapper">
              <Icon size={20} strokeWidth={isActive ? 2.3 : 1.8} />
            </div>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
