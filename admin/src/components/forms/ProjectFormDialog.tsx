import { useI18n } from "@/lib/i18n";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROJECT_STATUSES, useStore, type Department, type Project, type ProjectStatus } from "@/lib/store";
import { deliveryDateOf, type ProductMasterItem } from "@/lib/mock-data";
import { DateField } from "@/components/DateField";

const departmentForStatus = (status: ProjectStatus): Department => {
  const deptMap: Record<ProjectStatus, Department> = {
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
  return deptMap[status];
};

export function ProjectFormDialog({
  trigger,
  project,
  defaultClientId,
}: {
  trigger: ReactNode;
  project?: Project;
  defaultClientId?: string;
}) {
  const { t } = useI18n();
  const { clients, products, addProject, updateProject, upsertProductMaster } = useStore();
  const [open, setOpen] = useState(false);

  const [clientId, setClientId] = useState(project?.clientId ?? defaultClientId ?? clients[0]?.id ?? "");
  const [product, setProduct] = useState(project?.product ?? "");
  const [sku, setSku] = useState(project?.sku ?? "");
  const [pharmaceuticalForm, setPharmaceuticalForm] = useState(project?.pharmaceuticalForm ?? "");
  const [presentation, setPresentation] = useState(project?.presentation ?? "");
  const [manufacturer, setManufacturer] = useState(project?.manufacturer ?? "");
  const [manufacturerContact, setManufacturerContact] = useState(project?.manufacturerContact ?? "");
  const [manufacturerEmail, setManufacturerEmail] = useState(project?.manufacturerEmail ?? "");
  const [manufacturerWhatsapp, setManufacturerWhatsapp] = useState(project?.manufacturerWhatsapp ?? "");
  const [leadTime, setLeadTime] = useState(String(project?.leadTimeDays ?? 60));
  const [deliveryDate, setDeliveryDate] = useState<string | undefined>(
    project ? deliveryDateOf(project) : undefined,
  );
  const [nextAction, setNextAction] = useState(project?.nextAction ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "Under Registration");

  const selectedClient = clients.find((c) => c.id === clientId);

  // Product Master: apply a catalogue entry to the product-level fields only.
  // Manufacturer data and lead time stay project-specific and are never auto-filled.
  const applyMaster = (id: string) => {
    const item = products.find((x) => x.id === id);
    if (!item) return;
    setSku(item.sku);
    setProduct(item.name);
    setPharmaceuticalForm(item.pharmaceuticalForm ?? "");
    setPresentation(item.presentation ?? "");
  };

  const skuMatches = useMemo(() => {
    const q = sku.trim().toLowerCase();
    if (!q) return [];
    return products.filter((x) => x.sku.toLowerCase().includes(q) && x.sku.toLowerCase() !== q).slice(0, 5);
  }, [products, sku]);

  const nameMatches = useMemo(() => {
    const q = product.trim().toLowerCase();
    if (!q) return [];
    return products.filter((x) => x.name.toLowerCase().includes(q) && x.name.toLowerCase() !== q).slice(0, 5);
  }, [products, product]);

  // Typing a complete existing SKU pulls in its product-level master data.
  const exactSkuId = useMemo(() => {
    const q = sku.trim().toLowerCase();
    if (!q) return undefined;
    return products.find((x) => x.sku.trim().toLowerCase() === q)?.id;
  }, [products, sku]);

  // Typing a complete existing product name does the same (and fills the SKU).
  const exactNameId = useMemo(() => {
    const q = product.trim().toLowerCase();
    if (!q) return undefined;
    return products.find((x) => x.name.trim().toLowerCase() === q)?.id;
  }, [products, product]);

  useEffect(() => {
    if (exactSkuId) applyMaster(exactSkuId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exactSkuId]);

  useEffect(() => {
    if (!exactSkuId && exactNameId) applyMaster(exactNameId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exactNameId]);


  const submit = () => {
    if (!clientId || !product.trim()) return;
    // Create or update the Product Master entry from what was typed.
    upsertProductMaster({
      sku: sku.trim(),
      name: product.trim(),
      pharmaceuticalForm: pharmaceuticalForm.trim() || undefined,
      presentation: presentation.trim() || undefined,
    });

    const data: Partial<Project> = {
      clientId,
      product: product.trim(),
      sku: sku.trim(),
      pharmaceuticalForm: pharmaceuticalForm.trim() || undefined,
      presentation: presentation.trim() || undefined,
      manufacturer: manufacturer.trim() || undefined,
      manufacturerContact: manufacturerContact.trim() || undefined,
      manufacturerEmail: manufacturerEmail.trim() || undefined,
      manufacturerWhatsapp: manufacturerWhatsapp.trim() || undefined,
      leadTimeDays: Number(leadTime) || 0,
      productionDeliveryDate: deliveryDate,
      nextAction: nextAction.trim(),
    };
    if (project) {
      updateProject(project.id, data);
    } else {
      addProject({
        ...data,
        clientId,
        product: product.trim(),
        sku: sku.trim(),
        status,
        responsibleDepartment: departmentForStatus(status),
        responsiblePerson: "",
        nextAction: nextAction.trim(),
        leadTimeDays: Number(leadTime) || 0,
        productionDeliveryDate: deliveryDate,
      } as Omit<Project, "id" | "timeline">);
    }
    setOpen(false);
  };


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{project ? t("Edit project") : t("New project")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Client")}>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder={t("Select client")} /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} · {c.country}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("Country")}>
              <Input value={selectedClient?.country ?? ""} disabled readOnly />
            </Field>
          </div>

          {!project && (
            <Field label={t("Initial status")}>
              <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{t(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Product name")}>
              <Input value={product} onChange={(e) => setProduct(e.target.value)} placeholder={t("Search or type a new name")} />
              <Suggestions items={nameMatches} render={(x) => `${x.name} · ${x.sku}`} onPick={applyMaster} />
            </Field>
            <Field label="SKU">
              <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder={t("Search or type a new SKU")} />
              <Suggestions items={skuMatches} render={(x) => `${x.sku} · ${x.name}`} onPick={applyMaster} />
            </Field>
          </div>


          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Pharmaceutical form")}>
              <Input value={pharmaceuticalForm} onChange={(e) => setPharmaceuticalForm(e.target.value)} placeholder={t("Capsules, tablets, sachets…")} />
            </Field>
            <Field label={t("Presentation")}>
              <Input value={presentation} onChange={(e) => setPresentation(e.target.value)} placeholder={t("30 caps / blister x 2…")} />
            </Field>
          </div>

          <Field label={t("Manufacturer")}>
            <Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label={t("Manufacturer contact")}>
              <Input value={manufacturerContact} onChange={(e) => setManufacturerContact(e.target.value)} />
            </Field>
            <Field label={t("Manufacturer email")}>
              <Input type="email" value={manufacturerEmail} onChange={(e) => setManufacturerEmail(e.target.value)} />
            </Field>
            <Field label={t("Manufacturer WhatsApp")}>
              <Input value={manufacturerWhatsapp} onChange={(e) => setManufacturerWhatsapp(e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Lead time (days)")}>
              <Input type="number" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} />
            </Field>
            <Field label={t("Production delivery date")}>
              <DateField value={deliveryDate} onChange={setDeliveryDate} className="h-9 w-full" />
            </Field>
          </div>

          <Field label={t("Next action")}>
            <Textarea rows={2} value={nextAction} onChange={(e) => setNextAction(e.target.value)} />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>{t("Cancel")}</Button>
          <Button onClick={submit}>{project ? t("Save") : t("Create")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Product Master lookup results — picking one auto-populates the form. */
function Suggestions({
  items,
  render,
  onPick,
}: {
  items: ProductMasterItem[];
  render: (x: ProductMasterItem) => string;
  onPick: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-md border border-border bg-popover p-1">
      {items.map((x) => (
        <button
          key={x.id}
          type="button"
          onClick={() => onPick(x.id)}
          className="block w-full truncate rounded px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {render(x)}
        </button>
      ))}
    </div>
  );
}


function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
