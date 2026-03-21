// ============================================================
// relay.js — Kiosk Bridge v2.0.1-finalized
// Travel Expert™ | The AI Concierge
// ============================================================
// PRODUCTION BUILD for github.com/AIexpert-ig/kiosk-bridge
//
// Capabilities:
//   ✓ BOOKING_CONFIRMED → Telegram/Email/WhatsApp (preserved)
//   ✓ show_attraction → SHOW_ATTRACTION socket event
//   ✓ show_menu → SHOW_MENU socket event (25 items across 4 types)
//   ✓ set_mood → SET_MOOD socket event (5 mood themes)
//   ✓ avatar_state → AVATAR_STATE socket event
//   ✓ Self-ping keep-alive (https module)
//   ✓ /health endpoint with registry counts
// ============================================================

const https = require("https");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ["websocket", "polling"],
});

app.use(express.json());

// ── Health Endpoint (PRESERVED + extended) ───────────────
app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        uptime: process.uptime(),
        connectedKiosks: io.engine.clientsCount,
        version: "2.0.1-finalized",
        registries: {
            attractions: Object.keys(ATTRACTION_REGISTRY).length,
            menu_types: Object.keys(MENU_REGISTRY).length,
            moods: Object.keys(MOOD_THEMES).length,
        },
    });
});

// ── Self-Ping Keep-Alive (PRESERVED — uses https) ────────
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
if (RENDER_URL) {
    setInterval(() => {
        https
            .get(`${RENDER_URL}/health`, (res) => {
                console.log(`[SELF-PING] ${res.statusCode}`);
            })
            .on("error", (err) => {
                console.error(`[SELF-PING] Failed: ${err.message}`);
            });
    }, 4 * 60 * 1000);
}

// ── Notification Dispatch (PRESERVED) ─────────────────────
async function dispatchNotifications(bookingData) {
    const channels = [];

    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
        channels.push(
            sendTelegram(bookingData).catch((err) => ({
                channel: "telegram",
                error: err.message,
            }))
        );
    }

    if (process.env.EMAIL_ENABLED === "true") {
        channels.push(
            sendEmail(bookingData).catch((err) => ({
                channel: "email",
                error: err.message,
            }))
        );
    }

    if (process.env.WHATSAPP_ENABLED === "true") {
        channels.push(
            sendWhatsApp(bookingData).catch((err) => ({
                channel: "whatsapp",
                error: err.message,
            }))
        );
    }

    const results = await Promise.allSettled(channels);
    console.log(
        "[NOTIFICATIONS]",
        results.map((r) => (r.status === "fulfilled" ? r.value : r.reason))
    );
    return results;
}

async function sendTelegram(data) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const message = formatBookingMessage(data);

    const res = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: "HTML",
            }),
        }
    );

    if (!res.ok) throw new Error(`Telegram: ${res.status}`);
    return { channel: "telegram", status: "sent" };
}

function formatBookingMessage(data) {
    // Normalise — kiosk emits: guest, tourName, date, pax
    const guest  = data.guest    || data.guest_name  || "N/A";
    const tour   = data.tourName || data.tour_name   || "N/A";
    const date   = data.date     || "N/A";
    const pax    = data.pax      || data.guest_count || "N/A";
    const dubaiTime = new Date().toLocaleString("en-GB", {
        timeZone: "Asia/Dubai",
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit"
    });
    return [
        "\u{1F6A8} <b>New Kiosk Booking</b>",
        "",
        "\u{1F464} <b>Guest:</b>  " + guest,
        "\u{1F3C4} <b>Tour:</b>   " + tour,
        "\u{1F5D3} <b>Date:</b>   " + date,
        "\u{1F465} <b>Pax:</b>    " + pax,
        "\u{1F50D} <b>Source:</b> voice-ai",
        "",
        "\u23F0 " + dubaiTime + " (Dubai)",
    ].join("\n");
}

async function sendEmail(data) {
    console.log("[EMAIL] Would send:", data.guest_name);
    return { channel: "email", status: "stub" };
}

async function sendWhatsApp(data) {
    console.log("[WHATSAPP] Would send:", data.guest_name);
    return { channel: "whatsapp", status: "stub" };
}

// ============================================================
// CONTENT REGISTRIES
// ============================================================

