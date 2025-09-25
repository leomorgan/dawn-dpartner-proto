import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import type { StyledComponent, StyledSection } from '../styling';
import type { SectionType } from '../intent';

export interface GeneratedComponent {
  name: string;
  filename: string;
  code: string;
  imports: string[];
  exports: string[];
}

export interface CodegenResult {
  runId: string;
  components: GeneratedComponent[];
  indexFile: string;
  totalLines: number;
}

const SECTION_CONTENT_TEMPLATES: Record<SectionType, string> = {
  // Detail page sections
  gallery: `
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <div className="aspect-square bg-gray-200 rounded-lg flex items-center justify-center">
        <span className="text-gray-500">Image 1</span>
      </div>
      <div className="aspect-square bg-gray-200 rounded-lg flex items-center justify-center">
        <span className="text-gray-500">Image 2</span>
      </div>
      <div className="aspect-square bg-gray-200 rounded-lg flex items-center justify-center">
        <span className="text-gray-500">Image 3</span>
      </div>
    </div>
  `,
  summary: `
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Property Summary</h2>
      <p className="text-gray-600">
        Beautiful modern property with stunning views and premium amenities.
        This exceptional space offers comfort and style in a prime location.
      </p>
      <div className="flex flex-wrap gap-2">
        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">3 Bedrooms</span>
        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">2 Bathrooms</span>
        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">Modern</span>
      </div>
    </div>
  `,
  price_cta: `
    <div className="text-center space-y-4">
      <div>
        <span className="text-3xl font-bold">$299</span>
        <span className="text-gray-500">/night</span>
      </div>
      <button className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
        Book Now
      </button>
      <p className="text-sm text-gray-500">Free cancellation until 24h before check-in</p>
    </div>
  `,
  amenities: `
    <div className="space-y-6">
      <h3 className="text-xl font-semibold">Amenities</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
            <span className="text-green-600 text-xs">✓</span>
          </div>
          <span>Wi-Fi</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
            <span className="text-green-600 text-xs">✓</span>
          </div>
          <span>Kitchen</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
            <span className="text-green-600 text-xs">✓</span>
          </div>
          <span>Parking</span>
        </div>
      </div>
    </div>
  `,
  reviews: `
    <div className="space-y-6">
      <h3 className="text-xl font-semibold">Guest Reviews</h3>
      <div className="space-y-4">
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex text-yellow-400">★★★★★</div>
            <span className="font-medium">Sarah M.</span>
          </div>
          <p className="text-gray-600">"Amazing stay! The property exceeded our expectations."</p>
        </div>
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex text-yellow-400">★★★★★</div>
            <span className="font-medium">John D.</span>
          </div>
          <p className="text-gray-600">"Perfect location and excellent host communication."</p>
        </div>
      </div>
    </div>
  `,
  trust_signals: `
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-green-600">✓</span>
        <span>Verified Host</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-green-600">✓</span>
        <span>Instant Book</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-green-600">✓</span>
        <span>Great Location</span>
      </div>
    </div>
  `,

  // Generic sections
  hero: `
    <div className="text-center space-y-6">
      <h1 className="text-4xl md:text-6xl font-bold">Welcome</h1>
      <p className="text-xl text-gray-600 max-w-2xl mx-auto">
        Discover amazing experiences and create unforgettable memories
      </p>
      <button className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg hover:bg-blue-700 transition-colors">
        Get Started
      </button>
    </div>
  `,
  features: `
    <div className="space-y-8">
      <h2 className="text-3xl font-bold text-center">Features</h2>
      <div className="grid md:grid-cols-3 gap-8">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-blue-600 text-2xl">⚡</span>
          </div>
          <h3 className="text-xl font-semibold">Fast</h3>
          <p className="text-gray-600">Lightning fast performance</p>
        </div>
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-green-600 text-2xl">🛡️</span>
          </div>
          <h3 className="text-xl font-semibold">Secure</h3>
          <p className="text-gray-600">Enterprise-grade security</p>
        </div>
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-purple-600 text-2xl">📈</span>
          </div>
          <h3 className="text-xl font-semibold">Scalable</h3>
          <p className="text-gray-600">Grows with your needs</p>
        </div>
      </div>
    </div>
  `,
  testimonials: `
    <div className="space-y-8">
      <h2 className="text-3xl font-bold text-center">What People Say</h2>
      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex text-yellow-400 mb-4">★★★★★</div>
          <p className="text-gray-600 mb-4">"Absolutely fantastic service! Exceeded all expectations."</p>
          <div className="font-semibold">- Alex Johnson</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex text-yellow-400 mb-4">★★★★★</div>
          <p className="text-gray-600 mb-4">"Professional, reliable, and incredibly user-friendly."</p>
          <div className="font-semibold">- Maria Garcia</div>
        </div>
      </div>
    </div>
  `,
  faq: `
    <div className="space-y-8">
      <h2 className="text-3xl font-bold text-center">Frequently Asked Questions</h2>
      <div className="space-y-4">
        <div className="border rounded-lg">
          <button className="w-full text-left p-4 font-medium">How does it work?</button>
          <div className="px-4 pb-4 text-gray-600">It's simple and straightforward - just follow our step-by-step process.</div>
        </div>
        <div className="border rounded-lg">
          <button className="w-full text-left p-4 font-medium">Is it secure?</button>
          <div className="px-4 pb-4 text-gray-600">Yes, we use industry-standard security measures to protect your data.</div>
        </div>
      </div>
    </div>
  `,
  contact: `
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-center">Get in Touch</h2>
      <form className="max-w-md mx-auto space-y-4">
        <input type="text" placeholder="Your Name" className="w-full p-3 border rounded-lg" />
        <input type="email" placeholder="Your Email" className="w-full p-3 border rounded-lg" />
        <textarea placeholder="Your Message" rows={4} className="w-full p-3 border rounded-lg"></textarea>
        <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700">
          Send Message
        </button>
      </form>
    </div>
  `,

  // Profile sections
  avatar: `
    <div className="text-center">
      <div className="w-32 h-32 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
        <span className="text-gray-500 text-4xl">👤</span>
      </div>
      <h2 className="text-2xl font-bold">Profile Name</h2>
    </div>
  `,
  bio: `
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">About</h3>
      <p className="text-gray-600 leading-relaxed">
        Passionate professional with expertise in creating amazing experiences.
        Dedicated to quality and innovation in every project.
      </p>
    </div>
  `,
  experience: `
    <div className="space-y-6">
      <h3 className="text-xl font-semibold">Experience</h3>
      <div className="space-y-4">
        <div className="border-l-2 border-blue-200 pl-4">
          <h4 className="font-medium">Senior Position</h4>
          <p className="text-sm text-gray-500">Company Name • 2020-Present</p>
          <p className="text-gray-600">Led multiple successful projects and initiatives.</p>
        </div>
        <div className="border-l-2 border-blue-200 pl-4">
          <h4 className="font-medium">Previous Role</h4>
          <p className="text-sm text-gray-500">Another Company • 2018-2020</p>
          <p className="text-gray-600">Developed key skills and expertise.</p>
        </div>
      </div>
    </div>
  `,
  portfolio: `
    <div className="space-y-6">
      <h3 className="text-xl font-semibold">Portfolio</h3>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-gray-100 aspect-video rounded-lg flex items-center justify-center">
          <span className="text-gray-500">Project 1</span>
        </div>
        <div className="bg-gray-100 aspect-video rounded-lg flex items-center justify-center">
          <span className="text-gray-500">Project 2</span>
        </div>
      </div>
    </div>
  `,
  social_links: `
    <div className="flex justify-center gap-4">
      <a href="#" className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white hover:bg-blue-700">
        f
      </a>
      <a href="#" className="w-10 h-10 bg-blue-400 rounded-full flex items-center justify-center text-white hover:bg-blue-500">
        t
      </a>
      <a href="#" className="w-10 h-10 bg-blue-800 rounded-full flex items-center justify-center text-white hover:bg-blue-900">
        in
      </a>
    </div>
  `,
};

