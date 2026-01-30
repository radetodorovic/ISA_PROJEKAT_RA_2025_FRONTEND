/**
 * PERFORMANCE TEST SCRIPT
 * Testira optimalne intervale osvežavanja trending sistema
 * 
 * KAKO KORISTITI:
 * 1. Pokreni backend server (port 8080)
 * 2. Uloguj se u aplikaciju i kopiraj JWT token iz localStorage
 * 3. Zameni YOUR_JWT_TOKEN u skriptu sa pravim token-om
 * 4. Pokreni: node performance-test.js
 */

const API_BASE = 'http://localhost:8080/api';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmaWxpcEB0ZXN0LmNvbSIsImlhdCI6MTc2OTc4MjMwNSwiZXhwIjoxNzY5ODY4NzA1fQ.j6ukiYAOJlTZJOTThC12RwKnRS9_0lEW2FYyUtx9yKM'; // ZAMENI SA PRAVIM TOKEN-OM

// Test konfiguracija - smanjeno za stabilnost
const TEST_CONFIGS = [
  { interval: 5, name: '5 sekundi', iterations: 10 },
  { interval: 10, name: '10 sekundi', iterations: 8 },
  { interval: 30, name: '30 sekundi', iterations: 6 },
  { interval: 60, name: '1 minut', iterations: 5 },
  { interval: 120, name: '2 minuta', iterations: 3 },
  { interval: 300, name: '5 minuta', iterations: 2 }
];

// Rezultati
const results = [];

// Helper funkcija za merenje response time-a
async function measureResponseTime(url, options = {}) {
  const startTime = Date.now();
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // Pipeline endpoint vraća text, ostali vraćaju JSON
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
    
    return { success: true, responseTime, data };
  } catch (error) {
    const endTime = Date.now();
    return { 
      success: false, 
      responseTime: endTime - startTime, 
      error: error.message 
    };
  }
}

// Test trending endpoint-a
async function testTrendingEndpoint(lat = 44.787197, lon = 20.457273) {
  const url = `${API_BASE}/trending?lat=${lat}&lng=${lon}&radiusMeters=2000`;
  return await measureResponseTime(url);
}

// Test trending stats endpoint-a
async function testTrendingStats() {
  const url = `${API_BASE}/trending/stats`;
  return await measureResponseTime(url);
}

// Pokreni trending pipeline
async function runTrendingPipeline() {
  const url = `${API_BASE}/trending/run`;
  return await measureResponseTime(url, { method: 'POST' });
}

