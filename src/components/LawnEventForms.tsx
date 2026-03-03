"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useStore } from "@/lib/store";
import {
    MowingEventSchema,
    WateringEventSchema,
    FertilizingEventSchema,
    MowingEvent,
    WateringEvent,
    FertilizingEvent,
} from "@/lib/schemas";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Scissors, Droplets, Leaf } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function LawnEventForms() {
    const [open, setOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("mow");

    const { addMowingEvent, addWateringEvent, addFertilizingEvent } = useStore();

    // --- Mowing Form ---
    const mowForm = useForm({
        resolver: zodResolver(MowingEventSchema.omit({ id: true, date: true })),
        defaultValues: { type: "mow", cutHeightInches: 2.5, grassBagged: false, deckCleaned: false, notes: "" },
    });

    const onMowSubmit = (data: any) => {
        addMowingEvent(data);
        mowForm.reset();
        setOpen(false);
    };

    // --- Watering Form ---
    const waterForm = useForm({
        resolver: zodResolver(WateringEventSchema.omit({ id: true, date: true })),
        defaultValues: { type: "water", durationMinutes: 30, waterAmountInches: 0.5, notes: "" },
    });

    const onWaterSubmit = (data: any) => {
        addWateringEvent(data);
        waterForm.reset();
        setOpen(false);
    };

    // --- Fertilizing Form ---
    const fertilizeForm = useForm({
        resolver: zodResolver(FertilizingEventSchema.omit({ id: true, date: true })),
        defaultValues: { type: "fertilize", productName: "", npkRatio: "", applicationRate: "", notes: "" },
    });

    const onFertilizeSubmit = (data: any) => {
        addFertilizingEvent(data);
        fertilizeForm.reset();
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="w-full h-12 rounded-xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 font-bold transition-all mt-4">
                    <Plus className="w-4 h-4 mr-2" /> Log Lawn Event
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-2xl border-white/10 rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.8)] p-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
                <DialogHeader>
                    <DialogTitle className="text-xl font-heading font-black text-white">Log Lawn Event</DialogTitle>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-4">
                    <TabsList className="grid w-full grid-cols-3 h-12 bg-[#0a0f0d] border border-white/5 rounded-xl p-1 mb-6">
                        <TabsTrigger value="mow" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-black font-bold text-white/50 text-xs">
                            <Scissors className="w-3 h-3 mr-1.5" /> Mow
                        </TabsTrigger>
                        <TabsTrigger value="water" className="rounded-lg data-[state=active]:bg-blue-500 data-[state=active]:text-white font-bold text-white/50 text-xs">
                            <Droplets className="w-3 h-3 mr-1.5" /> Water
                        </TabsTrigger>
                        <TabsTrigger value="fertilize" className="rounded-lg data-[state=active]:bg-emerald-500 data-[state=active]:text-white font-bold text-white/50 text-xs text-center leading-tight">
                            <Leaf className="w-3 h-3 mr-1" /> Fertilize
                        </TabsTrigger>
                    </TabsList>

                    {/* Mowing Form Tab */}
                    <TabsContent value="mow">
                        <form onSubmit={mowForm.handleSubmit(onMowSubmit)} className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Cut Height (Inches)</Label>
                                <Input type="number" step="0.5" {...mowForm.register("cutHeightInches", { valueAsNumber: true })} className="bg-[#0a0f0d] border-white/10 h-12 rounded-xl" />
                                {mowForm.formState.errors.cutHeightInches && <p className="text-red-400 text-xs">{mowForm.formState.errors.cutHeightInches.message}</p>}
                            </div>
                            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                                <Label className="text-sm font-bold text-white cursor-pointer" htmlFor="grassBagged">Bagged Grass?</Label>
                                <Switch
                                    id="grassBagged"
                                    checked={mowForm.watch("grassBagged")}
                                    onCheckedChange={(c) => mowForm.setValue("grassBagged", c)}
                                />
                            </div>
                            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                                <Label className="text-sm font-bold text-white cursor-pointer" htmlFor="deckCleaned">Cleaned Mower Deck?</Label>
                                <Switch
                                    id="deckCleaned"
                                    checked={mowForm.watch("deckCleaned")}
                                    onCheckedChange={(c) => mowForm.setValue("deckCleaned", c)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Notes</Label>
                                <Input {...mowForm.register("notes")} placeholder="Any specific notes?" className="bg-[#0a0f0d] border-white/10 h-12 rounded-xl" />
                            </div>
                            <Button type="submit" className="w-full h-14 rounded-xl bg-primary hover:bg-primary/90 text-black font-bold shadow-[0_5px_15px_rgba(195,255,0,0.3)] mt-2">Save Mowing Log</Button>
                        </form>
                    </TabsContent>

                    {/* Watering Form Tab */}
                    <TabsContent value="water">
                        <form onSubmit={waterForm.handleSubmit(onWaterSubmit)} className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Duration (Minutes)</Label>
                                <Input type="number" {...waterForm.register("durationMinutes", { valueAsNumber: true })} className="bg-[#0a0f0d] border-white/10 h-12 rounded-xl" />
                                {waterForm.formState.errors.durationMinutes && <p className="text-red-400 text-xs">{waterForm.formState.errors.durationMinutes.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Est. Water Amount (Inches)</Label>
                                <Input type="number" step="0.1" {...waterForm.register("waterAmountInches", { valueAsNumber: true })} className="bg-[#0a0f0d] border-white/10 h-12 rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Notes</Label>
                                <Input {...waterForm.register("notes")} placeholder="e.g., Only front yard" className="bg-[#0a0f0d] border-white/10 h-12 rounded-xl" />
                            </div>
                            <Button type="submit" className="w-full h-14 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold shadow-[0_5px_15px_rgba(59,130,246,0.3)] mt-2">Save Watering Log</Button>
                        </form>
                    </TabsContent>

                    {/* Fertilizing Form Tab */}
                    <TabsContent value="fertilize">
                        <form onSubmit={fertilizeForm.handleSubmit(onFertilizeSubmit)} className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Product Name</Label>
                                <Input {...fertilizeForm.register("productName")} placeholder="e.g., Milorganite" className="bg-[#0a0f0d] border-white/10 h-12 rounded-xl" />
                                {fertilizeForm.formState.errors.productName && <p className="text-red-400 text-xs">{fertilizeForm.formState.errors.productName.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">N-P-K Ratio</Label>
                                <Input {...fertilizeForm.register("npkRatio")} placeholder="e.g., 6-4-0" className="bg-[#0a0f0d] border-white/10 h-12 rounded-xl font-mono text-center tracking-widest" />
                                {fertilizeForm.formState.errors.npkRatio && <p className="text-red-400 text-xs">{fertilizeForm.formState.errors.npkRatio.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Application Rate</Label>
                                <Input {...fertilizeForm.register("applicationRate")} placeholder="e.g., 32 lbs / 2,500 sq ft" className="bg-[#0a0f0d] border-white/10 h-12 rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Notes</Label>
                                <Input {...fertilizeForm.register("notes")} placeholder="Pre-emergent included?" className="bg-[#0a0f0d] border-white/10 h-12 rounded-xl" />
                            </div>
                            <Button type="submit" className="w-full h-14 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold shadow-[0_5px_15px_rgba(16,185,129,0.3)] mt-2">Save Fertilizer Log</Button>
                        </form>
                    </TabsContent>

                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
