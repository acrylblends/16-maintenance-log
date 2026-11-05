# Maintenance Log

Track machines, preventive maintenance schedules, work orders, downtime and service history for a facility.

An ACRYL Blends blueprint for the **Industrial** category (`acrylblends.maintenance-log`, category 16 of 100).

Status: designed, being built. `design/spec.md` is the specification and `design/mockup.html` the mockup (open it in a browser). The app itself,
composed from Cordis plugins (one `plugins/<feature>/` folder and one `blend.yaml` row per feature), lands here when it passes review.

When it is ready you will start it with:

```sh
npm create acrylblends@latest my-app -- --from acrylblends.maintenance-log
cd my-app && npm install && npm run dev
```

Listed on https://acrylblends.github.io/blends and https://acryl.dev/blends.
