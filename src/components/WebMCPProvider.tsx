/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";

// Extended navigator type for WebMCP draft
declare global {
    interface Navigator {
        modelContext?: {
            provideContext: (options: any) => void;
        };
        mmodelContext?: {
            provideContext: (options: any) => void;
        };
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
                        execute: async (input: { liters: number; pricePerLiter: number }) => {
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
