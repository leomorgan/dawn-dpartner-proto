#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const previewPath = path.join(__dirname, '..', 'artifacts', '2025-09-26T16-21-01-637Z_1a2o54pn_airbnb-co-uk', 'preview.html');

// Read the broken preview
let content = fs.readFileSync(previewPath, 'utf8');

// Fix component names with spaces
content = content.replace(/const Hero SectionSection/g, 'const HeroSectionSection');
content = content.replace(/const Property DescriptionSection/g, 'const PropertyDescriptionSection');
content = content.replace(/const Amenities and FeaturesSection/g, 'const AmenitiesAndFeaturesSection');
content = content.replace(/const Location InformationSection/g, 'const LocationInformationSection');
content = content.replace(/const Contact InformationSection/g, 'const ContactInformationSection');
content = content.replace(/const Reviews and TestimonialsSection/g, 'const ReviewsAndTestimonialsSection');
content = content.replace(/const Similar PropertiesSection/g, 'const SimilarPropertiesSection');

// Fix component references in PageLayout
content = content.replace(/<Hero SectionSection/g, '<HeroSectionSection');
content = content.replace(/<Property DescriptionSection/g, '<PropertyDescriptionSection');
content = content.replace(/<Amenities and FeaturesSection/g, '<AmenitiesAndFeaturesSection');
content = content.replace(/<Location InformationSection/g, '<LocationInformationSection');
content = content.replace(/<Contact InformationSection/g, '<ContactInformationSection');
content = content.replace(/<Reviews and TestimonialsSection/g, '<ReviewsAndTestimonialsSection');
content = content.replace(/<Similar PropertiesSection/g, '<SimilarPropertiesSection');

// Fix CSS property names
content = content.replace(/gridcolumn:/g, 'gridColumn:');
content = content.replace(/minheight:/g, 'minHeight:');
content = content.replace(/backgroundcolor:/g, 'backgroundColor:');
content = content.replace(/borderradius:/g, 'borderRadius:');
content = content.replace(/boxshadow:/g, 'boxShadow:');

// Fix broken className template literals
content = content.replace(/component-Hero Section/g, 'component-hero-section');
content = content.replace(/component-Property Description/g, 'component-property-description');
content = content.replace(/component-Amenities and Features/g, 'component-amenities-features');
content = content.replace(/component-Location Information/g, 'component-location-information');
content = content.replace(/component-Contact Information/g, 'component-contact-information');
content = content.replace(/component-Reviews and Testimonials/g, 'component-reviews-testimonials');
content = content.replace(/component-Similar Properties/g, 'component-similar-properties');

// Add missing data definitions for each component
const componentFixes = {
  'HeroSectionSection': `
  const property = {
    title: "Stunning Modern Apartment in London",
    price: "£250/night",
    features: ["2 Bedrooms", "1 Bathroom", "WiFi", "Kitchen", "Free Parking"]
  };
  const heroStyles = {
    backgroundColor: '#ffffff',
    padding: '2rem'
  };`,

  'PropertyDescriptionSection': `
  const propertyDetails = {
    description: "Experience luxury living in this beautifully designed modern apartment located in the heart of London. Perfect for business travelers and tourists alike.",
    amenities: ["High-speed WiFi", "Fully equipped kitchen", "Smart TV", "Washing machine", "Air conditioning"],
    price: "£250 per night"
  };`,

  'AmenitiesAndFeaturesSection': `
  const amenities = [
    { id: 1, name: "WiFi", icon: "📶" },
    { id: 2, name: "Kitchen", icon: "🍳" },
    { id: 3, name: "Parking", icon: "🚗" }
  ];
  const features = [
    { id: 1, name: "Self check-in" },
    { id: 2, name: "Workspace" },
    { id: 3, name: "Carbon monoxide alarm" }
  ];`,

  'LocationInformationSection': `
  const locationData = {
    address: "Central London, Westminster",
    description: "Prime location with easy access to major attractions",
    attractions: [
      { id: 1, name: "Big Ben - 5 min walk" },
      { id: 2, name: "London Eye - 10 min walk" }
    ],
    transportation: [
      { id: 1, name: "Westminster Station - 3 min walk" },
      { id: 2, name: "Bus stop - 1 min walk" }
    ]
  };`,

  'ContactInformationSection': `
  const contactInfo = {
    agentTitle: "Your Host: John Smith",
    email: "host@example.com",
    phone: "+44 20 1234 5678",
    socialLinks: [
      { platform: "Instagram", url: "#" },
      { platform: "Facebook", url: "#" }
    ]
  };`,

  'ReviewsAndTestimonialsSection': `
  const reviews = [
    { id: 1, name: "Sarah J.", rating: 5, comment: "Amazing stay! The apartment was spotless and exactly as described." },
    { id: 2, name: "Mike D.", rating: 4, comment: "Great location and very comfortable. Would definitely stay again." }
  ];
  const starRating = (rating) => {
    return Array.from({length: 5}, (_, index) => (
      <span key={index} className={index < rating ? "text-yellow-500" : "text-gray-400"}>★</span>
    ));
  };`,

  'SimilarPropertiesSection': `
  const similarProperties = [
    { id: 1, title: "Cozy Studio in Shoreditch", price: "£150/night", location: "East London", image: "https://via.placeholder.com/300x200" },
    { id: 2, title: "Luxury Flat in Kensington", price: "£350/night", location: "West London", image: "https://via.placeholder.com/300x200" },
    { id: 3, title: "Modern Loft in Camden", price: "£200/night", location: "North London", image: "https://via.placeholder.com/300x200" }
  ];`
};

// Insert data definitions after each component declaration
Object.entries(componentFixes).forEach(([componentName, dataCode]) => {
  const regex = new RegExp(`const ${componentName} = \\(\\{[\\s\\S]*?\\}\\) => \\{`, 'g');
  content = content.replace(regex, (match) => {
    return match + dataCode;
  });
});

// Write the fixed preview
fs.writeFileSync(previewPath, content);
console.log('✅ Fixed Airbnb preview.html');