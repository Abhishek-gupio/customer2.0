import axios from "axios";
import { logger } from "../../config/logger";
import { dbInstances } from "@repo/db-customer";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "max-age=0",
  Referer: "https://www.youtube.com/",
};

function extractYouTubeVideoId(html: string): string | null {
  const matches = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/g) || [];
  const firstMatch = matches[0];
  if (!firstMatch) return null;

  const videoId = firstMatch.replace(/.*"videoId":"([a-zA-Z0-9_-]{11})".*/, "$1");
  return videoId || null;
}

async function resolveYouTubePreview(searchQuery: string): Promise<{ videoUrl: string; thumbnail: string } | null> {
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
    const response = await axios.get(searchUrl, {
      headers: BROWSER_HEADERS,
      timeout: 15000,
    });

    const html = typeof response.data === "string" ? response.data : String(response.data || "");
    const videoId = extractYouTubeVideoId(html);
    if (!videoId) return null;

    return {
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    };
  } catch (err) {
    logger.warn({ err, searchQuery }, "Failed to resolve YouTube preview for DIY guide");
    return null;
  }
}

export interface DIYGuide {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  videoUrl: string;
  duration: string;
  category: "MAINTENANCE" | "REPAIR" | "CLEANING" | "ESSENTIALS";
}