export async function generateCode(runId: string, artifactDir?: string): Promise<CodegenResult> {
  const baseDir = artifactDir || join(process.cwd(), 'artifacts');
  const runDir = join(baseDir, runId);

  // Read styled components
  const styledComponentsContent = await readFile(join(runDir, 'styled_components.json'), 'utf8');
  const styledComponents: StyledComponent[] = JSON.parse(styledComponentsContent);

  // Generate React components
  const components = styledComponents.map(component =>
    generateReactComponent(component, runId)
  );

  // Generate index file
  const indexFile = generateIndexFile(components);

  // Create components directory
  const componentsDir = join(runDir, 'components');
  if (!existsSync(componentsDir)) {
    await mkdir(componentsDir, { recursive: true });
  }

  // Write component files
  await Promise.all([
    ...components.map(component =>
      writeFile(join(componentsDir, component.filename), component.code)
    ),
    writeFile(join(componentsDir, 'index.ts'), indexFile)
  ]);

  const totalLines = components.reduce((sum, comp) => sum + comp.code.split('\n').length, 0);

  return {
    runId,
    components,
    indexFile,
    totalLines,
  };
}

function generateReactComponent(component: StyledComponent, runId: string): GeneratedComponent {
  const componentName = toPascalCase(component.id);
  const filename = `${componentName}.tsx`;

  const imports = ['import React from \'react\';'];
  const childComponents: string[] = [];

  // Generate child components recursively
  if (component.children) {
    component.children.forEach(child => {
      if ('section' in child) {
        childComponents.push(generateSectionJSX(child));
      } else {
        childComponents.push(generateComponentJSX(child));
      }
    });
  }

  const styleProps = generateInlineStyles(component.styles);
  const jsx = component.children
    ? `<${component.element} className="${component.className}"${styleProps}>
        ${childComponents.join('\n        ')}
      </${component.element}>`
    : `<${component.element} className="${component.className}"${styleProps} />`;

  const code = `${imports.join('\n')}

export interface ${componentName}Props {
  className?: string;
}

export const ${componentName}: React.FC<${componentName}Props> = ({
  className = ''
}) => {
  return (
    ${jsx.split('\n').map(line => `    ${line}`).join('\n')}
  );
};

export default ${componentName};`;

  return {
    name: componentName,
    filename,
    code,
    imports,
    exports: [componentName, `${componentName}Props`],
  };
}

