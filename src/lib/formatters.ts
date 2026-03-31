const cadCurrencyFormatter = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

export function formatCurrency(amount: number): string {
    return cadCurrencyFormatter.format(Number.isFinite(amount) ? amount : 0);
}

export function formatDate(value: string): string {
    if (!value) return "N/A";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString("en-CA", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}
