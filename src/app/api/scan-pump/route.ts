import { genkit, z } from "genkit";
import { gemini15Flash, googleAI } from "@genkit-ai/googleai";
import { NextResponse } from "next/server";

const ai = genkit({
    plugins: [googleAI()],
    model: gemini15Flash,
});

const scanPumpRequestSchema = z.object({
    imageBase64: z.string().min(32, "Image data is required."),
});

const scanPumpOutputSchema = z.object({
    liters: z.number().positive(),
    pricePerLiter: z.number().positive(),
});

export async function POST(req: Request) {
    if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json(
            {
                error: "Pump scanning is not configured. Set GEMINI_API_KEY to enable AI scan.",
            },
            { status: 503 }
        );
    }

    try {
        const parsedBody = scanPumpRequestSchema.safeParse(await req.json());
        if (!parsedBody.success) {
            return NextResponse.json({ error: "A valid pump image is required." }, { status: 400 });
        }
        const { imageBase64 } = parsedBody.data;

        const result = await ai.generate({
            prompt: [
                { text: "Extract liters and pricePerLiter from this gas pump display. Return JSON only with numeric fields: liters, pricePerLiter." },
                { media: { url: `data:image/jpeg;base64,${imageBase64}` } }
            ],
            output: {
                schema: scanPumpOutputSchema
            }
        });

        if (!result.output) {
            throw new Error("No output generated");
        }

        const validated = scanPumpOutputSchema.parse(result.output);
        const total = Number((validated.liters * validated.pricePerLiter).toFixed(2));

        return NextResponse.json({
            ...validated,
            total,
        });
    } catch (error) {
        console.error("Genkit scan error:", error);
        return NextResponse.json({ error: "Failed to scan pump image. Try a clearer photo." }, { status: 500 });
    }
}
