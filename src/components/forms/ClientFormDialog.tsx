import { useI18n } from "@/lib/i18n";
import { useState, type ReactNode } from "react";
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
import { useStore, type Client } from "@/lib/store";
import { CLIENT_STATUSES, LOST_REASONS, type ClientStatus, type LostReason } from "@/lib/mock-data";

export function ClientFormDialog({
  trigger,
  client,
}: {
  trigger: ReactNode;
  client?: Client;
}) {
  const { t } = useI18n();
  const { addClient, updateClient } = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(client?.name ?? "");
  const [country, setCountry] = useState(client?.country ?? "");
  const [commercial, setCommercial] = useState(client?.commercialResponsible ?? "");
  const [contactPerson, setContactPerson] = useState(client?.contactPerson ?? "");
  const [position, setPosition] = useState(client?.position ?? "");
  const [email, setEmail] = useState(client?.email ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(client?.whatsapp ?? "");
  const [address, setAddress] = useState(client?.address ?? "");
  const [notes, setNotes] = useState(client?.notes ?? "");
  const [status, setStatus] = useState<ClientStatus>(client?.status ?? "Prospect");
  const [lostReason, setLostReason] = useState<LostReason>(client?.lostReason ?? "Other");
  const [lostNotes, setLostNotes] = useState(client?.lostNotes ?? "");
  const [reqs, setReqs] = useState((client?.requirementsMemory ?? []).join("\n"));

  const submit = () => {
    if (!name.trim() || !country.trim()) return;
    const channels: Client["channels"] = [];
    if (email.trim()) channels.push({ type: "Email", value: email.trim() });
    if (whatsapp.trim()) channels.push({ type: "WhatsApp", value: whatsapp.trim() });
    if (phone.trim()) channels.push({ type: "Phone", value: phone.trim() });
    const parsedReqs = reqs.split("\n").map((l) => l.trim()).filter(Boolean);
    const data: Omit<Client, "id"> = {
      name: name.trim(),
      country: country.trim(),
      commercialResponsible: commercial.trim(),
      contactPerson: contactPerson.trim() || undefined,
      position: position.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      whatsapp: whatsapp.trim() || undefined,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
      status,
      lostReason: status === "Lost" ? lostReason : undefined,
      lostNotes: status === "Lost" ? (lostNotes.trim() || undefined) : undefined,
      channels,
      requirementsMemory: parsedReqs,
    };
    if (client) updateClient(client.id, data);
    else addClient(data);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{client ? t("Edit client") : t("New client")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Company name")}><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label={t("Country")}><Input value={country} onChange={(e) => setCountry(e.target.value)} /></Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Client status")}>
              <Select value={status} onValueChange={(v) => setStatus(v as ClientStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CLIENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{t(s)}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("Commercial responsible")}>
              <Input value={commercial} onChange={(e) => setCommercial(e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Contact person")}><Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} /></Field>
            <Field label={t("Position")}><Input value={position} onChange={(e) => setPosition(e.target.value)} /></Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label={t("Email")}><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label={t("Phone")}><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
            <Field label="WhatsApp"><Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} /></Field>
          </div>

          <Field label={t("Address")}>
            <Textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>

          <Field label={t("Notes")}>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          {status === "Lost" && (
            <div className="rounded-md border border-border p-3 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t("Lost client")}</div>
              <Field label={t("Lost reason")}>
                <Select value={lostReason} onValueChange={(v) => setLostReason(v as LostReason)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LOST_REASONS.map((r) => <SelectItem key={r} value={r}>{t(r)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("Lost notes")}>
                <Textarea rows={3} value={lostNotes} onChange={(e) => setLostNotes(e.target.value)} placeholder={t("Why didn't this client proceed? Future you will thank present you.")} />
              </Field>
            </div>
          )}

          <Field label={t("Requirements memory (one per line)")}>
            <Textarea rows={4} value={reqs} onChange={(e) => setReqs(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>{t("Cancel")}</Button>
          <Button onClick={submit}>{client ? t("Save") : t("Create")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
