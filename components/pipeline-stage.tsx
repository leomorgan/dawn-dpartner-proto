'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PipelineStep } from '@/pipeline/orchestration';

interface PipelineStageProps {
  step: PipelineStep;
  index: number;
  artifacts?: any;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">✓ Completed</Badge>;
    case 'running':
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">● Running</Badge>;
    case 'error':
      return <Badge variant="destructive">✗ Error</Badge>;
    default:
      return <Badge variant="secondary">○ Pending</Badge>;
  }
}

function formatDuration(ms?: number): string {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function ArtifactViewer({ data, title }: { data: any; title: string }) {
  if (!data) return <div className="text-muted-foreground text-sm">No data available</div>;

  const jsonString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

  return (
    <div className="space-y-2">
      <h4 className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{title}</h4>
      <ScrollArea className="h-64 w-full rounded border">
        <pre className="p-3 font-mono text-xs leading-relaxed">
          {jsonString}
        </pre>
      </ScrollArea>
    </div>
  );
}

export function PipelineStage({ step, index, artifacts }: PipelineStageProps) {
  const hasArtifacts = artifacts && Object.keys(artifacts).length > 0;
  const hasOutputs = step.outputs && Object.keys(step.outputs).length > 0;
  const hasError = step.status === 'error' && step.error;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <span className="font-mono text-sm text-muted-foreground">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="font-mono">{step.name}</span>
          </CardTitle>
          <div className="flex items-center gap-3">
            {step.duration && (
              <span className="font-mono text-xs text-muted-foreground">
                {formatDuration(step.duration)}
              </span>
            )}
            {getStatusBadge(step.status)}
          </div>
        </div>
        {hasError && (
          <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded">
            <p className="font-mono text-xs text-destructive">{step.error}</p>
          </div>
        )}
      </CardHeader>

      {(hasArtifacts || hasOutputs) && (
        <CardContent className="pt-0">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="artifacts" className="border-none">
              <AccordionTrigger className="font-mono text-xs text-muted-foreground hover:no-underline py-2">
                View Artifacts & Outputs
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                {hasOutputs && (
                  <div className="space-y-2">
                    <h4 className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Outputs</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(step.outputs!).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center p-2 bg-muted/50 rounded text-xs font-mono">
                          <span className="text-muted-foreground">{key}:</span>
                          <span className="font-semibold">
                            {typeof value === 'boolean' ? (value ? '✓' : '✗') : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {hasArtifacts && (
                  <div className="space-y-4">
                    {Object.entries(artifacts).map(([key, value]) => (
                      <ArtifactViewer key={key} data={value} title={key} />
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      )}
    </Card>
  );
}