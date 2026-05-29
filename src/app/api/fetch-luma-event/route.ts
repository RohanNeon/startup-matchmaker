import { NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/admin-auth";

// POST /api/fetch-luma-event
// Body: { url: "https://lu.ma/..." }
// Returns event details scraped from the Luma page
export async function POST(request: Request) {
  const auth = await verifySuperAdmin(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { url } = body;

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    // Fetch the Luma page
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch Luma page: ${res.status}` },
        { status: 400 }
      );
    }

    const html = await res.text();

    // Extract meta tags
    const getMetaContent = (property: string): string => {
      // Try og: tags
      const ogMatch = html.match(
        new RegExp(
          `<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']*)["']`,
          "i"
        )
      );
      if (ogMatch) return ogMatch[1];

      // Try name= tags
      const nameMatch = html.match(
        new RegExp(
          `<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']*)["']`,
          "i"
        )
      );
      if (nameMatch) return nameMatch[1];

      // Try content first, then property/name
      const reverseOg = html.match(
        new RegExp(
          `<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${property}["']`,
          "i"
        )
      );
      if (reverseOg) return reverseOg[1];

      return "";
    };

    const title = getMetaContent("og:title");
    const description = getMetaContent("og:description");
    const ogImage = getMetaContent("og:image");

    // Extract the raw cover image from the og:image URL's img= parameter
    let coverImage = "";
    if (ogImage) {
      try {
        // The og:image URL contains an img= param with the actual cover image
        // Handle HTML entities (&amp; → &)
        const cleanOgUrl = ogImage.replace(/&amp;/g, "&");
        const ogUrl = new URL(cleanOgUrl);
        const imgParam = ogUrl.searchParams.get("img");
        if (imgParam) {
          coverImage = imgParam;
        } else {
          // Fallback: use the full og:image
          coverImage = cleanOgUrl;
        }
      } catch {
        // If URL parsing fails, use og:image as-is
        coverImage = ogImage.replace(/&amp;/g, "&");
      }
    }

    // Try to extract date/time from JSON-LD or script data
    let eventDate = "";
    let location = "";

    // Look for JSON-LD schema
    const jsonLdMatch = html.match(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i
    );
    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1]);
        if (jsonLd.startDate) {
          eventDate = jsonLd.startDate.split("T")[0]; // YYYY-MM-DD
        }
        if (jsonLd.location) {
          if (typeof jsonLd.location === "string") {
            location = jsonLd.location;
          } else if (jsonLd.location.name) {
            location = jsonLd.location.name;
          } else if (jsonLd.location.address) {
            location =
              typeof jsonLd.location.address === "string"
                ? jsonLd.location.address
                : jsonLd.location.address.addressLocality || "";
          }
        }
      } catch {
        // JSON-LD parse failed, continue
      }
    }

    // Try extracting from Next.js data script if JSON-LD didn't work
    if (!eventDate) {
      const dateMatch = html.match(
        /(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}/
      );
      if (dateMatch) {
        eventDate = dateMatch[1];
      }
    }

    // Generate slug from title
    const slug = title
      ? title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .slice(0, 50)
      : "";

    return NextResponse.json({
      name: title || "",
      description: description || "",
      event_date: eventDate || "",
      location: location || "",
      image_url: coverImage || "",
      slug,
      source_url: url,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Error fetching Luma page: ${err}` },
      { status: 500 }
    );
  }
}
