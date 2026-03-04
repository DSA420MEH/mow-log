import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

interface RevalidatePayload {
  urls?: unknown;
  secret?: unknown;
}

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as RevalidatePayload;
    const expectedSecret = process.env.REVALIDATION_SECRET;

    if (expectedSecret) {
      if (typeof payload.secret !== "string" || payload.secret !== expectedSecret) {
        return NextResponse.json({ error: "Invalid revalidation secret." }, { status: 401 });
      }
    }

    if (!Array.isArray(payload.urls)) {
      return NextResponse.json({ error: "urls must be an array of route paths." }, { status: 400 });
    }

    const validPaths = payload.urls.filter(
      (url): url is string =>
        typeof url === "string" &&
        url.startsWith("/") &&
        !url.startsWith("//")
    );

    if (validPaths.length === 0) {
      return NextResponse.json({ error: "No valid route paths provided." }, { status: 400 });
    }

    for (const path of validPaths) {
      revalidatePath(path);
    }

    return NextResponse.json({ revalidated: validPaths, count: validPaths.length });
  } catch (error) {
    console.error("PWA revalidate route failed:", error);
    return NextResponse.json({ error: "Failed to revalidate routes." }, { status: 500 });
  }
}