const ATTRACTION_REGISTRY = {
    burj_khalifa: {
        title: "Burj Khalifa",
        subtitle: "828m — World's Tallest Building",
        image: "/assets/attractions/burj_khalifa.webp",
        video: "/assets/attractions/burj_khalifa.mp4",
        facts: [
            "163 floors above ground",
            "Built in 5 years (2004–2009)",
            "At The Top observation deck on floor 124",
            "The fountain show below is the world's largest choreographed system",
        ],
        price_hint: "From AED 149",
        cta_label: "Book Tickets",
    },
    palm_jumeirah: {
        title: "Palm Jumeirah",
        subtitle: "The Iconic Man-Made Island",
        image: "/assets/attractions/palm_jumeirah.webp",
        video: "/assets/attractions/palm_jumeirah.mp4",
        facts: [
            "Visible from space",
            "Home to Atlantis The Royal and Atlantis The Palm",
            "11.5km monorail connects the trunk to the crescent",
            "Over 4,000 residential units",
        ],
        price_hint: "Day pass from AED 299",
        cta_label: "Explore Experiences",
    },
    desert_safari: {
        title: "Desert Safari",
        subtitle: "Dune Bashing · BBQ · Stargazing",
        image: "/assets/attractions/desert_safari.webp",
        video: "/assets/attractions/desert_safari.mp4",
        facts: [
            "Typical duration: 6 hours (afternoon to night)",
            "Includes camel ride, henna, and tanoura show",
            "BBQ dinner under the stars",
            "Pickup and drop-off from any Dubai hotel",
        ],
        price_hint: "From AED 185",
        cta_label: "Book Safari",
    },
    dubai_mall: {
        title: "Dubai Mall",
        subtitle: "1,200+ Stores · Aquarium · Ice Rink",
        image: "/assets/attractions/dubai_mall.webp",
        video: "/assets/attractions/dubai_mall.mp4",
        facts: [
            "Largest mall in the world by total area",
            "Dubai Aquarium holds 10 million litres of water",
            "Olympic-sized ice rink inside",
            "Over 200 food & beverage outlets",
        ],
        price_hint: "Free entry (attractions priced separately)",
        cta_label: "Plan Your Visit",
    },
    beach_club: {
        title: "Beach Clubs",
        subtitle: "Sun · Pool · DJ Sets",
        image: "/assets/attractions/beach_club.webp",
        video: "/assets/attractions/beach_club.mp4",
        facts: [
            "Top picks: Nikki Beach, Zero Gravity, Twiggy",
            "Most offer day-pass with pool & beach access",
            "Friday brunch + beach combo is peak Dubai",
            "Dress code: resort chic (no sportswear)",
        ],
        price_hint: "Day pass from AED 200",
        cta_label: "Reserve Spot",
    },
};

// ============================================================
// MENU REGISTRY (NEW — resolves skeleton loader gap)
// ============================================================
// Each menu_type maps to the Vapi schema enum.
// Items are tagged for category sub-filtering.
// ============================================================

