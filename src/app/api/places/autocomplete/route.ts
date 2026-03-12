import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    
    if (!q) {
        return NextResponse.json([], { status: 400 });
    }

    const API_KEY = process.env.GEOCODIO_API_KEY;

    if (!API_KEY) {
        console.error("GEOCODIO_API_KEY is not set in environment variables.");
        return NextResponse.json([], { status: 500 });
    }

    try {
        // Limit to 5 results and restrict to Canada to prevent US collisions (e.g. Monkton, MD)
        const res = await fetch(`https://api.geocod.io/v1.7/geocode?q=${encodeURIComponent(q)}&api_key=${API_KEY}&limit=5&country=CA`);
        const data = await res.json();
        
        if (!data.results) {
            return NextResponse.json([]);
        }

        // Map the Geocodio response to a clean, consistent format for our frontend
        const mapped = data.results.map((r: any) => ({
             display_name: r.formatted_address,
             address: {
                 number: r.address_components?.number || '',
                 street: r.address_components?.formatted_street || r.address_components?.street || '',
                 city: r.address_components?.city || '',
                 state: r.address_components?.state || '',
                 zip: r.address_components?.zip || '',
             },
             lat: r.location?.lat,
             lng: r.location?.lng,
        }));
        
        return NextResponse.json(mapped);
    } catch (error) {
         console.error("Failed to fetch from Geocodio:", error);
         return NextResponse.json([], { status: 500 });
    }
}
