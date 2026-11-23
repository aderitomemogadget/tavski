import { useI18n } from "@/lib/i18n";
import { DeptBadge, StatusPill } from "@/components/StatusPill";
import { PACKAGING_COMPONENT_NAMES, deliveryDateOf, type Project, type Client } from "@/lib/mock-data";
import { formatDate } from "@/lib/dates";
import { Lock } from "lucide-react";

/** Read-only historical view of an archived project. Renders no controls of any kind. */
export function ArchiveHistoryView({ p, client }: { p: Project; client?: Client }) {
  const { t, count } = useI18n();
  return (
    <div className="px-6 py-5 space-y-5">
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5" />
        {t("Archived record — permanent historical memory. This view is read-only.")}{" "}</div>

      <Block title={t("Overview")}>
        <div className="grid gap-x-6 gap-y-1.5 md:grid-cols-2">
          <Row label={t("Client")} value={client?.name} />
          <Row label={t("Country")} value={client?.country} />
          <Row label={t("Product")} value={p.product} />
          <Row label="SKU" value={p.sku} />
          <Row label={t("Final status")} value={t(p.status)} />
          <Row label={t("Responsible department")} value={t(p.responsibleDepartment)} />
          <Row label={t("Responsible person")} value={p.responsiblePerson} />
          <Row label={t("Lead time")} value={count("day", p.leadTimeDays)} />
          <Row label={t("Production delivery date")} value={formatDate(deliveryDateOf(p))} />
          <Row label={t("Archived on")} value={p.archivedAt ? formatDate(p.archivedAt.slice(0, 10)) : "—"} />
          <Row label={t("Pharmaceutical form")} value={p.pharmaceuticalForm} />
          <Row label={t("Presentation")} value={p.presentation} />
        </div>
      </Block>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Block title={t("Order memory")}>
          <div className="space-y-1.5">
            <Row label={t("Customer PO")} value={p.customerPoReference} />
            <Row label={t("Order reference")} value={p.orderReferenceNumber} />
            <Row label={t("Shipment reference")} value={p.shipmentReference} />
            <Row label={t("Ordered quantity")} value={p.orderedQuantity} />
            <Row label={t("FOC quantity")} value={p.focQuantity} />
            <Row label={t("Produced quantity")} value={p.actualProducedQuantity} />
          </div>
        </Block>

        <Block title={t("Manufacturing memory")}>
          <div className="space-y-1.5">
            <Row label={t("Manufacturer")} value={p.manufacturer} />
            <Row label={t("Contact")} value={p.manufacturerContact} />
            <Row label={t("Email")} value={p.manufacturerEmail} />
            <Row label="WhatsApp" value={p.manufacturerWhatsapp} />
            <Row label={t("Quotation / offer")} value={p.quotationOfferNumber} />
            <Row label={t("Quotation date")} value={p.quotationDate ? formatDate(p.quotationDate) : undefined} />
          </div>
        </Block>

        <Block title={t("Commercial memory")}>
          <div className="space-y-1.5">
            <Row label={t("Commercial responsible")} value={p.commercialResponsible} />
            <Row label={t("Last price")} value={p.lastPrice} />
            <Row label={t("Currency")} value={p.currency} />
            <Row label={t("Payment terms")} value={p.paymentTerms} />
            <Row label={t("Advance payment date")} value={p.advancePaymentDate ? formatDate(p.advancePaymentDate) : undefined} />
            <Row label={t("Advance payment amount")} value={p.advancePaymentAmount} />
            <Row
              label={t("Advance received")}
              value={p.advancePaymentReceived === undefined ? "—" : p.advancePaymentReceived ? "Yes" : "No"}
            />
          </div>
        </Block>

        <Block title={t("Regulatory memory")}>
          <div className="space-y-1.5">
            <Row label={t("Artwork version")} value={p.lastApprovedArtworkVersion} />
            <Row
              label={t("Artwork approval date")}
              value={p.artworkApprovalDate ? formatDate(p.artworkApprovalDate) : undefined}
            />
            <Row label={t("Artwork reference")} value={p.artworkReferenceCode} />
            <Row label={t("TDS reference")} value={p.tdsReferenceCode} />
            <Row label={t("Registration number")} value={p.registrationNumber} />
            <Row label={t("Folder location")} value={p.regulatoryFolderLocation} />
          </div>
          <div className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">{t("Packaging components")}</div>
          <ul className="text-sm space-y-1">
            {PACKAGING_COMPONENT_NAMES.map((name) => {
              const c = p.packagingComponents?.[name];
              if (!c || (!c.version && !c.approvalDate && !c.referenceCode)) return null;
              return (
                <li key={name} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t(name)}</span>
                  <span className="font-medium text-right">
                    {[c.version, c.approvalDate ? formatDate(c.approvalDate) : "", c.referenceCode]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </span>
                </li>
              );
            })}
          </ul>
          {p.regulatoryNotes && (
            <div className="mt-2 text-sm">
              <span className="text-muted-foreground">{t("Notes:")}{" "}</span>
              {p.regulatoryNotes}
            </div>
          )}
        </Block>

        <Block title={t("Logistics memory")}>
          <div className="space-y-1.5">
            <Row label={t("Transport mode")} value={p.transportMode ? t(p.transportMode) : undefined} />
            <Row label={t("Temperature controlled")} value={p.temperatureControlled === undefined ? "—" : p.temperatureControlled ? "Yes" : "No"} />
            <Row label="Incoterm" value={p.incoterm} />
            <Row label={t("Consignee")} value={p.consignee} />
            <Row label={t("Notify party")} value={p.notifyParty} />
            <Row label={t("Port of loading")} value={p.portOfLoading} />
            <Row label={t("Port of destination")} value={p.portOfDestination} />
            <Row label={t("Logistics notes")} value={p.logisticsNotes} />
          </div>
        </Block>

        <Block title={t("Document references")}>
          <div className="space-y-1.5">
            <Row label={t("Packing List")} value={p.packingListLocation} />
            <Row label={t("Invoice")} value={p.invoiceLocation} />
            <Row label="CoA" value={p.coaLocation} />
            <Row label="COO" value={p.cooLocation} />
            <Row label={t("DU (HS Code)")} value={p.duLocation} />
            <Row label="EUR-1" value={p.eur1Location} />
            <Row label={t("Health Certificate")} value={p.healthCertificateLocation} />
            <Row label="AWB" value={p.awbLocation} />
            <Row label={t("Insurance")} value={p.insurance === undefined ? "—" : p.insurance ? "Yes" : "No"} />
            <Row label={t("Other")} value={p.otherDocumentLocation} />
          </div>
        </Block>
      </section>

      <Block title={t("Bottleneck history")}>
        {p.bottleneck && (p.bottleneck.description?.trim() || p.bottleneck.since) ? (
          <div className="space-y-1.5">
            <Row label={t("Department")} value={t(p.bottleneck.department)} />
            <Row label={t("Since")} value={p.bottleneck.since ? formatDate(p.bottleneck.since) : undefined} />
            <div className="text-sm">
              <span className="text-muted-foreground">{t("Description:")}{" "}</span>
              {p.bottleneck.description || "—"}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("No bottleneck recorded.")}</p>
        )}
      </Block>

      <Block title={t("Operational notes")}>
        <div className="space-y-1.5">
          <p className="text-sm whitespace-pre-wrap">{p.operationalNotes || "—"}</p>
          <Row label={t("Known issues")} value={p.knownIssues} />
          <Row label={t("Logistics requirements")} value={p.logisticsRequirements} />
          <Row label={t("Final outcome")} value={p.finalOutcome} />
        </div>
      </Block>

      <div>
        <h4 className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">
          {t("Full timeline — {events}", { events: count("event", p.timeline.length) })}
        </h4>
        <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
          {p.timeline.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">{t("No timeline events recorded.")}</li>
          )}
          {p.timeline.map((e, i) => (
            <li key={i} className="px-3 py-2 grid grid-cols-[110px_120px_1fr] gap-3 text-sm items-center">
              <span className="tabular-nums text-muted-foreground">{formatDate(e.date)}</span>
              <DeptBadge dept={e.department} />
              <span>
                {t(e.status)}
                {e.comment && <span className="text-muted-foreground"> — {e.comment}</span>}
                {e.nextAction && (
                  <span className="block text-xs text-muted-foreground">{t("Next action:")}{" "}{e.nextAction}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{t("Final status")}</span>
        <StatusPill status={p.status} />
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | number }) {
  return (
    <div className="flex justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value === undefined || value === "" ? "—" : value}</span>
    </div>
  );
}
