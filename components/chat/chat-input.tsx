'use client';

import { useState, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput = ({
  onSendMessage,
  disabled = false,
  placeholder = 'Type your message...',
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
    <div className="flex gap-2 border-t p-4 transition-all duration-200">
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 transition-all duration-200"
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
        className="transition-all duration-200 disabled:opacity-50"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
};