function generateSectionJSX(section: StyledSection): string {
  const sectionName = toPascalCase(section.section);
  const styleProps = generateInlineStyles(section.styles);
  const content = SECTION_CONTENT_TEMPLATES[section.section] || '<div>Section content</div>';

  return `<section className="${section.className}"${styleProps}>
      ${content.trim().split('\n').map(line => `      ${line}`).join('\n')}
    </section>`;
}

function generateComponentJSX(component: StyledComponent): string {
  const childComponents: string[] = [];

  if (component.children) {
    component.children.forEach(child => {
      if ('section' in child) {
        childComponents.push(generateSectionJSX(child));
      } else {
        childComponents.push(generateComponentJSX(child));
      }
    });
  }

  const styleProps = generateInlineStyles(component.styles);

  if (component.children && component.children.length > 0) {
    return `<${component.element} className="${component.className}"${styleProps}>
        ${childComponents.join('\n        ')}
      </${component.element}>`;
  } else {
    return `<${component.element} className="${component.className}"${styleProps} />`;
  }
}

function generateInlineStyles(styles: StyledComponent['styles'] | StyledSection['styles']): string {
  const styleEntries = Object.entries(styles).filter(([_, value]) => value !== undefined);

  if (styleEntries.length === 0) {
    return '';
  }

  const styleObject = styleEntries
    .map(([key, value]) => `${key}: '${value}'`)
    .join(', ');

  return ` style={{ ${styleObject} }}`;
}

function generateIndexFile(components: GeneratedComponent[]): string {
  const exports = components.map(comp =>
    `export { ${comp.name}, type ${comp.name}Props } from './${comp.name.replace('.tsx', '')}';`
  ).join('\n');

  return `// Generated component exports
${exports}

// Re-export all components as default
export default {
  ${components.map(comp => comp.name).join(',\n  ')}
};`;
}

function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}