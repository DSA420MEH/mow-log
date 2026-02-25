"use client";

import { useState } from "react";
import { useStore, BillingType } from "@/lib/store";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, CheckCircle2, ChevronRight, ChevronLeft } from "lucide-react";

export function AddAddressForm({ customTrigger }: { customTrigger?: React.ReactNode }) {
    const addClient = useStore((state) => state.addClient);
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState(1);
    const [success, setSuccess] = useState(false);

    // Form State
    const [address, setAddress] = useState("");
    const [city, setCity] = useState("");
    const [zip, setZip] = useState("");
    const [sqft, setSqft] = useState("Under 5000");

    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [notes, setNotes] = useState("");

    const [billingType, setBillingType] = useState<BillingType>("PerCut");
    const [amount, setAmount] = useState("");

    const handleSave = () => {
        addClient({
            name,
            address: `${address}, ${city} ${zip}`,
            phone,
            sqft,
            billingType,
            amount: parseFloat(amount) || 0,
            notes,
        });
        setSuccess(true);
    };

    const currentClient = name || "New Client";

    if (success) {
        return (
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md bg-card/80 backdrop-blur-xl border-primary/30">
                    <DialogTitle className="sr-only">Success</DialogTitle>
                    <div className="flex flex-col items-center justify-center py-10 text-center animate-in fade-in zoom-in duration-500">
                        <CheckCircle2 className="w-24 h-24 text-primary mb-6 animate-bounce" />
                        <h2 className="text-2xl font-bold text-foreground mb-2">Address Added!</h2>
                        <div className="glass-card p-4 rounded-xl mb-8 w-full border-primary/20">
                            <p className="font-semibold text-lg text-primary">{currentClient}</p>
                            <p className="text-muted-foreground text-sm">{address}</p>
                        </div>
                        <div className="grid grid-cols-2 w-full gap-3">
                            <Button variant="outline" className="w-full" onClick={() => { setOpen(false); setSuccess(false); setStep(1); }}>
                                Dashboard
                            </Button>
                            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                                Start First Mow
                            </Button>
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
                    <Button className="fixed bottom-24 right-4 w-14 h-14 rounded-full shadow-lg shadow-black/50 bg-primary hover:bg-primary/90 text-primary-foreground z-40">
                        <Plus className="w-6 h-6" />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-card/80 backdrop-blur-xl border-primary/30 text-foreground overflow-hidden">
                <DialogTitle className="text-xl font-bold tracking-wide">Add New Address</DialogTitle>

                {/* Stepper */}
                <div className="flex gap-2 mb-6 mt-2">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${step >= s ? "bg-primary" : "bg-muted"}`} />
                    ))}
                </div>
                <p className="text-sm text-primary mb-4 font-semibold uppercase tracking-wider">
                    Step {step} of 3
                </p>

                <div className="space-y-4 relative min-h-[300px]">
                    {/* Step 1: Location */}
                    {step === 1 && (
                        <div className="animate-in slide-in-from-right-4 fade-in duration-300 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="address">Street Address</Label>
                                <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} className="bg-input/50 border-white/10 focus-visible:ring-primary" placeholder="123 Main St" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="city">City</Label>
                                    <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} className="bg-input/50 border-white/10" placeholder="Springfield" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="zip">Postal Code</Label>
                                    <Input id="zip" value={zip} onChange={(e) => setZip(e.target.value)} className="bg-input/50 border-white/10" placeholder="12345" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Lawn Size</Label>
                                <Select value={sqft} onValueChange={setSqft}>
                                    <SelectTrigger className="bg-input/50 border-white/10">
                                        <SelectValue placeholder="Select size" />
                                    </SelectTrigger>
                                    <SelectContent>
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
                                <Label htmlFor="name">Client Name</Label>
                                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="bg-input/50 border-white/10" placeholder="John Doe" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone Number</Label>
                                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-input/50 border-white/10" placeholder="(555) 123-4567" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="notes">Notes/Instructions</Label>
                                <textarea
                                    id="notes"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full min-h-[100px] rounded-md border border-white/10 bg-input/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="Gate code is 1234. Watch out for the dog."
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 3: Pricing */}
                    {step === 3 && (
                        <div className="animate-in slide-in-from-right-4 fade-in duration-300 space-y-4">
                            <div className="space-y-4">
                                <Label>Billing Category</Label>
                                <div className="grid grid-cols-2 gap-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => setBillingType("Regular")}
                                        className={`h-24 flex flex-col gap-2 ${billingType === "Regular" ? "border-primary bg-primary/10 text-primary" : "border-white/10"}`}
                                    >
                                        <span className="font-bold">Regular</span>
                                        <span className="text-xs text-muted-foreground">Fixed Monthly</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => setBillingType("PerCut")}
                                        className={`h-24 flex flex-col gap-2 ${billingType === "PerCut" ? "border-primary bg-primary/10 text-primary" : "border-white/10"}`}
                                    >
                                        <span className="font-bold">Per Cut</span>
                                        <span className="text-xs text-muted-foreground">Per Session</span>
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="amount">Amount ($)</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                                    <Input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-input/50 border-white/10 pl-8 text-lg font-bold" placeholder="50.00" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-between mt-6 pt-4 border-t border-border">
                    <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 1} className="text-muted-foreground hover:text-foreground">
                        <ChevronLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                    {step < 3 ? (
                        <Button onClick={() => setStep(step + 1)} className="bg-secondary text-secondary-foreground hover:bg-secondary/80">
                            Next <ChevronRight className="w-4 h-4 ml-2" />
                        </Button>
                    ) : (
                        <Button onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-[0_0_15px_rgba(170,255,0,0.5)]">
                            Save Address
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
