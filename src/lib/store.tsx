import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  type Client,
  type Project,
  type Department,
  type ProjectStatus,
  type TimelineEvent,
  type ProductMasterItem,
} from "./mock-data";
import { todayIso, repairDatesDeep } from "./dates";

interface State {
  clients: Client[];
  projects: Project[];
  products: ProductMasterItem[];
}

interface Store extends State {
  loading: boolean;
  userId: string | null;
  addClient: (c: Omit<Client, "id"> & { id?: string }) => Client;
  updateClient: (id: string, patch: Partial<Client>) => void;
  addProject: (p: Omit<Project, "id" | "timeline"> & { id?: string }) => Project;
  updateProject: (id: string, patch: Partial<Project>) => void;
  changeProjectStatus: (id: string, status: ProjectStatus) => void;
  archiveProject: (id: string) => void;
  addTimelineEvent: (id: string, e: TimelineEvent) => void;
  updateTimelineEvent: (id: string, index: number, patch: Partial<TimelineEvent>) => void;
  removeTimelineEvent: (id: string, index: number) => void;
  setBottleneckDays: (id: string, days: number) => void;
  /** Product Master: create or update the catalogue entry for a SKU / product name. */
  upsertProductMaster: (item: Omit<ProductMasterItem, "id"> & { id?: string }) => ProductMasterItem | null;
  reset: () => void;
}

const DataContext = createContext<Store | null>(null);

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `id-${Date.now()}`;

const today = () => todayIso();
const daysAgoIso = (days: number) =>
  new Date(Date.now() - Math.max(0, days) * 86400000).toISOString().slice(0, 10);


const uuid = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

const deptForStatus: Record<ProjectStatus, Department> = {
  "Preparing Documents": "Regulatory",
  "Under Registration": "Regulatory",
  "Order Confirmed": "Client",
  "Awaiting Payment": "Finance",
  "Artwork Review": "Regulatory",
  "In Production": "Production",
  "Production Delayed": "Production",
  "Ready to Ship": "Logistics",
  "In Transit": "Logistics",
  Delivered: "Logistics",
};

