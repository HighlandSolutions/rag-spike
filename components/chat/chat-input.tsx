'use client';

import { useState, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  sidebarOpen?: boolean;
}

export const ChatInput = ({
  onSendMessage,
  disabled = false,
  placeholder = 'Type your message...',
  sidebarOpen = false,
}: ChatInputProps) => {
  const [input, setInput] = useState('');

  const handleSend = () => {
    const trimmedInput = input.trim();
    if (trimmedInput && !disabled) {
      onSendMessage(trimmedInput);
      setInput('');
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-shrink-0 z-50 pb-4 pt-2 px-2 sm:px-4 md:px-6 transition-all duration-200 w-full overflow-x-hidden bg-background">
      <div className="relative w-full max-w-full min-w-0">
        {/* Gradient fade from top */}
        <div className="absolute -top-8 left-0 right-0 h-8 bg-gradient-to-b from-transparent to-background pointer-events-none" />
        
        {/* Floating input container - centered with max width */}
        <div className="mx-auto w-full max-w-[calc(100%-1rem)] sm:max-w-[calc(100%-2rem)] md:max-w-[70ch] min-w-0 px-1 sm:px-0">
          <div className="flex items-end gap-2 bg-background rounded-2xl border border-border shadow-lg p-2 transition-all duration-200 hover:shadow-xl w-full min-w-0">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-2 sm:px-3 py-2 text-sm sm:text-base min-w-0"
              aria-label="Chat input"
              aria-describedby="chat-input-description"
              autoComplete="off"
              autoFocus
            />
            <span id="chat-input-description" className="sr-only">
              Type your message and press Enter to send
            </span>
            <Button
              onClick={handleSend}
              disabled={disabled || !input.trim()}
              size="icon"
              aria-label="Send message"
              className="flex-shrink-0 transition-all duration-200 disabled:opacity-50 rounded-xl h-9 w-9 sm:h-10 sm:w-10"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

