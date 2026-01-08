'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { UserContextForm } from '@/components/chat/user-context-form';
import { ProfileView } from '@/components/chat/profile-view';
import { Button } from '@/components/ui/button';
import { Edit, X } from 'lucide-react';
import type { UserContext } from '@/types/domain';
import { loadUserContext } from '@/lib/storage';

export default function ProfilePage() {
  const router = useRouter();
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentContext, setCurrentContext] = useState<UserContext | null>(null);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    const saved = loadUserContext();
    setCurrentContext(saved);
  }, []);

  const handleNewChat = () => {
    router.push('/');
  };

  const handleLoadSession = (sessionId: string) => {
    router.push('/');
  };

  const handleContextChange = (context: UserContext) => {
    setCurrentContext(context);
    setIsEditMode(false);
  };

  const handleEdit = () => {
    setIsEditMode(true);
  };

  const handleCancel = () => {
    setIsEditMode(false);
    const saved = loadUserContext();
    setCurrentContext(saved);
    setFormKey((prev) => prev + 1);
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
          {isEditMode ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button variant="outline" onClick={handleCancel} className="gap-2">
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </div>
              <UserContextForm
                key={formKey}
                onContextChange={handleContextChange}
                initialContext={currentContext || undefined}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={handleEdit} className="gap-2">
                  <Edit className="h-4 w-4" />
                  Edit Profile
                </Button>
              </div>
              <ProfileView context={currentContext || {}} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

