# DoFormy - Progress dokumentácia

## Dátum: 12. apríl 2026 (Dnešné zmeny)

---

## Čo sme vytvorili a opravili

### 1. Globálny Reset dát (v20)
- **Logika:** Implementovaný endpoint `/api/reset` na serveri, ktorý transakčne vymaže tabuľku `history` a zvýši `resetVersion` v tabuľke `user`.
- **Sync:** Engine teraz deteguje vyššiu `resetVersion` zo servera a automaticky zahodí lokálnu históriu, čím zabráni "oživeniu" starých dát.
- **Mobile UI:** Pridaná nová karta v nastaveniach s deštruktívnym tlačidlom "Resetovať systém".
- **Safari/iOS Fix:** Opravené CORS hlavičky (`Access-Control-Max-Age`, `Authorization`) a obnovené HTTPS pre plnú kompatibilitu s iPhone.
- **Bezpečnosť:** Implementované potvrdzovacie okno pred vykonaním resetu.

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
