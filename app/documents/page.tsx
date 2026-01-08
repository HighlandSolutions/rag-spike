'use client';

import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { DocumentManagement } from '@/components/documents/document-management';

export default function DocumentsPage() {
  const router = useRouter();

  const handleNewChat = () => {
    router.push('/');
  };

  const handleLoadSession = (sessionId: string) => {
    router.push('/');
  };

  return (
    <div className="flex h-screen flex-col relative">
      {/* Sidebar */}
      <Sidebar
        currentSessionId={null}
        onNewChat={handleNewChat}
        onLoadSession={handleLoadSession}
      />

      <div className="min-h-screen flex flex-col ml-16">
        <main className="container mx-auto max-w-4xl py-8 px-4 flex-1">
          <DocumentManagement />
        </main>
      </div>
    </div>
  );
}

