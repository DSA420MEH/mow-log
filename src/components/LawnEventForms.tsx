"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useStore } from "@/lib/store";
import {
    MowingEventSchema,
    WateringEventSchema,
    FertilizingEventSchema,
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
    const mowingFormSchema = MowingEventSchema.omit({ id: true, date: true });
    const wateringFormSchema = WateringEventSchema.omit({ id: true, date: true });
    const fertilizingFormSchema = FertilizingEventSchema.omit({ id: true, date: true });

    type MowingInput = z.input<typeof mowingFormSchema>;
    type MowingOutput = z.output<typeof mowingFormSchema>;
    type WateringInput = z.input<typeof wateringFormSchema>;
    type WateringOutput = z.output<typeof wateringFormSchema>;
    type FertilizingInput = z.input<typeof fertilizingFormSchema>;
    type FertilizingOutput = z.output<typeof fertilizingFormSchema>;

    // --- Mowing Form ---
    const mowForm = useForm<MowingInput, unknown, MowingOutput>({
        resolver: zodResolver(mowingFormSchema),
        defaultValues: { type: "mow", cutHeightInches: 2.5, grassBagged: false, deckCleaned: false, notes: "" },
    });
    const grassBagged = useWatch({ control: mowForm.control, name: "grassBagged" }) ?? false;
    const deckCleaned = useWatch({ control: mowForm.control, name: "deckCleaned" }) ?? false;

    const onMowSubmit = (data: MowingOutput) => {
        addMowingEvent(data);
        mowForm.reset();
        setOpen(false);
    };

    // --- Watering Form ---
    const waterForm = useForm<WateringInput, unknown, WateringOutput>({
        resolver: zodResolver(wateringFormSchema),
        defaultValues: { type: "water", durationMinutes: 30, waterAmountInches: 0.5, notes: "" },
    });

    const onWaterSubmit = (data: WateringOutput) => {
        addWateringEvent(data);
        waterForm.reset();
        setOpen(false);
    };

    // --- Fertilizing Form ---
    const fertilizeForm = useForm<FertilizingInput, unknown, FertilizingOutput>({
        resolver: zodResolver(fertilizingFormSchema),
        defaultValues: { type: "fertilize", productName: "", npkRatio: "", applicationRate: "", notes: "" },
    });

    const onFertilizeSubmit = (data: FertilizingOutput) => {
        addFertilizingEvent(data);
        fertilizeForm.reset();
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="lg" className="fixed bottom-24 right-6 h-16 w-16 rounded-full shadow-[0_0_20px_rgba(204,255,0,0.3)] bg-[#ccff00] text-black hover:bg-[#aacc00]">
                    <Plus className="h-8 w-8" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-[#0a0f0d]/90 backdrop-blur-2xl border-white/10 p-0 overflow-hidden shadow-2xl">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="text-xl font-bold uppercase tracking-widest text-white/90">Add Log Entry</DialogTitle>
                    <div className="sr-only">
                        <DialogDescription>
                            Form to add mowing, watering, or fertilizing logs.
                        </DialogDescription>
                    </div>
                </DialogHeader>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <div className="px-6 pb-4 pt-2">
                        <TabsList className="bg-white/5 rounded-2xl p-1.5 flex border border-white/10 shadow-lg backdrop-blur-sm w-full h-auto">
                            <TabsTrigger value="mow" className="flex-1 py-3 px-2 rounded-xl text-sm font-medium text-gray-400 hover:text-[#d4ff33] hover:bg-white/5 transition-all data-[state=active]:bg-[#d4ff33] data-[state=active]:text-black data-[state=active]:font-bold data-[state=active]:shadow-md flex items-center justify-center gap-2">
                                <Scissors className="mr-2 h-4 w-4" />
                                Mow
                            </TabsTrigger>
                            <TabsTrigger value="water" className="flex-1 py-3 px-2 rounded-xl text-sm font-medium text-gray-400 hover:text-[#3B82F6] hover:bg-white/5 transition-all data-[state=active]:bg-[#3B82F6] data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:shadow-md flex items-center justify-center gap-2">
                                <Droplets className="mr-2 h-4 w-4" />
                                Water
                            </TabsTrigger>
                            <TabsTrigger value="fertilize" className="flex-1 py-3 px-2 rounded-xl text-sm font-medium text-gray-400 hover:text-[#10B981] hover:bg-white/5 transition-all data-[state=active]:bg-[#10B981] data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:shadow-md flex items-center justify-center gap-2">
                                <Leaf className="mr-2 h-4 w-4" />
                                Fert
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="p-6 pt-0 bg-white/5 mx-6 mb-6 rounded-2xl border border-white/5">
                        {/* Mowing Form Tab */}
                        <TabsContent value="mow">
                            <form onSubmit={mowForm.handleSubmit(onMowSubmit)} className="space-y-4 pt-2">
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Cut Height (Inches)</Label>
                                    <Input type="number" step="0.5" {...mowForm.register("cutHeightInches", { valueAsNumber: true })} className="bg-[#141A16] border-[#2C4535] focus-visible:ring-[#D4FF33] focus-visible:border-[#D4FF33] h-12 rounded-xl text-white font-mono transition-all" />
                                    {mowForm.formState.errors.cutHeightInches && <p className="text-red-400 text-xs">{mowForm.formState.errors.cutHeightInches.message}</p>}
                                </div>
                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 transition-all">
                                <Label className="text-sm font-bold text-white cursor-pointer" htmlFor="grassBagged">Bagged Grass?</Label>
                                <Switch
                                    id="grassBagged"
                                    checked={grassBagged}
                                    onCheckedChange={(c) => mowForm.setValue("grassBagged", c)}
                                />
                            </div>
                            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 transition-all">
                                <Label className="text-sm font-bold text-white cursor-pointer" htmlFor="deckCleaned">Cleaned Mower Deck?</Label>
                                <Switch
                                    id="deckCleaned"
                                    checked={deckCleaned}
                                    onCheckedChange={(c) => mowForm.setValue("deckCleaned", c)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Notes</Label>
                                <Input {...mowForm.register("notes")} placeholder="Any specific notes?" className="bg-[#141A16] border-[#2C4535] focus-visible:ring-[#D4FF33] focus-visible:border-[#D4FF33] h-12 rounded-xl text-white transition-all" />
                            </div>
                            <Button type="submit" className="w-full h-14 rounded-xl bg-[#D4FF33] hover:bg-[#B8E625] text-black font-bold shadow-[0_0_15px_rgba(212,255,51,0.2)] hover:shadow-[0_0_25px_rgba(212,255,51,0.4)] hover:scale-[1.02] active:scale-95 transition-all mt-4">Save Mowing Log</Button>
                        </form>
                    </TabsContent>

                    {/* Watering Form Tab */}
                    <TabsContent value="water">
                        <form onSubmit={waterForm.handleSubmit(onWaterSubmit)} className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Duration (Minutes)</Label>
                                <Input type="number" {...waterForm.register("durationMinutes", { valueAsNumber: true })} className="bg-[#141A16] border-[#2C4535] focus-visible:ring-[#3B82F6] focus-visible:border-[#3B82F6] h-12 rounded-xl text-white transition-all" />
                                {waterForm.formState.errors.durationMinutes && <p className="text-red-400 text-xs">{waterForm.formState.errors.durationMinutes.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Est. Water Amount (Inches)</Label>
                                <Input type="number" step="0.1" {...waterForm.register("waterAmountInches", { valueAsNumber: true })} className="bg-[#141A16] border-[#2C4535] focus-visible:ring-[#3B82F6] focus-visible:border-[#3B82F6] h-12 rounded-xl text-white transition-all" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Notes</Label>
                                <Input {...waterForm.register("notes")} placeholder="e.g., Only front yard" className="bg-[#141A16] border-[#2C4535] focus-visible:ring-[#3B82F6] focus-visible:border-[#3B82F6] h-12 rounded-xl text-white transition-all" />
                            </div>
                            <Button type="submit" className="w-full h-14 rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] text-white font-bold shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_rgba(59,130,246,0.5)] hover:scale-[1.02] active:scale-95 transition-all mt-4">Save Watering Log</Button>
                        </form>
                    </TabsContent>

                    {/* Fertilizing Form Tab */}
                    <TabsContent value="fertilize">
                        <form onSubmit={fertilizeForm.handleSubmit(onFertilizeSubmit)} className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Product Name</Label>
                                <Input {...fertilizeForm.register("productName")} placeholder="e.g., Milorganite" className="bg-[#141A16] border-[#2C4535] focus-visible:ring-[#10B981] focus-visible:border-[#10B981] h-12 rounded-xl text-white transition-all" />
                                {fertilizeForm.formState.errors.productName && <p className="text-red-400 text-xs">{fertilizeForm.formState.errors.productName.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">N-P-K Ratio</Label>
                                <Input {...fertilizeForm.register("npkRatio")} placeholder="e.g., 6-4-0" className="bg-[#141A16] border-[#2C4535] focus-visible:ring-[#10B981] focus-visible:border-[#10B981] h-12 rounded-xl font-mono text-center tracking-widest text-white transition-all" />
                                {fertilizeForm.formState.errors.npkRatio && <p className="text-red-400 text-xs">{fertilizeForm.formState.errors.npkRatio.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Application Rate</Label>
                                <Input {...fertilizeForm.register("applicationRate")} placeholder="e.g., 32 lbs / 2,500 sq ft" className="bg-[#141A16] border-[#2C4535] focus-visible:ring-[#10B981] focus-visible:border-[#10B981] h-12 rounded-xl text-white transition-all" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Notes</Label>
                                <Input {...fertilizeForm.register("notes")} placeholder="Pre-emergent included?" className="bg-[#141A16] border-[#2C4535] focus-visible:ring-[#10B981] focus-visible:border-[#10B981] h-12 rounded-xl text-white transition-all" />
                            </div>
                            <Button type="submit" className="w-full h-14 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white font-bold shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] hover:scale-[1.02] active:scale-95 transition-all mt-4">Save Fertilizer Log</Button>
                        </form>
                    </TabsContent>
                    </div>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
