import Link from 'next/link';
import { DocumentManagement } from '@/components/documents/document-management';

export default function DocumentsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b p-4" role="banner">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-2xl font-bold">Document Management</h1>
          <Link
            href="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded px-2 py-1"
          >
            Back to Chat
          </Link>
        </div>
      </header>
      <main className="container mx-auto max-w-4xl py-8 px-4 flex-1">
        <DocumentManagement />
      </main>
    </div>
  );
}

