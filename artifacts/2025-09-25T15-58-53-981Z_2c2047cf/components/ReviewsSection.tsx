import React from 'react';

export interface ReviewsSectionProps {
  className?: string;
}

export const ReviewsSection: React.FC<ReviewsSectionProps> = ({
  className = ''
}) => {
  return (
        <div className="flex flex-col gap-6 reviews-section" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <section className="reviews-section section-reviews" style={{ gridColumn: '1 / -1', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: 'none', padding: '16px' }}>
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
        </section>
          </div>
  );
};

export default ReviewsSection;