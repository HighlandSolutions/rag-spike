'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Upload, File, X, Loader2, Link } from 'lucide-react';

interface DocumentUploadProps {
  onUploadSuccess?: () => void;
  tenantId?: string;
}

interface UploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
  success: string | null;
}

export const DocumentUpload = ({ onUploadSuccess, tenantId }: DocumentUploadProps) => {
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
    success: null,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string>('');
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const extension = file.name.toLowerCase();
      if (!extension.endsWith('.pdf') && !extension.endsWith('.csv')) {
        setUploadState({
          isUploading: false,
          progress: 0,
          error: 'Only PDF and CSV files are supported',
          success: null,
        });
        return;
      }

      if (file.size > 50 * 1024 * 1024) {
        setUploadState({
          isUploading: false,
          progress: 0,
          error: 'File size must be less than 50MB',
          success: null,
        });
        return;
      }

      setSelectedFile(file);
      setUploadState({
        isUploading: false,
        progress: 0,
        error: null,
        success: null,
      });
    }
  };

  const handleUpload = async () => {
    if (uploadMode === 'file' && !selectedFile) {
      return;
    }
    if (uploadMode === 'url' && !url.trim()) {
      setUploadState({
        isUploading: false,
        progress: 0,
        error: 'Please enter a valid URL',
        success: null,
      });
      return;
    }

    setUploadState({
      isUploading: true,
      progress: 0,
      error: null,
      success: null,
    });

    try {
      const formData = new FormData();
      if (uploadMode === 'file' && selectedFile) {
        formData.append('file', selectedFile);
      } else if (uploadMode === 'url' && url.trim()) {
        formData.append('url', url.trim());
      }
      if (tenantId) {
        formData.append('tenant_id', tenantId);
      }

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed');
      }

      const result = await response.json();

      setUploadState({
        isUploading: false,
        progress: 100,
        error: null,
        success: `Document "${result.document.name}" uploaded successfully! ${result.chunksCreated} chunks created.`,
      });

      setSelectedFile(null);
      setUrl('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (error) {
      setUploadState({
        isUploading: false,
        progress: 0,
        error: error instanceof Error ? error.message : 'Upload failed',
        success: null,
      });
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setUploadState({
      isUploading: false,
      progress: 0,
      error: null,
      success: null,
    });
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const file = event.dataTransfer.files?.[0];
    if (file) {
      const extension = file.name.toLowerCase();
      if (extension.endsWith('.pdf') || extension.endsWith('.csv')) {
        setSelectedFile(file);
        setUploadState({
          isUploading: false,
          progress: 0,
          error: null,
          success: null,
        });
      } else {
        setUploadState({
          isUploading: false,
          progress: 0,
          error: 'Only PDF and CSV files are supported',
          success: null,
        });
      }
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Upload Source</h2>
        </div>

        {/* Upload mode toggle */}
        <div className="flex gap-2 border-b">
          <button
            type="button"
            onClick={() => {
              setUploadMode('file');
              setUploadState({ isUploading: false, progress: 0, error: null, success: null });
            }}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              uploadMode === 'file'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            File Upload
          </button>
          <button
            type="button"
            onClick={() => {
              setUploadMode('url');
              setUploadState({ isUploading: false, progress: 0, error: null, success: null });
            }}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              uploadMode === 'url'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            URL
          </button>
        </div>

        {uploadMode === 'file' ? (
          <div
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center transition-colors hover:border-muted-foreground/50"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.csv,.docx,.doc,.xlsx,.xls,.pptx,.ppt"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
              disabled={uploadState.isUploading}
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <Upload className="h-12 w-12 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF, CSV, Word, Excel, or PowerPoint files (max 50MB)
                </p>
              </div>
            </label>
          </div>
        ) : (
          <div className="space-y-2">
            <label htmlFor="url-input" className="text-sm font-medium">
              Enter URL
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="url-input"
                  type="url"
                  placeholder="https://example.com/article"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setUploadState({ isUploading: false, progress: 0, error: null, success: null });
                  }}
                  disabled={uploadState.isUploading}
                  className="pl-10"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter a valid HTTP or HTTPS URL to scrape and ingest content
            </p>
          </div>
        )}

        {selectedFile && (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <File className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{selectedFile.name}</span>
              <span className="text-xs text-muted-foreground">
                ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </span>
            </div>
            <button
              type="button"
              onClick={handleRemoveFile}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Remove file"
              disabled={uploadState.isUploading}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {uploadState.error && (
          <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg">
            {uploadState.error}
          </div>
        )}

        {uploadState.success && (
          <div className="p-3 bg-green-500/10 text-green-600 dark:text-green-400 text-sm rounded-lg">
            {uploadState.success}
          </div>
        )}

        <Button
          onClick={handleUpload}
          disabled={(uploadMode === 'file' && !selectedFile) || (uploadMode === 'url' && !url.trim()) || uploadState.isUploading}
          className="w-full"
        >
          {uploadState.isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {uploadMode === 'url' ? 'Processing URL...' : 'Uploading...'}
            </>
          ) : (
            <>
              {uploadMode === 'url' ? (
                <>
                  <Link className="mr-2 h-4 w-4" />
                  Ingest URL
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Source
                </>
              )}
            </>
          )}
        </Button>
      </div>
    </Card>
  );
};