// Test za određeni interval
async function testInterval(config) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 TESTIRANJE: ${config.name} interval`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  const responseTimes = [];
  const errors = [];
  
  for (let i = 1; i <= config.iterations; i++) {
    console.log(`\n⏳ Iteracija ${i}/${config.iterations}...`);
    
    // 1. Pokreni trending pipeline
    console.log('  → Pokrećem trending pipeline...');
    const pipelineResult = await runTrendingPipeline();
    if (pipelineResult.success) {
      console.log(`  ✓ Pipeline: ${pipelineResult.responseTime}ms`);
    } else {
      console.log(`  ✗ Pipeline greška: ${pipelineResult.error}`);
      errors.push({ type: 'pipeline', error: pipelineResult.error });
    }
    
    // 2. Sačekaj interval
    if (i < config.iterations) {
      console.log(`  ⏸  Čekam ${config.interval} sekundi...`);
      await sleep(config.interval * 1000);
    }
    
    // 3. Testiraj trending endpoint
    console.log('  → Testiram /trending endpoint...');
    const trendingResult = await testTrendingEndpoint();
    if (trendingResult.success) {
      responseTimes.push(trendingResult.responseTime);
      const videoCount = Array.isArray(trendingResult.data) ? trendingResult.data.length : 0;
      console.log(`  ✓ Trending: ${trendingResult.responseTime}ms (${videoCount} videa)`);
    } else {
      console.log(`  ✗ Trending greška: ${trendingResult.error}`);
      errors.push({ type: 'trending', error: trendingResult.error });
    }
    
    // 4. Testiraj stats endpoint
    console.log('  → Testiram /trending/stats endpoint...');
    const statsResult = await testTrendingStats();
    if (statsResult.success) {
      console.log(`  ✓ Stats: ${statsResult.responseTime}ms`);
      console.log(`     Backend mereno vreme: ${statsResult.data.responseTimeMs}ms`);
    } else {
      console.log(`  ✗ Stats greška: ${statsResult.error}`);
    }
  }
  
  // Izračunaj statistiku
  const avgResponseTime = responseTimes.length > 0 
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : 0;
  const minResponseTime = responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
  const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;
  const successRate = ((config.iterations - errors.length) / config.iterations * 100).toFixed(1);
  
  const result = {
    interval: config.name,
    intervalSeconds: config.interval,
    avgResponseTime,
    minResponseTime,
    maxResponseTime,
    successRate,
    totalTests: config.iterations,
    errors: errors.length
  };
  
  results.push(result);
  
  console.log(`\n✅ Rezultati za ${config.name}:`);
  console.log(`   Prosečno vreme: ${avgResponseTime}ms`);
  console.log(`   Min/Max: ${minResponseTime}ms / ${maxResponseTime}ms`);
  console.log(`   Uspešnost: ${successRate}%`);
  console.log(`   Greške: ${errors.length}`);
  
  return result;
}

// Sleep funkcija
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Prikaži finalnu tabelu
function displayResults() {
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                     📊 FINALNI REZULTATI TESTIRANJA                        ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log('');
  
  console.log('┌─────────────┬──────────────┬─────────┬─────────┬───────────┬──────────┐');
  console.log('│   Interval  │   Avg Time   │   Min   │   Max   │  Success  │  Greške  │');
  console.log('├─────────────┼──────────────┼─────────┼─────────┼───────────┼──────────┤');
  
  results.forEach(r => {
    const interval = r.interval.padEnd(11);
    const avg = `${r.avgResponseTime}ms`.padStart(12);
    const min = `${r.minResponseTime}ms`.padStart(7);
    const max = `${r.maxResponseTime}ms`.padStart(7);
    const success = `${r.successRate}%`.padStart(9);
    const errors = `${r.errors}`.padStart(8);
    
    console.log(`│ ${interval} │ ${avg} │ ${min} │ ${max} │ ${success} │ ${errors} │`);
  });
  
  console.log('└─────────────┴──────────────┴─────────┴─────────┴───────────┴──────────┘');
  
  // Preporuka
  const optimalResult = results
    .filter(r => r.successRate >= 90)
    .sort((a, b) => {
      // Kombinovani score: manji response time + razumno češće osvežavanje
      const scoreA = a.avgResponseTime + (a.intervalSeconds * 0.5);
      const scoreB = b.avgResponseTime + (b.intervalSeconds * 0.5);
      return scoreA - scoreB;
    })[0];
  
  if (optimalResult) {
    console.log('\n🎯 OPTIMALNA MERA:');
    console.log(`   Interval: ${optimalResult.interval}`);
    console.log(`   Prosečno vreme: ${optimalResult.avgResponseTime}ms`);
    console.log(`   Uspešnost: ${optimalResult.successRate}%`);
    console.log(`   
   Obrazloženje: Ovaj interval pruža najbolji balans između brzine`);
    console.log(`   odziva i aktuelnosti trending podataka.`);
  }
  
  // Sačuvaj JSON rezultate
  console.log('\n💾 Čuvam rezultate u performance-results.json...');
  const fs = require('fs');
  fs.writeFileSync('performance-results.json', JSON.stringify({
    testDate: new Date().toISOString(),
    results,
    optimal: optimalResult
  }, null, 2));
  console.log('✓ Rezultati sačuvani!');
}

// Glavna funkcija
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║         🚀 TRENDING PERFORMANCE TEST - POČETAK TESTIRANJA                  ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log(`\nAPI URL: ${API_BASE}`);
  console.log(`JWT Token: ${JWT_TOKEN.substring(0, 20)}...`);
  console.log(`Ukupno test konfiguracija: ${TEST_CONFIGS.length}`);
  
  // Proveri konekciju
  console.log('\n🔍 Proveravam konekciju sa backend-om...');
  const healthCheck = await measureResponseTime(`${API_BASE}/trending`);
  if (!healthCheck.success) {
    console.error('❌ Ne mogu se povezati sa backend-om!');
    console.error('   Proveri:');
    console.error('   1. Da li je backend pokrenut na http://localhost:8080');
    console.error('   2. Da li je JWT token validan');
    console.error(`   Greška: ${healthCheck.error}`);
    process.exit(1);
  }
  console.log('✓ Konekcija uspešna!\n');
  
  // Pokreni testove
  for (const config of TEST_CONFIGS) {
    await testInterval(config);
    
    // Pauza između test grupa
    if (config !== TEST_CONFIGS[TEST_CONFIGS.length - 1]) {
      console.log('\n⏸  Pauza 5 sekundi pre sledećeg testa...\n');
      await sleep(5000);
    }
  }
  
  // Prikaži rezultate
  displayResults();
  
  console.log('\n✅ TESTIRANJE ZAVRŠENO!\n');
}

// Pokreni
main().catch(error => {
  console.error('\n❌ KRITIČNA GREŠKA:', error);
  process.exit(1);
});
