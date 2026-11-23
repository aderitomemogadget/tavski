import { parseIsoDate } from "./dates";

export type Department = "Client" | "Regulatory" | "Production" | "Logistics" | "Finance";

export type ProjectStatus =
  | "Preparing Documents"
  | "Under Registration"
  | "Order Confirmed"
  | "Awaiting Payment"
  | "In Production"
  | "Production Delayed"
  | "Artwork Review"
  | "Ready to Ship"
  | "In Transit"
  | "Delivered";

export interface TimelineEvent {
  date: string; // ISO
  department: Department;
  responsible: string;
  status: string;
  comment?: string;
  nextAction?: string;
}

export type PackagingComponentName =
  | "Carton"
  | "Leaflet"
  | "Label"
  | "Blister"
  | "Sachet"
  | "Stick Pack"
  | "Vials"
  | "Shots";

export interface PackagingComponentMemory {
  version?: string;
  approvalDate?: string;
  referenceCode?: string;
  folderLocation?: string;
}

export type TransportMode = "Sea" | "Air" | "Road" | "Courier";

export interface Project {
  id: string;
  clientId: string;
  product: string;
  sku: string;
  status: ProjectStatus;
  bottleneck?: { department: Department; description: string; since: string };
  responsibleDepartment: Department;
  responsiblePerson: string;
  nextAction: string;
  /** Expected (forecast) date the manufacturer delivers the finished production. Drives all warning/reminder/overdue logic. */
  productionDeliveryDate?: string;
  /** Historical record of when production actually became ready. Never triggers any alert. */
  actualProductionCompletionDate?: string;
  /** @deprecated legacy field — read-only fallback for records created before the rename. */
  nextActionDueDate?: string;
  nextActionReminderDate?: string;
  leadTimeDays: number;

  // Product / manufacturing
  pharmaceuticalForm?: string;
  presentation?: string;
  manufacturer?: string;
  manufacturerContact?: string;
  manufacturerEmail?: string;
  manufacturerWhatsapp?: string;
  // Order information
  customerPoReference?: string;
  orderReferenceNumber?: string;
  shipmentReference?: string;
  orderedQuantity?: number;
  focQuantity?: number;
  actualProducedQuantity?: number;
  // Manufacturer commercial reference
  quotationOfferNumber?: string;
  quotationDate?: string;
  // Commercial memory
  commercialResponsible?: string;
  lastPrice?: string;
  currency?: string;
  paymentTerms?: string;
  advancePaymentDate?: string;
  advancePaymentAmount?: string;
  advancePaymentReceived?: boolean;
  // Regulatory memory
  lastApprovedArtworkVersion?: string;
  artworkApprovalDate?: string;
  artworkReferenceCode?: string;
  tdsReferenceCode?: string;
  packagingComponents?: Partial<Record<PackagingComponentName, PackagingComponentMemory>>;
  registrationNumber?: string;
  regulatoryNotes?: string;
  regulatoryFolderLocation?: string;
  // Operational memory
  logisticsRequirements?: string;
  knownIssues?: string;
  // Logistics memory
  transportMode?: TransportMode;
  temperatureControlled?: boolean;
  incoterm?: string;
  goodsAvailableAt?: string;
  consignee?: string;
  notifyParty?: string;
  portOfLoading?: string;
  portOfDestination?: string;
  logisticsNotes?: string;
  // Document references (legacy — kept for archived records)
  artworkLocation?: string;
  tdsLocation?: string;
  cvlLocation?: string;
  // Document references (current)
  packingListLocation?: string;
  invoiceLocation?: string;
  coaLocation?: string;
  cooLocation?: string;
  duLocation?: string;
  eur1Location?: string;
  healthCertificateLocation?: string;
  awbLocation?: string;
  insurance?: boolean;
  otherDocumentLocation?: string;
  timeline: TimelineEvent[];
  archived?: boolean;
  archivedAt?: string;
  shippingRequirements?: string[];
  artworkVersions?: string[];
  operationalNotes?: string;
  finalOutcome?: string;
}

export const PACKAGING_COMPONENT_NAMES: PackagingComponentName[] = [
  "Carton",
  "Leaflet",
  "Label",
  "Blister",
  "Sachet",
  "Stick Pack",
  "Vials",
  "Shots",
];

export const TRANSPORT_MODES: TransportMode[] = ["Sea", "Air", "Road", "Courier"];

export type ClientStatus = "Prospect" | "Active" | "Dormant" | "Lost";

export type LostReason =
  | "Price Too High"
  | "Regulatory Barrier"
  | "No Response"
  | "Chose Another Supplier"
  | "MOQ Too High"
  | "Product Unavailable"
  | "Logistics Issues"
  | "Payment Concerns"
  | "Internal Client Decision"
  | "Other";

export const CLIENT_STATUSES: ClientStatus[] = ["Prospect", "Active", "Dormant", "Lost"];

export const LOST_REASONS: LostReason[] = [
  "Price Too High",
  "Regulatory Barrier",
  "No Response",
  "Chose Another Supplier",
  "MOQ Too High",
  "Product Unavailable",
  "Logistics Issues",
  "Payment Concerns",
  "Internal Client Decision",
  "Other",
];

export interface Client {
  id: string;
  name: string;
  country: string;
  commercialResponsible: string;
  channels: { type: "Email" | "WhatsApp" | "Phone"; value: string }[];
  requirementsMemory: string[];
  createdAt?: string;
  // Contact details
  contactPerson?: string;
  position?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  notes?: string;
  // Lifecycle
  status?: ClientStatus;
  lostReason?: LostReason;
  lostNotes?: string;
}

/** Product Master — reusable catalogue of SKUs. Deliberately minimal:
 *  manufacturer, specs, formulation and documentation stay project-specific. */
export interface ProductMasterItem {
  id: string;
  sku: string;
  name: string;
  pharmaceuticalForm?: string;
  presentation?: string;
}

/** Production Delivery Date, with fallback to the legacy field name. */
export const deliveryDateOf = (p: Pick<Project, "productionDeliveryDate" | "nextActionDueDate">) =>
  p.productionDeliveryDate ?? p.nextActionDueDate;

export const clients: Client[] = [];

export const projects: Project[] = [];


export const daysSince = (isoDate: string) => {
  const d = parseIsoDate(isoDate) ?? new Date(isoDate);
  if (isNaN(d.getTime())) return 0;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((start.getTime() - d.getTime()) / 86400000));
};


export const getClient = (id: string) => clients.find((c) => c.id === id);
export const getProject = (id: string) => projects.find((p) => p.id === id);
export const activeProjects = () => projects.filter((p) => !p.archived);
export const archivedProjects = () => projects.filter((p) => p.archived);
