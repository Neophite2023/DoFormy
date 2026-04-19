# DoFormy - Progress dokumentácia

## Dátum: 19. apríl 2026 (Dnešné zmeny)

---

## Čo sme vytvorili a opravili

### 1. Odstránenie prefixu "Karta" z názvov kariet
- **Zmena:** V mobile appke odstránený prefix "Karta" zo všetkých 4 kariet (Cvičenie, Váha, Voda, Pohyb).
- **Dôvod:** Jednoduchší a modernejší dizajn bez zbytočného slova.

---

## Dátum: 16. apríl 2026 (Predošlé zmeny)

---

## Čo sme vytvorili a opravili

### 1. Čistka systému notifikácií
- **Odstránenie kódu:** Kompletne odstránená logika tréningových pripomienok z HTML, JavaScriptu (mobilná aplikácia, shared engine) a Service Workera.
- **Dôvod:** Notifikácie v čistom offline režime na iPhone (bez serverového Push) neboli stabilné a pri vypnutej aplikácii nefungovali, čo ich robilo pre používateľa bezvýznamnými.
- **UI zmeny:** Odstránená sekcia "Notifikácie" z nastavení mobilnej aplikácie, čím sa rozhranie zjednodušilo.

---

## Dátum: 15. apríl 2026 (Predošlé zmeny)

### 1. Offline zápis v mobile app
- **Startup fix:** Mobilná appka sa už pri štarte neblokuje na "tichom" načítaní dát zo servera. Najprv sa okamžite spustí z lokálnych dát a server sa skúša až na pozadí.
- **Offline režim:** Ukladanie váhy, vody, krokov a tréningu funguje aj bez spojenia s Python serverom.
- **Local storage stav:** V nastaveniach mobilu pribudla karta so stavom lokálneho úložiska, časom posledného lokálneho zápisu, posledného syncu a chybou úložiska alebo synchronizácie.
- **PWA cache:** Service Worker dostal nové cache verzie (`v28`, neskôr `v29`), aby iPhone nebežal na miešanine starého a nového kódu po deployi.

### 2. Oprava synchronizácie vody
- **Merge logika:** Voda už nepoužíva jednoduché "vyhrá posledná hodnota". Sync teraz rozlišuje bežný nárast vody od resetu na `0 ml`.
- **Nové metadáta:** Do `sync_meta` bol doplnený kľúč `water_reset`, aby sa dalo rozpoznať, či ide o nový reset-cyklus alebo len ďalšie navýšenie pitného režimu.
- **Klient aj server:** Oprava bola spravená v `shared/engine.js` aj `server.py`, aby sa voda správne zlučovala pri mobile, desktope aj pri serverovom merge.

### 3. Oprava desktop zobrazenia vody
- **Manuálny sync button:** Desktop opäť inicializuje `btn-sync`, takže manuálna synchronizácia je funkčná aj z UI.
- **Lokálne dátumy:** KPI voda, vodný graf a consistency grid už nepoužívajú UTC dátum cez `toISOString()`, ale lokálny dátum. To opravuje stav, keď sa po polnoci voda synchronizovala do servera správne, ale desktop ju nezobrazil v dnešnom dni.
- **Vizualizácia:** Po refreshe desktopu sa už správne zobrazuje hodnota "Voda dnes" aj vodný graf.

---

## Dátum: 14. apríl 2026 (Dnešné zmeny)

---

## Čo sme vytvorili a opravili

### 1. Kompletný Rebranding na "DoFormy"
- **Premenovanie:** Všetky zostávajúce výskyty starého názvu "FitnessPal" boli v kóde nahradené novým názvom "DoFormy" (komentáre v `shared/progress-store.js`, správy v spúšťacích skriptoch).
- **Čistka spúšťačov:** Odstránený zastaraný súbor `spusti_fitness.vbs`. Primárnym a bezpečným spúšťačom zostáva `Spusti_DoFormy.vbs`, ktorý pred štartom korektne ukončuje staré procesy.

### 2. Organizácia pracovného priestoru
- **Archivácia:** Vytvorený priečinok `backup/`, do ktorého boli presunuté staré a neidentifikované databázové súbory (`zenfit.db`, staršie zálohy `doformy.db.*`).
- **Prehľadnosť:** Hlavný adresár projektu je teraz vyčistený od duplicitných skriptov a nepotrebných dátových súborov, čo uľahčuje ďalší vývoj.

---

## Dátum: 12. apríl 2026 (Predošlé zmeny)
- **Logika:** Implementovaný endpoint `/api/reset` na serveri, ktorý transakčne vymaže tabuľku `history` a zvýši `resetVersion` v tabuľke `user`.
- **Sync:** Engine teraz deteguje vyššiu `resetVersion` zo servera a automaticky zahodí lokálnu históriu, čím zabráni "oživeniu" starých dát (aj pri "tichom" štarte mobilu).
- **Mobile UI:** Pridaná nová karta v nastaveniach s deštruktívnym tlačidlom "Resetovať systém".
- **Safari/iOS Fix:** Opravené CORS hlavičky (`Access-Control-Max-Age`, `Authorization`) a obnovené HTTPS pre plnú kompatibilitu s iPhone.

