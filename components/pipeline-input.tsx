'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface PipelineInputProps {
  onVectorize: (url: string) => void;
  isGenerating: boolean;
}

export function PipelineInput({ onVectorize, isGenerating }: PipelineInputProps) {
  const [url, setUrl] = useState('');

  const normalizeUrl = (inputUrl: string): string => {
    let normalized = inputUrl.trim();

    // If it's localhost with port, add http://
    if (normalized.startsWith('localhost:')) {
      return `http://${normalized}`;
    }

    // If it already has a protocol, return as is
    if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
      return normalized;
    }

    // Remove www. prefix if present (we'll let the URL handle this)
    if (normalized.startsWith('www.')) {
      normalized = normalized.substring(4);
    }

    // Add https:// for all other cases
    return `https://${normalized}`;
  };

  const handleSubmit = () => {
    if (!url.trim() || isGenerating) return;

    const normalizedUrl = normalizeUrl(url);
    onVectorize(normalizedUrl);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isGenerating) {
      handleSubmit();
    }
  };

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="flex gap-4 items-end">
          <div className="flex-1 space-y-2">
            <label htmlFor="url" className="text-sm font-medium text-muted-foreground">
              Enter URL to vectorize
            </label>
            <Input
              id="url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="stripe.com, apple.com, airbnb.com..."
              disabled={isGenerating}
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={isGenerating || !url.trim()}
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Vectorizing...
              </>
            ) : (
              'Vectorize'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}