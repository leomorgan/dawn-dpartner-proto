#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const OpenAI = require('openai');
const fs = require('fs');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const runId = '2025-09-26T15-35-21-184Z_d544102e_stripe-com';
const componentsDir = path.join(__dirname, '..', 'artifacts', runId, 'components');

const components = [
  { name: 'SummarySection', type: 'summary' },
  { name: 'DataTableSection', type: 'data-table' },
  { name: 'ChartSection', type: 'chart' },
  { name: 'FormSection', type: 'form' },
  { name: 'SupportSection', type: 'support' }
];

async function generateComponent(name, type) {
  const prompt = `Generate a complete React component body for a ${type} section.

Requirements:
1. First define all const variables with complete data
2. Then provide complete JSX with all tags properly closed
3. Use Stripe brand colors: primary=#635bff, text=#425466

Generate the return statement with complete JSX.

Example structure:
const items = [{id: 1, name: "Item 1"}, {id: 2, name: "Item 2"}];

return (
  <section className="component-${type}" style={{padding: '16px'}}>
    <div className="bg-white p-8 rounded-lg shadow-md">
      <h2>Title</h2>
      {items.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  </section>
);`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a React component generator. Generate complete, valid JSX with all necessary data definitions.' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 2000,
    temperature: 0.3,
  });

  let content = response.choices[0].message.content?.trim();

  // Remove markdown if present
  if (content.startsWith('```')) {
    content = content.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');
  }

  // Wrap in component function
  const componentCode = `export interface ${name}Props {
  className?: string;
}

export const ${name}: React.FC<${name}Props> = ({
  className = ''
}) => {
  ${content.split('\n').map(line => '  ' + line).join('\n')}
};

export default ${name};`;

  return componentCode;
}

async function main() {
  console.log('🔧 Regenerating components with fixed syntax...');

  if (!fs.existsSync(componentsDir)) {
    fs.mkdirSync(componentsDir, { recursive: true });
  }

  for (const comp of components) {
    console.log(`  Generating ${comp.name}...`);
    const code = await generateComponent(comp.name, comp.type);
    fs.writeFileSync(path.join(componentsDir, `${comp.name}.tsx`), code);
  }

  // Generate index file
  const indexContent = `// Generated component exports
${components.map(c => `export { ${c.name}, type ${c.name}Props } from './${c.name}';`).join('\n')}
export { PageLayout, type PageLayoutProps } from './PageLayout';

// Re-export all components as default
export default {
${components.map(c => `  ${c.name}`).join(',\n')},
  PageLayout
};`;

  fs.writeFileSync(path.join(componentsDir, 'index.ts'), indexContent);

  // Generate PageLayout
  const pageLayoutContent = `${components.map(c => `import { ${c.name} } from './${c.name}';`).join('\n')}

export interface PageLayoutProps {
  className?: string;
}

export const PageLayout: React.FC<PageLayoutProps> = ({
  className = ''
}) => {
  return (
    <div className={\`page-layout \${className}\`}>
      <div
        className="flex flex-col gap-6 main-stack"
        style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
      >
${components.map(c => `        <${c.name} />`).join('\n')}
      </div>
    </div>
  );
};

export default PageLayout;`;

  fs.writeFileSync(path.join(componentsDir, 'PageLayout.tsx'), pageLayoutContent);

  console.log('✅ Components regenerated successfully!');
}

main().catch(console.error);