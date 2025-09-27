'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface PipelineInputProps {
  onGenerate: (url: string, prompt: string, mode: 'full' | 'cta') => void;
  isGenerating: boolean;
}

export function PipelineInput({ onGenerate, isGenerating }: PipelineInputProps) {
  const [url, setUrl] = useState('stripe.com');
  const [prompt, setPrompt] = useState('create a property detail page');
  const [mode, setMode] = useState<'full' | 'cta'>('cta');

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
    if (mode === 'full' && !prompt.trim()) return;

    const normalizedUrl = normalizeUrl(url);
    onGenerate(normalizedUrl, prompt.trim(), mode);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isGenerating) {
      handleSubmit();
    }
  };

  return (
    <Card className="w-full">
      <CardContent className="p-6 space-y-4">
        {/* Mode Selection */}
        <div className="flex gap-2">
          <Button
            variant={mode === 'full' ? 'default' : 'outline'}
            onClick={() => setMode('full')}
            disabled={isGenerating}
            className="font-mono text-sm"
          >
            Full Pipeline
          </Button>
          <Button
            variant={mode === 'cta' ? 'default' : 'outline'}
            onClick={() => setMode('cta')}
            disabled={isGenerating}
            className="font-mono text-sm"
          >
            CTA Templates
          </Button>
        </div>

        <div className="flex gap-4 items-end">
          <div className="flex-1 space-y-2">
            <label htmlFor="url" className="text-sm font-medium text-muted-foreground">
              Target URL
            </label>
            <Input
              id="url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="airbnb.com, stripe.com, github.com..."
              disabled={isGenerating}
              className="font-mono text-sm"
            />
          </div>

          {mode === 'full' && (
            <div className="flex-1 space-y-2">
              <label htmlFor="prompt" className="text-sm font-medium text-muted-foreground">
                Generation Prompt
              </label>
              <Input
                id="prompt"
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="create a landing page"
                disabled={isGenerating}
                className="font-mono text-sm"
              />
            </div>
          )}


          <Button
            onClick={handleSubmit}
            disabled={isGenerating || !url.trim() || (mode === 'full' && !prompt.trim())}
            className="h-10 px-8 font-mono"
          >
            {isGenerating ? 'Generating...' : 'Generate'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}