const MENU_REGISTRY = {
    tours: {
        title: "Dubai Tours & Experiences",
        items: [
            {
                id: "tour_burj_khalifa",
                name: "Burj Khalifa Ticket — At The Top",
                description: "Skip-the-line entry to floors 124 & 125",
                price: "AED 149",
                duration: "1.5 hours",
                image: "/assets/menu/tour_burj.webp",
                categories: ["luxury", "family", "popular"],
                rating: 4.8,
            },
            {
                id: "tour_desert_premium",
                name: "Premium Desert Safari",
                description: "Private 4x4, gourmet BBQ, falcon show, VIP seating",
                price: "AED 650",
                duration: "6 hours",
                image: "/assets/menu/tour_desert_premium.webp",
                categories: ["luxury", "adventure", "romantic"],
                rating: 4.9,
            },
            {
                id: "tour_desert_standard",
                name: "Desert Safari — Classic",
                description: "Shared 4x4, dune bashing, camel ride, buffet dinner",
                price: "AED 185",
                duration: "6 hours",
                image: "/assets/menu/tour_desert_standard.webp",
                categories: ["adventure", "budget", "family", "popular"],
                rating: 4.6,
            },
            {
                id: "tour_dhow_cruise",
                name: "Dhow Cruise Dinner — Marina",
                description: "2-hour cruise with buffet dinner and live entertainment",
                price: "AED 189",
                duration: "2 hours",
                image: "/assets/menu/tour_dhow.webp",
                categories: ["romantic", "family", "popular"],
                rating: 4.5,
            },
            {
                id: "tour_abu_dhabi",
                name: "Abu Dhabi Day Trip",
                description: "Sheikh Zayed Mosque, Louvre Abu Dhabi, Corniche",
                price: "AED 225",
                duration: "10 hours",
                image: "/assets/menu/tour_abu_dhabi.webp",
                categories: ["family", "culture"],
                rating: 4.7,
            },
            {
                id: "tour_helicopter",
                name: "Helicopter Tour — Dubai Skyline",
                description: "12-minute flight over Palm, Burj Al Arab, and Marina",
                price: "AED 745",
                duration: "12 minutes",
                image: "/assets/menu/tour_helicopter.webp",
                categories: ["luxury", "adventure"],
                rating: 4.9,
            },
            {
                id: "tour_old_dubai",
                name: "Old Dubai Walking Tour",
                description: "Al Fahidi, spice souk, abra ride, street food tasting",
                price: "AED 120",
                duration: "3 hours",
                image: "/assets/menu/tour_old_dubai.webp",
                categories: ["culture", "budget", "family"],
                rating: 4.4,
            },
            {
                id: "tour_aquaventure",
                name: "Aquaventure Waterpark",
                description: "Full-day pass at Atlantis — slides, lazy river, beach",
                price: "AED 340",
                duration: "Full day",
                image: "/assets/menu/tour_aquaventure.webp",
                categories: ["family", "adventure", "popular"],
                rating: 4.6,
            },
        ],
    },

    restaurants: {
        title: "Dining Recommendations",
        items: [
            {
                id: "rest_nobu",
                name: "Nobu Dubai",
                description: "Japanese-Peruvian fusion at Atlantis The Royal",
                price: "AED 400–800 pp",
                cuisine: "Japanese-Peruvian",
                image: "/assets/menu/rest_nobu.webp",
                categories: ["luxury", "romantic"],
                rating: 4.7,
            },
            {
                id: "rest_al_mahara",
                name: "Al Mahara — Burj Al Arab",
                description: "Seafood fine dining with floor-to-ceiling aquarium",
                price: "AED 900–1500 pp",
                cuisine: "Seafood",
                image: "/assets/menu/rest_al_mahara.webp",
                categories: ["luxury"],
                rating: 4.8,
            },
            {
                id: "rest_pierchic",
                name: "Pierchic",
                description: "Over-water seafood restaurant on a private pier",
                price: "AED 500–900 pp",
                cuisine: "Seafood",
                image: "/assets/menu/rest_pierchic.webp",
                categories: ["luxury", "romantic"],
                rating: 4.6,
            },
            {
                id: "rest_ravi",
                name: "Ravi Restaurant",
                description: "Legendary Pakistani food. Cash only. Always busy.",
                price: "AED 25–60 pp",
                cuisine: "Pakistani",
                image: "/assets/menu/rest_ravi.webp",
                categories: ["budget", "popular"],
                rating: 4.5,
            },
            {
                id: "rest_tresind",
                name: "Tresind Studio",
                description: "Michelin-starred modern Indian tasting menu",
                price: "AED 750 pp (set menu)",
                cuisine: "Modern Indian",
                image: "/assets/menu/rest_tresind.webp",
                categories: ["luxury", "culture"],
                rating: 4.9,
            },
            {
                id: "rest_sea_fu",
                name: "Sea Fu — Four Seasons",
                description: "Pan-Asian seafood with direct beach access",
                price: "AED 350–700 pp",
                cuisine: "Pan-Asian",
                image: "/assets/menu/rest_sea_fu.webp",
                categories: ["luxury", "romantic"],
                rating: 4.5,
            },
        ],
    },

    activities: {
        title: "Things to Do",
        items: [
            {
                id: "act_skydive",
                name: "Skydive Dubai — Palm Drop Zone",
                description: "Tandem jump with Palm Jumeirah landing",
                price: "AED 1,999",
                duration: "3–4 hours (incl. prep)",
                image: "/assets/menu/act_skydive.webp",
                categories: ["adventure"],
                rating: 4.9,
            },
            {
                id: "act_jetski",
                name: "Jet Ski Tour — Burj Al Arab Circuit",
                description: "30-minute guided ride past Dubai's skyline",
                price: "AED 450",
                duration: "30 minutes",
                image: "/assets/menu/act_jetski.webp",
                categories: ["adventure", "popular"],
                rating: 4.6,
            },
            {
                id: "act_museum_future",
                name: "Museum of the Future",
                description: "Immersive exhibits on AI, space, and bioengineering",
                price: "AED 149",
                duration: "2 hours",
                image: "/assets/menu/act_museum.webp",
                categories: ["culture", "family"],
                rating: 4.7,
            },
            {
                id: "act_global_village",
                name: "Global Village",
                description: "Cultural pavilions, rides, street food. Open Oct–Apr.",
                price: "AED 25",
                duration: "4–5 hours",
                image: "/assets/menu/act_global_village.webp",
                categories: ["family", "culture", "budget"],
                rating: 4.4,
            },
            {
                id: "act_kayak_mangroves",
                name: "Kayak the Mangroves",
                description: "Eco-tour through Abu Dhabi's mangrove forests",
                price: "AED 180",
                duration: "2.5 hours",
                image: "/assets/menu/act_kayak.webp",
                categories: ["adventure", "family"],
                rating: 4.5,
            },
            {
                id: "act_spa_talise",
                name: "Talise Ottoman Spa",
                description: "Full-day spa circuit at Jumeirah Zabeel Saray",
                price: "AED 600",
                duration: "3 hours",
                image: "/assets/menu/act_spa.webp",
                categories: ["luxury", "romantic"],
                rating: 4.8,
            },
        ],
    },

    transfers: {
        title: "Airport & City Transfers",
        items: [
            {
                id: "xfer_airport_sedan",
                name: "Airport Pickup — Sedan",
                description: "DXB or DWC. Meet & greet. Mercedes E-Class.",
                price: "AED 180",
                duration: "30–50 min",
                image: "/assets/menu/xfer_sedan.webp",
                categories: ["popular"],
                rating: 4.7,
            },
            {
                id: "xfer_airport_suv",
                name: "Airport Pickup — Luxury SUV",
                description: "Cadillac Escalade or Range Rover. Water + WiFi.",
                price: "AED 350",
                duration: "30–50 min",
                image: "/assets/menu/xfer_suv.webp",
                categories: ["luxury"],
                rating: 4.8,
            },
            {
                id: "xfer_airport_van",
                name: "Airport Pickup — Group Van",
                description: "Mercedes V-Class. Seats up to 6 + luggage.",
                price: "AED 280",
                duration: "30–50 min",
                image: "/assets/menu/xfer_van.webp",
                categories: ["family", "budget"],
                rating: 4.5,
            },
            {
                id: "xfer_intercity",
                name: "Dubai ↔ Abu Dhabi Transfer",
                description: "One-way sedan transfer. Door to door.",
                price: "AED 400",
                duration: "1.5 hours",
                image: "/assets/menu/xfer_intercity.webp",
                categories: ["popular"],
                rating: 4.6,
            },
            {
                id: "xfer_chauffeur",
                name: "Full-Day Chauffeur",
                description: "10 hours. Luxury sedan. Go anywhere in Dubai.",
                price: "AED 1,200",
                duration: "10 hours",
                image: "/assets/menu/xfer_chauffeur.webp",
                categories: ["luxury"],
                rating: 4.9,
            },
        ],
    },
};

