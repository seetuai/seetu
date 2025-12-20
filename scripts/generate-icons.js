const fs = require('fs');
const path = require('path');

// Simple PNG generator for solid color icons with "S" letter
// This creates minimal valid PNG files

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

function createPNG(size) {
  // Create a simple canvas-like structure
  // We'll generate an SVG and note that proper icons should be created with a design tool

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#7c3aed;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#4f46e5;stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#grad)"/>
    <text x="50%" y="55%" font-family="Arial, sans-serif" font-size="${size * 0.5}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">S</text>
  </svg>`;

  return svg;
}

const iconsDir = path.join(__dirname, '..', 'public', 'icons');

// Ensure directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate SVG icons (these will need to be converted to PNG for production)
sizes.forEach(size => {
  const svg = createPNG(size);
  const svgPath = path.join(iconsDir, `icon-${size}x${size}.svg`);
  fs.writeFileSync(svgPath, svg);
  console.log(`Created: icon-${size}x${size}.svg`);
});

console.log('\nSVG icons created. For production, convert these to PNG using:');
console.log('- Online converter: https://cloudconvert.com/svg-to-png');
console.log('- Or install sharp: npm install sharp && node scripts/convert-icons.js');