### 2. Systém notifikácií (v24-v25)
- **Logika:** Implementácia tréningových pripomienok pre PWA (iPhone na ploche).
- **Pripomienky:** Notifikácia sa odošle každý tréningový deň (Pondelok, Streda, Piatok) o 8:00 ráno.
- **Nastavenia:** Pridaná nová sekcia v Nastaveniach iPhonu so stavom povolenia a tlačidlom na odoslanie testovacej notifikácie.
- **Service Worker:** Aktualizovaný `sw.js` pre správne doručovanie a spracovanie kliknutia na notifikáciu.

### 3. Vylepšenie Desktop synchronizácie (v22-v23)
- **Automatická očista:** Polling na Desktope (každé 2s) teraz deteguje globálny reset zo servera a automaticky vymaže lokálne grafy.
- **Hard Reset:** Pridané manuálne tlačidlo "Hard Reset" (ikona koša 🗑️) v headeri Desktopu pre vynútené premazanie lokálnej vyrovnávacej pamäte v prípade zaseknutia cache v prehliadači.

### 4. Striktne manuálna synchronizácia (v27)
- **Offline-First:** iPhone funguje ako primárne úložisko dát (Master).
- **Kontrola prenosu:** Odstránená pokusná automatická synchronizácia. Dáta sa na server odošlú **iba manuálne** po stlačení tlačidla 🔄, čím má používateľ plnú kontrolu nad tým, kedy sa Desktop aktualizuje.

---

## Dátum: 5. apríl 2026

---

## Čo sme vytvorili a opravili

### 1. Master-Slave Synchronizácia (Mobile Master)
- **Logika:** Mobilná aplikácia (PWA na iPhone) je teraz nastavená ako hlavný zdroj dát. Desktopová aplikácia slúži primárne na vizualizáciu.
- **Pasívny Desktop:** Desktopová aplikácia v automatickom 2s intervale dáta iba **sťahuje** (`GET`), čím sa zabránilo nechcenému prepisovaniu novších mobilných zmien starými dátami z PC.
- **Fix Resetu vody:** Opravená chyba, kedy nebolo možné na mobile vynulovať vodu na 0 ml. Zmenená merge logika z `Math.max` späť na `pickLatestValue` (vyhráva najnovšia časová pečiatka).

### 2. Kompletný redesign Desktop Dashboardu
- **Analytické centrum:** Pôvodné widgety nahradené moderným Grid rozložením (2x2 matica grafov).
- **KPI Lišta:** Horný pás s kompaktnými kartami pre okamžitý prehľad (Kroky, Voda, Váha).
- **Nové grafy (Chart.js):**
    - **Trend váhy:** 30-dňová línia s výpočtom úbytku/prírastku.
    - **Aktivita krokov:** 14-dňový stĺpcový graf s indikáciou splneného cieľa.
    - **Pitný režim:** 7-dňový plošný graf hydratácie.
    - **Kalendár konzistencie:** 14-dňová heatmapa úspešnosti dní (body za kroky, vodu a tréning).
- **Kompaktnosť:** Celé UI zmenšené o cca 50% pre lepší prehľad na monitore.
- **Stabilita:** Implementovaný hash-check, ktorý zabraňuje preblikávaniu (re-renderu) grafov, ak sa dáta nezmenili.

### 3. Vizuálna indikácia stavu (Mobile)
- **Status Bar:** Pridaná lišta pod hlavičku mobilnej appky, ktorá upozorňuje na chýbajúcu Server URL alebo offline stav. Rieši problém iPhonu, ktorý pri pridaní na plochu niekedy "stratil" parametre z URL.

### 4. Odstránenie Karty návykov
- **Čistka kódu:** Kompletne odstránená funkcia "Karta návyku" z HTML, CSS, JavaScriptu (mobil aj desktop) a databázovej schémy na serveri.

### 5. Fresh Start (Úplný Reset)
- **Vynulovanie systému:** Databáza bola prečistená, dátum štartu nastavený na dnešok (5. 4. 2026).
- **Reset Versioning:** Verzia resetu zvýšená na **10**, čo vynucuje okamžité premazanie lokálnej pamäte na všetkých pripojených zariadeniach pri ich najbližšom štarte.

---

## Technické detaily

### Synchronizačná logika (Zmeny)
- Voda a kroky v `shared/engine.js` a `server.py` používajú inteligentné spájanie.
- Voda: Cieľ je automaticky zaokrúhľovaný na najbližších **100 ml** (vzorec: Váha * 35).

---

## Dátum: 2. apríl 2026
... (zvyšok histórie zostáva zachovaný) ...
