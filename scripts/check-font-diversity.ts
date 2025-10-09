#!/usr/bin/env node

import { readFileSync } from 'fs';
import { join } from 'path';

interface ComputedStyleNode {
  styles: {
    fontFamily: string;
    [key: string]: any;
  };
  [key: string]: any;
}

const runs = [
  '2025-10-02T13-03-18-205Z_4b76f711_stripe-com',
  '2025-10-02T13-03-58-115Z_03ad24ee_monzo-com',
  '2025-10-02T13-05-26-998Z_1a97b63c_fifa-com',
];

console.log('🔍 Checking Font Family Diversity (before .slice(0, 2))\n');

for (const runId of runs) {
  try {
    const nodesPath = join(process.cwd(), 'artifacts', runId, 'raw', 'computed_styles.json');
    const nodes: ComputedStyleNode[] = JSON.parse(readFileSync(nodesPath, 'utf8'));

    const fontFamilies = new Map<string, number>();

    for (const node of nodes) {
      fontFamilies.set(node.styles.fontFamily, (fontFamilies.get(node.styles.fontFamily) || 0) + 1);
    }

    const sorted = Array.from(fontFamilies.entries())
      .sort(([, countA], [, countB]) => countB - countA);

    console.log(`\n${runId.split('_')[2]}:`);
    console.log(`  Total unique font stacks: ${sorted.length}`);
    console.log(`  Top 5 by usage count:`);
    sorted.slice(0, 5).forEach(([family, count], i) => {
      console.log(`    ${i + 1}. [${count}x] ${family}`);
    });

  } catch (err: any) {
    console.error(`  ⚠️  Error: ${err.message}`);
  }
}
