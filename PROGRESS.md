# DoFormy - Progress dokumentácia

## Dátum: 30. marec 2026

---

## Čo sme vytvorili a opravili

### 1. Oprava karty Váha (Desktop)
- **Zobrazenie:** Váha sa teraz zobrazuje zaokrúhlená na **1 desatinné miesto** (napr. 83.5 kg) pre lepšiu prehľadnosť.
- **Inteligentný Input:** Zabránené prepisovaniu hodnoty v políčku, kým používateľ práve píše (kontrola cez `document.activeElement`).
- **Oprava grafu:** Vyriešené tiché zlyhávanie grafu pri jedinom zázname – teraz sa zobrazí aspoň jeden bod.
- **Stabilita UI:** Vyriešený problém s "nekonečným predlžovaním" stránky pridaním pevného kontajnera pre Chart.js.

### 2. Inteligentná obojstranná synchronizácia
- **Systém "Novší vyhráva":** Do databázy a enginu pridaná časová pečiatka `last_updated` (milisekundy). Pri synchronizácii sa porovnávajú časy a najnovšia zmena vždy prepíše staršiu, čo rieši problémy s "vracaním" hodnôt.
- **Zjednotenie dátumov:** Prechod z UTC času (`toISOString`) na lokálny čas (`YYYY-MM-DD`) v celom projekte. To zabezpečuje, že zmeny urobené večer sa zapíšu k správnemu dňu.
- **Automatizácia Desktopu:** Pridaný **Background Polling (každé 2s)** na desktope, ktorý automaticky sťahuje zmeny z mobilu bez nutnosti klikať na tlačidlá.
- **Plynulý Mobil:** Odstránené preblikávanie stránky (`location.reload()`) na mobile, nahradené plynulou aktualizáciou UI cez JavaScript.

### 3. Server a Zabezpečenie (Fixes)
- **Databázová migrácia:** Automatické pridanie stĺpcov `weight`, `water` a `last_updated` do SQLite pri štarte servera.
- **API Robustnosť:** Opravené spracovanie ciest v `server.py`, aby sa zabránilo chybnému servovaniu statických súborov (ako `data.jpg`) namiesto JSON dát.
- **SSL Handshake:** Vylepšené ošetrenie chýb pripojenia (`ConnectionResetError`), aby logy servera zostali čisté pri odpojení iPhonu.

### 4. UI/UX vylepšenia
- **Vizuálna spätná väzba:** Tlačidlá synchronizácie a ukladania teraz zobrazujú stavy (⏳ -> OK / ✓ -> 🔄) pre lepšiu informovanosť používateľa.
- **Konzistencia:** Zjednotené správanie a vzhľad prvkov v oboch aplikáciách.

---

## Technické detaily

### Server (server.py)
- Port: 8000 (HTTPS)
- Host: `doma-pc.tail85a624.ts.net`
- Databáza: SQLite (`doformy.db`), tabuľka `history` obsahuje `last_updated` pre synchronizáciu.

### API URL
- Predvolená: `https://doma-pc.tail85a624.ts.net:8000/api`

---

## Zostávajúce úlohy
1. Sledovať stabilitu Tailscale certifikátov (expirácia).
2. Pridať vizuálnu indikáciu stavu servera (Online/Offline) priamo v UI.
3. Pridať možnosť exportu dát do CSV pre zálohu.
