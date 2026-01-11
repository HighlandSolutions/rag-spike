'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, MessageSquare, Plus, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatsPopout } from './chats-popout';

interface SidebarProps {
  currentSessionId: string | null;
  onNewChat: () => void;
  onLoadSession: (sessionId: string) => void;
  isPinned: boolean;
  onPinChange: (pinned: boolean) => void;
}

export const Sidebar = ({ currentSessionId, onNewChat, onLoadSession, isPinned, onPinChange }: SidebarProps) => {
  const [showChatsPopout, setShowChatsPopout] = useState(false);
  const pathname = usePathname();
  const isChatPage = pathname === '/' || pathname.startsWith('/chat');
  const isDocumentsPage = pathname === '/documents';
  const isProfilePage = pathname === '/profile';

  return (
    <aside className="fixed left-0 top-0 h-full w-16 bg-background border-r z-30 flex flex-col items-center py-4 gap-4">
      {/* Logo placeholder - you can replace with your actual logo */}
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
        <div className="w-4 h-4 rounded bg-primary" />
      </div>

      {/* New Chat Button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onNewChat}
        className="w-12 h-12 rounded-lg hover:bg-accent"
        aria-label="New chat"
      >
        <Plus className="h-5 w-5" />
      </Button>

      {/* Navigation Items */}
      <nav className="flex flex-col gap-3 flex-1">
        {/* Chats Icon with Popout */}
        <div className="relative flex flex-col items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={`w-12 h-12 rounded-lg transition-colors ${
              isChatPage
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : showChatsPopout || isPinned
                  ? 'bg-accent'
                  : 'hover:bg-accent'
            }`}
            aria-label="Chats"
            aria-expanded={showChatsPopout || isPinned}
            onClick={() => {
              if (showChatsPopout) {
                setShowChatsPopout(false);
                onPinChange(false);
              } else {
                setShowChatsPopout(true);
              }
            }}
          >
            <MessageSquare className="h-5 w-5" />
          </Button>
          <span
            className={`text-[10px] leading-tight transition-colors ${
              isChatPage ? 'text-primary font-medium' : 'text-muted-foreground'
            }`}
          >
            Chat
          </span>
          {(showChatsPopout || isPinned) && (
            <ChatsPopout
              currentSessionId={currentSessionId}
              onLoadSession={onLoadSession}
              isPinned={isPinned}
              onPinToggle={(pinned) => {
                onPinChange(pinned);
                if (pinned) {
                  setShowChatsPopout(true);
                }
              }}
              onClose={() => {
                setShowChatsPopout(false);
                onPinChange(false);
              }}
            />
          )}
        </div>

        {/* Documents Link */}
        <Link
          href="/documents"
          className={`flex flex-col items-center gap-1 transition-colors ${
            isDocumentsPage
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-label="Sources"
          aria-current={isDocumentsPage ? 'page' : undefined}
        >
          <div
            className={`flex items-center justify-center w-12 h-12 rounded-lg transition-colors ${
              isDocumentsPage
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'hover:bg-accent'
            }`}
          >
            <FileText className="h-5 w-5" />
          </div>
          <span
            className={`text-[10px] leading-tight transition-colors ${
              isDocumentsPage ? 'text-primary font-medium' : 'text-muted-foreground'
            }`}
          >
            Sources
          </span>
        </Link>

        {/* Profile Link */}
        <Link
          href="/profile"
          className={`flex flex-col items-center gap-1 transition-colors ${
            isProfilePage
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-label="Profile"
          aria-current={isProfilePage ? 'page' : undefined}
        >
          <div
            className={`flex items-center justify-center w-12 h-12 rounded-lg transition-colors ${
              isProfilePage
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'hover:bg-accent'
            }`}
          >
            <User className="h-5 w-5" />
          </div>
          <span
            className={`text-[10px] leading-tight transition-colors ${
              isProfilePage ? 'text-primary font-medium' : 'text-muted-foreground'
            }`}
          >
            Profile
          </span>
        </Link>
      </nav>
    </aside>
  );
};

