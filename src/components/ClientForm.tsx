"use client";

import { useState, useEffect } from "react";
import { useStore, BillingType, Client } from "@/lib/store";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, CheckCircle2, ChevronRight, ChevronLeft, Pencil } from "lucide-react";

interface ClientFormProps {
    customTrigger?: React.ReactNode;
    initialData?: Client;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function ClientForm({ customTrigger, initialData, open: externalOpen, onOpenChange: externalOnOpenChange }: ClientFormProps) {
    const { addClient, updateClient } = useStore();
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

    // Initialize/Reset form
    useEffect(() => {
        if (initialData && open) {
            // Try to split address: "Street, City Zip"
            const parts = initialData.address.split(", ");
            if (parts.length >= 2) {
                setAddress(parts[0]);
                const cityZip = parts[1].split(" ");
                if (cityZip.length >= 2) {
                    setZip(cityZip.pop() || "");
                    setCity(cityZip.join(" "));
                } else {
                    setCity(parts[1]);
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
            setStep(1);
            setSuccess(false);
        }
    }, [initialData, open]);

    const handleSave = () => {
        const clientData = {
            name,
            address: `${address}, ${city} ${zip}`.trim(),
            phone,
            email,
            contractLength,
            sqft,
            billingType,
            amount: parseFloat(amount) || 0,
            notes,
        };

        if (initialData) {
            updateClient(initialData.id, clientData);
            setSuccess(true);
        } else {
            addClient(clientData);
            setSuccess(true);
        }
    };

    const currentClient = name || (initialData ? initialData.name : "New Client");

    if (success) {
        return (
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md bg-[#1a201c]/90 backdrop-blur-xl border-primary/30">
                    <DialogTitle className="sr-only">Success</DialogTitle>
                    <div className="flex flex-col items-center justify-center py-10 text-center animate-in fade-in zoom-in duration-500">
                        <CheckCircle2 className="w-24 h-24 text-primary mb-6 animate-bounce" />
                        <h2 className="text-2xl font-bold text-white mb-2">
                            {initialData ? "Client Updated!" : "Address Added!"}
                        </h2>
                        <div className="glass-card p-4 rounded-xl mb-8 w-full border-primary/20 bg-black/40">
                            <p className="font-semibold text-lg text-primary">{currentClient}</p>
                            <p className="text-muted-foreground text-sm">{address}</p>
                        </div>
                        <div className="grid grid-cols-2 w-full gap-3">
                            <Button variant="outline" className="w-full border-white/10 text-white" onClick={() => { setOpen(false); setSuccess(false); setStep(1); }}>
                                {initialData ? "Close" : "Dashboard"}
                            </Button>
                            {!initialData && (
                                <Button className="w-full bg-primary text-black hover:bg-primary/90 font-bold shadow-[0_4px_20px_rgba(195,255,0,0.3)] transition-all">
                                    Start First Mow
                                </Button>
                            )}
                            {initialData && (
                                <Button className="w-full bg-primary text-black hover:bg-primary/90 font-bold shadow-[0_4px_20px_rgba(195,255,0,0.3)] transition-all" onClick={() => setOpen(false)}>
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
            <DialogTrigger asChild>
                {customTrigger ? customTrigger : (
                    <Button className="fixed bottom-24 right-4 w-14 h-14 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.4),0_0_20px_rgba(195,255,0,0.3)] bg-primary hover:bg-primary/90 text-black z-40 transition-all active:scale-95 group border border-primary/50">
                        {initialData ? <Pencil className="w-6 h-6 group-hover:scale-110 transition-transform" /> : <Plus className="w-6 h-6 group-hover:scale-110 transition-transform" />}
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-2xl border-white/10 text-white overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-[1.5rem]">
                <DialogTitle className="text-2xl font-heading font-bold tracking-tight">
                    {initialData ? `Edit ${initialData.name}` : "Add New Address"}
                </DialogTitle>

                {/* Stepper */}
                <div className="flex gap-2 mb-6 mt-2">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${step >= s ? "bg-primary" : "bg-white/10"}`} />
                    ))}
                </div>
                <p className="text-[10px] text-primary mb-4 font-black uppercase tracking-[0.2em]">
                    Step {step} of 3
                </p>

                <div className="space-y-4 relative min-h-[350px]">
                    {/* Step 1: Location */}
                    {step === 1 && (
                        <div className="animate-in slide-in-from-right-4 fade-in duration-300 space-y-4 pt-2">
                            <div className="space-y-2">
                                <Label htmlFor="address" className="text-[10px] uppercase tracking-widest font-bold opacity-70 ml-1">Street Address</Label>
                                <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} className="bg-white/[0.03] border-white/10 focus-visible:ring-primary h-14 rounded-xl px-4 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]" placeholder="123 Main St" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="city" className="text-[10px] uppercase tracking-widest font-bold opacity-70 ml-1">City</Label>
                                    <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} className="bg-white/[0.03] border-white/10 h-14 rounded-xl px-4 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]" placeholder="Springfield" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="zip" className="text-[10px] uppercase tracking-widest font-bold opacity-70 ml-1">Postal Code</Label>
                                    <Input id="zip" value={zip} onChange={(e) => setZip(e.target.value)} className="bg-white/[0.03] border-white/10 h-14 rounded-xl px-4 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]" placeholder="12345" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-widest font-bold opacity-70 ml-1">Lawn Size</Label>
                                <Select value={sqft} onValueChange={setSqft}>
                                    <SelectTrigger className="bg-white/[0.03] border-white/10 h-14 rounded-xl px-4 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]">
                                        <SelectValue placeholder="Select size" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-white/10 text-white rounded-xl shadow-2xl">
                                        <SelectItem value="Under 5000" className="rounded-lg focus:bg-white/5 focus:text-white cursor-pointer py-2">Under 5,000 sq ft</SelectItem>
                                        <SelectItem value="5000-10000" className="rounded-lg focus:bg-white/5 focus:text-white cursor-pointer py-2">5,000 - 10,000 sq ft</SelectItem>
                                        <SelectItem value="10000+" className="rounded-lg focus:bg-white/5 focus:text-white cursor-pointer py-2">10,000+ sq ft</SelectItem>
                                        <SelectItem value="Acre+" className="rounded-lg focus:bg-white/5 focus:text-white cursor-pointer py-2">1 Acre+</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Client */}
                    {step === 2 && (
                        <div className="animate-in slide-in-from-right-4 fade-in duration-300 space-y-4 pt-2">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-[10px] uppercase tracking-widest font-bold opacity-70 ml-1">Client Name</Label>
                                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="bg-white/[0.03] border-white/10 h-14 rounded-xl px-4 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]" placeholder="John Doe" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone" className="text-[10px] uppercase tracking-widest font-bold opacity-70 ml-1">Phone Number</Label>
                                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-white/[0.03] border-white/10 h-14 rounded-xl px-4 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]" placeholder="(555) 123-4567" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-[10px] uppercase tracking-widest font-bold opacity-70 ml-1">Email</Label>
                                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-white/[0.03] border-white/10 h-14 rounded-xl px-4 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]" placeholder="john@example.com" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="contract" className="text-[10px] uppercase tracking-widest font-bold opacity-70 ml-1">Contract</Label>
                                    <Input id="contract" value={contractLength} onChange={(e) => setContractLength(e.target.value)} className="bg-white/[0.03] border-white/10 h-14 rounded-xl px-4 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]" placeholder="6 Months" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="notes" className="text-[10px] uppercase tracking-widest font-bold opacity-70 ml-1">Notes/Instructions</Label>
                                <textarea
                                    id="notes"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full min-h-[100px] rounded-xl border border-white/10 bg-white/[0.03] shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 text-white resize-none"
                                    placeholder="Gate code is 1234. Watch out for the dog."
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 3: Pricing */}
                    {step === 3 && (
                        <div className="animate-in slide-in-from-right-4 fade-in duration-300 space-y-4 pt-2">
                            <div className="space-y-4">
                                <Label className="text-[10px] uppercase tracking-widest font-bold opacity-70 ml-1">Billing Category</Label>
                                <div className="grid grid-cols-2 gap-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => setBillingType("Regular")}
                                        className={`h-28 flex flex-col gap-2 rounded-2xl transition-all ${billingType === "Regular" ? "border-primary bg-primary/10 text-primary shadow-[inset_0_0_20px_rgba(195,255,0,0.05)] ring-1 ring-primary/20" : "border-white/5 bg-white/[0.02] text-white/50 hover:text-white hover:bg-white/[0.04]"}`}
                                    >
                                        <span className="font-bold text-base">Regular</span>
                                        <span className="text-[10px] uppercase tracking-widest opacity-60">Fixed Monthly</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => setBillingType("PerCut")}
                                        className={`h-28 flex flex-col gap-2 rounded-2xl transition-all ${billingType === "PerCut" ? "border-primary bg-primary/10 text-primary shadow-[inset_0_0_20px_rgba(195,255,0,0.05)] ring-1 ring-primary/20" : "border-white/5 bg-white/[0.02] text-white/50 hover:text-white hover:bg-white/[0.04]"}`}
                                    >
                                        <span className="font-bold text-base">Per Cut</span>
                                        <span className="text-[10px] uppercase tracking-widest opacity-60">Per Session</span>
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-2 mt-6">
                                <Label htmlFor="amount" className="text-[10px] uppercase tracking-widest font-bold opacity-70 ml-1">Amount ($)</Label>
                                <div className="relative">
                                    <span className="absolute left-5 top-4 text-primary font-bold opacity-80">$</span>
                                    <Input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-white/[0.03] border-white/10 pl-10 text-3xl font-heading font-bold h-16 rounded-xl text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] focus-visible:ring-primary/50" placeholder="50.00" />
                                </div>
                                <p className="text-[10px] text-muted-foreground italic ml-1 mt-2 tracking-wide">
                                    {billingType === "Regular" ? "Charged monthly regardless of visit count." : "Charged each time a session is completed."}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-between mt-8 pt-5 border-t border-white/5 relative z-10 bg-card">
                    <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 1} className="text-white/40 hover:text-white hover:bg-white/[0.05] rounded-xl h-12 px-5">
                        <ChevronLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                    {step < 3 ? (
                        <Button onClick={() => setStep(step + 1)} className="bg-white/10 text-white hover:bg-white/20 px-8 rounded-xl font-bold h-12 border border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] transition-all">
                            Next <ChevronRight className="w-4 h-4 ml-2" />
                        </Button>
                    ) : (
                        <Button onClick={handleSave} className="bg-primary text-black font-bold h-12 px-8 rounded-xl shadow-[0_4px_20px_rgba(195,255,0,0.3)] transition-all active:scale-[0.98]">
                            {initialData ? "Update Client" : "Save Address"}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
