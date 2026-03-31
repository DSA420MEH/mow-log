"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
    Check,
    CheckCircle2,
    ChevronRight,
    Copy,
    FileText,
    Mail,
    MapPin,
    Save,
    Search,
    Trash2,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DocumentPreview from "@/components/DocumentPreview";
import {
    BILLING_SERVICE_TYPES,
    PAYMENT_METHOD_OPTIONS,
    buildDocumentClipboardText,
    buildDocumentNumber,
    buildMailtoLink,
    calculateHstAmount,
    createInitialAdditionalServices,
    formatNumericDate,
    formatPhoneNumber,
    getAdditionalServicesTotal,
    getCurrentYearServicePeriod,
    getDocumentGrandTotal,
    getDocumentNumber,
    getLastMowedLabel,
    getResolvedQuoteStatus,
    inferSuggestedRate,
    isQuoteExpired,
    mapSelectedAdditionalServices,
    parseSqftValue,
    sortInvoices,
    sortQuotes,
    type BillingServiceSelection,
    type InvoiceSortKey,
    type OperatorProfile,
    type QuoteSortKey,
} from "@/lib/billing";
import { formatCurrency } from "@/lib/formatters";
import type { Client, Invoice, Quote } from "@/lib/store";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const LawnDrawModal = dynamic(() => import("@/components/LawnDrawModal"), {
    ssr: false,
});

type BillingMode = "quote" | "invoice";
type TargetMode = "client" | "prospect";
type BillingStep = 1 | 2 | 3;

interface AddressSuggestion {
    display_name: string;
}

interface ToastState {
    message: string;
    tone?: "success" | "warning";
}

function todayInputValue(): string {
    return new Date().toISOString().slice(0, 10);
}

function addDays(dateValue: string, days: number): string {
    const date = new Date(`${dateValue}T12:00:00`);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
}

function roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
}

function StatCard({
    label,
    value,
    accent = "default",
}: {
    label: string;
    value: string;
    accent?: "default" | "orange";
}) {
    return (
        <div
            className={cn(
                "glass-card rounded-2xl border p-4",
                accent === "orange" ? "border-orange-500/20 bg-orange-500/10" : "border-white/10 bg-white/[0.02]",
            )}
        >
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.24em] text-white/45">{label}</p>
            <p
                className={cn(
                    "mt-3 text-2xl font-black tracking-tight",
                    accent === "orange" ? "text-orange-400" : "text-primary",
                )}
            >
                {value}
            </p>
        </div>
    );
}

function StepLabel({ children }: { children: ReactNode }) {
    return (
        <p className="font-mono text-[10px] font-black uppercase tracking-[0.3em] text-primary/75">
            {children}
        </p>
    );
}

function Stepper({
    currentStep,
    onStepClick,
}: {
    currentStep: BillingStep;
    onStepClick: (step: BillingStep) => void;
}) {
    const steps: { id: BillingStep; label: string }[] = [
        { id: 1, label: "SELECT TARGET" },
        { id: 2, label: "DETAILS" },
        { id: 3, label: "PREVIEW" },
    ];

    return (
        <div className="flex items-center gap-3 overflow-x-auto pb-1">
            {steps.map((step, index) => {
                const completed = currentStep > step.id;
                const active = currentStep === step.id;

                return (
                    <div key={step.id} className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => completed && onStepClick(step.id)}
                            className={cn(
                                "flex items-center gap-3 rounded-full border px-3 py-2 text-left transition-all",
                                active
                                    ? "border-primary/40 bg-primary/15"
                                    : completed
                                      ? "border-primary/20 bg-black/20"
                                      : "border-white/10 bg-black/20",
                            )}
                        >
                            <span
                                className={cn(
                                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-black",
                                    active
                                        ? "bg-primary text-black"
                                        : completed
                                          ? "bg-primary/20 text-primary"
                                          : "bg-white/10 text-white/45",
                                )}
                            >
                                {completed ? <Check className="h-4 w-4" /> : step.id}
                            </span>
                            <span
                                className={cn(
                                    "font-mono text-[10px] font-black uppercase tracking-[0.24em]",
                                    active || completed ? "text-white" : "text-white/45",
                                )}
                            >
                                {step.label}
                            </span>
                        </button>
                        {index < steps.length - 1 && <ChevronRight className="h-4 w-4 text-white/20" />}
                    </div>
                );
            })}
        </div>
    );
}

function SortControls({
    active,
    onChange,
}: {
    active: QuoteSortKey | InvoiceSortKey;
    onChange: (value: QuoteSortKey | InvoiceSortKey) => void;
}) {
    const items: { key: QuoteSortKey | InvoiceSortKey; label: string }[] = [
        { key: "date", label: "DATE ↓" },
        { key: "amount", label: "AMOUNT ↓" },
        { key: "status", label: "STATUS" },
    ];

    return (
        <div className="flex flex-wrap gap-2">
            {items.map((item) => (
                <button
                    key={item.key}
                    type="button"
                    onClick={() => onChange(item.key)}
                    className={cn(
                        "rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em]",
                        active === item.key
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-white/10 bg-black/20 text-white/45",
                    )}
                >
                    {item.label}
                </button>
            ))}
        </div>
    );
}