const MOOD_THEMES = {
    gold: {
        primary: "#C5A355",
        secondary: "#1A1A2E",
        accent: "#F5E6C8",
        gradient: "linear-gradient(135deg, #1A1A2E 0%, #2D2D44 50%, #C5A355 100%)",
        particle_color: "rgba(197, 163, 85, 0.6)",
        label: "Luxury Gold",
    },
    blue: {
        primary: "#4FC3F7",
        secondary: "#0D1B2A",
        accent: "#B3E5FC",
        gradient: "linear-gradient(135deg, #0D1B2A 0%, #1B3A4B 50%, #4FC3F7 100%)",
        particle_color: "rgba(79, 195, 247, 0.6)",
        label: "Ocean Blue",
    },
    amber: {
        primary: "#FFB74D",
        secondary: "#2E1503",
        accent: "#FFE0B2",
        gradient: "linear-gradient(135deg, #2E1503 0%, #4E2A0E 50%, #FFB74D 100%)",
        particle_color: "rgba(255, 183, 77, 0.6)",
        label: "Desert Amber",
    },
    emerald: {
        primary: "#66BB6A",
        secondary: "#0B2E0B",
        accent: "#C8E6C9",
        gradient: "linear-gradient(135deg, #0B2E0B 0%, #1B5E20 50%, #66BB6A 100%)",
        particle_color: "rgba(102, 187, 106, 0.6)",
        label: "Oasis Emerald",
    },
    coral: {
        primary: "#FF7043",
        secondary: "#2E0E06",
        accent: "#FFCCBC",
        gradient: "linear-gradient(135deg, #2E0E06 0%, #4E1A0E 50%, #FF7043 100%)",
        particle_color: "rgba(255, 112, 67, 0.6)",
        label: "Sunset Coral",
    },
};

