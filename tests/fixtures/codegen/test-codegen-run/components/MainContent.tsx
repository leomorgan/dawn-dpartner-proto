import React from 'react';

export interface MainContentProps {
  className?: string;
}

export const MainContent: React.FC<MainContentProps> = ({
  className = ''
}) => {
  return (
        <div className="flex flex-row items-start gap-8 main-content" style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '32px' }}>
            <section className="gallery-section section-gallery" style={{ gridColumn: 'span 7', backgroundColor: '#ffffff', borderRadius: '4px', boxShadow: 'none', padding: '24px' }}>
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
        </section>
            <div className="flex flex-col items-stretch gap-4 sidebar" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '16px' }}>
            <section className="summary-section section-summary" style={{ gridColumn: 'span 5', backgroundColor: '#f8fafc', borderRadius: '4px', boxShadow: 'none', padding: '24px' }}>
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
        </section>
          </div>
          </div>
  );
};

export default MainContent;