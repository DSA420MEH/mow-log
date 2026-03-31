import type { Client, Invoice, Quote, Session } from "@/lib/store";
import { formatCurrency } from "@/lib/formatters";

export interface BillingLineItem {
    description: string;
    quantity: number;
    rate: number;
    amount: number;
    isAdditional?: boolean;
}

export interface BillingServiceSelection {
    name: string;
    enabled: boolean;
    price: string;
}

export interface OperatorProfile {
    name?: string;
    address?: string;
    phone?: string;
}

export type QuoteSortKey = "date" | "amount" | "status";
export type InvoiceSortKey = "date" | "amount" | "status";

export const HST_RATE = 0.15;

export const BILLING_SERVICE_TYPES = [
    "Lawn Mowing",
    "Weekly Mowing",
    "Bi-Weekly Mowing",
    "Spring Cleanup",
    "Fall Cleanup",
] as const;

export const PAYMENT_METHOD_OPTIONS = [
    "E-Transfer",
    "Cash",
    "Cheque",
    "Credit Card",
] as const;

export const ADDITIONAL_SERVICE_OPTIONS = [
    "Edging",
    "Trimming",
    "Leaf Blowing",
    "Fertilization",
    "Other",
] as const;

function roundCurrency(value: number): number {
    return Math.round(value * 100) / 100;
}