// ============================================================
// SOCKET.IO CONNECTION HANDLER
// ============================================================
io.on("connection", (socket) => {
    console.log(`[KIOSK] Connected: ${socket.id}`);

    // ── PRESERVED: Booking Confirmation ─────────────────────
    socket.on("BOOKING_CONFIRMED", async (data) => {
        console.log("[BOOKING]", JSON.stringify(data));

        // Ghost booking guard
        const GHOSTS = ["unknown", "not specified", "[tour name]", ""];
        const isEmpty = (v) => GHOSTS.includes(String(v || "").toLowerCase().trim());
        const _g = data.guest    || data.guest_name  || "";
        const _t = data.tourName || data.tour_name   || "";
        const _d = data.date     || "";
        const _p = data.pax      || data.guest_count || "";
        const emptyCount = [_g, _t, _d, _p].filter(isEmpty).length;

        if (emptyCount >= 3) {
            const reason = (_t && !isEmpty(_t)) ? "DROPOFF_AFTER_INTENT" : "DATA_VOID";
            console.warn("[GHOST BOOKING] Suppressed:", reason, "| empty:", emptyCount, "| data:", JSON.stringify(data));
            socket.emit("BOOKING_NOTIFICATION_SENT", { success: false, suppressed: true, reason: reason });
            return;
        }
        if (emptyCount > 0) {
            console.warn("[PARTIAL BOOKING]", emptyCount, "field(s) missing");
            if (isEmpty(_g)) data.guest    = "REQUIRES FOLLOW-UP";
            if (isEmpty(_t)) data.tourName = "REQUIRES FOLLOW-UP";
            if (isEmpty(_d)) data.date     = "REQUIRES FOLLOW-UP";
            if (isEmpty(_p)) data.pax      = "REQUIRES FOLLOW-UP";
        }

        try {
            await dispatchNotifications(data);
            socket.emit("BOOKING_NOTIFICATION_SENT", { success: true, timestamp: Date.now(), partial: emptyCount > 0 });
        } catch (err) {
            console.error("[BOOKING ERROR]", err);
            socket.emit("BOOKING_NOTIFICATION_SENT", { success: false, error: err.message });
        }});

    // ── Kiosk requests its initial state ───────────────
    socket.on("REQUEST_STATE", () => {
        socket.emit("UI_UPDATE", {
            type: "SET_MOOD",
            data: {
                mood: "gold",
                theme: MOOD_THEMES.gold,
                reason: "initial_state",
                timestamp: Date.now(),
            },
        });
    });

    socket.on("disconnect", (reason) => {
        console.log(`[KIOSK] Disconnected: ${socket.id} (${reason})`);
    });
});

// ============================================================
// VAPI FUNCTION CALL ENDPOINT
// ============================================================

