'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface PipelineInputProps {
  onGenerate: (url: string, prompt: string) => void;
  isGenerating: boolean;
}

export function PipelineInput({ onGenerate, isGenerating }: PipelineInputProps) {
  const [url, setUrl] = useState('http://localhost:5050');
  const [prompt, setPrompt] = useState('create a property detail page');

  const handleSubmit = () => {
    if (!url.trim() || !prompt.trim() || isGenerating) return;
    onGenerate(url.trim(), prompt.trim());
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
              Target URL
            </label>
            <Input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="https://example.com"
              disabled={isGenerating}
              className="font-mono text-sm"
            />
          </div>

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

          <Button
            onClick={handleSubmit}
            disabled={isGenerating || !url.trim() || !prompt.trim()}
            className="h-10 px-8 font-mono"
          >
            {isGenerating ? 'Generating...' : 'Generate'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}