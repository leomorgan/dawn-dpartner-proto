'use client';

import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

interface DataPoint {
  id: string;
  sourceUrl: string;
  x: number;
  y: number;
  brandTone: string;
  brandEnergy: string;
  brandName?: string;
  runId?: string;
}

interface VectorScatterPlotProps {
  data: DataPoint[];
  title: string;
  explainedVariance: { pc1: number; pc2: number };
  onPointClick?: (id: string) => void;
  highlightedId?: string;
}

// Color mapping for brand tones
const TONE_COLORS: Record<string, string> = {
  professional: '#3b82f6', // blue
  playful: '#a855f7',      // purple
  serious: '#6b7280',      // gray
  friendly: '#10b981',     // green
  luxurious: '#f59e0b',    // amber
  minimal: '#64748b',      // slate
  bold: '#ef4444',         // red
  calm: '#06b6d4',         // cyan
  unknown: '#94a3b8',      // gray-400
};

function getToneColor(tone: string): string {
  const normalizedTone = tone.toLowerCase();
  return TONE_COLORS[normalizedTone] || TONE_COLORS.unknown;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const hostname = new URL(data.sourceUrl).hostname.replace('www.', '');

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden" style={{ maxWidth: '280px' }}>
      {/* Screenshot Thumbnail */}
      {data.runId && (
        <div className="relative w-full h-32 bg-gray-100 overflow-hidden">
          <img
            src={`/api/artifact/${data.runId}/raw/page.png`}
            alt={hostname}
            className="w-full h-full object-cover object-top"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Content */}
      <div className="p-3">
        <div className="font-semibold text-sm text-gray-900 mb-1">{hostname}</div>
        <div className="text-xs text-gray-600 mb-2 truncate">{data.sourceUrl}</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gray-500">Tone:</span>{' '}
            <span className="font-medium capitalize">{data.brandTone || 'N/A'}</span>
          </div>
          <div>
            <span className="text-gray-500">PC1:</span>{' '}
            <span className="font-mono">{data.x.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-gray-500">PC2:</span>{' '}
            <span className="font-mono">{data.y.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VectorScatterPlot({
  data,
  title,
  explainedVariance,
  onPointClick,
  highlightedId,
}: VectorScatterPlotProps) {
  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-600 mt-1">
          PC1: {explainedVariance.pc1}% variance • PC2: {explainedVariance.pc2}% variance • Total: {explainedVariance.pc1 + explainedVariance.pc2}%
        </p>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart
          margin={{ top: 20, right: 20, bottom: 40, left: 40 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            type="number"
            dataKey="x"
            name="PC1"
            label={{
              value: `PC1 (${explainedVariance.pc1}% variance)`,
              position: 'bottom',
              offset: 0,
              style: { fontSize: 12, fill: '#6b7280' }
            }}
            stroke="#9ca3af"
          />
          <YAxis
            type="number"
            dataKey="y"
            name="PC2"
            label={{
              value: `PC2 (${explainedVariance.pc2}% variance)`,
              angle: -90,
              position: 'left',
              offset: 0,
              style: { fontSize: 12, fill: '#6b7280' }
            }}
            stroke="#9ca3af"
          />
          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter
            data={data}
            onClick={(point) => {
              if (onPointClick && point) {
                onPointClick(point.id);
              }
            }}
            cursor="pointer"
            isAnimationActive={false}
          >
            {data.map((entry) => {
              const isHighlighted = entry.id === highlightedId;

              return (
                <Cell
                  key={entry.id}
                  fill={getToneColor(entry.brandTone)}
                  stroke={isHighlighted ? '#1f2937' : getToneColor(entry.brandTone)}
                  strokeWidth={isHighlighted ? 3 : 1}
                  r={isHighlighted ? 10 : 6}
                  opacity={isHighlighted ? 1 : 0.8}
                />
              );
            })}
            <LabelList
              dataKey="sourceUrl"
              position="top"
              content={(props: any) => {
                const { x, y, value } = props;
                if (!value) return null;

                try {
                  const hostname = new URL(value).hostname.replace('www.', '').replace('.com', '');
                  return (
                    <text
                      x={x}
                      y={y - 10}
                      textAnchor="middle"
                      fill="#374151"
                      fontSize={11}
                      fontWeight={500}
                    >
                      {hostname}
                    </text>
                  );
                } catch {
                  return null;
                }
              }}
            />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t">
        <div className="text-xs font-medium text-gray-700 mb-2">Brand Tones</div>
        <div className="flex flex-wrap gap-3">
          {Object.entries(TONE_COLORS)
            .filter(([tone]) => data.some(d => d.brandTone.toLowerCase() === tone))
            .map(([tone, color]) => (
              <div key={tone} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-gray-600 capitalize">{tone}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
