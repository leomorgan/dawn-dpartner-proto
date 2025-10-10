#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const runId = '2025-10-02T13-03-18-205Z_4b76f711_stripe-com';
const artifactDir = path.join(process.cwd(), 'artifacts', runId);

// Read vector data
const vectorPath = path.join(artifactDir, 'vector_data.json');
if (!fs.existsSync(vectorPath)) {
  console.log('❌ No vector_data.json found. Generating...');
  require('child_process').execSync(`npm run build:pipeline && node -e "const {buildVectors} = require('./dist/pipeline/vectors'); buildVectors('${runId}').then(r => require('fs').writeFileSync('${vectorPath}', JSON.stringify(r, null, 2)))"`);
}

const vectorData = JSON.parse(fs.readFileSync(vectorPath, 'utf8'));

console.log('📊 Vector Feature Analysis');
console.log('=' .repeat(70));
console.log('');

// Analyze interpretable vector (64D)
const interpretable = Array.from(vectorData.globalStyleVec.interpretable);
const featureNames = vectorData.globalStyleVec.metadata.featureNames;

console.log(`Total Dimensions: ${interpretable.length}`);
console.log(`Non-Zero Features: ${interpretable.filter(x => x !== 0).length}`);
console.log(`Zero Features: ${interpretable.filter(x => x === 0).length}`);
console.log('');

// Group by category
const categories = {
  color: { start: 0, end: 16 },
  typography: { start: 16, end: 32 },
  spacing: { start: 32, end: 40 },
  shape: { start: 40, end: 48 },
  brand: { start: 48, end: 64 }
};

console.log('Features by Category:');
console.log('-'.repeat(70));

for (const [category, range] of Object.entries(categories)) {
  const slice = interpretable.slice(range.start, range.end);
  const nonZero = slice.filter(x => x !== 0).length;
  const total = range.end - range.start;

  console.log(`${category.padEnd(12)} | ${nonZero}/${total} active | ${(nonZero/total*100).toFixed(0)}% utilized`);
}

console.log('');
console.log('All Features with Values:');
console.log('-'.repeat(70));

interpretable.forEach((value, idx) => {
  const name = featureNames[idx];
  const isReserved = name.includes('reserved') || name.includes('missing');

  if (value === 0 && !isReserved) {
    console.log(`[${String(idx).padStart(2)}] ${name.padEnd(35)} = ${value.toFixed(4)} ⚠️  ZERO`);
  } else if (value !== 0) {
    console.log(`[${String(idx).padStart(2)}] ${name.padEnd(35)} = ${value.toFixed(4)} ✅`);
  }
});

console.log('');
console.log('Reserved/Missing Features (Expected to be 0):');
console.log('-'.repeat(70));

interpretable.forEach((value, idx) => {
  const name = featureNames[idx];
  const isReserved = name.includes('reserved') || name.includes('missing');

  if (isReserved) {
    console.log(`[${String(idx).padStart(2)}] ${name.padEnd(35)} = ${value.toFixed(4)}`);
  }
});
