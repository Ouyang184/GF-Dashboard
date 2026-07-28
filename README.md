# AMG Daily Process Management Dashboard

A TV-ready manufacturing dashboard built as a Microsoft Power Apps Code App. It combines operational status, SharePoint-backed workflows, deviation tracking, quality metrics, and buyoff data in one responsive daily-management board.

## What the dashboard covers

The main view presents five performance pillars:

- **Safety** — daily status and editable production-area conditions
- **Quality** — weekly scrap performance and top quality issues
- **Process Deviation** — recent process deviations mapped to affected machines and areas
- **Product Deviation** — recent product deviations and affected-part details
- **Productivity** — MasterCard availability, buyoff activity, and repeated-rejection alerts

Each pillar stays compact on the main board and opens a detailed full-screen view when selected.

## Key features

- Responsive wallboard layout for desktop and TV displays
- Monthly red/yellow/green status history saved to SharePoint
- Editable production-area status for LD, MD, SD1, SD2, FS, PA&F, and EXT
- SharePoint-backed open escalations and long-term actions
- Task priorities, owners, due dates, overdue flagging, and completion history
- Detailed task popup with:
  - Problem statement
  - Root cause
  - Countermeasure
  - Affected part number and description
  - Machine assignment
  - Part-image preview
  - Completed date
- Process and product deviation maps
- Molding, coils-and-collars, and extrusion buyoff views
- MasterCard availability and missing-MasterCard workflows
- Repeated buyoff-rejection monitoring over a 24-hour window
- Remote-control entry point for opening and closing pillar views
- Daily quote and holiday indicators

## Technology

- React 19 and TypeScript
- Vite
- Tailwind CSS
- TanStack Router and TanStack Query
- Microsoft Power Apps Code Apps
- Microsoft SharePoint connector
- Excel Online (Business) connector
- Recharts

## Project structure

```text
src/
  components/       Reusable dashboard and control components
  data/             Static reference and fallback data
  generated/        Power Apps generated connector models and services
  hooks/            SharePoint, dashboard, deviation, and buyoff data hooks
  routes/           Main dashboard route and views
backend/             Optional local JSON-export API
.power/              Power Apps data-source schemas
power.config.json    Power Apps Code App configuration
```

## Prerequisites

- Node.js 22 or newer
- npm
- Access to the target Power Apps environment
- Permission to the configured SharePoint and Excel data sources
- Power Apps CLI authentication for connector refreshes and deployment

The app does not contain SharePoint credentials. Connections are resolved through the signed-in Power Apps user and the environment connection references.

## Local development

Install dependencies:

```bash
npm install
```

Start the Vite development server:

```bash
npm run dev
```

The default local address is `http://localhost:8081`.

To run on the port configured for the Power Apps local host:

```bash
npm run dev:powerapps
```

## Validation

Run the production build:

```bash
npm run build
```

Run linting:

```bash
npm run lint
```

## Power Apps workflow

Sign in:

```bash
npx power-apps login
```

Refresh a connector schema after changing SharePoint columns:

```bash
npx power-apps refresh-data-source --data-source-name "dashboard task status"
```

Run the Code App locally:

```bash
npx power-apps run
```

Build and publish:

```bash
npm run build
npx power-apps push
```

Publishing requires access to the Power Apps environment identified by the local `power.config.json`.

## Optional local backend

The `backend` directory can serve JSON files exported by Power Automate for local development or fallback testing.

1. Copy `backend/.env.example` to `backend/.env`.
2. Set the export-file paths for your machine.
3. Start the backend with Node.js.

Never commit `.env` files, access tokens, exported production records, or user-specific filesystem paths.

## Data-source maintenance

Files under `.power/` and `src/generated/` are generated from Power Apps connector metadata. Refresh them through the Power Apps CLI after SharePoint columns or data sources change. Avoid hand-editing generated connector files unless regenerating is not possible.

## Security

- Keep environment files and credentials out of Git.
- Do not place Microsoft tenant secrets or access tokens in source files.
- SharePoint permissions remain the source of truth for what a user can read or update.
- Review connector and list permissions before deploying to a new environment.

## Deployment notes

- Validate the production build before every push.
- Test the dashboard at the target TV resolution and browser zoom.
- Use full-screen browser mode for wallboard presentation.
- Refresh the browser after publishing to clear cached application assets.

