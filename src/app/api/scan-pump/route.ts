import { genkit, z } from "genkit";
import { gemini15Flash, googleAI } from "@genkit-ai/googleai";
import { NextResponse } from "next/server";

const ai = genkit({
    plugins: [googleAI()],
    model: gemini15Flash,
});

export async function POST(req: Request) {
    try {
        const { imageBase64 } = await req.json();

        if (!imageBase64 || !process.env.GEMINI_API_KEY) {
            // Mock mode if no key or no image
            return NextResponse.json({
                liters: 45.32,
                pricePerLiter: 1.65,
                total: 74.78,
            });
        }

        const result = await ai.generate({
            prompt: [
                { text: "Extract the number of liters and the price per liter from this gas pump display. Only return JSON with 'liters' and 'pricePerLiter' as number values." },
                { media: { url: `data:image/jpeg;base64,${imageBase64}` } }
            ],
            output: {
                schema: z.object({
                    liters: z.number(),
                    pricePerLiter: z.number()
                })
            }
        });

        if (!result.output) {
            throw new Error("No output generated");
        }
        return NextResponse.json(result.output);
    } catch (error) {
        console.error("Genkit scan error:", error);
        return NextResponse.json({ error: "Failed to scan pump" }, { status: 500 });
    }
}
