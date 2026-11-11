# Treningsdashboard

Dashboard for Strava-eksport bygget med Vite, React, Tailwind og shadcn/ui. Støtter lys og mørk modus.

## Oppdatere data
1. Last ned eksport fra Strava (Innstillinger → Min konto → Last ned eller slett kontoen din).
2. Kjør: `python3 -I scripts/build-data.py <eksport>/activities.csv public/data.json`
3. Commit og push – GitHub Actions publiserer til Pages.

Kun nøkkeltall per økt tas med (ingen GPS-spor, e-post, vekt eller notater).

## Utvikling
```bash
npm install
npm run dev
```
