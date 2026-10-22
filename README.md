# GMS Logistics — Demo Platform

[![Deploy demo to GitHub Pages](https://github.com/SmittyWerbenn/logistics-demo-platform/actions/workflows/deploy.yml/badge.svg)](https://github.com/SmittyWerbenn/logistics-demo-platform/actions/workflows/deploy.yml)

**Live demo:** https://logistics-demo.frel.cloud/

A fully static demo of the GMS Logistics tracking & resi system. No backend,
no database server: the real GMS Worker code runs in the browser against a
SQLite (WASM) database stored in IndexedDB, seeded with fictional demo data.

- Run locally: `npm install && npm run dev` → http://localhost:5184
- Demo guide (accounts, scenarios): [README-DEMO.md](README-DEMO.md)
- Deploy: push to GitHub, then Settings → Pages → Source: **GitHub Actions**
  (`.github/workflows/deploy.yml` handles the build and the base path).

What is inside:

- React 19 + Vite + TypeScript + Tailwind SPA (public site, admin portal,
  driver portal).
- `api-worker/` — the real Cloudflare Worker (routing, RBAC, validation, AWB
  numbering, audit log) plus its D1 migrations and demo seed. It is compiled
  into the static build and runs in-browser via `src/demo/`.
- `cloudflare-worker/` — production email worker (kept for reference, not used
  by the demo; email sending is stubbed).
