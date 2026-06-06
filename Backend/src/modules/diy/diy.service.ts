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

function buildYouTubeSearchUrl(searchQuery: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
}

async function resolveYouTubePreview(searchQueries: string | string[]): Promise<{ videoUrl: string; thumbnail: string } | null> {
  const candidates = Array.isArray(searchQueries) ? searchQueries : [searchQueries];

  for (const rawQuery of candidates) {
    const searchQuery = rawQuery.trim();
    if (!searchQuery) continue;

    try {
      const searchUrl = `${buildYouTubeSearchUrl(searchQuery)}&sp=EgIQAQ%253D%253D`;
      const response = await axios.get(searchUrl, {
        headers: BROWSER_HEADERS,
        timeout: 15000,
      });

      const html = typeof response.data === "string" ? response.data : String(response.data || "");
      const videoId = extractYouTubeVideoId(html);
      if (!videoId) continue;

      return {
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      };
    } catch (err) {
      logger.warn({ err, searchQuery }, "Failed to resolve YouTube preview for DIY guide");
    }
  }

  return null;
}

export interface DIYGuide {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  videoUrl: string;
  duration: string;
  category: "MAINTENANCE" | "REPAIR" | "CLEANING" | "ESSENTIALS";
  searchQuery?: string;
}

const DIY_CATEGORIES: DIYGuide["category"][] = ["MAINTENANCE", "REPAIR", "ESSENTIALS", "CLEANING"];
const CATEGORY_TARGET_COUNT = 6;

function topUpGuidesPerCategory(primaryGuides: DIYGuide[], supplementGuides: DIYGuide[]): DIYGuide[] {
  const result = [...primaryGuides];

  for (const category of DIY_CATEGORIES) {
    const currentCount = result.filter((guide) => guide.category === category).length;
    if (currentCount >= CATEGORY_TARGET_COUNT) continue;

    const needed = CATEGORY_TARGET_COUNT - currentCount;
    const preferredSupplements = supplementGuides.filter(
      (guide) =>
        guide.category === category &&
        !result.some(
          (existing) =>
            existing.videoUrl === guide.videoUrl ||
            existing.title.toLowerCase() === guide.title.toLowerCase(),
        ),
    );

    result.push(...preferredSupplements.slice(0, needed));

    const stillNeeded = CATEGORY_TARGET_COUNT - result.filter((guide) => guide.category === category).length;
    if (stillNeeded <= 0) continue;

    const fallbackSupplements = supplementGuides.filter((guide) => guide.category === category);
    result.push(...fallbackSupplements.slice(0, stillNeeded));
  }

  return result;
}

