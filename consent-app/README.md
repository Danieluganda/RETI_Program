# 10X Consent App

Next.js MVP scaffold for collecting program participant consent.

## Setup

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Demo login details are in `.env`.

## MVP Scope

- Login screen
- Dashboard
- New consent form
- Signature/thumbprint drawing
- PNG/JPG upload support
- Optional interpreter declaration
- Records list
- Consent detail page
- CSV report route
- Prisma schema for the future database layer

For speed, the first API implementation stores records in `private/consents.json` and files in `private/uploads/`.
