'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  File, 
  FileText, 
  FilePdf, 
  FileSpreadsheet, 
  FileWord, 
  FilePresentation,
  Globe,
  Link as LinkIcon,
  Trash2, 
  Loader2, 
  RefreshCw 
} from 'lucide-react';

interface Document {
  id: string;
  name: string;
  sourcePath?: string;
  contentType: string;
  uploadedAt: string;
  createdAt: string;
}

interface DocumentListProps {
  tenantId?: string;
  onDocumentDeleted?: () => void;
}

export const DocumentList = ({ tenantId, onDocumentDeleted }: DocumentListProps) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (tenantId) {
        params.append('tenant_id', tenantId);
      }

      const response = await fetch(`/api/documents?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch documents');
      }

      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleDelete = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document? This will also delete all associated chunks.')) {
      return;
    }

    setDeletingIds((prev) => new Set(prev).add(documentId));

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete document');
      }

      setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));

      if (onDocumentDeleted) {
        onDocumentDeleted();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete document');
    } finally {
      setDeletingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(documentId);
        return newSet;
      });
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDocumentIcon = (document: Document): React.ComponentType<{ className?: string }> => {
    // Check if sourcePath is a URL (starts with http:// or https://)
    if (document.sourcePath) {
      const lowerSourcePath = document.sourcePath.toLowerCase();
      if (lowerSourcePath.startsWith('http://') || lowerSourcePath.startsWith('https://')) {
        return LinkIcon;
      }
    }
    
    // Fallback: Check document name for URL pattern
    const lowerName = document.name.toLowerCase();
    if (lowerName.startsWith('http://') || lowerName.startsWith('https://')) {
      return LinkIcon;
    }
    
    // Check file extension from name
    if (lowerName.endsWith('.pdf')) {
      return FilePdf;
    }
    if (lowerName.endsWith('.csv') || lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
      return FileSpreadsheet;
    }
    if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) {
      return FileWord;
    }
    if (lowerName.endsWith('.pptx') || lowerName.endsWith('.ppt')) {
      return FilePresentation;
    }
    if (lowerName.endsWith('.txt') || lowerName.endsWith('.md')) {
      return FileText;
    }
    
    // Default to generic file icon
    return File;
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Sources</h2>
            <Button variant="outline" size="sm" onClick={fetchDocuments}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
          <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg">
            {error}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Sources ({documents.length})</h2>
          <Button variant="outline" size="sm" onClick={fetchDocuments} disabled={isLoading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <File className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No sources uploaded yet</p>
            <p className="text-sm mt-2">Upload a document or URL to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((document) => (
              <div
                key={document.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {(() => {
                    const IconComponent = getDocumentIcon(document);
                    return <IconComponent className="h-5 w-5 text-muted-foreground flex-shrink-0" />;
                  })()}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{document.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(document.uploadedAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(document.id)}
                  disabled={deletingIds.has(document.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  aria-label={`Delete ${document.name}`}
                >
                  {deletingIds.has(document.id) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};

