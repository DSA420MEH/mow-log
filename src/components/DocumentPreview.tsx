"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import {
    buildDocumentLineItems,
    formatNumericDate,
    formatPhoneNumber,
    getDocumentGrandTotal,
    getDocumentNumber,
    getDocumentSubtotal,
    toTitleCase,
} from "@/lib/billing";
import { formatCurrency } from "@/lib/formatters";
import type { Invoice, Quote } from "@/lib/store";
import { cn } from "@/lib/utils";

interface DocumentPreviewProps {
    document: Quote | Invoice;
    id?: string;
    className?: string;
}

function getStatusClasses(status: Quote["status"] | Invoice["status"]): string {
    switch (status) {
        case "paid":
        case "open":
            return "bg-primary/20 text-primary border-primary/30";
        case "unpaid":
            return "bg-orange-500/20 text-orange-400 border-orange-500/30";
        case "expired":
            return "bg-white/10 text-white/50 border-white/10";
        default:
            return "bg-white/10 text-white/70 border-white/10";
    }
}

export default function DocumentPreview({
    document,
    id = "billing-preview-card",
    className,
}: DocumentPreviewProps) {
    const store = useStore();
    const lineItems = buildDocumentLineItems(document);
    const operatorPhone = formatPhoneNumber(
        (store as typeof store & { userPhone?: string | null }).userPhone ?? undefined,
    );
    const operatorName = store.userName?.trim();
    const operatorAddress = store.homeAddress?.trim();
    const profileComplete = !!operatorName && !!operatorAddress && !!operatorPhone;

    return (
        <div data-billing-preview-shell className={cn("w-full", className)}>
            <article
                id={id}
                data-billing-preview-card
                className="glass-card relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.06] text-white shadow-[0_0_40px_rgba(0,0,0,0.4)]"
            >
                <div className="absolute inset-x-0 top-0 h-1 bg-primary" />

                {document.type === "invoice" && document.status === "paid" && (
                    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                        <div className="rotate-[-15deg] text-[4.5rem] font-black uppercase tracking-[0.28em] text-primary/15 sm:text-[7rem]">
                            PAID ✓
                        </div>
                    </div>
                )}

                <div className="relative z-10 p-6 sm:p-8">
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <h2 className="font-mono text-3xl font-bold text-primary">
                                    {document.type === "quote" ? "QUOTE" : "INVOICE"}
                                </h2>
                                <p className="mt-2 font-mono text-sm text-white/55">
                                    {getDocumentNumber(document)}
                                </p>
                            </div>

                            <div className="text-left sm:text-right">
                                <p className="text-lg font-black uppercase text-white">
                                    {operatorName || "Operator Profile"}
                                </p>
                                <p className="mt-1 text-sm text-white/70 capitalize">
                                    {operatorAddress ? toTitleCase(operatorAddress) : "Moncton, NB"}
                                </p>
                                {operatorPhone ? (
                                    <p className="mt-1 text-sm text-white/70">{operatorPhone}</p>
                                ) : null}
                                {!profileComplete && (
                                    <Link
                                        href="/profile"
                                        className="mt-2 inline-flex text-xs font-black uppercase tracking-[0.2em] text-orange-400"
                                    >
                                        Add In Profile →
                                    </Link>
                                )}
                                <Badge className={cn("mt-3 border px-2.5 py-1 text-[10px] font-black tracking-[0.18em]", getStatusClasses(document.status))}>
                                    {document.status.toUpperCase()}
                                </Badge>
                            </div>
                        </div>

                        <div className="border-t border-white/10" />

                        <div className="grid gap-6 sm:grid-cols-2">
                            <div>
                                <p className="text-xs uppercase tracking-[0.22em] text-white/45">Bill To</p>
                                <p className="mt-2 text-lg font-bold text-white">{document.clientName}</p>
                                <p className="mt-1 text-sm text-white/70">{document.clientAddress}</p>
                            </div>

                            <div className="space-y-1 text-left sm:text-right">
                                <p className="font-mono text-sm text-white/70">
                                    DATE: {formatNumericDate(document.type === "quote" ? document.createdAt : document.invoiceDate)}
                                </p>
                                <p className="font-mono text-sm text-white/70">
                                    {document.type === "quote" ? "VALID UNTIL" : "DUE DATE"}:{" "}
                                    {formatNumericDate(document.type === "quote" ? document.validUntil : document.dueDate)}
                                </p>
                            </div>
                        </div>

                        <div className="border-t border-white/10" />

                        <div className="overflow-hidden rounded-2xl border border-white/10">
                            <div className="grid grid-cols-[minmax(0,1.8fr)_0.6fr_0.8fr_0.8fr] gap-3 border-b border-primary/30 px-4 py-3 text-xs uppercase tracking-[0.24em] text-white/45">
                                <span>Description</span>
                                <span className="text-right">Qty</span>
                                <span className="text-right">Rate</span>
                                <span className="text-right">Amount</span>
                            </div>
                            {lineItems.map((item, index) => (
                                <div
                                    key={`${item.description}-${item.quantity}-${item.rate}`}
                                    className={cn(
                                        "grid grid-cols-[minmax(0,1.8fr)_0.6fr_0.8fr_0.8fr] gap-3 px-4 py-4 font-mono text-sm",
                                        index % 2 === 0 ? "bg-white/[0.02]" : "bg-transparent",
                                    )}
                                >
                                    <span className="truncate text-white">{item.description}</span>
                                    <span className="text-right tabular-nums text-white/80">{item.quantity}</span>
                                    <span className="text-right tabular-nums text-white/80">{formatCurrency(item.rate)}</span>
                                    <span className="text-right tabular-nums text-white">{formatCurrency(item.amount)}</span>
                                </div>
                            ))}
                        </div>

                        {document.hstApplied ? (
                            <div className="ml-auto w-full max-w-sm space-y-2">
                                <div className="flex items-center justify-between font-mono text-sm text-white/75">
                                    <span>SUBTOTAL</span>
                                    <span>{formatCurrency(getDocumentSubtotal(document))}</span>
                                </div>
                                <div className="flex items-center justify-between font-mono text-sm text-white/50">
                                    <span>HST (15%)</span>
                                    <span>{formatCurrency(document.hstAmount)}</span>
                                </div>
                                <div className="border-t border-primary/40 pt-3" />
                                <div className="flex items-center justify-between font-mono text-2xl font-bold text-primary">
                                    <span>{document.type === "quote" ? "TOTAL DUE" : "GRAND TOTAL"}</span>
                                    <span>{formatCurrency(getDocumentGrandTotal(document))}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="ml-auto w-full max-w-sm">
                                <div className="border-t border-primary/40 pt-3" />
                                <div className="mt-3 flex items-center justify-between font-mono text-2xl font-bold text-primary">
                                    <span>TOTAL</span>
                                    <span>{formatCurrency(getDocumentGrandTotal(document))}</span>
                                </div>
                            </div>
                        )}

                        {document.type === "invoice" && document.paymentInstructions && (
                            <div>
                                <p className="text-xs uppercase tracking-[0.22em] text-white/45">
                                    Payment Instructions
                                </p>
                                <p className="mt-2 whitespace-pre-wrap font-mono text-sm text-white/75">
                                    {document.paymentInstructions}
                                </p>
                            </div>
                        )}

                        {document.notes && (
                            <div>
                                <p className="text-xs uppercase tracking-[0.22em] text-white/45">Notes</p>
                                <p className="mt-2 whitespace-pre-wrap text-sm text-white/75">{document.notes}</p>
                            </div>
                        )}

                        <div className="text-right text-xs italic text-white/45">
                            <p>Your lawn care professional in Moncton, NB</p>
                            {operatorPhone && <p className="mt-1 not-italic">{operatorPhone}</p>}
                        </div>
                    </div>
                </div>
            </article>

            <style jsx global>{`
                @media print {
                    nav,
                    .bottom-nav,
                    header,
                    .app-chrome,
                    [data-no-print] {
                        display: none !important;
                    }

                    .glass-card {
                        background: white !important;
                        color: black !important;
                        border: 1px solid #ccc !important;
                    }

                    body {
                        background: white !important;
                    }

                    [data-billing-preview-shell] {
                        position: absolute !important;
                        inset: 0 !important;
                        width: 100% !important;
                    }
                }
            `}</style>
        </div>
    );
}
