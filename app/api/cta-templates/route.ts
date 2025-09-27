import { NextResponse } from 'next/server';
import { cardTemplate, bannerTemplate, modalTemplate } from '../../../pipeline/cta-template';

export async function GET() {
  return NextResponse.json({
    templates: [
      {
        type: 'auto',
        name: 'Auto-Select',
        description: 'Automatically choose the best template based on design tokens',
        complexity: 'adaptive',
        sections: {
          header: true,
          card: true,
          actions: true,
          pricing: true,
          features: true
        }
      },
      {
        type: cardTemplate.type,
        name: cardTemplate.name,
        description: cardTemplate.description,
        complexity: cardTemplate.structure.complexity,
        sections: cardTemplate.structure.sections,
        layout: cardTemplate.structure.layout
      },
      {
        type: bannerTemplate.type,
        name: bannerTemplate.name,
        description: bannerTemplate.description,
        complexity: bannerTemplate.structure.complexity,
        sections: bannerTemplate.structure.sections,
        layout: bannerTemplate.structure.layout
      },
      {
        type: modalTemplate.type,
        name: modalTemplate.name,
        description: modalTemplate.description,
        complexity: modalTemplate.structure.complexity,
        sections: modalTemplate.structure.sections,
        layout: modalTemplate.structure.layout
      }
    ],
    metadata: {
      totalTemplates: 4,
      lastUpdated: new Date().toISOString(),
      version: '1.0.0'
    }
  });
}