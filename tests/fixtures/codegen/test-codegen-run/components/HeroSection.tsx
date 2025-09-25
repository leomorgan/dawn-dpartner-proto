import React from 'react';

export interface HeroSectionProps {
  className?: string;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  className = ''
}) => {
  return (
        <div className="flex flex-col justify-center items-center gap-6 hero-section" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '24px' }}>
            <section className="hero-section section-hero" style={{ gridColumn: '1 / -1', backgroundColor: '#2563eb', padding: '32px' }}>
                <div className="text-center space-y-6">
                <h1 className="text-4xl md:text-6xl font-bold">Welcome</h1>
                <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                  Discover amazing experiences and create unforgettable memories
                </p>
                <button className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg hover:bg-blue-700 transition-colors">
                  Get Started
                </button>
              </div>
        </section>
          </div>
  );
};

export default HeroSection;