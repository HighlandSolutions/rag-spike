'use client';

import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Pin, PinOff, X, Pencil, Trash2 } from 'lucide-react';
import { listChatSessions, updateChatSession, deleteChatSession, type ChatSession } from '@/lib/chat/history';
import { ChatHistorySidebar } from './chat-history-sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ChatsPopoutProps {
  currentSessionId: string | null;
  onLoadSession: (sessionId: string) => void;
  isPinned: boolean;
  onPinToggle: (pinned: boolean) => void;
  onClose: () => void;
}

export const ChatsPopout = ({
  currentSessionId,
  onLoadSession,
  isPinned,
  onPinToggle,
  onClose,
}: ChatsPopoutProps) => {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const handlePinToggle = () => {
    onPinToggle(!isPinned);
  };

  const loadSessions = async () => {
    try {
      setIsLoading(true);
      const sessions = await listChatSessions(20, 0);
      setChatSessions(sessions);
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (editingSessionId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingSessionId]);

  const handleSessionClick = (session: ChatSession) => {
    if (selectedSessionId === session.id) {
      setSelectedSessionId(null);
      setSelectedSession(null);
    } else {
      setSelectedSessionId(session.id);
      setSelectedSession(session);
    }
    onLoadSession(session.id);
  };

  const getSessionTitle = (session: ChatSession): string => {
    if (session.title) {
      // Truncate long titles to keep UI clean
      return session.title.length > 50 ? `${session.title.slice(0, 50)}...` : session.title;
    }
    return 'Untitled Chat';
  };

  const handleStartRename = (session: ChatSession, event: React.MouseEvent) => {
    event.stopPropagation();
    setEditingSessionId(session.id);
    setEditingTitle(session.title || '');
  };

  const handleCancelRename = () => {
    setEditingSessionId(null);
    setEditingTitle('');
  };

  const handleSaveRename = async (sessionId: string) => {
    try {
      const trimmedTitle = editingTitle.trim();
      await updateChatSession(sessionId, { title: trimmedTitle || undefined });
      setEditingSessionId(null);
      setEditingTitle('');
      await loadSessions();
      if (currentSessionId === sessionId) {
        onLoadSession(sessionId);
      }
    } catch (error) {
      console.error('Failed to rename chat session:', error);
    }
  };

  const handleRenameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, sessionId: string) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSaveRename(sessionId);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      handleCancelRename();
    }
  };

  const handleDelete = async (session: ChatSession, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    const confirmed = window.confirm(`Are you sure you want to delete "${getSessionTitle(session)}"? This action cannot be undone.`);
    if (!confirmed) {
      return;
    }
    try {
      await deleteChatSession(session.id);
      await loadSessions();
      if (currentSessionId === session.id) {
        onLoadSession('');
      }
      if (selectedSessionId === session.id) {
        setSelectedSessionId(null);
        setSelectedSession(null);
      }
    } catch (error) {
      console.error('Failed to delete chat session:', error);
      alert('Failed to delete chat session. Please try again.');
    }
  };

  const handleDeleteFromSidebar = async (sessionId: string) => {
    const session = chatSessions.find((s) => s.id === sessionId);
    if (session) {
      await handleDelete(session);
    }
  };

  const handleRenameFromSidebar = async (sessionId: string) => {
    await loadSessions();
    if (currentSessionId === sessionId) {
      onLoadSession(sessionId);
    }
  };

  return (
    <>
      <div className="fixed left-16 top-0 h-screen w-64 bg-background border-r shadow-lg z-40 animate-in slide-in-from-left duration-200">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-4 border-b flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            <h2 className="text-lg font-semibold flex-1">Chats</h2>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handlePinToggle}
                aria-label={isPinned ? 'Unpin chat popover' : 'Pin chat popover'}
                title={isPinned ? 'Unpin' : 'Pin'}
              >
                {isPinned ? (
                  <PinOff className="h-4 w-4" />
                ) : (
                  <Pin className="h-4 w-4" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onClose}
                aria-label="Close chat popover"
                title="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Recent Section */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Recent
              </h3>
              {isLoading ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  Loading...
                </div>
              ) : chatSessions.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No previous chats
                </div>
              ) : (
                <ul className="space-y-1">
                  {chatSessions.map((session) => {
                    const isActive = currentSessionId === session.id;
                    const isSelected = selectedSessionId === session.id;
                    const isEditing = editingSessionId === session.id;

                    return (
                      <li key={session.id} className="relative group">
                        {isEditing ? (
                          <div className="flex items-center gap-1 px-3 py-2">
                            <Input
                              ref={editInputRef}
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => handleRenameKeyDown(e, session.id)}
                              onBlur={() => handleSaveRename(session.id)}
                              className="h-8 text-sm"
                              onClick={(e) => e.stopPropagation()}
                              aria-label="Edit chat title"
                            />
                          </div>
                        ) : (
                          <div
                            className={`flex items-center gap-1 group/item ${
                              isActive
                                ? 'bg-primary text-primary-foreground'
                                : isSelected
                                ? 'bg-accent'
                                : 'hover:bg-accent/50'
                            } rounded-md transition-colors min-w-0`}
                          >
                            <button
                              type="button"
                              onClick={() => handleSessionClick(session)}
                              className="flex-1 text-left px-3 py-2 rounded-md text-sm min-w-0"
                              aria-label={`Load chat: ${getSessionTitle(session)}`}
                            >
                              <div className="truncate font-medium">
                                {getSessionTitle(session)}
                              </div>
                            </button>
                            <div className="flex items-center gap-0.5 pr-1 opacity-0 group-hover/item:opacity-100 transition-opacity flex-shrink-0">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => handleStartRename(session, e)}
                                aria-label={`Rename ${getSessionTitle(session)}`}
                                title="Rename chat"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                                onClick={(e) => handleDelete(session, e)}
                                aria-label={`Delete ${getSessionTitle(session)}`}
                                title="Delete chat"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
      {selectedSession && (
        <ChatHistorySidebar
          session={selectedSession}
          onDelete={handleDeleteFromSidebar}
          onRename={handleRenameFromSidebar}
        />
      )}
    </>
  );
};

