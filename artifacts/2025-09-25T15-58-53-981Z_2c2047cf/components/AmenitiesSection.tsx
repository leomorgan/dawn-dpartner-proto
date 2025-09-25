import React from 'react';

export interface AmenitiesSectionProps {
  className?: string;
}

export const AmenitiesSection: React.FC<AmenitiesSectionProps> = ({
  className = ''
}) => {
  return (
        <div className="flex flex-col gap-6 amenities-section" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <section className="amenities-section section-amenities" style={{ gridColumn: '1 / -1', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: 'none', padding: '16px' }}>
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
        </section>
          </div>
  );
};

export default AmenitiesSection;