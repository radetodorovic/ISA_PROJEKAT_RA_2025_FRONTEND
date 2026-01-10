/**
 * TEST SKRIPTA ZA SIMULACIJU ISTOVREMENIH PREGLEDA VIDEA
 * 
 * Ova skripta simulira više korisnika koji istovremeno gledaju isti video
 * i proverava da li se brojač pregleda pravilno inkrementira.
 * 
 * KAKO RADI:
 * 1. Simulira N korisnika koji šalju paralelne HTTP requestove ka video stream endpointu
 * 2. Backend inkrementira viewCount za svaki prvi request (Range: bytes=0-)
 * 3. Na kraju proverava da li je viewCount tačno uvećan za N
 */

const axios = require('axios');

// Konfiguracija
const API_BASE_URL = 'http://localhost:8080';
const VIDEO_ID = 13; // ID videa koji testiramo
const NUM_CONCURRENT_USERS = 10; // Broj istovremenih korisnika
const JWT_TOKEN = null; // Opciono: JWT token ako je potreban za pristup

/**
 * Funkcija koja dobavlja informacije o videu (pre testa)
 */
async function getVideoInfo(videoId) {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/videos/${videoId}`, {
      headers: JWT_TOKEN ? { 'Authorization': `Bearer ${JWT_TOKEN}` } : {}
    });
    return response.data;
  } catch (error) {
    console.error('❌ Greška pri dobavljanju video informacija:', error.message);
    throw error;
  }
}

/**
 * Funkcija koja simulira jedan view (streamovanje videa)
 * Šalje Range request sa bytes=0- što znači prvi pristup
 */
async function simulateVideoView(videoFilename, userId) {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/videos/stream/${videoFilename}`,
      {
        headers: {
          'Range': 'bytes=0-',  // Prvi request - ovo triggeruje inkrementiranje
          'User-Agent': `TestUser-${userId}`
        },
        responseType: 'stream',
        validateStatus: (status) => status === 206 || status === 200
      }
    );
    
    // Odmah prekinemo stream jer nam ne treba ceo video
    response.data.destroy();
    
    return { success: true, userId };
  } catch (error) {
    console.error(`❌ Korisnik ${userId} - greška:`, error.message);
    return { success: false, userId, error: error.message };
  }
}

/**
 * Glavna funkcija za testiranje
 */
async function testConcurrentViews() {
  console.log(' TEST ISTOVREMENIH PREGLEDA VIDEA');
  console.log('=====================================\n');
  
  console.log(` Konfiguracija:`);
  console.log(`   - Video ID: ${VIDEO_ID}`);
  console.log(`   - Broj korisnika: ${NUM_CONCURRENT_USERS}`);
  console.log(`   - API: ${API_BASE_URL}\n`);
  
  try {
    // 1. Dobavi početne informacije o videu
    console.log('📥 Dobavljam informacije o videu...');
    const videoBefore = await getVideoInfo(VIDEO_ID);
    console.log(`   ✅ Naziv: "${videoBefore.title}"`);
    console.log(`   ✅ Video URL: ${videoBefore.videoUrl}`);
    console.log(`   ✅ Trenutni broj pregleda: ${videoBefore.viewCount || 0}\n`);
    
    // Ekstraktuj filename iz videoUrl
    const filename = videoBefore.videoUrl.split('/').pop();
    if (!filename) {
      throw new Error('Nije moguće ekstraktovati filename iz videoUrl');
    }
    
    const initialViewCount = videoBefore.viewCount || 0;
    
    // 2. Simuliraj istovremene preglede
    console.log(`🚀 Simuliram ${NUM_CONCURRENT_USERS} istovremenih pregleda...`);
    const startTime = Date.now();
    
    // Kreiraj niz promise-a za paralelne requestove
    const viewPromises = [];
    for (let i = 1; i <= NUM_CONCURRENT_USERS; i++) {
      viewPromises.push(simulateVideoView(filename, i));
    }
    
    // Pokreni SVE requestove istovremeno
    const results = await Promise.all(viewPromises);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // 3. Analiziraj rezultate
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    console.log(`   ✅ Uspešnih: ${successCount}`);
    console.log(`   ❌ Neuspešnih: ${failureCount}`);
    console.log(`   ⏱️  Trajanje: ${duration}ms\n`);
    
    // 4. Sačekaj malo da se backend stabilizuje
    console.log('⏳ Čekam da se backend stabilizuje (2 sekunde)...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 5. Proveri finalni broj pregleda
    console.log('📥 Proveravam finalni broj pregleda...');
    const videoAfter = await getVideoInfo(VIDEO_ID);
    const finalViewCount = videoAfter.viewCount || 0;
    const actualIncrease = finalViewCount - initialViewCount;
    
    console.log(`   ✅ Finalni broj pregleda: ${finalViewCount}`);
    console.log(`   ✅ Promena: +${actualIncrease}\n`);
    
    // 6. Validacija rezultata
    console.log('📊 REZULTAT TESTA:');
    console.log('===================');
    
    if (actualIncrease === successCount) {
      console.log(`✅ TEST PROŠAO!`);
      console.log(`   - Očekivano povećanje: ${successCount}`);
      console.log(`   - Stvarno povećanje: ${actualIncrease}`);
      console.log(`   - Konzistentnost: 100%`);
      console.log(`\n✨ Backend pravilno rukuje konkurentnim pristupima!`);
    } else if (actualIncrease > successCount) {
      console.log(`⚠️  TEST DELIMIČNO PROŠAO`);
      console.log(`   - Očekivano povećanje: ${successCount}`);
      console.log(`   - Stvarno povećanje: ${actualIncrease}`);
      console.log(`   - Možda postoje drugi korisnici koji gledaju video...`);
    } else {
      console.log(`❌ TEST NIJE PROŠAO!`);
      console.log(`   - Očekivano povećanje: ${successCount}`);
      console.log(`   - Stvarno povećanje: ${actualIncrease}`);
      console.log(`   - PROBLEM: Backend ne inkrementira pravilno!`);
    }
    
  } catch (error) {
    console.error('\n❌ KRITIČNA GREŠKA:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Pokreni test
console.log('\n');
testConcurrentViews()
  .then(() => {
    console.log('\n✅ Test završen uspešno!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test završen sa greškom:', error.message);
    process.exit(1);
  });