export const diyService = {
  /**
   * Fetches DIY guides for a specific vehicle's make and model
   * Uses a scraper-like approach to find relevant content
   */
  async getGuidesForVehicle(vehicleId: string): Promise<DIYGuide[]> {
    const vehicle = await dbInstances.customerVehicle.findUnique({
      where: { id: vehicleId },
      select: { make: true, model: true, vehicleType: true },
    });

    if (!vehicle) {
      return this.getDefaultGuides();
    }

    logger.info(
      { vehicleId, make: vehicle.make, model: vehicle.model },
      "Fetching DIY guides for vehicle",
    );

    // Determine categories based on vehicle type
    const isBike = vehicle.vehicleType?.toUpperCase() === 'BIKE';

    // Curated guide topics paired with a safe fallback image and a search query.
    const categories = isBike ? [
      {
        name: "Engine Oil Change",
        label: "MAINTENANCE" as const,
        thumb: "https://res.cloudinary.com/ds4ojehul/image/upload/q_auto/f_auto/v1775551507/louismoto-H_9vRBSdXAA-unsplash_dhu0ku.jpg?auto=format&fit=crop&q=80&w=800",
      },
      {
        name: "Chain Cleaning & Lubing",
        label: "MAINTENANCE" as const,
        thumb: "https://res.cloudinary.com/ds4ojehul/image/upload/q_auto/f_auto/v1775551840/louismoto-nb6fyVMRkaE-unsplash_oyayem.jpg?auto=format&fit=crop&q=80&w=800",
      },
      {
        name: "Air Filter Cleaning",
        label: "MAINTENANCE" as const,
        thumb: "https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?auto=format&fit=crop&q=80&w=800",
      },
      {
        name: "Spark Plug Check",
        label: "REPAIR" as const,
        thumb: "https://images.unsplash.com/photo-1635311499501-c85e8d5334c4?auto=format&fit=crop&q=80&w=800",
      },
      {
        name: "Brake Pad Replacement",
        label: "REPAIR" as const,
        thumb: "https://images.unsplash.com/photo-1647466170425-635352c1619a?auto=format&fit=crop&q=80&w=800",
      },
      {
        name: "Battery Maintenance",
        label: "REPAIR" as const,
        thumb: "https://images.unsplash.com/photo-1621905252507-b354bcadcabc?auto=format&fit=crop&q=80&w=800",
      },
      {
        name: "Tyre Pressure & Inspection",
        label: "ESSENTIALS" as const,
        thumb: "https://images.unsplash.com/photo-1444491741275-3747c33cc99b?auto=format&fit=crop&q=80&w=800",
      },
      {
        name: "Body Polish",
        label: "CLEANING" as const,
        thumb: "https://images.unsplash.com/photo-1558981285-6f0cd9181404?auto=format&fit=crop&q=80&w=800",
      },
    ] : [
      {
        name: "Engine Oil Change",
        label: "MAINTENANCE" as const,
        thumb: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&q=80&w=800",
      },
      {
        name: "Air Filter Replacement",
        label: "MAINTENANCE" as const,
        thumb: "https://images.unsplash.com/photo-1629891823190-2ef830026f8d?auto=format&fit=crop&q=80&w=800",
      },
      {
        name: "Cabin Filter Change",
        label: "MAINTENANCE" as const,
        thumb: "https://images.unsplash.com/photo-1599256629751-240974edae3c?auto=format&fit=crop&q=80&w=800",
      },
      {
        name: "Brake Pad Replacement",
        label: "REPAIR" as const,
        thumb: "https://images.unsplash.com/photo-1502419409050-bcc748443219?auto=format&fit=crop&q=80&w=800",
      },
      {
        name: "Battery Replacement",
        label: "REPAIR" as const,
        thumb: "https://images.unsplash.com/photo-1621905251918-48416bd1575a?auto=format&fit=crop&q=80&w=800",
      },
      {
        name: "Coolant Top-up",
        label: "ESSENTIALS" as const,
        thumb: "https://images.unsplash.com/photo-1549410183-bc265e38d721?auto=format&fit=crop&q=80&w=800",
      },
      {
        name: "Wiper Blade Replacement",
        label: "ESSENTIALS" as const,
        thumb: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=800",
      },
      {
        name: "Interior Deep Cleaning",
        label: "CLEANING" as const,
        thumb: "https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&q=80&w=800",
      },
    ];

    const make = vehicle.make || "General";
    const model = vehicle.model || "Vehicle";

    const vehicleSearchTag = isBike ? "motorcycle scooter" : "car";

    const guides: DIYGuide[] = await Promise.all(
      categories.map(async (cat, idx) => {
        const searchQuery = `${make} ${model} ${cat.name} ${vehicleSearchTag}`.trim();
        const youtube = await resolveYouTubePreview(searchQuery);

        return {
          id: `diy-${idx}-${model.toLowerCase()}`,
          title: `${make} ${model}: ${cat.name}`,
          description: `Step-by-step guide on how to perform ${cat.name.toLowerCase()} for your ${make} ${model}.`,
          thumbnail: youtube?.thumbnail ?? cat.thumb,
          videoUrl: youtube?.videoUrl ?? `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`,
          duration: "5:30",
          category: cat.label,
        };
      }),
    );

    return guides;
  },

  /**
   * Default fallback guides if no vehicle is selected
   */
  async getDefaultGuides(): Promise<DIYGuide[]> {
    const defaultGuides = [
      {
        id: "default-1",
        title: "Understanding Your Dashboard Lights",
        description: "A complete guide to what every warning light on your dashboard means.",
        thumbnail: "https://images.unsplash.com/photo-1542282088-72c9c27ed0be?auto=format&fit=crop&q=80&w=400",
        searchQuery: "car dashboard lights meaning",
        duration: "8:15",
        category: "ESSENTIALS" as const,
      },
      {
        id: "default-2",
        title: "How to Jump-start a Car Safely",
        description: "Emergency guide on how to jump-start your vehicle without damaging the electronics.",
        thumbnail: "https://images.unsplash.com/photo-1593941707882-a5bba14930c7?auto=format&fit=crop&q=80&w=400",
        searchQuery: "how to jump start a car safely",
        duration: "4:45",
        category: "REPAIR" as const,
      },
      {
        id: "default-3",
        title: "Basic Car Tool Kit Essentials",
        description: "The 10 tools every car owner should keep in their boot.",
        thumbnail: "https://images.unsplash.com/photo-1530124560677-bdaeaeb1faee?auto=format&fit=crop&q=80&w=400",
        searchQuery: "car tool kit essentials",
        duration: "6:20",
        category: "ESSENTIALS" as const,
      },
    ];

    return Promise.all(
      defaultGuides.map(async (guide) => {
        const youtube = await resolveYouTubePreview(guide.searchQuery);
        const fallbackVideoUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(guide.searchQuery)}`;

        return {
          id: guide.id,
          title: guide.title,
          description: guide.description,
          thumbnail: youtube?.thumbnail ?? guide.thumbnail,
          videoUrl: youtube?.videoUrl ?? fallbackVideoUrl,
          duration: guide.duration,
          category: guide.category,
        };
      }),
    );
  },
};