function safeDate(value?: string): Date | null {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysBetween(from: Date, to: Date): number {
    const fromDay = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
    const toDay = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
    return Math.max(0, Math.floor((toDay - fromDay) / 86400000));
}

function getDisplaySeed(id: string): number {
    let seed = 0;
    for (const char of id.replace(/-/g, "")) {
        seed = (seed * 31 + char.charCodeAt(0)) % 10000;
    }
    return seed;
}

export function createInitialAdditionalServices(): BillingServiceSelection[] {
    return ADDITIONAL_SERVICE_OPTIONS.map((name) => ({
        name,
        enabled: false,
        price: "",
    }));
}

export function parseSqftValue(value?: string | number | null): number | undefined {
    if (typeof value === "number") {
        return Number.isFinite(value) && value > 0 ? value : undefined;
    }

    if (!value) return undefined;

    const normalized = value.trim().replace(/,/g, "");
    if (!/^\d+(\.\d+)?$/.test(normalized)) {
        return undefined;
    }

    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function inferSuggestedRate(client?: Client | null): number {
    if (!client) return 0;
    return roundCurrency(client.billingType === "Regular" ? client.amount / 4 : client.amount);
}

export function mapSelectedAdditionalServices(
    selections: BillingServiceSelection[],
): { name: string; price: number }[] {
    return selections
        .filter((selection) => selection.enabled)
        .map((selection) => ({
            name: selection.name,
            price: roundCurrency(Number.parseFloat(selection.price) || 0),
        }));
}

export function getAdditionalServicesTotal(
    services: { name: string; price: number }[],
): number {
    return roundCurrency(services.reduce((sum, service) => sum + service.price, 0));
}

export function calculateHstAmount(subtotal: number, applied: boolean): number {
    return applied ? roundCurrency(subtotal * HST_RATE) : 0;
}

export function getLineItemsSubtotal(
    visits: number,
    ratePerVisit: number,
    additionalServices: { name: string; price: number }[],
): number {
    return roundCurrency((visits * ratePerVisit) + getAdditionalServicesTotal(additionalServices));
}

export function getDocumentSubtotal(document: Quote | Invoice): number {
    const total = document.type === "quote"
        ? document.seasonTotal ?? 0
        : document.grandTotal;

    if (!document.hstApplied) {
        return roundCurrency(total);
    }

    return roundCurrency(total - document.hstAmount);
}

export function getDocumentGrandTotal(document: Quote | Invoice): number {
    return roundCurrency(document.type === "quote" ? document.seasonTotal ?? 0 : document.grandTotal);
}

export function buildDocumentLineItems(document: Quote | Invoice): BillingLineItem[] {
    const visits = document.type === "invoice" ? document.visits : document.visits ?? 1;
    const rate = document.ratePerVisit ?? 0;

    return [
        {
            description: document.serviceType,
            quantity: visits,
            rate,
            amount: roundCurrency(visits * rate),
        },
        ...document.additionalServices.map((service) => ({
            description: service.name,
            quantity: 1,
            rate: service.price,
            amount: service.price,
            isAdditional: true,
        })),
    ];
}

export function getDocumentNumber(document: Quote | Invoice): string {
    const prefix = document.type === "quote" ? "Q-" : "INV-";
    return `${prefix}${getDisplaySeed(document.id).toString().padStart(4, "0")}`;
}

export function buildDocumentNumber(type: "quote" | "invoice", id: string): string {
    const prefix = type === "quote" ? "Q-" : "INV-";
    return `${prefix}${getDisplaySeed(id).toString().padStart(4, "0")}`;
}

export function isQuoteExpired(validUntil: string): boolean {
    const expiry = safeDate(`${validUntil}T23:59:59`);
    return !!expiry && expiry.getTime() < Date.now();
}

export function getResolvedQuoteStatus(quote: Quote): Quote["status"] {
    return isQuoteExpired(quote.validUntil) ? "expired" : quote.status;
}

export function getDocumentFilename(document: Quote | Invoice): string {
    const clientSlug = document.clientName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    return `${document.type}-${clientSlug || "client"}-${getDocumentNumber(document).toLowerCase()}`;
}

export function formatNumericDate(value: string): string {
    const parsed = safeDate(value);
    if (!parsed) return value;

    return parsed.toLocaleDateString("en-CA", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
    });
}

export function formatPhoneNumber(value?: string): string | null {
    if (!value) return null;

    const digits = value.replace(/\D/g, "");
    const normalized = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;

    if (normalized.length !== 10) {
        return value;
    }

    return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
}

export function toTitleCase(value?: string): string {
    if (!value) return "";

    return value
        .toLowerCase()
        .split(" ")
        .map((part) => {
            if (part.length === 2 && /^[a-z]{2}$/i.test(part)) {
                return part.toUpperCase();
            }
            return part.charAt(0).toUpperCase() + part.slice(1);
        })
        .join(" ");
}

export function getLastMowedLabel(clientId: string, sessions: Session[]): string {
    const lastSession = sessions
        .filter((session) => session.clientId === clientId && session.type === "address-mow")
        .sort((a, b) => {
            const aTime = safeDate(a.endTime || a.startTime)?.getTime() ?? 0;
            const bTime = safeDate(b.endTime || b.startTime)?.getTime() ?? 0;
            return bTime - aTime;
        })[0];

    if (!lastSession) {
        return "NEVER MOWED";
    }

    const referenceDate = safeDate(lastSession.endTime || lastSession.startTime);
    if (!referenceDate) {
        return "NEVER MOWED";
    }

    return `LAST MOWED: ${daysBetween(referenceDate, new Date())} days ago`;
}

export function getCurrentYearServicePeriod(): { start: string; end: string } {
    const year = new Date().getFullYear();
    return {
        start: `${year}-04-01`,
        end: `${year}-11-30`,
    };
}

export function buildDocumentClipboardText(
    document: Quote | Invoice,
    operator?: OperatorProfile,
): string {
    const lines = buildDocumentLineItems(document).map((item) => {
        return `${item.description} | ${item.quantity} | ${formatCurrency(item.rate)} | ${formatCurrency(item.amount)}`;
    });

    const output = [
        document.type === "quote" ? "QUOTE" : "INVOICE",
        getDocumentNumber(document),
        operator?.name ? `Operator: ${operator.name}` : undefined,
        operator?.address ? `Operator Address: ${operator.address}` : undefined,
        operator?.phone ? `Operator Phone: ${operator.phone}` : undefined,
        `Bill To: ${document.clientName}`,
        `Address: ${document.clientAddress}`,
        `Date: ${formatNumericDate(document.type === "quote" ? document.createdAt : document.invoiceDate)}`,
        document.type === "quote"
            ? `Valid Until: ${formatNumericDate(document.validUntil)}`
            : `Due Date: ${formatNumericDate(document.dueDate)}`,
        "",
        "DESCRIPTION | QTY | RATE | AMOUNT",
        ...lines,
        "",
        `Subtotal: ${formatCurrency(getDocumentSubtotal(document))}`,
    ];

    if (document.hstApplied) {
        output.push(`HST (15%): ${formatCurrency(document.hstAmount)}`);
    }

    output.push(`Total: ${formatCurrency(getDocumentGrandTotal(document))}`);

    if (document.notes) {
        output.push("", `Notes: ${document.notes}`);
    }

    if (document.type === "invoice" && document.paymentInstructions) {
        output.push("", `Payment Instructions: ${document.paymentInstructions}`);
    }

    return output.filter(Boolean).join("\n");
}

export function buildDocumentEmailPayload(
    document: Quote | Invoice,
    operator?: OperatorProfile,
): { subject: string; body: string } {
    const subject = document.type === "quote"
        ? `Quote ${getDocumentNumber(document)} — Lawn Care Services`
        : `Invoice ${getDocumentNumber(document)} — ${document.clientName}`;

    const body = buildDocumentClipboardText(document, operator);
    return { subject, body };
}

export function buildMailtoLink(
    document: Quote | Invoice,
    operator?: OperatorProfile,
): string {
    const { subject, body } = buildDocumentEmailPayload(document, operator);
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function sortQuotes(quotes: Quote[], sortKey: QuoteSortKey): Quote[] {
    return [...quotes].sort((a, b) => {
        if (sortKey === "amount") {
            return getDocumentGrandTotal(b) - getDocumentGrandTotal(a);
        }

        if (sortKey === "status") {
            const order: Record<Quote["status"], number> = { open: 0, expired: 1 };
            return order[getResolvedQuoteStatus(a)] - order[getResolvedQuoteStatus(b)];
        }

        const aTime = safeDate(a.createdAt)?.getTime() ?? 0;
        const bTime = safeDate(b.createdAt)?.getTime() ?? 0;
        return bTime - aTime;
    });
}

export function sortInvoices(invoices: Invoice[], sortKey: InvoiceSortKey): Invoice[] {
    return [...invoices].sort((a, b) => {
        if (sortKey === "amount") {
            return getDocumentGrandTotal(b) - getDocumentGrandTotal(a);
        }

        if (sortKey === "status") {
            const order: Record<Invoice["status"], number> = { unpaid: 0, paid: 1 };
            return order[a.status] - order[b.status];
        }

        const aTime = safeDate(a.invoiceDate)?.getTime() ?? 0;
        const bTime = safeDate(b.invoiceDate)?.getTime() ?? 0;
        return bTime - aTime;
    });
}

export function buildInvoiceFromQuote(
    quote: Quote,
    invoiceId: string,
    invoiceDate: string,
    dueDate: string,
    servicePeriod: { start: string; end: string },
    paymentMethod: string,
    paymentInstructions?: string,
): Invoice {
    return {
        id: invoiceId,
        type: "invoice",
        clientId: quote.clientId,
        clientName: quote.clientName,
        clientAddress: quote.clientAddress,
        lawnSqft: quote.lawnSqft,
        serviceType: quote.serviceType,
        servicePeriod,
        visits: quote.visits ?? 1,
        ratePerVisit: quote.ratePerVisit ?? 0,
        grandTotal: quote.seasonTotal ?? 0,
        additionalServices: quote.additionalServices,
        paymentMethod,
        paymentInstructions,
        notes: quote.notes,
        invoiceDate,
        dueDate,
        status: "unpaid",
        hstApplied: quote.hstApplied,
        hstAmount: quote.hstAmount,
        convertedFromQuoteId: quote.id,
    };
}
