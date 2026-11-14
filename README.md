# Peaks of Light — Navigator Polul Sud

**NASA Space Apps Challenge 2026 · Alba Iulia · 14–15 noiembrie**
Provocarea: **Lunar Landing Site Navigator**
Echipa: **Peaks of Light** (Adrian, Eren)

O hartă 3D interactivă a polului sud lunar. Arată, pentru orice loc de aselenizare și orice zi, când are Soare (energie) și când vede Pământul (comunicații directe), calculat din relieful real.

> **Stare la începutul hackathonului (sâmbătă dimineața):** avem un prototip funcțional pe **teren generat** și cu **poziții simplificate** pentru Soare și Pământ (`index.html`). Treaba din weekend: înlocuim terenul generat cu relieful LOLA, pozițiile simplificate cu efemeride NASA și validăm rezultatele pe hărțile oficiale de iluminare.

---

## Cuprins

1. [Termene și reguli care ne pot elimina](#1-termene-și-reguli-care-ne-pot-elimina)
2. [Provocarea și de ce am ales-o](#2-provocarea-și-de-ce-am-ales-o)
3. [Ideea: ce construim](#3-ideea-ce-construim)
4. [Prototipul de până acum](#4-prototipul-de-până-acum)
5. [Cum funcționează calculul](#5-cum-funcționează-calculul)
6. [Datele NASA pe care le folosim](#6-datele-nasa-pe-care-le-folosim)
7. [Planul pentru weekend](#7-planul-pentru-weekend)
8. [Pitch (3–5 minute, în engleză)](#8-pitch-35-minute-în-engleză)
9. [Checklist pentru predare](#9-checklist-pentru-predare)
10. [Transparență: ce am făcut înainte și cu ce unelte](#10-transparență-ce-am-făcut-înainte-și-cu-ce-unelte)
11. [Anexă: regulament, premii, logistică](#11-anexă-regulament-premii-logistică)
12. [Surse](#12-surse)

---

## 1. Termene și reguli care ne pot elimina

| Când | Ce | Dacă ratăm |
|---|---|---|
| **Duminică 15:00** | Formularul local de pitch + orice fișiere sau linkuri pe care le folosim la prezentare (link-ul vine pe email și WhatsApp) | Nu mai putem lua premii în bani |
| **Duminică 15:30** | Pitch în fața juriului | — |
| **Duminică 18:50** | **Proiectul trimis pe platforma NASA Space Apps** | Fără premii locale și fără nominalizare globală |

- **Suntem 2 în echipă, deci amândoi trebuie să fim fizic acolo pe toată durata jurizării.** Regula cere două treimi din echipă prezentă; pentru 2 membri, minimul e 2.
- Fiecare membru trebuie să fie în echipa corectă de la Alba Iulia pe platforma NASA și **să nu fie pe waitlist**.
- Proiectul trebuie să folosească **cel puțin o sursă de date NASA**, în mod real, și să răspundă provocării alese.
- **Nu avem voie să inventăm date sau rezultate.** Cifrele din prototip vin din teren generat, deci nu le prezentăm ca rezultate reale (vezi secțiunea 10).
- Putem folosi muncă făcută înainte, dar trebuie să arătăm **progres concret făcut în weekend** și să fim transparenți despre surse și unelte, inclusiv AI.

**Juriul** dă note de la 1 la 10 pe 5 criterii, fiecare cu 20%:

| Criteriu | Ce urmărește | Cum îl atacăm |
|---|---|---|
| Impact | Beneficiu real, problemă importantă | Alegerea locurilor de aselenizare Artemis: energie + comunicații |
| Creativitate | Originalitate | Hartă 3D „vie”, comparație pe zile, catarg reglabil |
| Validitate | Fundament științific, fezabilitate | Comparație cu hărțile oficiale de iluminare LRO (secțiunea 6) |
| Relevanță | Răspunde provocării, folosește date NASA | Exact ce cere provocarea: Soare și Pământ față de orizont |
| Prezentare | Claritate, demo | Demo live + video de rezervă |

La egalitate decide Impactul, apoi Validitatea, apoi Creativitatea.

---

## 2. Provocarea și de ce am ales-o

**Lunar Landing Site Navigator** (nivel mediu–avansat): o unealtă care compară locuri și date de aselenizare la **polul sud al Lunii**, arătând poziția **Soarelui** și a **Pământului** față de orizont. Din asta rezultă ferestrele de **energie** (Soare deasupra reliefului) și de **comunicații directe cu Pământul** (Pământ deasupra reliefului).

De ce această provocare:

- Pe 6 noiembrie, la Alba Iulia avea **o singură altă echipă** (Red rocket). Pe Health Monitoring erau ~5 echipe, pe Field Shift 4.
- E cea mai „inginerească” provocare: geometrie, ferestre de timp, compromisuri. Se potrivește cu experiența noastră de validare de sisteme.
- 3D-ul nu e decor aici: umbrele din cratere sunt chiar răspunsul la întrebare.

<details>
<summary>Toate cele 14 provocări și câte echipe aveau la Alba Iulia (6 noiembrie)</summary>

| Provocare | Nivel | Echipe la Alba Iulia |
|---|---|---|
| Dancing with the SARs | Mediu–Avansat | 0 |
| The Earth Information Jukebox | Începător–Mediu | 0 |
| Planet X and SPHEREx | Avansat | 0 |
| Space Mission Design Game | Începător–Mediu | 0 |
| Interplanetary Survival Guide: Martian Map | Mediu | 0 |
| **Lunar Landing Site Navigator** | Mediu–Avansat | 1 (+ noi) |
| Junior Astronaut Mission Trainer | Începător–Mediu | 1 |
| Harmonization of MODIS and VIIRS Hot Spots | Mediu–Avansat | 1 |
| Abandoned but not Forgotten | Începător–Mediu | 2 |
| Be An Earth System Trend Detective! | Avansat | 2 |
| Identify Earth Analogs (Lună/Marte) | Toate | 2 |
| Flame in Freefall | Mediu–Avansat | 2 |
| Field Shift: Adapting Farms with NASA Data | Mediu–Avansat | 4 |
| Create Health Monitoring Software for Astronauts | Mediu | ~5 |

Numărătoarea e din lista de echipe de pe platformă la data respectivă; între timp s-ar putea să se fi schimbat.
</details>

---

## 3. Ideea: ce construim

La polul sud, Soarele se rotește în jurul orizontului o dată la ~29,5 zile și nu urcă niciodată mai sus de ~1,5° (plus câteva zecimi de grad, în funcție de poziția locului). Pământul oscilează lângă orizont cu ±6,7° pe verticală. De aceea:

- crestele și vârfurile pot avea Soare aproape tot timpul („peaks of light” — de aici numele echipei);
- fundul craterelor poate fi în umbră permanentă (regiuni permanent umbrite, unde se poate afla gheață);
- un loc bun pentru energie nu e neapărat bun pentru comunicații, și invers.

**Navigatorul** răspunde la trei întrebări pentru orice loc ales pe hartă:

1. Ce procent din timp are Soare și Pământ deasupra orizontului?
2. Care e cea mai lungă perioadă fără Soare (cât trebuie să țină bateriile)?
3. În ce zile și ore sunt deschise ferestrele de energie și de comunicații?

**Exemplul din prototip** (teren generat, deci doar ilustrativ, nu rezultate reale):

| Loc | Soare | Pământ | Ambele | Cea mai lungă noapte |
|---|---|---|---|---|
| A — creasta craterului | 78% | 56% | 45% | 6,5 zile |
| B — versantul dinspre Pământ | 56% | 73% | 40% | 13 zile |
| C — fundul craterului | 0% | 0% | 0% | tot anul |

Asta e povestea pentru pitch: A e cel mai bun loc pentru energie, B pentru comunicații, iar C are probabil gheață, dar nici energie, nici legătură cu Pământul. Pe date reale, punem în locul lor locuri reale: marginea craterului Shackleton, creasta de legătură, masivul Malapert.

---

## 4. Prototipul de până acum

Fișier: [`index.html`](index.html). Un singur fișier, fără dependențe și fără server. Se deschide direct în browser.

**Rulare**
- Local: dublu-click pe `index.html`.
- Online: în repo, **Settings → Pages → Deploy from a branch → `main` / root**. După ~1 minut demo-ul e live la `https://<user>.github.io/<repo>/`. Linkul ăsta merge în formularul de pitch și în predarea NASA.

**Ce face**
- Hartă 3D a unei zone de 48 × 48 km în jurul polului, sub formă de bloc de relief care se rotește cu mouse-ul sau degetul.
- Simulare în timp (butonul ▶, slider pe 365 de zile, viteză reglabilă): umbrele se mișcă odată cu Soarele.
- Trei straturi: **Lumina acum**, **Soare pe an** (procent mediu de iluminare), **Pământ pe an** (procent mediu de vizibilitate).
- Locuri candidate A, B, C, cu statistici; **atingi terenul și adaugi locul tău (D)**, cu statistici calculate pe loc.
- **Graficul orizontului** pentru locul selectat: profilul reliefului pe 360°, banda pe unde trece Soarele într-un an, zona în care oscilează Pământul, pozițiile curente.
- **Banda anuală**: pentru fiecare loc, zi cu zi, cât din zi are Soare și cât vede Pământul. Click pe ea te duce la acea zi.
- Exagerare a reliefului reglabilă (doar vizual, nu schimbă calculul).
- Merge pe telefon (touch, pinch-zoom) și în temă deschisă sau închisă.

**Tehnic:** WebGL scris direct (fără Three.js), JavaScript simplu, Canvas 2D pentru grafice. Calculul inițial durează 1–2 secunde pe laptop.

---

## 5. Cum funcționează calculul

### Relief
- Grilă de calcul: 257 × 257 puncte, la 375 m, adică 96 × 96 km. Se afișează doar centrul de 48 × 48 km; restul există ca relieful din jur să poată umbri marginile.
- În prototip relieful e generat: un crater de ~21 km lângă pol (seamănă cu Shackleton), un masiv spre Pământ (seamănă cu Malapert), cratere mici și zgomot fractal.

### Orizontul fiecărui punct
Pentru fiecare punct și fiecare direcție (64 de direcții pentru hartă, 360 pentru locurile candidate) mergem pe teren până la 46 km și reținem unghiul maxim de elevație:

```
unghi = atan( (h(d) − d² / (2·R_Lună) − h₀) / d )
```

Termenul `d² / (2·R)` e **curbura Lunii**: la 20 km, terenul „coboară” cu ~115 m. Pasul crește cu distanța (6% din distanță pentru hartă, 2,5% pentru locuri). Calculul se oprește devreme când nici cel mai înalt vârf nu mai poate depăși unghiul găsit.

Locurile candidate au panourile și antena pe un **catarg de 10 m**.

### Soare și Pământ (simplificat în prototip)

| Mărime | Model în prototip |
|---|---|
| Azimutul Soarelui | cerc complet la 29,53 zile (luna sinodică) |
| Elevația Soarelui la pol | ±1,54° · sin(2π·t / 346,62 zile) |
| Azimutul Pământului | ±7,9° · sin(2π·t / 27,55 zile) (librație în longitudine) |
| Elevația Pământului la pol | ±6,7° · sin(2π·t / 27,21 zile + 0,7) (librație în latitudine) |
| Corecție pentru un loc aflat la distanța c de pol | elevație + c·cos(azimut_corp − azimut_loc) |
| Discul Soarelui | rază 0,267°; fracția luminată crește liniar pe diametrul discului |
| Discul Pământului | rază 0,95° |

**În versiunea finală** înlocuim tabelul cu efemeride reale (secțiunea 6) și cu formula exactă de elevație pentru un loc la latitudinea φ și longitudinea λ:

```
sin(elevație) = sin(φ)·sin(β) + cos(φ)·cos(β)·cos(λ_corp − λ)
```

unde (β, λ_corp) e punctul subsolar, respectiv subterestru, pe Lună.

### Statistici pe loc
Eșantionăm anul la fiecare 3 ore (2.920 de momente):
- **Soare**: media fracției luminate a discului.
- **Pământ**: procentul momentelor cu mai mult de jumătate din disc deasupra reliefului.
- **Ambele**: momente cu Soare și Pământ în același timp.
- **Cea mai lungă noapte**: cel mai lung șir de momente fără Soare.

### Limite cunoscute
- Relieful de dincolo de 46 km nu e luat în calcul.
- Rezoluția de 375 m netezește crestele mici; pe date reale de 20 m sau 5 m, rezultatele se schimbă.
- În prototip, efemeridele sunt simplificate (vezi mai sus).

---

## 6. Datele NASA pe care le folosim

### Relief: LOLA (Lunar Orbiter Laser Altimeter, LRO)

| Fișier | Acoperire | Rezoluție | Mărime | Pentru ce |
|---|---|---|---|---|
| `LDEM_875S_20M` | 87,5°S → pol (~76 km rază) | 20 m | JP2 20 MB / IMG 110 MB | **Varianta principală** pentru hartă |
| `LDEM_85S_40M` | 85°S → pol (~150 km rază) | 40 m | JP2 21 MB / IMG 110 MB | Relieful din jur, pentru orizont |
| `ldem_87s_5mpp.tif` (PGDA) | 87°S → pol | 5 m | 3,3 GB | Prea mare pentru weekend |
| DEM-uri pe locuri (PGDA, ex. `Site04` = marginea Shackleton, `Site23` = masivul Malapert) | ~20 × 20 km | 5 m | — | Zoom pe un loc, dacă avem timp |

Descărcare: `https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_875S_20M.IMG` (și `.LBL` alături). Formatul `.IMG` e binar cu valori întregi pe 16 biți. **Citiți `SCALING_FACTOR`, `OFFSET` și proiecția din fișierul `.LBL`** înainte de conversie (proiecție polar-stereografică, coordonate în metri).

### Validare: hărțile oficiale de iluminare (PGDA / LRO)

| Fișier | Ce conține | Rezoluție |
|---|---|---|
| `AVGVISIB_85S_060M_201608` | Iluminare solară medie | 60 m |
| `AVGVISIB_85S_060M_201608_EARTH` | Vizibilitate medie a Pământului | 60 m |
| `LPSR_85S_060M_201608` | Regiuni permanent umbrite | 60 m |

Descărcare GeoTIFF: `https://pgda.gsfc.nasa.gov/data/MoonIllumination/<NUME>.TIF`

**Pentru Validitate:** calculăm cu algoritmul nostru media pe un an și o comparăm cu `AVGVISIB_85S...` pe aceeași zonă. Un grafic „noi vs. NASA” în pitch e cel mai puternic argument științific pe care îl putem aduce. Diferențele mari ne arată limitele noastre (rezoluție, efemeride, perioada de timp).

### Poziții reale pentru Soare și Pământ

**Varianta rapidă: JPL Horizons.** Cerere pe ținta **Lună (301)**, observator **centrul Pământului (500@399)**, pas de 1 oră, pe un an, cu cantitățile:
- **14** — punctul subterestru (sub-lon, sub-lat), de unde se vede Pământul;
- **15** — punctul subsolar (sub-lon, sub-lat), de unde se vede Soarele.

Exportăm tabelul CSV și îl încărcăm în pagină. Verificați convenția de longitudine (est/vest) față de proiecția LOLA.

**Varianta precisă: NASA NAIF SPICE** (Python: `spiceypy`), cu nucleele generice NAIF pentru timp, efemeride planetare și orientarea Lunii (cadrul `MOON_ME`, același ca LOLA, DE421).

### Pipeline-ul de date (de scris sâmbătă)

```
LDEM_875S_20M.IMG ──► Python (numpy): citire după .LBL, decupare în jurul polului,
                      reeșantionare la grila de calcul ──► heights.bin (Float32)
Horizons CSV ──► Python: interpolare la pași de 1–3 ore ──► ephem.json
index.html ──► încarcă heights.bin și ephem.json în loc de terenul generat
AVGVISIB_85S_060M ──► Python: comparație cu media noastră ──► grafic pentru pitch
```

Atenție: GitHub Pages servește fișiere până la 100 MB. Un `heights.bin` de 257 × 257 Float32 are ~260 KB; o grilă mai fină, de 1025 × 1025, are ~4 MB.

---

## 7. Planul pentru weekend

Rolurile sunt **propuse**; le stabilim pe loc.

| Cine | Rol |
|---|---|
| Adrian | Datele reale (LOLA, efemeride), algoritmul, validarea față de NASA |
| Eren | Interfața și 3D-ul, pitch deck-ul, video-ul demo |

### Sâmbătă, 14 noiembrie

| Ora | Ce | Gata când |
|---|---|---|
| 11:00–13:00 | Descărcăm `LDEM_875S_20M`, `LDEM_85S_40M`, `AVGVISIB_85S_060M` (+ `_EARTH`, `LPSR`). Script Python care citește `.IMG` după `.LBL` | Avem relieful real ca matrice numpy |
| 11:00–13:00 | În paralel: cerere Horizons (cantitățile 14 și 15, un an, pas de 1 h) | Avem `ephem.csv` |
| 14:00–17:00 | `heights.bin` + `ephem.json`; pagina le încarcă în loc de terenul generat | Harta arată Shackleton și relieful real |
| 17:00 | Check-in cu mentorii: arătăm progresul | Feedback notat |
| 20:00–22:00 | Validare: media noastră vs. `AVGVISIB_85S_060M`, pe aceeași grilă | Un grafic și un procent de potrivire |
| seara | Locuri reale: marginea Shackleton, creasta de legătură, Malapert, plus o regiune permanent umbrită | Tabel cu cele 4 locuri, pe date reale |

### Duminică, 15 noiembrie

| Ora | Ce |
|---|---|
| 09:10–12:00 | Pitch deck, video demo de rezervă (60–90 s), README final, GitHub Pages live |
| 13:00 | Testăm tot: linkul GitHub Pages pe alt laptop și pe telefon, video-ul, slide-urile |
| **înainte de 15:00** | **Formularul de pitch** cu linkurile (demo, repo, slide-uri, video) |
| 15:30 | Pitch |
| **cât mai repede după pitch, înainte de 18:50** | **Predarea pe platforma NASA** (ideal o pregătim înainte de 15:00 și doar apăsăm Submit) |

Dacă rămâne timp:
- Comutator pentru înălțimea catargului (0 / 10 / 50 m) și efectul lui asupra statisticilor.
- Export CSV cu ferestrele de energie și comunicații pentru locul selectat.
- Narare vocală a ferestrelor (ElevenLabs are premiu separat pentru proiecte care îl folosesc).

---

## 8. Pitch (3–5 minute, în engleză)

Timpul exact se anunță înainte de jurizare: 3–5 minute de pitch, plus 1–3 minute de întrebări, în funcție de numărul de echipe. Pregătim o variantă de 3 minute și una de 5.

1. **Hook (20 s).** *"At the Moon's south pole, the Sun never climbs more than about one and a half degrees above the horizon. A crater rim can be in sunlight almost all the time, while the floor of the same crater hasn't seen the Sun in billions of years."*
2. **Problem (30 s).** Artemis landers need power from the Sun and a direct line to Earth. Both depend on terrain, location and date, and the best spot for one is often bad for the other.
3. **Solution (30 s).** *Peaks of Light*: an interactive 3D navigator that computes, from real LOLA terrain, when any site sees the Sun and the Earth.
4. **Live demo (90 s).** Play time; compare the Shackleton rim with Malapert; tap a new site; show the horizon chart.
5. **NASA data & validation (30 s).** LOLA elevation models, JPL ephemerides; our yearly illumination against NASA's official LRO illumination maps.
6. **What we built this weekend (20 s).** Be explicit: the prototype existed on synthetic terrain; this weekend we connected real NASA data and validated it.
7. **Impact & next steps (20 s).** Mission planning, rover traverse planning, power and battery sizing, public outreach.

**Întrebări probabile de la juriu**
- *Cât de precis e?* → Graficul de validare: diferența față de hărțile NASA și de unde vine.
- *De ce nu folosiți direct hărțile NASA de iluminare?* → Ele dau medii; noi dăm ferestre pe zi și oră, pentru orice loc și orice înălțime de catarg, plus comparația între locuri.
- *Curbura Lunii?* → Inclusă: la 20 km, ~115 m.
- *Ce lipsește?* → Rezoluția (folosim 20 m, există 5 m), relieful de dincolo de 46 km, umbrirea parțială a discului Pământului.

---

## 9. Checklist pentru predare

**Formularul local (până duminică la 15:00)**
- [ ] Formatul prezentării (slide-uri + demo live)
- [ ] Link GitHub Pages (demo)
- [ ] Link repo
- [ ] Slide-uri (PDF) și video de rezervă

**Platforma NASA Space Apps (până duminică la 18:50)**
- [ ] Amândoi în echipa Peaks of Light, la evenimentul Alba Iulia, fără waitlist
- [ ] Provocarea: Lunar Landing Site Navigator
- [ ] Titlu și descriere (textul de mai jos)
- [ ] Datele NASA folosite, cu linkuri (secțiunea 6)
- [ ] Alte surse și unelte, inclusiv asistența AI (secțiunea 10)
- [ ] Link demo + repo (+ video sau slide-uri, dacă platforma le cere)

**Descriere de proiect (draft în engleză, de actualizat cu rezultatele reale):**

> *Peaks of Light is an interactive 3D navigator for the lunar south pole. Using LRO LOLA elevation models and JPL ephemerides, it computes the terrain horizon of every point and shows, for any candidate landing site and date, when the Sun is above the horizon (power) and when the Earth is visible (direct-to-Earth communications). Users can compare sites side by side, add their own site, and see yearly statistics such as the longest period without sunlight. We validated our yearly illumination results against NASA's official LRO average illumination maps.*

---

## 10. Transparență: ce am făcut înainte și cu ce unelte

Regulamentul permite muncă făcută înainte, cu condiția să o declarăm și să arătăm progres făcut în weekend. O spunem deschis, în pitch și în predare:

- **Înainte de eveniment (6–13 noiembrie):** am ales provocarea, am făcut prototipul `index.html` pe **teren generat procedural** și cu **poziții simplificate** pentru Soare și Pământ. Prototipul a fost construit cu ajutorul unui asistent AI (Claude, de la Anthropic).
- **Cifrele din prototip nu sunt rezultate reale** și nu le prezentăm ca atare. Le folosim doar ca exemplu în acest document.
- **În weekend:** legătura cu datele NASA reale (LOLA, efemeride), validarea față de hărțile oficiale de iluminare, locurile reale, pitch-ul și predarea. Ce facem cu AI în weekend notăm în lista de mai jos.

| Ce | Unealtă / sursă |
|---|---|
| Prototip, documentație | Claude (asistent AI) |
| _de completat în weekend_ | |

---

## 11. Anexă: regulament, premii, logistică

**Program**
- Sâmbătă: check-in 08:30 (cu buletin sau pașaport), deschidere 09:30, hacking de la 11:00, pauză 13:00, check-in-uri cu mentorii 17:00, încheierea zilei ~21:30.
- Se poate lucra peste noapte în locație, dar fără paturi. **La 23:00 se închid ușile**: cine iese nu mai intră până dimineață.
- Duminică: uși deschise 08:30, briefing 09:00, sprint final 09:10, **termen formular 15:00**, pitch-uri de la 15:30, **predare NASA 18:50**, premiere ~19:00.

**Locația:** Centrul de Conferințe „Gheorghe Șincai”, strada Gheorghe Șincai, Alba Iulia.

**Premii (brut, plătite în lei la cursul fix 1 € = 5,2405 lei, prin transfer, în cel mult 30 de zile):**

| Loc | Euro | Lei |
|---|---|---|
| 1 | 3.000 | 15.721,50 |
| 2 | 2.000 | 10.481,00 |
| 3 | 1.000 | 5.240,50 |

Echipa desemnează un reprezentant care primește premiul și semnează cum îl împarte. Impozitul depinde de cum și cui se plătește; organizatorii stabilesc la plată.

**ElevenLabs:** o lună gratuită de Creator pentru fiecare participant (cod pe Discord, `#coupon-codes`), plus premii software separate, inclusiv unul pentru cel mai bun proiect construit cu ElevenLabs.

**Global:** primele echipe locale pot fi nominalizate la jurizarea internațională (18–30 noiembrie); câștigătorii globali sunt anunțați în ianuarie 2027.

**Contact organizatori:** contact@daregen.ro, comunitatea WhatsApp a evenimentului.

---

## 12. Surse

- Regulamentul participanților, NASA Space Apps Alba Iulia 2026 (Dare.Gen, versiunea finală, 6 nov. 2026)
- Provocările oficiale: <https://www.spaceappschallenge.org/2026/challenges/>
- LOLA, produse polare (LDEM): <https://imbrium.mit.edu/BROWSE/LOLA_GDR/POLAR/SOUTH_POLE>
- LOLA 5 m/pixel, mozaicul 87°S: <https://pgda.gsfc.nasa.gov/products/81>
- LOLA 5 m/pixel, locuri de aselenizare: <https://pgda.gsfc.nasa.gov/products/78>
- Hărți de iluminare polară LRO: <https://pgda.gsfc.nasa.gov/products/69>
- Moon Trek (NASA): <https://trek.nasa.gov/moon/>
- JPL Horizons: <https://ssd.jpl.nasa.gov/horizons/>
- NASA NAIF SPICE: <https://naif.jpl.nasa.gov/naif/>
- Barker et al., 2021, *Planetary and Space Science* 203, 105119 — de citat dacă folosim produsele LOLA de 5 m: <https://doi.org/10.1016/j.pss.2020.105119>
