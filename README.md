# Моя дача — дневник сада и огорода

Локальный offline-first дневник участка для Android (RuStore).

**Моя дача** · Дневник сада и огорода  
Package: `com.calculatorplatform.gardendiary`

Phase 0–1: Expo foundation, SQLite + migrations, domain model, repository layer, first-run flow (участок → сезон → зона).

## Stack

- Expo SDK 57
- React Native 0.86
- React 19
- TypeScript strict
- Expo Router
- expo-sqlite
- Jest + sql.js
- ESLint

## Requirements

- Node.js **≥ 22.13.0** (required by Expo SDK 57)
- Android device or emulator for UI smoke

## Install & run

```bash
npm install
npm start
npm run android
```

## Quality checks

```bash
npm test
npm run typecheck
npm run lint
npm run doctor
```

## Project structure

```text
app/                 Expo Router screens (tabs + create forms)
src/
  components/ui/     Reusable UI (Button, Card, Screen, …)
  db/                SQLite adapters, migrations, opener
  domain/            Types, codes, errors
  repositories/      Garden, Season, Area, Catalog, Planting, Settings
  services/          First-run bootstrap
  hooks/             Garden snapshot hook
  utils/             id, localDate, timestamps, numeric, money
  theme/             Design tokens
  providers/         DatabaseProvider
__tests__/           Foundation tests (sql.js)
docs/                DATA_MODEL.md, ROADMAP.md
```

Screens own UI only. SQL and business rules live in `src/`.

## Docs

- [Data model](docs/DATA_MODEL.md) — entities, FK, delete semantics, dates, money
- [Roadmap](docs/ROADMAP.md) — Phase 2+

## Privacy

- [Privacy policy](docs/PRIVACY.md) — local data, photos, backup/export, AppMetrica, Yandex Ads
- Garden data stays on device by default; optional analytics/ads SDKs are documented in the privacy policy
