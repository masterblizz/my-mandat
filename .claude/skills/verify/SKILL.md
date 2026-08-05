---
name: verify
description: Build, launch, and drive MY MANDAT (Next.js 14) to verify changes at the browser surface.
---

# Verify MY MANDAT

## Launch
```bash
npm run dev -- --port 3177 &   # ready in ~15-30s under WSL /mnt/c
curl -s -o /dev/null -w "%{http_code}" http://localhost:3177/<route>   # poll until 200
```

## Drive
Playwright chromium is a devDependency. Scripts outside the repo need
`NODE_PATH=<repo>/node_modules node script.js`.

- Pages work cold (Zustand store has defaults; no login/setup needed).
  Visit routes directly: `/warroom`, `/kawasan`, `/campaign`, etc.
- Capture `console` + `pageerror` events — the app should log zero errors.
- Emoji/CJK glyphs render as boxes in headless chromium (missing fonts);
  that's the environment, not a bug. Prefer ASCII in UI chrome anyway.

## Gotchas
- `/kawasan` 3D map: camera state is in CSS vars `--kw-rz/--kw-rx/--kw-zoom`
  on `.kw-scene` (inline style, set imperatively) — read them via
  `el.style.getPropertyValue(...)` to assert drag/zoom worked.
- Zone selection is suppressed after a drag (movement > 6px); click without
  moving to select.
- WSL /mnt/c file watching is flaky: after editing files the dev server may
  keep serving stale code or 404 the route. Restart the server (and if it
  500s with "React Client Manifest" errors, delete `.next` while the server
  is STOPPED, then start it) rather than debugging the app.
- The `/kawasan` city is a pure-CSS 3D scene: never animate `opacity`/`filter`
  on `.kw-world` or any `preserve-3d` ancestor — it flattens the scene into
  roof-only rectangles (see comment in globals.css).
