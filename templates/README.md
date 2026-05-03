# Project Templates

Each `.json` file in this directory defines a project template — a named set
of checklist items that get materialized as `tasks` when a new engagement is
created. Templates are consumed by `TaskSink` implementations (see
`api/adapters/TaskSink.ts`).

Ship a handful of templates that match how your organization runs projects.
Two reference templates are included:

- `consulting-engagement.json` — fixed-scope, SOW-driven engagement with
  kickoff → active → readout → closeout phases
- `time-and-materials-project.json` — flexible T&M engagement with weekly
  status checkpoints

## Schema

```ts
{
  "id": "kebab-case-identifier",       // matches filename (without .json)
  "name": "Human-readable name",
  "description": "One-line summary",
  "phases": ["Phase A", "Phase B"],    // optional phase groupings
  "items": [
    {
      "title": "Short task title",     // required
      "description": "Longer body",    // optional
      "phase": "Phase A",              // must match one of `phases`
      "due_offset_days": -14,          // days relative to engagement_start (negative = before)
      "tags": ["billing", "kickoff"]   // optional filtering tags
    }
  ]
}
```

## Using a template

```ts
import fs from 'node:fs/promises'
import { InternalTasksSink } from '../api/adapters/InternalTasksSink'

const template = JSON.parse(await fs.readFile('templates/consulting-engagement.json', 'utf8'))
const sink = new InternalTasksSink()
await sink.createProjectTasks({
  projectId: '...',
  projectName: 'Acme Pentest',
  engagementStart: new Date('2026-05-01'),
  template,
})
```

## Adding your own

1. Copy one of the reference templates.
2. Rename the file and set the `id` to match.
3. Edit the phases and items to fit your workflow.
4. That's it — templates are loaded at read time, no redeploy needed if you
   fetch them dynamically.
