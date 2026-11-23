
# FlowTrace Beta → Production SaaS: Infrastructure Migration Plan

Goal: replace `localStorage` persistence with Supabase (Lovable Cloud), add email/password auth, and enforce per-user data isolation via RLS. **Zero UI or workflow changes.**

---

## 1. Enable Lovable Cloud (Supabase)

- Turn on Lovable Cloud on the project. This provisions Postgres, Auth, and the managed Supabase client integration for TanStack Start (browser client, server auth middleware, `_authenticated` route gate, bearer attacher in `src/start.ts`).
- No external accounts required.

## 2. Database schema (single migration)

Two tables, both owned by `auth.users(id)`. No shared/global data — every row is scoped to `user_id`.

```text
clients
  id            uuid PK (default gen_random_uuid)
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
  data          jsonb NOT NULL         -- full Client shape from mock-data.ts
  created_at    timestamptz default now()
  updated_at    timestamptz default now()

projects
  id            uuid PK
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
  client_id     uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE
  data          jsonb NOT NULL         -- full Project shape incl. timeline[]
  archived      boolean NOT NULL default false
  created_at    timestamptz default now()
  updated_at    timestamptz default now()
```

Rationale for `jsonb` payloads: the existing `Client` and `Project` types (packagingComponents, timeline events, memory subsections, doc references) are already tree-shaped and evolve frequently. Storing them as `jsonb` preserves 100% of current business logic without a large relational rewrite, while `user_id` + `client_id` + `archived` columns remain indexed for filtering. This is an infrastructure swap, not a data-model refactor.

Indexes: `(user_id)`, `(user_id, archived)`, `(user_id, client_id)`.

GRANTs (mandatory in same migration):
```
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients, public.projects TO authenticated;
GRANT ALL ON public.clients, public.projects TO service_role;
```

## 3. Row Level Security

Enable RLS on both tables. Policies (all four commands, scoped strictly to `auth.uid() = user_id`):

```sql
CREATE POLICY "own rows select" ON public.clients
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own rows insert" ON public.clients
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own rows update" ON public.clients
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own rows delete" ON public.clients
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
```

Same four policies for `public.projects`. No `anon` grants. No shared/public rows.

Result: a new user signing in sees zero rows — the empty-workspace requirement is enforced by the database, not by app code.

## 4. Authentication

- Email + password only (per request; no Google/OAuth).
- Disable email confirmation initially so signup → immediate usable workspace (documented; can be toggled later).
- Two public routes:
  - `/auth` — sign in / sign up (single page, tabbed).
  - `/` — if signed in, redirect to `/dashboard`; if not, redirect to `/auth`.
- All existing app routes move under the integration-managed `_authenticated/` layout, which gates on `supabase.auth.getUser()` and redirects to `/auth`.
- Add a "Sign out" affordance in the existing sidebar footer (uses current UI slot; no visual redesign — just wires the existing user area to `supabase.auth.signOut()`).

## 5. Data access layer

Replace `src/lib/store.tsx` internals while keeping its **exact public API** (`useStore`, `useClients`, `useProjects`, `useClient`, `useProject`, `addClient`, `updateClient`, `addProject`, `updateProject`, `changeProjectStatus`, `archiveProject`, `addTimelineEvent`, `updateTimelineEvent`, `removeTimelineEvent`, `setBottleneckDays`, `reset`).

Every consumer route/component keeps working unmodified.

New implementation:
- `DataProvider` fetches the current user's `clients` and `projects` from Supabase on mount (via TanStack Query).
- Local state mirrors the DB for instant UI (optimistic updates) — same in-memory shape the UI already consumes.
- Each mutator: updates local state optimistically → writes to Supabase → on error, rolls back and surfaces a toast.
- `reset()` becomes "delete all my rows" (kept for parity; not exposed in UI).
- All business logic (status→department mapping, timeline event creation on status change, business-day reminders, normalization) is **copied verbatim** from the current store — only the persistence backend changes.

No server functions needed for CRUD: the browser Supabase client + RLS is sufficient and matches the current client-only architecture. Server functions would add complexity without a security benefit here.

## 6. Migration path for existing local data

Not required by the spec (new customers start empty), and preserving the developer's own Biomax/Genisav/Disav test data across the switch is out of scope. On first sign-in the workspace is empty by design. The old `localStorage` key is left untouched (no cleanup needed — it's simply unused).

## 7. Implementation order

1. Enable Lovable Cloud.
2. Run the schema migration (tables, indexes, GRANTs, RLS policies).
3. Add `/auth` route (sign in + sign up, using existing form components).
4. Move all existing app routes under `_authenticated/` (file renames only; no component changes).
5. Rewrite `src/lib/store.tsx` internals against Supabase, keeping the exported API identical.
6. Wire sign-out into the existing sidebar user area.
7. Update `__root.tsx` `onAuthStateChange` subscriber per integration guidance.
8. Verify: sign up as new user → dashboard is empty; create a project → reload → still there; sign out → sign up as second user → cannot see first user's data (RLS check).

## 8. Explicit non-goals

- No UI redesign, no new screens, no new fields, no workflow changes.
- No social login, no password reset flow (can be added later; not in scope).
- No multi-user workspaces / team sharing — strictly one workspace per user.
- No relational normalization of the Project/Client jsonb payloads.

---

Approve this plan and I'll execute steps 1–8 in order.