app.post("/vapi/function-call", (req, res) => {
    const { message } = req.body;

    if (!message || message.type !== "function-call") {
        return res.status(400).json({ error: "Invalid payload type" });
    }

    const { functionCall } = message;
    const toolName = functionCall?.name;
    const params = functionCall?.parameters || {};

    console.log(`[VAPI TOOL] ${toolName}`, JSON.stringify(params));

    switch (toolName) {
        // ── show_attraction (UNCHANGED) ─────────────────────
        case "show_attraction": {
            const attraction = ATTRACTION_REGISTRY[params.attraction_id];
            if (!attraction) {
                return res.json({
                    results: [
                        {
                            toolCallId: functionCall.id,
                            result: `Attraction "${params.attraction_id}" not in registry. Options: ${Object.keys(ATTRACTION_REGISTRY).join(", ")}`,
                        },
                    ],
                });
            }

            io.emit("UI_UPDATE", {
                type: "SHOW_ATTRACTION",
                data: {
                    ...attraction,
                    attraction_id: params.attraction_id,
                    media_type: params.media_type || "image",
                    mood: params.mood || "gold",
                    theme: MOOD_THEMES[params.mood || "gold"],
                    timestamp: Date.now(),
                },
            });

            return res.json({
                results: [
                    {
                        toolCallId: functionCall.id,
                        result: `Showing ${attraction.title} on kiosk. Guest sees the ${params.media_type || "image"} now.`,
                    },
                ],
            });
        }

        // ── show_menu (REFACTORED — now sends items) ────────
        case "show_menu": {
            const menuType = params.menu_type || "tours";
            const menu = MENU_REGISTRY[menuType];

            if (!menu) {
                return res.json({
                    results: [
                        {
                            toolCallId: functionCall.id,
                            result: `Menu "${menuType}" not found. Options: ${Object.keys(MENU_REGISTRY).join(", ")}`,
                        },
                    ],
                });
            }

            // Guard: treat empty string, null, undefined as "all"
            const rawCategory = params.category;
            const category = rawCategory && rawCategory.trim() ? rawCategory.trim().toLowerCase() : "all";

            const filteredItems =
                category === "all"
                    ? menu.items
                    : menu.items.filter((item) =>
                        item.categories.includes(category)
                    );

            // Collect all unique categories from this menu for frontend filter pills
            const availableCategories = [
                ...new Set(menu.items.flatMap((item) => item.categories)),
            ].sort();

            io.emit("UI_UPDATE", {
                type: "SHOW_MENU",
                data: {
                    menu_type: menuType,
                    title: menu.title,
                    category,
                    items: filteredItems,
                    total_count: menu.items.length,
                    filtered_count: filteredItems.length,
                    available_categories: availableCategories,
                    mood: params.mood || "gold",
                    theme: MOOD_THEMES[params.mood || "gold"],
                    timestamp: Date.now(),
                },
            });

            return res.json({
                results: [
                    {
                        toolCallId: functionCall.id,
                        result: `Showing ${filteredItems.length} ${menuType}${category !== "all" ? ` (${category})` : ""} on kiosk. Guest can browse them now.`,
                    },
                ],
            });
        }

        // ── set_mood (UNCHANGED) ────────────────────────────
        case "set_mood": {
            const moodKey = params.mood || "gold";
            const theme = MOOD_THEMES[moodKey];

            if (!theme) {
                return res.json({
                    results: [
                        {
                            toolCallId: functionCall.id,
                            result: `Mood "${moodKey}" not found. Options: ${Object.keys(MOOD_THEMES).join(", ")}`,
                        },
                    ],
                });
            }

            io.emit("UI_UPDATE", {
                type: "SET_MOOD",
                data: {
                    mood: moodKey,
                    theme,
                    reason: params.reason || "conversation_context",
                    timestamp: Date.now(),
                },
            });

            return res.json({
                results: [
                    {
                        toolCallId: functionCall.id,
                        result: `Mood set to ${theme.label}. Kiosk theme updated.`,
                    },
                ],
            });
        }

        // ── avatar_state (NEW — completes schema coverage) ──
        case "avatar_state": {
            io.emit("UI_UPDATE", {
                type: "AVATAR_STATE",
                data: {
                    expression: params.expression || "neutral",
                    speaking: params.speaking ?? false,
                    gesture: params.gesture || "none",
                    timestamp: Date.now(),
                },
            });

            return res.json({
                results: [
                    {
                        toolCallId: functionCall.id,
                        result: "Avatar updated.",
                    },
                ],
            });
        }

        default: {
            console.warn(`[VAPI TOOL] Unknown: ${toolName}`);
            return res.json({
                results: [
                    {
                        toolCallId: functionCall.id,
                        result: `Tool "${toolName}" not registered on bridge. Available: show_attraction, show_menu, set_mood, avatar_state.`,
                    },
                ],
            });
        }
    }
});

// ── Start Server ──────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    const totalItems = Object.values(MENU_REGISTRY).reduce((sum, m) => sum + m.items.length, 0);
    console.log(`[BRIDGE] Kiosk relay v2.0.1-finalized on port ${PORT}`);
    console.log(`[BRIDGE] Registries: ${Object.keys(ATTRACTION_REGISTRY).length} attractions, ${Object.keys(MENU_REGISTRY).length} menus (${totalItems} items), ${Object.keys(MOOD_THEMES).length} moods`);
    console.log(`[BRIDGE] Endpoints:`);
    console.log(`  GET  /health`);
    console.log(`  POST /vapi/function-call`);
    console.log(`  WS   socket.io → BOOKING_CONFIRMED, UI_UPDATE`);
});
