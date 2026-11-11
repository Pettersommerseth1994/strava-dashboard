# Magnus – Treningsdashboard

Interaktivt dashboard for Strava-eksport (Vite, React, Tailwind, shadcn/ui, Recharts). Dark mode er standard, lys modus via bryteren øverst til høyre.

## Funksjoner
- Perioder: uke, måned, kvartal, hittil i år, år, 30/90 dager, 12 mnd, alle og egendefinert, med bla-knapper og sammenligning mot forrige periode
- Rekorder (trykk for å åpne økten), personlige rekorder per distanse og rekordutvikling
- Progresjon: pace, beste 5 km/10 km m.fl., VO2 maks (VDOT-estimat), makspuls, hvilepuls, effektivitet, kadens, watt og «bygg din egen graf»
- Form (CTL/ATL/TSB), ukentlig volum og pulssoner over tid
- Utforsker (valgfri X/Y), økttabell med søk, sortering og CSV-eksport
- Detaljpanel per økt: nøkkeltall, pulssoner, puls/fart/høyde-profil, kilometersplitter. Delbar lenke via `#a=<id>`

## Oppdatere data
```bash
pip install fitdecode
python3 -I scripts/build-data.py <eksportmappe> public
```
Eksportmappen er utpakket Strava-eksport (med `activities.csv` og `activities/`). Kun nøkkeltall og tidsserier uten posisjon skrives ut (ingen GPS, e-post, vekt eller notater). Commit og push, så publiserer GitHub Actions til Pages.

## Utvikling
```bash
npm install
npm run dev
```
