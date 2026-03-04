/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";

interface WebMCPToolInputSchema {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
}

interface WebMCPTool {
    name: string;
    description: string;
    inputSchema: WebMCPToolInputSchema;
    execute: (input?: unknown) => Promise<{ success: boolean; message: string }>;
}

interface WebMCPContextProviderOptions {
    tools: WebMCPTool[];
}

interface WebMCPContextBridge {
    provideContext: (options: WebMCPContextProviderOptions) => void;
}

interface LogGasExpenseInput {
    liters: number;
    pricePerLiter: number;
}

function isLogGasExpenseInput(input: unknown): input is LogGasExpenseInput {
    if (typeof input !== "object" || input === null) return false;
    const candidate = input as Record<string, unknown>;
    return (
        typeof candidate.liters === "number" &&
        Number.isFinite(candidate.liters) &&
        typeof candidate.pricePerLiter === "number" &&
        Number.isFinite(candidate.pricePerLiter)
    );
}

// Extended navigator type for WebMCP draft
declare global {
    interface Navigator {
        modelContext?: WebMCPContextBridge;
        mmodelContext?: WebMCPContextBridge;
    }
}

export function WebMCPProvider({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);
    const addGasLog = useStore((state) => state.addGasLog);
    const startWorkdaySession = useStore((state) => state.startWorkdaySession);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;

        // Support both draft names
        const mContext = navigator.modelContext || navigator.mmodelContext;

        if (!mContext) {
            console.warn("WebMCP (modelContext) not available in this browser. Please enable the experimental flag.");
            return;
        }

        try {
            mContext.provideContext({
                tools: [
                    {
                        name: "log_gas_expense",
                        description: "Log a new fuel/gas expense for the upcoming mowing jobs.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                liters: { type: "number", description: "Amount of gas in liters" },
                                pricePerLiter: { type: "number", description: "Price per liter in dollars" }
                            },
                            required: ["liters", "pricePerLiter"]
                        },
                        execute: async (input) => {
                            if (!isLogGasExpenseInput(input)) {
                                return { success: false, message: "Invalid gas log input." };
                            }
                            addGasLog({
                                liters: input.liters,
                                pricePerLiter: input.pricePerLiter,
                                total: input.liters * input.pricePerLiter,
                                isAiScanned: true
                            });
                            return { success: true, message: `Logged ${input.liters}L gas expense.` };
                        }
                    },
                    {
                        name: "start_mowing_session",
                        description: "Start the general clock-in for the workday session.",
                        inputSchema: {
                            type: "object",
                            properties: {},
                        },
                        execute: async () => {
                            startWorkdaySession();
                            return { success: true, message: "Started general mowing session." };
                        }
                    }
                ]
            });
            console.log("WebMCP Imperative Context successfully provided.");
        } catch (err) {
            console.error("Failed to provide WebMCP context:", err);
        }
    }, [mounted, addGasLog, startWorkdaySession]);

    return <>{children}</>;
}
