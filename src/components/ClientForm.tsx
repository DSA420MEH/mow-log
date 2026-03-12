/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, useRef } from "react";
import { useStore, BillingType, Client } from "@/lib/store";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, CheckCircle2, ChevronRight, ChevronLeft, Pencil } from "lucide-react";
import { cn } from "../lib/utils";

interface ClientFormProps {
    customTrigger?: React.ReactNode;
    initialData?: Client;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    contentClassName?: string;
}

export function ClientForm({ customTrigger, initialData, open: externalOpen, onOpenChange: externalOnOpenChange, contentClassName }: ClientFormProps) {
    const { addClient, updateClient, homeAddress, homeLat, homeLng } = useStore();
    const [internalOpen, setInternalOpen] = useState(false);

    // Use external open state if provided, otherwise use internal
    const open = externalOpen !== undefined ? externalOpen : internalOpen;
    const setOpen = (v: boolean) => {
        if (externalOnOpenChange) externalOnOpenChange(v);
        setInternalOpen(v);
    };

    const [step, setStep] = useState(1);
    const [success, setSuccess] = useState(false);

    // Form State
    const [address, setAddress] = useState("");
    const [city, setCity] = useState("");
    const [zip, setZip] = useState("");
    const [sqft, setSqft] = useState("Under 5000");

    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [contractLength, setContractLength] = useState("");
    const [notes, setNotes] = useState("");

    const [billingType, setBillingType] = useState<BillingType>("PerCut");
    const [amount, setAmount] = useState("");
    const [lat, setLat] = useState<number | undefined>(undefined);
    const [lng, setLng] = useState<number | undefined>(undefined);

    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [isSearchingSuggestions, setIsSearchingSuggestions] = useState(false);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setAddress(val);

        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

        if (val.trim().length > 3) {
            setIsSearchingSuggestions(true);
            debounceTimerRef.current = setTimeout(async () => {
                try {
                    let query = val;
                    if (!val.includes(',') && homeAddress && homeAddress.includes(',')) {
                        const cityRegion = homeAddress.substring(homeAddress.indexOf(','));
                        query = val + cityRegion;
                    }

                    const res = await fetch(
                        `/api/places/autocomplete?q=${encodeURIComponent(query)}`
                    );
                    const data = await res.json();
                    setSuggestions(data);
                } catch {
                    setSuggestions([]);
                }
                setIsSearchingSuggestions(false);
            }, 600);
        } else {
            setSuggestions([]);
            setIsSearchingSuggestions(false);
        }
    };

    const selectSuggestion = async (sug: any) => {
        const adr = sug.address || {};
        const houseNumber = adr.number || "";
        const road = adr.street || "";
        const street = `${houseNumber} ${road}`.trim();

        // Fallback cleanup logic
        let cityVal = adr.city || "";
        if (!cityVal && sug.display_name.includes("Moncton")) {
            cityVal = "Moncton";
        }
        cityVal = cityVal.replace(/City of /gi, ""); 

        let zipVal = adr.zip || "";
        
        const selectedLat = parseFloat(sug.lat);
        const selectedLng = parseFloat(sug.lng);

        setAddress(street || sug.display_name.split(",")[0]);
        setCity(cityVal);
        setZip(zipVal);
        setLat(selectedLat);
        setLng(selectedLng);

        setSuggestions([]);

        // Geocodio often only returns 3-character Canadian FSAs. 
        // We use a free reverse lookup to find the full 6-character postal code locally.
        if (zipVal.length === 3 && selectedLat && selectedLng) {
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${selectedLat}&lon=${selectedLng}&format=json`, {
                    headers: { "User-Agent": "MowLogApp/1.0" }
                });
                const data = await res.json();
                if (data?.address?.postcode) {
                    setZip(data.address.postcode);
                }
            } catch (err) {
                console.error("Failed to fetch full postal code", err);
            }
        }
    };

    // Initialize/Reset form
    useEffect(() => {
        if (initialData && open) {
            // Try to split address: "Street, City Zip" or "Street, City, Zip"
            const parts = initialData.address.split(", ").map(p => p.trim());
            if (parts.length >= 3) {
                setAddress(parts[0]);
                setCity(parts[1]);
                setZip(parts[2]);
            } else if (parts.length === 2) {
                setAddress(parts[0]);
                const cityZip = parts[1];
                // Regex for typical postal codes (at the end)
                // Canadian: A1A 1A1, US: 12345
                const zipMatch = cityZip.match(/([A-Z]\d[A-Z]\s?\d[A-Z]\d|\d{5}(-\d{4})?)$/i);
                if (zipMatch) {
                    setZip(zipMatch[0]);
                    setCity(cityZip.replace(zipMatch[0], "").trim());
                } else {
                    setCity(cityZip);
                    setZip("");
                }
            } else {
                setAddress(initialData.address);
                setCity("");
                setZip("");
            }

            setName(initialData.name);
            setPhone(initialData.phone || "");
            setEmail(initialData.email || "");
            setContractLength(initialData.contractLength || "");
            setSqft(initialData.sqft || "Under 5000");
            setBillingType(initialData.billingType);
            setAmount(initialData.amount.toString());
            setNotes(initialData.notes || "");
            setLat(initialData.lat);
            setLng(initialData.lng);
            setStep(1);
            setSuccess(false);
        } else if (!initialData && open) {
            // Reset for new client
            setAddress("");
            setCity("");
            setZip("");
            setSqft("Under 5000");
            setName("");
            setPhone("");
            setEmail("");
            setContractLength("");
            setBillingType("PerCut");
            setAmount("");
            setNotes("");
            setLat(undefined);
            setLng(undefined);
            setStep(1);
            setSuccess(false);
        }
    }, [initialData, open]);

    const handleSave = () => {
        const clientData: Partial<Client> = {
            name,
            address: `${address}, ${city}, ${zip}`.trim(),
            phone,
            email,
            contractLength,
            sqft,
            billingType,
            amount: parseFloat(amount) || 0,
            notes,
        };

        if (lat !== undefined && lng !== undefined) {
            clientData.lat = lat;
            clientData.lng = lng;
        }

        if (initialData) {
            updateClient(initialData.id, clientData);
            // Auto close immediately for edits
            setOpen(false);
            setSuccess(false);
            setStep(1);
        } else {
            addClient(clientData as Omit<Client, 'id' | 'createdAt'>);
            setSuccess(true);
        }
    };

    // Auto-close success screen for new clients after 2 seconds
    useEffect(() => {
        if (success && !initialData) {
            const timer = setTimeout(() => {
                setOpen(false);
                setSuccess(false);
                setStep(1);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [success, initialData]);

    const currentClient = name || (initialData ? initialData.name : "New Client");

    if (success) {
        return (
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className={cn("!fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] sm:max-w-md bg-black/95 backdrop-blur-2xl border border-primary/30 text-white overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.7)] sm:rounded-2xl p-8", contentClassName)}>
                    <DialogTitle className="sr-only">Success</DialogTitle>
                    <div className="flex flex-col items-center justify-center py-10 text-center animate-in fade-in zoom-in duration-500">
                        <CheckCircle2 className="w-24 h-24 text-primary mb-6 animate-bounce" />
                        <h2 className="text-2xl font-bold text-white mb-2">
                            {initialData ? "Client Updated!" : "Address Added!"}
                        </h2>
                        <div className="glass-card hover:glass-card-hover p-4 rounded-xl mb-8 w-full border-primary/20">
                            <p className="font-semibold text-lg text-primary">{currentClient}</p>
                            <p className="text-muted-foreground text-sm">{address}</p>
                        </div>
                        <div className="grid grid-cols-2 w-full gap-3">
                            <Button variant="outline" className="w-full border-white/10 text-white" onClick={() => { setOpen(false); setSuccess(false); setStep(1); }}>
                                {initialData ? "Close" : "Dashboard"}
                            </Button>
                            {!initialData && (
                                <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
                                    Start First Mow
                                </Button>
                            )}
                            {initialData && (
                                <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold" onClick={() => setOpen(false)}>
                                    Done
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setStep(1); setSuccess(false); } }}>
            {(!externalOpen || customTrigger) && (
                <DialogTrigger asChild>
                    {customTrigger ? customTrigger : (
                        <Button className="fixed bottom-24 right-4 w-14 h-14 rounded-full shadow-lg shadow-black/50 bg-primary hover:bg-primary/90 text-primary-foreground z-40">
                            {initialData ? <Pencil className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
                        </Button>
                    )}
                </DialogTrigger>
            )}
            <DialogContent className={cn("!fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] sm:max-w-md bg-black/95 backdrop-blur-2xl border border-primary/30 text-white overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.7)] sm:rounded-2xl p-6 md:p-8", contentClassName)}>
                <DialogTitle className="text-2xl font-black tracking-tight mb-2">
                    {initialData ? `Edit ${initialData.name}` : "Add New Address"}
                </DialogTitle>

                {/* Stepper */}
                <div className="flex gap-2 mb-6 mt-2">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${step >= s ? "bg-primary shadow-[0_0_10px_rgba(204,255,0,0.5)]" : "bg-white/10"}`} />
                    ))}
                </div>
                <p className="text-[10px] text-primary mb-4 font-black uppercase tracking-[0.2em]">
                    Step {step} of 3
                </p>

                <div className="space-y-4 relative min-h-[350px]">
                    {/* Step 1: Location */}
                    {step === 1 && (
                        <div className="animate-in slide-in-from-right-4 fade-in duration-300 space-y-4">
                            <div className="space-y-2 relative">
                                <Label htmlFor="address" className="text-[10px] uppercase tracking-widest font-bold opacity-70">Street Address</Label>
                                <Input id="address" value={address} onChange={handleAddressChange} className="stealth-noir-glass border-white/10 focus-visible:ring-primary h-12" placeholder="123 Main St" />

                                {/* Autocomplete Dropdown */}
                                {suggestions.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-2 stealth-noir-glass border border-white/10 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-50 overflow-hidden text-sm font-mono max-h-60 overflow-y-auto">
                                        {suggestions.map((sug, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => selectSuggestion(sug)}
                                                className="w-full text-left px-4 py-3 border-b border-white/5 hover:bg-primary/20 text-white transition-colors last:border-0"
                                            >
                                                {sug.display_name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="city" className="text-[10px] uppercase tracking-widest font-bold opacity-70">City</Label>
                                    <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} className="stealth-noir-glass border-white/10 h-12" placeholder="Springfield" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="zip" className="text-[10px] uppercase tracking-widest font-bold opacity-70">Postal Code</Label>
                                    <Input id="zip" value={zip} onChange={(e) => setZip(e.target.value)} className="stealth-noir-glass border-white/10 h-12" placeholder="12345" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-widest font-bold opacity-70">Lawn Size</Label>
                                <Select value={sqft} onValueChange={setSqft}>
                                    <SelectTrigger className="stealth-noir-glass border-white/10 h-12">
                                        <SelectValue placeholder="Select size" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#1a201c] border-white/10 text-white">
                                        <SelectItem value="Under 5000">Under 5,000 sq ft</SelectItem>
                                        <SelectItem value="5000-10000">5,000 - 10,000 sq ft</SelectItem>
                                        <SelectItem value="10000+">10,000+ sq ft</SelectItem>
                                        <SelectItem value="Acre+">1 Acre+</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Client */}
                    {step === 2 && (
                        <div className="animate-in slide-in-from-right-4 fade-in duration-300 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-[10px] uppercase tracking-widest font-bold opacity-70">Client Name</Label>
                                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="stealth-noir-glass border-white/10 h-12" placeholder="John Doe" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone" className="text-[10px] uppercase tracking-widest font-bold opacity-70">Phone Number</Label>
                                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="stealth-noir-glass border-white/10 h-12" placeholder="(555) 123-4567" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-[10px] uppercase tracking-widest font-bold opacity-70">Email</Label>
                                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="stealth-noir-glass border-white/10 h-12" placeholder="john@example.com" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="contract" className="text-[10px] uppercase tracking-widest font-bold opacity-70">Contract</Label>
                                    <Input id="contract" value={contractLength} onChange={(e) => setContractLength(e.target.value)} className="stealth-noir-glass border-white/10 h-12" placeholder="6 Months" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="notes" className="text-[10px] uppercase tracking-widest font-bold opacity-70">Notes/Instructions</Label>
                                <textarea
                                    id="notes"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full min-h-[100px] rounded-md border border-white/10 stealth-noir-glass px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 text-white"
                                    placeholder="Gate code is 1234. Watch out for the dog."
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 3: Pricing */}
                    {step === 3 && (
                        <div className="animate-in slide-in-from-right-4 fade-in duration-300 space-y-4">
                            <div className="space-y-4">
                                <Label className="text-[10px] uppercase tracking-widest font-bold opacity-70">Billing Category</Label>
                                <div className="grid grid-cols-2 gap-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => setBillingType("Regular")}
                                        className={`h-24 flex flex-col gap-2 rounded-2xl transition-all ${billingType === "Regular" ? "border-primary bg-primary/10 text-primary shadow-[0_0_15px_rgba(204,255,0,0.15)]" : "border-white/10 stealth-noir-glass text-white/60 hover:text-white"}`}
                                    >
                                        <span className="font-bold">Regular</span>
                                        <span className="text-[10px] uppercase tracking-tighter opacity-50">Fixed Monthly</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => setBillingType("PerCut")}
                                        className={`h-24 flex flex-col gap-2 rounded-2xl transition-all ${billingType === "PerCut" ? "border-primary bg-primary/10 text-primary shadow-[0_0_15px_rgba(204,255,0,0.15)]" : "border-white/10 stealth-noir-glass text-white/60 hover:text-white"}`}
                                    >
                                        <span className="font-bold">Per Cut</span>
                                        <span className="text-[10px] uppercase tracking-tighter opacity-50">Per Session</span>
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="amount" className="text-[10px] uppercase tracking-widest font-bold opacity-70">Amount ($)</Label>
                                <div className="relative">
                                    <span className="absolute left-4 top-3 text-primary/60 font-bold">$</span>
                                    <Input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="stealth-noir-glass border-white/10 pl-8 text-2xl font-black h-14 text-white" placeholder="50.00" />
                                </div>
                                <p className="text-[10px] text-muted-foreground italic">
                                    {billingType === "Regular" ? "Charged monthly regardless of visit count." : "Charged each time a session is completed."}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-between mt-6 pt-4 border-t border-white/5">
                    <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 1} className="text-white/40 hover:text-white hover:bg-white/5">
                        <ChevronLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                    {step < 3 ? (
                        <div className="flex gap-3">
                            <Button onClick={handleSave} variant="outline" className="border-primary/50 text-primary stealth-noir-glass hover:bg-primary/20 hover:text-primary px-6 rounded-xl font-bold">
                                Save
                            </Button>
                            <Button onClick={() => setStep(step + 1)} className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 rounded-xl font-bold shadow-[0_0_15px_rgba(204,255,0,0.2)] transition-all">
                                Next <ChevronRight className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    ) : (
                        <Button onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90 font-black px-8 rounded-xl shadow-[0_0_20px_rgba(204,255,0,0.3)] transition-all active:scale-[0.98]">
                            {initialData ? "Update Client" : "Save Address"}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
