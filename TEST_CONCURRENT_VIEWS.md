# Test Istovremenih Pregleda Videa

Ova skripta demonstrira pravilno rukovanje konkurentnim pristupima brojača pregleda videa.

## Šta test radi?

1. **Uzima početni broj pregleda** za određeni video
2. **Simulira N korisnika** koji istovremeno šalju HTTP requestove ka video stream endpointu
3. **Proverava finalni broj pregleda** i validira da li je pravilno uvećan

## Kako pokrenuti test?

### 1. Instaliraj axios (ako već nije instaliran):
```bash
npm install axios
```

### 2. Pokreni backend server:
Proveri da je Spring Boot aplikacija pokrenuta na `http://localhost:8080`

### 3. Pokreni test skriptu:
```bash
node test-concurrent-views.js
```

## Konfiguracija

Otvori `test-concurrent-views.js` i prilagodi parametre:

```javascript
const VIDEO_ID = 1;                    // ID videa koji testiraš
const NUM_CONCURRENT_USERS = 10;       // Broj istovremenih korisnika (može i 50, 100...)
const JWT_TOKEN = null;                 // Opciono: JWT token ako je potreban
```

## PrimerOutputA:

```
🎬 TEST ISTOVREMENIH PREGLEDA VIDEA
=====================================

📊 Konfiguracija:
   - Video ID: 1
   - Broj korisnika: 10
   - API: http://localhost:8080

📥 Dobavljam informacije o videu...
   ✅ Naziv: "Test Video"
   ✅ Video URL: /api/videos/stream/abc123.mp4
   ✅ Trenutni broj pregleda: 5

🚀 Simuliram 10 istovremenih pregleda...
   ✅ Uspešnih: 10
   ❌ Neuspešnih: 0
   ⏱️  Trajanje: 245ms

⏳ Čekam da se backend stabilizuje (2 sekunde)...
📥 Proveravam finalni broj pregleda...
   ✅ Finalni broj pregleda: 15
   ✅ Promena: +10

📊 REZULTAT TESTA:
===================
✅ TEST PROŠAO!
   - Očekivano povećanje: 10
   - Stvarno povećanje: 10
   - Konzistentnost: 100%

✨ Backend pravilno rukuje konkurentnim pristupima!
```

## Šta test proverava?

### ✅ Konzistentnost
Backend koristi `@Transactional` i database locking da obezbedi da se viewCount pravilno inkrementira čak i kada više korisnika istovremeno pristupi istom videu.

### ✅ Konkurentnost
Svi HTTP requestovi se šalju **istovremeno** (Promise.all), što simulira realan scenario gde više korisnika u istom trenutku počne da gleda video.

### ✅ Tačnost
Test verifikuje da je finalni broj pregleda **tačno jednak** broju uspešnih requestova.

## Troubleshooting

### Problem: "Connection refused"
- Proveri da li je backend server pokrenut na portu 8080
- Proveri firewall/antivirus

### Problem: "401 Unauthorized"
- Ako endpoint zahteva autentifikaciju, dodaj JWT token:
```javascript
const JWT_TOKEN = 'tvoj-jwt-token-ovde';
```

### Problem: Stvarno povećanje ≠ Očekivano povećanje
- Možda drugi korisnici/testovi takođe pristupaju istom videu
- Pokušaj sa nekim drugim video ID-om koji se ređe koristi
- Ili proveri backend logove da vidiš šta se dešava

## Napredni testovi

Možeš povećati broj korisnika da testiraš ekstremne slučajeve:

```javascript
const NUM_CONCURRENT_USERS = 100;  // 100 istovremenih korisnika
```

Ili testirati sa različitim video-ima:

```javascript
const VIDEO_ID = 5;  // Drugi video
```
