import React from 'react';

export interface MainContentProps {
  className?: string;
}

export const MainContent: React.FC<MainContentProps> = ({
  className = ''
}) => {
  return (
        <div className="flex flex-row items-start gap-8 main-content" style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '32px' }}>
            <section className="gallery-section section-gallery" style={{ gridColumn: 'span 7', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: 'none', padding: '16px' }}>
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
            <section className="summary-section section-summary" style={{ gridColumn: 'span 5', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: 'none', padding: '16px' }}>
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
            <section className="price-cta section-price-cta" style={{ gridColumn: 'span 5', minHeight: '120px', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: 'rgba(0, 0, 0, 0.1) 0px 1px 3px 0px', padding: '16px' }}>
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
        </section>
          </div>
          </div>
  );
};

export default MainContent;