function buildGuideSearchCandidates(args: {
  make?: string | null;
  model?: string | null;
  topic: string;
  category: DIYGuide["category"];
  vehicleSearchTag: string;
  isBike: boolean;
}): string[] {
  const vehicleLabel = [args.make, args.model].filter(Boolean).join(" ").trim();
  const categoryFallbacks = args.isBike
    ? {
        MAINTENANCE: ["bike maintenance diy tutorial", "motorcycle service tutorial", "motorcycle engine oil change tutorial"],
        REPAIR: ["motorcycle repair diy tutorial", "bike brake repair tutorial", "motorcycle battery repair tutorial"],
        CLEANING: ["bike cleaning diy tutorial", "motorcycle detailing tutorial", "bike polish tutorial"],
        ESSENTIALS: ["bike owner essentials tutorial", "motorcycle inspection tutorial", "bike safety tips tutorial"],
      }
    : {
        MAINTENANCE: ["car maintenance diy tutorial", "car service tutorial", "engine oil change tutorial"],
        REPAIR: ["car repair diy tutorial", "brake pad replacement tutorial", "battery replacement tutorial"],
        CLEANING: ["car detailing diy tutorial", "interior cleaning tutorial", "car wash tutorial"],
        ESSENTIALS: ["car owner tips tutorial", "vehicle care essentials tutorial", "car maintenance basics tutorial"],
      };

  return Array.from(
    new Set(
      [
        `${vehicleLabel} ${args.topic} ${args.vehicleSearchTag} diy tutorial`,
        `${vehicleLabel} ${args.topic} ${args.vehicleSearchTag} how to`,
        `${vehicleLabel} ${args.topic} ${args.vehicleSearchTag} full guide`,
        `${args.topic} ${args.vehicleSearchTag} diy tutorial`,
        `${args.topic} ${args.vehicleSearchTag} how to`,
        `${args.topic} trending tutorial`,
        ...categoryFallbacks[args.category],
      ]
        .map((query) => query.trim())
        .filter(Boolean),
    ),
  );
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

    // Curated guide topics with related queries that should surface real YouTube tutorial videos.
    const categories = isBike ? [
      {
        name: "Engine Oil Change",
        label: "MAINTENANCE" as const,
      },
      {
        name: "Chain Cleaning & Lubing",
        label: "MAINTENANCE" as const,
      },
      {
        name: "Air Filter Cleaning",
        label: "MAINTENANCE" as const,
      },
      {
        name: "Spark Plug Service",
        label: "MAINTENANCE" as const,
      },
      {
        name: "Brake Fluid Check",
        label: "MAINTENANCE" as const,
      },
      {
        name: "Clutch Cable Adjustment",
        label: "MAINTENANCE" as const,
      },
      {
        name: "Spark Plug Check",
        label: "REPAIR" as const,
      },
      {
        name: "Brake Pad Replacement",
        label: "REPAIR" as const,
      },
      {
        name: "Battery Maintenance",
        label: "REPAIR" as const,
      },
      {
        name: "Puncture Repair",
        label: "REPAIR" as const,
      },
      {
        name: "Headlight Bulb Replacement",
        label: "REPAIR" as const,
      },
      {
        name: "Fuse Box Troubleshooting",
        label: "REPAIR" as const,
      },
      {
        name: "Tyre Pressure & Inspection",
        label: "ESSENTIALS" as const,
      },
      {
        name: "Chain Slack Inspection",
        label: "ESSENTIALS" as const,
      },
      {
        name: "Pre-Ride Safety Check",
        label: "ESSENTIALS" as const,
      },
      {
        name: "Bike Tool Kit Essentials",
        label: "ESSENTIALS" as const,
      },
      {
        name: "Motorcycle Jump Start Guide",
        label: "ESSENTIALS" as const,
      },
      {
        name: "Dashboard Warning Light Guide",
        label: "ESSENTIALS" as const,
      },
      {
        name: "Body Polish",
        label: "CLEANING" as const,
      },
      {
        name: "Foam Wash Technique",
        label: "CLEANING" as const,
      },
      {
        name: "Alloy Wheel Cleaning",
        label: "CLEANING" as const,
      },
      {
        name: "Windshield And Visor Cleaning",
        label: "CLEANING" as const,
      },
      {
        name: "Seat Care And Cleaning",
        label: "CLEANING" as const,
      },
      {
        name: "Chrome Parts Polishing",
        label: "CLEANING" as const,
      },
    ] : [
      {
        name: "Engine Oil Change",
        label: "MAINTENANCE" as const,
      },
      {
        name: "Air Filter Replacement",
        label: "MAINTENANCE" as const,
      },
      {
        name: "Cabin Filter Change",
        label: "MAINTENANCE" as const,
      },
      {
        name: "Spark Plug Inspection",
        label: "MAINTENANCE" as const,
      },
      {
        name: "Brake Fluid Flush",
        label: "MAINTENANCE" as const,
      },
      {
        name: "Transmission Fluid Check",
        label: "MAINTENANCE" as const,
      },
      {
        name: "Brake Pad Replacement",
        label: "REPAIR" as const,
      },
      {
        name: "Battery Replacement",
        label: "REPAIR" as const,
      },
      {
        name: "Coolant Leak Check",
        label: "REPAIR" as const,
      },
      {
        name: "Headlight Bulb Replacement",
        label: "REPAIR" as const,
      },
      {
        name: "Fuse Replacement",
        label: "REPAIR" as const,
      },
      {
        name: "Wiper Motor Fix",
        label: "REPAIR" as const,
      },
      {
        name: "Coolant Top-up",
        label: "ESSENTIALS" as const,
      },
      {
        name: "Wiper Blade Replacement",
        label: "ESSENTIALS" as const,
      },
      {
        name: "Tyre Pressure Inspection",
        label: "ESSENTIALS" as const,
      },
      {
        name: "Dashboard Warning Lights Guide",
        label: "ESSENTIALS" as const,
      },
      {
        name: "Jump Start A Car Safely",
        label: "ESSENTIALS" as const,
      },
      {
        name: "Car Tool Kit Essentials",
        label: "ESSENTIALS" as const,
      },
      {
        name: "Interior Deep Cleaning",
        label: "CLEANING" as const,
      },
      {
        name: "Exterior Foam Wash",
        label: "CLEANING" as const,
      },
      {
        name: "Alloy Wheel Cleaning",
        label: "CLEANING" as const,
      },
      {
        name: "Windshield Glass Care",
        label: "CLEANING" as const,
      },
      {
        name: "Seat Upholstery Cleaning",
        label: "CLEANING" as const,
      },
      {
        name: "Engine Bay Cleaning",
        label: "CLEANING" as const,
      },
    ];

    const make = vehicle.make || "General";
    const model = vehicle.model || "Vehicle";

    const vehicleSearchTag = isBike ? "motorcycle scooter" : "car";

    const guides: Array<DIYGuide | null> = await Promise.all(
      categories.map(async (cat, idx) => {
        const searchQuery = `${make} ${model} ${cat.name} ${vehicleSearchTag}`.trim();
        const searchCandidates = buildGuideSearchCandidates({
          make,
          model,
          topic: cat.name,
          category: cat.label,
          vehicleSearchTag,
          isBike,
        });
        const youtube = await resolveYouTubePreview(searchCandidates);
        if (!youtube) return null;

        return {
          id: `diy-${idx}-${model.toLowerCase()}`,
          title: `${make} ${model}: ${cat.name}`,
          description: `Step-by-step guide on how to perform ${cat.name.toLowerCase()} for your ${make} ${model}.`,
          thumbnail: youtube.thumbnail,
          videoUrl: youtube.videoUrl,
          duration: "5:30",
          category: cat.label,
          searchQuery: searchCandidates[0],
        };
      }),
    );

    const resolvedGuides = guides.filter((guide): guide is DIYGuide => guide !== null);
    const hasMissingCategory = DIY_CATEGORIES.some(
      (category) => resolvedGuides.filter((guide) => guide.category === category).length < CATEGORY_TARGET_COUNT,
    );

    if (!hasMissingCategory) {
      return resolvedGuides;
    }

    const defaultGuides = await this.getDefaultGuides();
    return topUpGuidesPerCategory(resolvedGuides, defaultGuides);
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
        searchQuery: "car dashboard lights meaning",
        duration: "8:15",
        category: "ESSENTIALS" as const,
      },
      {
        id: "default-2",
        title: "How to Jump-start a Car Safely",
        description: "Emergency guide on how to jump-start your vehicle without damaging the electronics.",
        searchQuery: "how to jump start a car safely",
        duration: "4:45",
        category: "ESSENTIALS" as const,
      },
      {
        id: "default-3",
        title: "Basic Car Tool Kit Essentials",
        description: "The 10 tools every car owner should keep in their boot.",
        searchQuery: "car tool kit essentials",
        duration: "6:20",
        category: "ESSENTIALS" as const,
      },
      {
        id: "default-4",
        title: "How to Check Tyre Pressure",
        description: "A quick guide to checking tyre pressure for safer daily driving.",
        searchQuery: "how to check tyre pressure car",
        duration: "4:30",
        category: "ESSENTIALS" as const,
      },
      {
        id: "default-5",
        title: "Wiper Blade Replacement Guide",
        description: "Replace worn-out wipers before the next rain drive.",
        searchQuery: "car wiper blade replacement tutorial",
        duration: "5:05",
        category: "ESSENTIALS" as const,
      },
      {
        id: "default-6",
        title: "Coolant Top-up Basics",
        description: "Learn when and how to top up coolant without damaging the engine.",
        searchQuery: "car coolant top up tutorial",
        duration: "5:10",
        category: "ESSENTIALS" as const,
      },
      {
        id: "default-7",
        title: "Engine Oil Change Basics",
        description: "Step-by-step engine oil replacement for first-time DIY owners.",
        searchQuery: "car engine oil change diy tutorial",
        duration: "7:10",
        category: "MAINTENANCE" as const,
      },
      {
        id: "default-8",
        title: "Air Filter Replacement Guide",
        description: "Improve airflow and mileage with a simple air filter swap.",
        searchQuery: "car air filter replacement tutorial",
        duration: "4:50",
        category: "MAINTENANCE" as const,
      },
      {
        id: "default-9",
        title: "Cabin Filter Change Tutorial",
        description: "Keep your cabin air fresh with an easy filter change.",
        searchQuery: "car cabin filter change tutorial",
        duration: "4:20",
        category: "MAINTENANCE" as const,
      },
      {
        id: "default-10",
        title: "Spark Plug Inspection Basics",
        description: "Check spark plugs and spot early signs of engine trouble.",
        searchQuery: "car spark plug inspection tutorial",
        duration: "5:40",
        category: "MAINTENANCE" as const,
      },
      {
        id: "default-11",
        title: "Brake Fluid Flush Guide",
        description: "Brake fluid maintenance explained for safer braking.",
        searchQuery: "car brake fluid flush tutorial",
        duration: "6:15",
        category: "MAINTENANCE" as const,
      },
      {
        id: "default-12",
        title: "Transmission Fluid Check",
        description: "A beginner-friendly guide to checking transmission fluid.",
        searchQuery: "car transmission fluid check tutorial",
        duration: "5:35",
        category: "MAINTENANCE" as const,
      },
      {
        id: "default-13",
        title: "Brake Pad Replacement",
        description: "Replace worn brake pads before they damage the rotor.",
        searchQuery: "car brake pad replacement tutorial",
        duration: "7:00",
        category: "REPAIR" as const,
      },
      {
        id: "default-14",
        title: "Battery Replacement Guide",
        description: "Swap a weak battery and get back on the road fast.",
        searchQuery: "car battery replacement tutorial",
        duration: "5:05",
        category: "REPAIR" as const,
      },
      {
        id: "default-15",
        title: "Coolant Leak Troubleshooting",
        description: "How to inspect hoses and spot common coolant leaks.",
        searchQuery: "car coolant leak check tutorial",
        duration: "6:00",
        category: "REPAIR" as const,
      },
      {
        id: "default-16",
        title: "Headlight Bulb Replacement",
        description: "A simple headlight replacement guide for better night visibility.",
        searchQuery: "car headlight bulb replacement tutorial",
        duration: "4:45",
        category: "REPAIR" as const,
      },
      {
        id: "default-17",
        title: "Fuse Replacement Basics",
        description: "Find and replace blown fuses safely in your car.",
        searchQuery: "car fuse replacement tutorial",
        duration: "4:25",
        category: "REPAIR" as const,
      },
      {
        id: "default-18",
        title: "Wiper Motor Fix Guide",
        description: "Troubleshoot and fix common wiper motor issues.",
        searchQuery: "car wiper motor fix tutorial",
        duration: "6:10",
        category: "REPAIR" as const,
      },
      {
        id: "default-19",
        title: "Interior Deep Cleaning",
        description: "A proper step-by-step car interior deep-clean process.",
        searchQuery: "car interior deep cleaning tutorial",
        duration: "6:30",
        category: "CLEANING" as const,
      },
      {
        id: "default-20",
        title: "Exterior Foam Wash Guide",
        description: "Wash your car safely without scratching the paint.",
        searchQuery: "car exterior foam wash tutorial",
        duration: "5:25",
        category: "CLEANING" as const,
      },
      {
        id: "default-21",
        title: "Alloy Wheel Cleaning Basics",
        description: "Clean brake dust and restore shine to your wheels.",
        searchQuery: "alloy wheel cleaning tutorial car",
        duration: "4:55",
        category: "CLEANING" as const,
      },
      {
        id: "default-22",
        title: "Windshield Glass Care",
        description: "Improve visibility with proper windshield cleaning and care.",
        searchQuery: "car windshield glass care tutorial",
        duration: "4:15",
        category: "CLEANING" as const,
      },
      {
        id: "default-23",
        title: "Seat Upholstery Cleaning",
        description: "Remove stains and refresh your seats at home.",
        searchQuery: "car seat upholstery cleaning tutorial",
        duration: "5:45",
        category: "CLEANING" as const,
      },
      {
        id: "default-24",
        title: "Engine Bay Cleaning",
        description: "Clean the engine bay carefully without harming electronics.",
        searchQuery: "car engine bay cleaning tutorial",
        duration: "6:05",
        category: "CLEANING" as const,
      },
    ];

    const guides: Array<DIYGuide | null> = await Promise.all(
      defaultGuides.map(async (guide) => {
        const searchCandidates = [
          `${guide.searchQuery} tutorial`,
          `${guide.searchQuery} trending`,
          guide.searchQuery,
          "car maintenance diy tutorial",
        ];
        const youtube = await resolveYouTubePreview(searchCandidates);
        if (!youtube) return null;

        return {
          id: guide.id,
          title: guide.title,
          description: guide.description,
          thumbnail: youtube.thumbnail,
          videoUrl: youtube.videoUrl,
          duration: guide.duration,
          category: guide.category,
          searchQuery: searchCandidates[0],
        };
      }),
    );

    return guides.filter((guide): guide is DIYGuide => guide !== null);
  },
};
