'use client';

import { useState } from 'react';
import { DocumentUpload } from './document-upload';
import { DocumentList } from './document-list';

interface DocumentManagementProps {
  tenantId?: string;
}

export const DocumentManagement = ({ tenantId }: DocumentManagementProps) => {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadSuccess = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleDocumentDeleted = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Document Management</h1>
        <p className="text-muted-foreground">
          Upload and manage documents for the RAG system
        </p>
      </div>

      <DocumentUpload onUploadSuccess={handleUploadSuccess} tenantId={tenantId} />

      <DocumentList key={refreshKey} tenantId={tenantId} onDocumentDeleted={handleDocumentDeleted} />
    </div>
  );
};

