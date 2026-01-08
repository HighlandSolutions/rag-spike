'use client';

import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { UserContextForm } from '@/components/chat/user-context-form';
import type { UserContext } from '@/types/domain';

export default function ProfilePage() {
  const router = useRouter();

  const handleNewChat = () => {
    router.push('/');
  };

  const handleLoadSession = (sessionId: string) => {
    router.push('/');
  };

  const handleContextChange = (context: UserContext) => {
    // Context is saved automatically in UserContextForm
    // This callback can be used for additional actions if needed
  };

  return (
    <div className="flex h-screen flex-col relative">
      {/* Sidebar */}
      <Sidebar
        currentSessionId={null}
        onNewChat={handleNewChat}
        onLoadSession={handleLoadSession}
      />

      {/* Main Content */}
      <main className="flex-1 ml-16 overflow-auto">
        <div className="container mx-auto py-8 px-4 max-w-2xl">
          <UserContextForm onContextChange={handleContextChange} />
        </div>
      </main>
    </div>
  );
}