// Strip id/archived from the object we serialize into the jsonb column (they live as columns).
function serializeClient(c: Client) {
  const { id: _id, ...rest } = c;
  return rest;
}
function serializeProject(p: Project) {
  const { id: _id, archived: _a, ...rest } = p;
  return rest;
}
function serializeProduct(p: ProductMasterItem) {
  const { id: _id, ...rest } = p;
  return rest;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ clients: [], projects: [], products: [] });
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let cancelled = false;

    async function load(uid: string | null) {
      if (!uid) {
        setState({ clients: [], projects: [], products: [] });
        setLoading(false);
        return;
      }
      setLoading(true);
      const [{ data: cs, error: e1 }, { data: ps, error: e2 }, { data: pm, error: e3 }] =
        await Promise.all([
          supabase.from("clients").select("id,data").eq("user_id", uid),
          supabase.from("projects").select("id,data,archived").eq("user_id", uid),
          supabase.from("products").select("id,data").eq("user_id", uid),
        ]);
      if (cancelled) return;
      if (e1 || e2 || e3) {
        toast.error("Failed to load workspace");
        setLoading(false);
        return;
      }
      setState({
        clients: (cs ?? []).map((r: any) => ({ ...repairDatesDeep(r.data as Client), id: r.id as string })),
        projects: (ps ?? []).map((r: any) => ({
          ...repairDatesDeep(r.data as Project),
          id: r.id as string,
          archived: r.archived as boolean,
        })),
        products: (pm ?? []).map((r: any) => ({
          ...(r.data as ProductMasterItem),
          id: r.id as string,
        })),
      });
      setLoading(false);
    }


    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const uid = data.user?.id ?? null;
      setUserId(uid);
      load(uid);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      load(uid);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Persist helpers (fire-and-forget with toast on error).
  const persistClient = useCallback(async (c: Client, uid: string) => {
    const { error } = await supabase
      .from("clients")
      .upsert({ id: c.id, user_id: uid, data: serializeClient(c) as any });
    if (error) toast.error(`Save failed: ${error.message}`);
  }, []);
  const persistProject = useCallback(async (p: Project, uid: string) => {
    const { error } = await supabase.from("projects").upsert({
      id: p.id,
      user_id: uid,
      client_id: p.clientId,
      archived: !!p.archived,
      data: serializeProject(p) as any,
    });
    if (error) toast.error(`Save failed: ${error.message}`);
  }, []);
  const persistProduct = useCallback(async (p: ProductMasterItem, uid: string) => {
    const { error } = await supabase
      .from("products")
      .upsert({ id: p.id, user_id: uid, data: serializeProduct(p) as any });
    if (error) toast.error(`Save failed: ${error.message}`);
  }, []);



  const store = useMemo<Store>(() => {
    const requireUser = () => {
      if (!userId) throw new Error("Not signed in");
      return userId;
    };
    const upsertClientLocal = (c: Client) => {
      setState((s) => ({
        ...s,
        clients: s.clients.some((x) => x.id === c.id)
          ? s.clients.map((x) => (x.id === c.id ? c : x))
          : [c, ...s.clients],
      }));
    };
    const upsertProjectLocal = (p: Project) => {
      setState((s) => ({
        ...s,
        projects: s.projects.some((x) => x.id === p.id)
          ? s.projects.map((x) => (x.id === p.id ? p : x))
          : [...s.projects, p],
      }));
    };
    const getProject = (id: string) => stateRef.current.projects.find((p) => p.id === id);
    const getClient = (id: string) => stateRef.current.clients.find((c) => c.id === id);

    return {
      ...state,
      loading,
      userId,
      addClient: (c) => {
        const uid = requireUser();
        const id = uuid();
        const newClient: Client = {
          ...c,
          id,
          channels: c.channels ?? [],
          requirementsMemory: c.requirementsMemory ?? [],
          createdAt: c.createdAt ?? new Date().toISOString(),
        };
        upsertClientLocal(newClient);
        void persistClient(newClient, uid);
        return newClient;
      },
      updateClient: (id, patch) => {
        const uid = requireUser();
        const existing = getClient(id);
        if (!existing) return;
        const updated = { ...existing, ...patch };
        upsertClientLocal(updated);
        void persistClient(updated, uid);
      },
      addProject: (p) => {
        const uid = requireUser();
        const id = uuid();
        const initialStatus = p.status;
        const initialDept = deptForStatus[initialStatus] ?? p.responsibleDepartment;
        const initialEvent: TimelineEvent = {
          date: today(),
          department: initialDept,
          status: initialStatus,
          responsible: p.responsiblePerson || "—",
          comment: `Status → ${initialStatus}`,
        };
        const newProject: Project = {
          ...p,
          id,
          status: initialStatus,
          responsibleDepartment: initialDept,
          timeline: [initialEvent],
        };
        upsertProjectLocal(newProject);
        void persistProject(newProject, uid);
        return newProject;
      },
      updateProject: (id, patch) => {
        const uid = requireUser();
        const existing = getProject(id);
        if (!existing) return;
        const updated = { ...existing, ...patch };
        upsertProjectLocal(updated);
        void persistProject(updated, uid);
      },
      changeProjectStatus: (id, status) => {
        const uid = requireUser();
        const existing = getProject(id);
        if (!existing) return;
        if (existing.status === status) {
          upsertProjectLocal({ ...existing, status });
          return;
        }
        const nextDept = deptForStatus[status] ?? existing.responsibleDepartment;
        const event: TimelineEvent = {
          date: today(),
          department: nextDept,
          status,
          responsible: existing.responsiblePerson || "—",
          comment: `Status → ${status}`,
        };
        const updated: Project = {
          ...existing,
          status,
          responsibleDepartment: nextDept,
          timeline: [...existing.timeline, event],
        };
        upsertProjectLocal(updated);
        void persistProject(updated, uid);
      },
      archiveProject: (id) => {
        const uid = requireUser();
        const existing = getProject(id);
        if (!existing || existing.archived) return;
        const updated = { ...existing, archived: true, archivedAt: new Date().toISOString() };
        upsertProjectLocal(updated);
        void persistProject(updated, uid);
      },
      addTimelineEvent: (id, e) => {
        const uid = requireUser();
        const existing = getProject(id);
        if (!existing) return;
        const updated = { ...existing, timeline: [...existing.timeline, e] };
        upsertProjectLocal(updated);
        void persistProject(updated, uid);
      },
      updateTimelineEvent: (id, index, patch) => {
        const uid = requireUser();
        const existing = getProject(id);
        if (!existing) return;
        const updated = {
          ...existing,
          timeline: existing.timeline.map((ev, i) => (i === index ? { ...ev, ...patch } : ev)),
        };
        upsertProjectLocal(updated);
        void persistProject(updated, uid);
      },
      removeTimelineEvent: (id, index) => {
        const uid = requireUser();
        const existing = getProject(id);
        if (!existing) return;
        const updated = { ...existing, timeline: existing.timeline.filter((_, i) => i !== index) };
        upsertProjectLocal(updated);
        void persistProject(updated, uid);
      },
      setBottleneckDays: (id, days) => {
        const uid = requireUser();
        const existing = getProject(id);
        if (!existing || !existing.bottleneck) return;
        const updated = {
          ...existing,
          bottleneck: { ...existing.bottleneck, since: daysAgoIso(days) },
        };
        upsertProjectLocal(updated);
        void persistProject(updated, uid);
      },
      upsertProductMaster: (item) => {
        const uid = requireUser();
        const sku = item.sku.trim();
        const name = item.name.trim();
        if (!sku && !name) return null;
        const existing =
          (item.id && stateRef.current.products.find((x) => x.id === item.id)) ||
          (sku && stateRef.current.products.find((x) => x.sku.toLowerCase() === sku.toLowerCase())) ||
          (name && stateRef.current.products.find((x) => x.name.toLowerCase() === name.toLowerCase())) ||
          undefined;
        const next: ProductMasterItem = {
          id: existing?.id ?? uuid(),
          sku: sku || existing?.sku || "",
          name: name || existing?.name || "",
          pharmaceuticalForm:
            item.pharmaceuticalForm?.trim() || existing?.pharmaceuticalForm || undefined,
          presentation: item.presentation?.trim() || existing?.presentation || undefined,
        };
        setState((s) => ({
          ...s,
          products: s.products.some((x) => x.id === next.id)
            ? s.products.map((x) => (x.id === next.id ? next : x))
            : [...s.products, next],
        }));
        void persistProduct(next, uid);
        return next;
      },
      reset: async () => {
        const uid = requireUser();
        await supabase.from("projects").delete().eq("user_id", uid);
        await supabase.from("clients").delete().eq("user_id", uid);
        setState((s) => ({ ...s, clients: [], projects: [] }));
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, userId, loading, persistClient, persistProject, persistProduct]);


  // Keep slug helper referenced (used elsewhere historically); no-op here.
  void slug;

  return <DataContext.Provider value={store}>{children}</DataContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useStore must be used inside DataProvider");
  return ctx;
}

export const useClients = () => useStore().clients;
export const useProjects = () => useStore().projects;
export const useClient = (id: string) => useStore().clients.find((c) => c.id === id);
export const useProject = (id: string) => useStore().projects.find((p) => p.id === id);

export type { Client, Project, Department, ProjectStatus, TimelineEvent };
export const PROJECT_STATUSES: ProjectStatus[] = [
  "Preparing Documents",
  "Under Registration",
  "Order Confirmed",
  "Awaiting Payment",
  "In Production",
  "Production Delayed",
  "Artwork Review",
  "Ready to Ship",
  "In Transit",
  "Delivered",
];
export const DEPARTMENTS: Department[] = ["Client", "Regulatory", "Production", "Logistics", "Finance"];