export default function InvoicesPage() {
    const store = useStore();
    const {
        clients,
        sessions,
        quotes,
        invoices,
        addQuote,
        deleteQuote,
        addInvoice,
        updateInvoice,
        deleteInvoice,
    } = store;

    const previewRef = useRef<HTMLDivElement | null>(null);
    const addressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const today = todayInputValue();
    const defaultServicePeriod = getCurrentYearServicePeriod();
    const operatorPhone = formatPhoneNumber(
        (store as typeof store & { userPhone?: string | null }).userPhone ?? undefined,
    );
    const operatorProfile: OperatorProfile = {
        name: store.userName || undefined,
        address: store.homeAddress || undefined,
        phone: operatorPhone || undefined,
    };

    const [currentStep, setCurrentStep] = useState<BillingStep>(1);
    const [mode, setMode] = useState<BillingMode>("quote");
    const [targetMode, setTargetMode] = useState<TargetMode>(clients.length > 0 ? "client" : "prospect");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
    const [prospectAddress, setProspectAddress] = useState("");
    const [prospectSqft, setProspectSqft] = useState("");
    const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
    const [clientName, setClientName] = useState("");
    const [clientAddress, setClientAddress] = useState("");
    const [lawnSqft, setLawnSqft] = useState("");
    const [validUntil, setValidUntil] = useState(addDays(today, 30));
    const [serviceType, setServiceType] = useState<string>(BILLING_SERVICE_TYPES[0]);
    const [visits, setVisits] = useState("4");
    const [ratePerVisit, setRatePerVisit] = useState("");
    const [notes, setNotes] = useState("");
    const [invoiceDate, setInvoiceDate] = useState(today);
    const [dueDate, setDueDate] = useState(addDays(today, 14));
    const [servicePeriodStart, setServicePeriodStart] = useState(defaultServicePeriod.start);
    const [servicePeriodEnd, setServicePeriodEnd] = useState(defaultServicePeriod.end);
    const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHOD_OPTIONS[0]);
    const [paymentInstructions, setPaymentInstructions] = useState("");
    const [additionalServices, setAdditionalServices] = useState<BillingServiceSelection[]>(
        createInitialAdditionalServices(),
    );
    const [hstApplied, setHstApplied] = useState(false);
    const [rateError, setRateError] = useState<string | null>(null);
    const [previewDocument, setPreviewDocument] = useState<Quote | Invoice | null>(null);
    const [previewOrigin, setPreviewOrigin] = useState<"draft" | "saved" | null>(null);
    const [draftInvoiceId, setDraftInvoiceId] = useState<string | null>(null);
    const [convertedFromQuoteId, setConvertedFromQuoteId] = useState<string | undefined>();
    const [conversionBanner, setConversionBanner] = useState<string | null>(null);
    const [showLawnModal, setShowLawnModal] = useState(false);
    const [toast, setToast] = useState<ToastState | null>(null);
    const [quoteSort, setQuoteSort] = useState<QuoteSortKey>("date");
    const [invoiceSort, setInvoiceSort] = useState<InvoiceSortKey>("date");

    const selectedClient = selectedClientId ? clients.find((client) => client.id === selectedClientId) ?? null : null;
    const filteredClients = clients.filter((client) =>
        `${client.name} ${client.address}`.toLowerCase().includes(searchQuery.trim().toLowerCase()),
    );
    const additionalServicesPayload = mapSelectedAdditionalServices(additionalServices);
    const visitsValue = Math.max(1, Number.parseInt(visits, 10) || 1);
    const rateValue = roundMoney(Number.parseFloat(ratePerVisit) || 0);
    const subtotal = roundMoney((visitsValue * rateValue) + getAdditionalServicesTotal(additionalServicesPayload));
    const hstAmount = calculateHstAmount(subtotal, hstApplied);
    const totalDue = roundMoney(subtotal + hstAmount);
    const sortedQuotes = sortQuotes(quotes, quoteSort);
    const sortedInvoices = sortInvoices(invoices, invoiceSort);
    const totalQuoted = quotes.reduce((sum, quote) => sum + getDocumentGrandTotal(quote), 0);
    const totalInvoiced = invoices.reduce((sum, invoice) => sum + getDocumentGrandTotal(invoice), 0);
    const totalPaid = invoices
        .filter((invoice) => invoice.status === "paid")
        .reduce((sum, invoice) => sum + getDocumentGrandTotal(invoice), 0);
    const outstanding = invoices
        .filter((invoice) => invoice.status === "unpaid")
        .reduce((sum, invoice) => sum + getDocumentGrandTotal(invoice), 0);

    const showToast = (message: string, tone: ToastState["tone"] = "success") => setToast({ message, tone });

    useEffect(() => {
        if (!toast) return;
        const timer = window.setTimeout(() => setToast(null), 2500);
        return () => window.clearTimeout(timer);
    }, [toast]);

    useEffect(() => {
        return () => {
            if (addressDebounceRef.current) {
                clearTimeout(addressDebounceRef.current);
            }
        };
    }, []);

    const clearPreview = () => {
        setPreviewDocument(null);
        setPreviewOrigin(null);
        setCurrentStep((step) => (step === 3 ? 2 : step));
    };

    const applyClientToForm = (client: Client) => {
        setSelectedClientId(client.id);
        setClientName(client.name);
        setClientAddress(client.address);
        setLawnSqft(parseSqftValue(client.sqft)?.toString() ?? "");
        const suggestedRate = inferSuggestedRate(client);
        setRatePerVisit(suggestedRate > 0 ? suggestedRate.toFixed(2) : "");
    };

    const handleModeChange = (nextMode: string) => {
        setMode(nextMode as BillingMode);
        setRateError(null);
        setConversionBanner(null);
        setDraftInvoiceId(null);
        setConvertedFromQuoteId(undefined);
        clearPreview();
    };

    const handleSelectExistingClient = (client: Client) => {
        applyClientToForm(client);
        setTargetMode("client");
        setCurrentStep(2);
        clearPreview();
    };

    const handleProspectAddressChange = (value: string) => {
        setProspectAddress(value);

        if (addressDebounceRef.current) {
            clearTimeout(addressDebounceRef.current);
        }

        if (value.trim().length <= 3) {
            setAddressSuggestions([]);
            return;
        }

        addressDebounceRef.current = setTimeout(async () => {
            try {
                const response = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(value)}`);
                const results = (await response.json()) as AddressSuggestion[];
                setAddressSuggestions(Array.isArray(results) ? results : []);
            } catch (error) {
                console.error("Failed to fetch address suggestions", error);
                setAddressSuggestions([]);
            }
        }, 400);
    };

    const proceedProspect = () => {
        if (!prospectAddress.trim()) {
            showToast("PROSPECT ADDRESS REQUIRED", "warning");
            return;
        }

        setSelectedClientId(null);
        setClientAddress(prospectAddress.trim());
        setLawnSqft(prospectSqft);
        setCurrentStep(2);
        clearPreview();
    };

    const updateAdditionalService = (serviceName: string, updates: Partial<BillingServiceSelection>) => {
        setAdditionalServices((current) =>
            current.map((service) => (service.name === serviceName ? { ...service, ...updates } : service)),
        );
        clearPreview();
    };

    const loadAdditionalServicesFromDocument = (services: { name: string; price: number }[]) => {
        setAdditionalServices(
            createInitialAdditionalServices().map((service) => {
                const existing = services.find((item) => item.name === service.name);
                return existing ? { ...service, enabled: true, price: existing.price.toFixed(2) } : service;
            }),
        );
    };

    const handleGeneratePreview = () => {
        if (rateValue <= 0) {
            setRateError("RATE REQUIRED — enter a price per visit");
            showToast("RATE REQUIRED", "warning");
            return;
        }

        if (!clientName.trim() || !clientAddress.trim()) {
            showToast("CLIENT DETAILS REQUIRED", "warning");
            return;
        }

        setRateError(null);

        if (mode === "quote") {
            const quote: Quote = {
                id: crypto.randomUUID(),
                type: "quote",
                clientId: selectedClientId ?? undefined,
                clientName: clientName.trim(),
                clientAddress: clientAddress.trim(),
                lawnSqft: parseSqftValue(lawnSqft),
                serviceType,
                visits: visitsValue,
                ratePerVisit: rateValue,
                seasonTotal: totalDue,
                additionalServices: additionalServicesPayload,
                notes: notes.trim() || undefined,
                validUntil,
                createdAt: new Date().toISOString(),
                status: isQuoteExpired(validUntil) ? "expired" : "open",
                hstApplied,
                hstAmount,
            };
            setPreviewDocument(quote);
        } else {
            const invoice: Invoice = {
                id: draftInvoiceId ?? crypto.randomUUID(),
                type: "invoice",
                clientId: selectedClientId ?? undefined,
                clientName: clientName.trim(),
                clientAddress: clientAddress.trim(),
                lawnSqft: parseSqftValue(lawnSqft),
                serviceType,
                servicePeriod: { start: servicePeriodStart, end: servicePeriodEnd },
                visits: visitsValue,
                ratePerVisit: rateValue,
                grandTotal: totalDue,
                additionalServices: additionalServicesPayload,
                paymentMethod,
                paymentInstructions: paymentInstructions.trim() || undefined,
                notes: notes.trim() || undefined,
                invoiceDate,
                dueDate,
                status: "unpaid",
                hstApplied,
                hstAmount,
                convertedFromQuoteId,
            };
            setPreviewDocument(invoice);
        }

        setPreviewOrigin("draft");
        setCurrentStep(3);
        window.setTimeout(() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    };

    const handleViewDocument = (document: Quote | Invoice) => {
        setMode(document.type);
        setTargetMode(document.clientId ? "client" : "prospect");
        setSelectedClientId(document.clientId ?? null);
        setClientName(document.clientName);
        setClientAddress(document.clientAddress);
        setLawnSqft(document.lawnSqft ? String(document.lawnSqft) : "");
        setServiceType(document.serviceType);
        setVisits(String(document.type === "invoice" ? document.visits : document.visits ?? 1));
        setRatePerVisit((document.ratePerVisit ?? 0).toFixed(2));
        setNotes(document.notes ?? "");
        setHstApplied(document.hstApplied);
        loadAdditionalServicesFromDocument(document.additionalServices);

        if (document.type === "quote") {
            setValidUntil(document.validUntil);
            setConversionBanner(null);
            setDraftInvoiceId(null);
            setConvertedFromQuoteId(undefined);
        } else {
            setInvoiceDate(document.invoiceDate);
            setDueDate(document.dueDate);
            setServicePeriodStart(document.servicePeriod.start);
            setServicePeriodEnd(document.servicePeriod.end);
            setPaymentMethod(document.paymentMethod);
            setPaymentInstructions(document.paymentInstructions ?? "");
            setDraftInvoiceId(document.id);
            setConvertedFromQuoteId(document.convertedFromQuoteId);
            setConversionBanner(
                document.convertedFromQuoteId
                    ? `CONVERTED FROM QUOTE ${buildDocumentNumber("quote", document.convertedFromQuoteId)}`
                    : null,
            );
        }

        setPreviewDocument(document);
        setPreviewOrigin("saved");
        setCurrentStep(3);
    };

    const handleConvertQuote = (quote: Quote) => {
        setMode("invoice");
        setTargetMode(quote.clientId ? "client" : "prospect");
        setSelectedClientId(quote.clientId ?? null);
        setClientName(quote.clientName);
        setClientAddress(quote.clientAddress);
        setLawnSqft(quote.lawnSqft ? String(quote.lawnSqft) : "");
        setServiceType(quote.serviceType);
        setVisits(String(quote.visits ?? 1));
        setRatePerVisit((quote.ratePerVisit ?? 0).toFixed(2));
        setNotes(quote.notes ?? "");
        setHstApplied(quote.hstApplied);
        loadAdditionalServicesFromDocument(quote.additionalServices);
        setInvoiceDate(today);
        setDueDate(addDays(today, 14));
        setServicePeriodStart(defaultServicePeriod.start);
        setServicePeriodEnd(defaultServicePeriod.end);
        setPaymentMethod(PAYMENT_METHOD_OPTIONS[0]);
        setPaymentInstructions("");
        setDraftInvoiceId(crypto.randomUUID());
        setConvertedFromQuoteId(quote.id);
        setConversionBanner(`CONVERTED FROM QUOTE ${getDocumentNumber(quote)}`);
        setPreviewDocument(null);
        setPreviewOrigin(null);
        setCurrentStep(2);
    };

    const handleSaveDocument = () => {
        if (!previewDocument || previewOrigin === "saved") return;

        if (previewDocument.type === "quote") {
            addQuote(previewDocument);
        } else {
            addInvoice(previewDocument);
        }

        setPreviewOrigin("saved");
        showToast("DOCUMENT SAVED");
    };

    const handleCopyDocument = async () => {
        if (!previewDocument) return;

        try {
            await navigator.clipboard.writeText(buildDocumentClipboardText(previewDocument, operatorProfile));
            showToast("DOCUMENT COPIED");
        } catch (error) {
            console.error("Failed to copy billing document", error);
            showToast("COPY FAILED", "warning");
        }
    };

    const handleEmailDocument = () => {
        if (!previewDocument) return;
        window.location.href = buildMailtoLink(previewDocument, operatorProfile);
        showToast("EMAIL READY");
    };

    const handleExportDocument = () => {
        if (!previewDocument) return;
        window.print();
    };

    const handleDeleteQuote = (id: string) => {
        deleteQuote(id);
        if (previewDocument?.type === "quote" && previewDocument.id === id) {
            setPreviewDocument(null);
            setPreviewOrigin(null);
            setCurrentStep(2);
        }
        showToast("QUOTE DELETED");
    };

    const handleDeleteInvoice = (id: string) => {
        deleteInvoice(id);
        if (previewDocument?.type === "invoice" && previewDocument.id === id) {
            setPreviewDocument(null);
            setPreviewOrigin(null);
            setCurrentStep(2);
        }
        showToast("INVOICE DELETED");
    };

    const handleMarkInvoicePaid = (invoice: Invoice) => {
        const paidAt = new Date().toISOString();
        updateInvoice(invoice.id, {
            status: "paid",
            paidAt,
        });

        if (previewDocument?.type === "invoice" && previewDocument.id === invoice.id) {
            setPreviewDocument({
                ...previewDocument,
                status: "paid",
                paidAt,
            });
        }

        showToast("INVOICE MARKED PAID");
    };

    return (
        <div className="min-h-[100dvh] bg-[#0a0f0d] px-4 pb-[144px] pt-10 text-white">
            {toast && (
                <div
                    className={cn(
                        "fixed right-4 top-4 z-[180] rounded-2xl border px-4 py-3 text-sm font-black uppercase tracking-[0.18em]",
                        toast.tone === "warning"
                            ? "border-orange-500/30 bg-orange-500/15 text-orange-300"
                            : "border-primary/30 bg-primary/15 text-primary",
                    )}
                >
                    {toast.message}
                </div>
            )}

            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-no-print>
                    <StatCard label="Total Quoted" value={formatCurrency(totalQuoted)} />
                    <StatCard label="Total Invoiced" value={formatCurrency(totalInvoiced)} />
                    <StatCard label="Total Paid" value={formatCurrency(totalPaid)} />
                    <StatCard
                        label="Outstanding"
                        value={formatCurrency(outstanding)}
                        accent={outstanding > 0 ? "orange" : "default"}
                    />
                </section>

                <section className="glass-card rounded-[28px] border border-white/10 bg-white/[0.02] p-6" data-no-print>
                    <div className="flex flex-col gap-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <StepLabel>Billing</StepLabel>
                                <h1 className="mt-3 text-4xl font-black uppercase tracking-tight text-white">
                                    Invoices & Quotes
                                </h1>
                            </div>

                            <Tabs value={mode} onValueChange={handleModeChange}>
                                <TabsList className="w-full sm:w-auto">
                                    <TabsTrigger value="quote" className="min-w-[120px]">
                                        Quote
                                    </TabsTrigger>
                                    <TabsTrigger value="invoice" className="min-w-[120px]">
                                        Invoice
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>

                        <Stepper currentStep={currentStep} onStepClick={setCurrentStep} />

                        {conversionBanner && (
                            <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-black uppercase tracking-[0.2em] text-primary">
                                {conversionBanner}
                            </div>
                        )}

                        {currentStep === 1 && (
                            <div className="space-y-5">
                                <Tabs value={targetMode} onValueChange={(value) => setTargetMode(value as TargetMode)}>
                                    <TabsList className="w-full sm:w-auto">
                                        <TabsTrigger value="client">Existing Client</TabsTrigger>
                                        <TabsTrigger value="prospect">Prospect</TabsTrigger>
                                    </TabsList>
                                </Tabs>

                                {targetMode === "client" ? (
                                    <div className="space-y-4">
                                        <div className="relative">
                                            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-primary/70" />
                                            <Input
                                                value={searchQuery}
                                                onChange={(event) => setSearchQuery(event.target.value)}
                                                placeholder="SEARCH CLIENTS..."
                                                className="stealth-noir-glass h-12 border-white/10 pl-10 text-white"
                                            />
                                        </div>

                                        {filteredClients.length === 0 ? (
                                            <div className="glass-card rounded-2xl border border-white/10 bg-black/20 px-4 py-10 text-center">
                                                <FileText className="mx-auto h-10 w-10 text-white/20" />
                                                <p className="mt-4 font-mono text-xs font-black uppercase tracking-[0.26em] text-white/40">
                                                    No Matching Clients
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {filteredClients.map((client) => {
                                                    const hasQuote = quotes.some((quote) => quote.clientId === client.id);
                                                    const hasInvoice = invoices.some(
                                                        (invoice) => invoice.clientId === client.id,
                                                    );
                                                    const hasSqft = !!parseSqftValue(client.sqft);

                                                    return (
                                                        <button
                                                            key={client.id}
                                                            type="button"
                                                            onClick={() => handleSelectExistingClient(client)}
                                                            className="glass-card w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-left transition-colors hover:border-primary/20"
                                                        >
                                                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                                                <div>
                                                                    <p className="text-lg font-black uppercase tracking-tight text-white">
                                                                        {client.name}
                                                                    </p>
                                                                    <p className="mt-2 text-sm font-mono text-white/55">
                                                                        {client.address}
                                                                    </p>
                                                                    <p className="mt-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/35">
                                                                        {getLastMowedLabel(client.id, sessions)}
                                                                    </p>
                                                                </div>

                                                                <div className="flex flex-wrap gap-2">
                                                                    <Badge className="border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-black tracking-[0.18em] text-white">
                                                                        {client.billingType === "PerCut" ? "PER CUT" : "REGULAR"}
                                                                    </Badge>
                                                                    <Badge
                                                                        className={cn(
                                                                            "border px-2.5 py-1 text-[10px] font-black tracking-[0.18em]",
                                                                            hasSqft
                                                                                ? "border-primary/30 bg-primary/20 text-primary"
                                                                                : "border-orange-500/30 bg-orange-500/20 text-orange-400",
                                                                        )}
                                                                    >
                                                                        {hasSqft ? "SQFT SET" : "NO SQFT"}
                                                                    </Badge>
                                                                    {hasQuote && (
                                                                        <Badge className="border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-black tracking-[0.18em] text-primary">
                                                                            QUOTED
                                                                        </Badge>
                                                                    )}
                                                                    {hasInvoice && (
                                                                        <Badge className="border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-black tracking-[0.18em] text-primary">
                                                                            INVOICED
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">
                                                Prospect Address
                                            </label>
                                            <div className="relative">
                                                <MapPin className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-primary/70" />
                                                <Input
                                                    value={prospectAddress}
                                                    onChange={(event) => handleProspectAddressChange(event.target.value)}
                                                    className="stealth-noir-glass h-12 border-white/10 pl-10 text-white"
                                                />

                                                {addressSuggestions.length > 0 && (
                                                    <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#101411]">
                                                        {addressSuggestions.map((suggestion) => (
                                                            <button
                                                                key={suggestion.display_name}
                                                                type="button"
                                                                onClick={() => {
                                                                    setProspectAddress(suggestion.display_name);
                                                                    setAddressSuggestions([]);
                                                                }}
                                                                className="block w-full border-b border-white/5 px-4 py-3 text-left text-sm font-mono text-white/75 last:border-b-0 hover:bg-primary/10"
                                                            >
                                                                {suggestion.display_name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                                if (!prospectAddress.trim()) {
                                                    showToast("PROSPECT ADDRESS REQUIRED", "warning");
                                                    return;
                                                }
                                                setShowLawnModal(true);
                                            }}
                                            className="glass-card h-12 rounded-2xl border-primary/30 bg-primary/10 px-4 text-xs font-black uppercase tracking-[0.22em] text-primary hover:bg-primary/20"
                                        >
                                            📐 Set Lawn Sqft
                                        </Button>

                                        {prospectSqft && (
                                            <p className="font-mono text-sm text-primary">
                                                CONFIRMED: {Number(prospectSqft).toLocaleString()} sq ft
                                            </p>
                                        )}

                                        <Button
                                            type="button"
                                            onClick={proceedProspect}
                                            className="h-12 rounded-2xl bg-primary px-6 text-sm font-black uppercase tracking-[0.24em] text-black"
                                        >
                                            Continue
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                        {currentStep === 2 && (
                            <div className="space-y-6">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">
                                            Client Name
                                        </label>
                                        <Input
                                            value={clientName}
                                            onChange={(event) => {
                                                setClientName(event.target.value);
                                                clearPreview();
                                            }}
                                            placeholder="CLIENT NAME"
                                            className="stealth-noir-glass h-12 border-white/10 text-white"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">
                                            Lawn Size (Sq Ft)
                                        </label>
                                        <Input
                                            value={lawnSqft}
                                            onChange={(event) => {
                                                setLawnSqft(event.target.value);
                                                clearPreview();
                                            }}
                                            inputMode="decimal"
                                            placeholder="0"
                                            className="stealth-noir-glass h-12 border-white/10 text-white"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">
                                        Address
                                    </label>
                                    <Input
                                        value={clientAddress}
                                        onChange={(event) => {
                                            setClientAddress(event.target.value);
                                            clearPreview();
                                        }}
                                        placeholder="FULL SERVICE ADDRESS"
                                        className="stealth-noir-glass h-12 border-white/10 text-white"
                                    />
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    {mode === "quote" ? (
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">
                                                Valid Until
                                            </label>
                                            <Input
                                                type="date"
                                                value={validUntil}
                                                onChange={(event) => {
                                                    setValidUntil(event.target.value);
                                                    clearPreview();
                                                }}
                                                className="stealth-noir-glass h-12 border-white/10 text-white"
                                            />
                                        </div>
                                    ) : (
                                        <>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">
                                                    Invoice Date
                                                </label>
                                                <Input
                                                    type="date"
                                                    value={invoiceDate}
                                                    onChange={(event) => {
                                                        setInvoiceDate(event.target.value);
                                                        clearPreview();
                                                    }}
                                                    className="stealth-noir-glass h-12 border-white/10 text-white"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">
                                                    Due Date
                                                </label>
                                                <Input
                                                    type="date"
                                                    value={dueDate}
                                                    onChange={(event) => {
                                                        setDueDate(event.target.value);
                                                        clearPreview();
                                                    }}
                                                    className="stealth-noir-glass h-12 border-white/10 text-white"
                                                />
                                            </div>
                                        </>
                                    )}

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">
                                            Service Type
                                        </label>
                                        <Select
                                            value={serviceType}
                                            onValueChange={(value) => {
                                                setServiceType(value);
                                                clearPreview();
                                            }}
                                        >
                                            <SelectTrigger className="stealth-noir-glass h-12 border-white/10 text-white">
                                                <SelectValue placeholder="Select service type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {BILLING_SERVICE_TYPES.map((option) => (
                                                    <SelectItem key={option} value={option}>
                                                        {option}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">
                                            Visits
                                        </label>
                                        <Input
                                            type="number"
                                            min="1"
                                            value={visits}
                                            onChange={(event) => {
                                                setVisits(event.target.value);
                                                clearPreview();
                                            }}
                                            className="stealth-noir-glass h-12 border-white/10 text-white"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">
                                            Rate Per Visit
                                        </label>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={ratePerVisit}
                                            onChange={(event) => {
                                                setRatePerVisit(event.target.value);
                                                setRateError(null);
                                                clearPreview();
                                            }}
                                            className={cn(
                                                "stealth-noir-glass h-12 text-white",
                                                rateError
                                                    ? "border-red-500/70 focus-visible:ring-red-500"
                                                    : "border-white/10",
                                            )}
                                        />
                                        {selectedClient?.billingType === "Regular" &&
                                            inferSuggestedRate(selectedClient) > 0 && (
                                                <p className="text-[11px] font-mono text-primary/75">
                                                    Suggested from client rate
                                                </p>
                                            )}
                                        {rateError && (
                                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-red-400">
                                                {rateError}
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">
                                            {mode === "quote" ? "Base Total" : "Grand Total"}
                                        </label>
                                        <div className="glass-card flex h-12 items-center rounded-2xl border border-primary/20 bg-primary/10 px-4 font-mono text-lg font-black text-primary">
                                            {formatCurrency(mode === "quote" ? subtotal : totalDue)}
                                        </div>
                                    </div>
                                </div>

                                {mode === "invoice" && (
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">
                                                Service Period Start
                                            </label>
                                            <Input
                                                type="date"
                                                value={servicePeriodStart}
                                                onChange={(event) => {
                                                    setServicePeriodStart(event.target.value);
                                                    clearPreview();
                                                }}
                                                className="stealth-noir-glass h-12 border-white/10 text-white"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">
                                                Service Period End
                                            </label>
                                            <Input
                                                type="date"
                                                value={servicePeriodEnd}
                                                onChange={(event) => {
                                                    setServicePeriodEnd(event.target.value);
                                                    clearPreview();
                                                }}
                                                className="stealth-noir-glass h-12 border-white/10 text-white"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">
                                                Payment Method
                                            </label>
                                            <Select
                                                value={paymentMethod}
                                                onValueChange={(value) => {
                                                    setPaymentMethod(value);
                                                    clearPreview();
                                                }}
                                            >
                                                <SelectTrigger className="stealth-noir-glass h-12 border-white/10 text-white">
                                                    <SelectValue placeholder="Select payment method" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {PAYMENT_METHOD_OPTIONS.map((option) => (
                                                        <SelectItem key={option} value={option}>
                                                            {option}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2 md:col-span-2">
                                            <label className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">
                                                Payment Instructions
                                            </label>
                                            <textarea
                                                value={paymentInstructions}
                                                onChange={(event) => {
                                                    setPaymentInstructions(event.target.value);
                                                    clearPreview();
                                                }}
                                                rows={4}
                                                className="stealth-noir-glass min-h-[110px] w-full rounded-2xl border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                                placeholder="SEND E-TRANSFER TO..."
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">
                                            Additional Services
                                        </label>
                                        <p className="mt-2 font-mono text-xs text-white/45">
                                            Add one-time extras to this {mode}.
                                        </p>
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-2">
                                        {additionalServices.map((service) => (
                                            <div
                                                key={service.name}
                                                className="glass-card rounded-2xl border border-white/10 bg-black/20 p-4"
                                            >
                                                <label className="flex cursor-pointer items-center justify-between gap-3">
                                                    <span className="flex items-center gap-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={service.enabled}
                                                            onChange={(event) =>
                                                                updateAdditionalService(service.name, {
                                                                    enabled: event.target.checked,
                                                                    price: event.target.checked ? service.price : "",
                                                                })
                                                            }
                                                            className="h-4 w-4 rounded border-white/20 bg-black text-primary focus:ring-primary"
                                                        />
                                                        <span className="font-mono text-sm font-bold uppercase tracking-[0.14em] text-white">
                                                            {service.name}
                                                        </span>
                                                    </span>
                                                    {service.enabled && (
                                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80">
                                                            One-Time
                                                        </span>
                                                    )}
                                                </label>

                                                {service.enabled && (
                                                    <div className="mt-3 flex items-center gap-2">
                                                        <span className="font-mono text-sm text-primary">+</span>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={service.price}
                                                            onChange={(event) =>
                                                                updateAdditionalService(service.name, {
                                                                    price: event.target.value,
                                                                })
                                                            }
                                                            className="stealth-noir-glass h-11 border-white/10 text-white"
                                                        />
                                                        <span className="font-mono text-xs uppercase tracking-[0.16em] text-white/45">
                                                            CAD (one-time)
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="glass-card rounded-2xl border border-white/10 bg-black/20 p-4">
                                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">
                                                Apply HST (15% · NB)
                                            </label>
                                            <p className="mt-2 font-mono text-xs text-white/45">
                                                Toggle tax on or off for this {mode}.
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <span
                                                className={cn(
                                                    "font-mono text-xs font-black uppercase tracking-[0.2em]",
                                                    hstApplied ? "text-primary" : "text-white/35",
                                                )}
                                            >
                                                {hstApplied ? "ON" : "OFF"}
                                            </span>
                                            <Switch
                                                checked={hstApplied}
                                                onCheckedChange={(checked) => {
                                                    setHstApplied(checked);
                                                    clearPreview();
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-4 space-y-2 font-mono text-sm">
                                        <div className="flex items-center justify-between text-white/80">
                                            <span>
                                                {hstApplied
                                                    ? "SUBTOTAL"
                                                    : mode === "quote"
                                                      ? "BASE TOTAL"
                                                      : "GRAND TOTAL"}
                                            </span>
                                            <span>{formatCurrency(subtotal)}</span>
                                        </div>
                                        {hstApplied && (
                                            <>
                                                <div className="flex items-center justify-between text-white/50">
                                                    <span>HST (15%)</span>
                                                    <span>{formatCurrency(hstAmount)}</span>
                                                </div>
                                                <div className="border-t border-primary/30 pt-2" />
                                                <div className="flex items-center justify-between text-lg font-black text-primary">
                                                    <span>{mode === "quote" ? "TOTAL DUE" : "GRAND TOTAL"}</span>
                                                    <span>{formatCurrency(totalDue)}</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">
                                        Notes
                                    </label>
                                    <textarea
                                        value={notes}
                                        onChange={(event) => {
                                            setNotes(event.target.value);
                                            clearPreview();
                                        }}
                                        rows={4}
                                        className="stealth-noir-glass min-h-[120px] w-full rounded-2xl border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                        placeholder="ADD SERVICE NOTES, ACCESS DETAILS, OR TERMS..."
                                    />
                                </div>

                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setCurrentStep(1)}
                                        className="h-12 rounded-2xl border-white/10 bg-black/20 px-5 text-xs font-black uppercase tracking-[0.22em] text-white/70"
                                    >
                                        Back
                                    </Button>

                                    <Button
                                        type="button"
                                        onClick={handleGeneratePreview}
                                        className="h-12 rounded-2xl bg-primary px-6 text-sm font-black uppercase tracking-[0.24em] text-black"
                                    >
                                        Generate Preview
                                    </Button>
                                </div>
                            </div>
                        )}
                        {currentStep === 3 && previewDocument && (
                            <div ref={previewRef} className="space-y-5">
                                <div className="flex flex-wrap gap-3" data-no-print>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleExportDocument}
                                        className="h-12 rounded-2xl border-white/10 bg-black/20 px-5 text-xs font-black uppercase tracking-[0.22em] text-white"
                                    >
                                        📄 Export PDF
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => void handleCopyDocument()}
                                        className="h-12 rounded-2xl border-white/10 bg-black/20 px-5 text-xs font-black uppercase tracking-[0.22em] text-white"
                                    >
                                        <Copy className="mr-2 h-4 w-4" />
                                        Copy
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleEmailDocument}
                                        className="h-12 rounded-2xl border-white/10 bg-black/20 px-5 text-xs font-black uppercase tracking-[0.22em] text-white"
                                    >
                                        <Mail className="mr-2 h-4 w-4" />
                                        Email
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={handleSaveDocument}
                                        disabled={previewOrigin === "saved"}
                                        className="h-12 rounded-2xl bg-primary px-5 text-xs font-black uppercase tracking-[0.22em] text-black disabled:bg-white/10 disabled:text-white/35"
                                    >
                                        <Save className="mr-2 h-4 w-4" />
                                        {previewOrigin === "saved" ? "Saved" : "Save"}
                                    </Button>
                                </div>

                                <DocumentPreview document={previewDocument} />
                            </div>
                        )}
                    </div>
                </section>

                <section className="glass-card rounded-[28px] border border-white/10 bg-white/[0.02] p-6" data-no-print>
                    <div className="flex flex-col gap-2">
                        <StepLabel>Saved Documents</StepLabel>
                        <h2 className="text-2xl font-black uppercase tracking-tight text-white">
                            Billing Archive
                        </h2>
                    </div>

                    <Accordion type="multiple" defaultValue={["quotes", "invoices"]} className="mt-6 space-y-4">
                        <AccordionItem
                            value="quotes"
                            className="overflow-hidden rounded-2xl border border-white/10 bg-black/20 px-4"
                        >
                            <AccordionTrigger className="hover:no-underline">
                                <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="text-left">
                                        <p className="font-mono text-xs font-black uppercase tracking-[0.24em] text-white/55">
                                            Saved Quotes ({quotes.length})
                                        </p>
                                        <p className="mt-1 text-sm text-white/35">
                                            View, convert, or remove saved quotes.
                                        </p>
                                    </div>
                                    <SortControls
                                        active={quoteSort}
                                        onChange={(value) => setQuoteSort(value as QuoteSortKey)}
                                    />
                                </div>
                            </AccordionTrigger>

                            <AccordionContent className="space-y-3 pt-2">
                                {sortedQuotes.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center">
                                        <FileText className="mx-auto h-10 w-10 text-white/20" />
                                        <p className="mt-4 font-mono text-xs font-black uppercase tracking-[0.26em] text-white/40">
                                            No Quotes Saved Yet
                                        </p>
                                    </div>
                                ) : (
                                    sortedQuotes.map((quote) => {
                                        const resolvedStatus = getResolvedQuoteStatus(quote);

                                        return (
                                            <div
                                                key={quote.id}
                                                className="rounded-2xl border border-white/10 bg-black/20 p-4"
                                            >
                                                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                                    <div className="space-y-2">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="font-mono text-sm font-black text-white/70">
                                                                {getDocumentNumber(quote)}
                                                            </span>
                                                            <Badge
                                                                className={cn(
                                                                    "border px-2.5 py-1 text-[10px] font-black tracking-[0.18em]",
                                                                    resolvedStatus === "open"
                                                                        ? "border-primary/30 bg-primary/10 text-primary"
                                                                        : "border-white/10 bg-white/10 text-white/50",
                                                                )}
                                                            >
                                                                {resolvedStatus.toUpperCase()}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-lg font-black text-white">{quote.clientName}</p>
                                                        <p className="font-mono text-xs text-white/40">
                                                            {formatNumericDate(quote.createdAt)}
                                                        </p>
                                                    </div>

                                                    <div className="flex flex-col gap-3 lg:items-end">
                                                        <p className="font-mono text-xl font-black text-primary">
                                                            {formatCurrency(getDocumentGrandTotal(quote))}
                                                        </p>
                                                        <div className="flex flex-wrap gap-2">
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                onClick={() => handleViewDocument(quote)}
                                                                className="h-10 rounded-xl border-white/10 bg-black/20 px-4 text-[10px] font-black uppercase tracking-[0.18em] text-white"
                                                            >
                                                                View
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                onClick={() => handleConvertQuote(quote)}
                                                                className="h-10 rounded-xl border-primary/20 bg-primary/10 px-4 text-[10px] font-black uppercase tracking-[0.18em] text-primary"
                                                            >
                                                                → Invoice
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                onClick={() => handleDeleteQuote(quote.id)}
                                                                className="h-10 rounded-xl border-white/10 bg-black/20 px-4 text-[10px] font-black uppercase tracking-[0.18em] text-white/70"
                                                            >
                                                                <Trash2 className="mr-2 h-3.5 w-3.5" />
                                                                Delete
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem
                            value="invoices"
                            className="overflow-hidden rounded-2xl border border-white/10 bg-black/20 px-4"
                        >
                            <AccordionTrigger className="hover:no-underline">
                                <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="text-left">
                                        <p className="font-mono text-xs font-black uppercase tracking-[0.24em] text-white/55">
                                            Saved Invoices ({invoices.length})
                                        </p>
                                        <p className="mt-1 text-sm text-white/35">
                                            Review payment status and resend records.
                                        </p>
                                    </div>
                                    <SortControls
                                        active={invoiceSort}
                                        onChange={(value) => setInvoiceSort(value as InvoiceSortKey)}
                                    />
                                </div>
                            </AccordionTrigger>

                            <AccordionContent className="space-y-3 pt-2">
                                {sortedInvoices.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center">
                                        <FileText className="mx-auto h-10 w-10 text-white/20" />
                                        <p className="mt-4 font-mono text-xs font-black uppercase tracking-[0.26em] text-white/40">
                                            No Invoices Saved Yet
                                        </p>
                                    </div>
                                ) : (
                                    sortedInvoices.map((invoice) => (
                                        <div
                                            key={invoice.id}
                                            className="rounded-2xl border border-white/10 bg-black/20 p-4"
                                        >
                                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                                <div className="space-y-2">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-mono text-sm font-black text-white/70">
                                                            {getDocumentNumber(invoice)}
                                                        </span>
                                                        <Badge
                                                            className={cn(
                                                                "border px-2.5 py-1 text-[10px] font-black tracking-[0.18em]",
                                                                invoice.status === "paid"
                                                                    ? "border-primary/30 bg-primary/10 text-primary"
                                                                    : "border-orange-500/30 bg-orange-500/20 text-orange-400",
                                                            )}
                                                        >
                                                            {invoice.status.toUpperCase()}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-lg font-black text-white">{invoice.clientName}</p>
                                                    <p className="font-mono text-xs text-white/40">
                                                        {formatNumericDate(invoice.dueDate)}
                                                    </p>
                                                </div>

                                                <div className="flex flex-col gap-3 lg:items-end">
                                                    <p className="font-mono text-xl font-black text-primary">
                                                        {formatCurrency(getDocumentGrandTotal(invoice))}
                                                    </p>
                                                    <div className="flex flex-wrap gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={() => handleViewDocument(invoice)}
                                                            className="h-10 rounded-xl border-white/10 bg-black/20 px-4 text-[10px] font-black uppercase tracking-[0.18em] text-white"
                                                        >
                                                            View
                                                        </Button>
                                                        {invoice.status === "unpaid" && (
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                onClick={() => handleMarkInvoicePaid(invoice)}
                                                                className="h-10 rounded-xl border-primary/20 bg-primary/10 px-4 text-[10px] font-black uppercase tracking-[0.18em] text-primary"
                                                            >
                                                                <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                                                                Mark Paid
                                                            </Button>
                                                        )}
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={() => handleDeleteInvoice(invoice.id)}
                                                            className="h-10 rounded-xl border-white/10 bg-black/20 px-4 text-[10px] font-black uppercase tracking-[0.18em] text-white/70"
                                                        >
                                                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                                                            Delete
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </section>
            </div>

            {showLawnModal && (
                <LawnDrawModal
                    address={prospectAddress}
                    onConfirm={(sqft) => {
                        const nextValue = String(sqft);
                        setProspectSqft(nextValue);
                        setLawnSqft(nextValue);
                        setShowLawnModal(false);
                        showToast("LAWN SQFT SET");
                    }}
                    onClose={() => setShowLawnModal(false)}
                />
            )}
        </div>
    );
}
