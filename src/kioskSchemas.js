"use strict";
// ============================================================
// kiosk-orchestrator-mcp | schemas/kioskSchemas.ts
// Dubai Luxury Kiosk — Zod Validation Schemas
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogKioskEventSchema = exports.UpdateKioskViewSchema = void 0;
const zod_1 = require("zod");
exports.UpdateKioskViewSchema = zod_1.z
    .object({
    viewType: zod_1.z
        .enum(["home", "tour_details", "booking_qr"])
        .describe("The screen to display on the kiosk. 'home' = landing screen, 'tour_details' = full tour info, 'booking_qr' = QR code for booking confirmation."),
    tourID: zod_1.z
        .string()
        .min(1, "tourID cannot be empty")
        .max(64, "tourID must not exceed 64 characters")
        .describe("Unique identifier for the tour being displayed. Required even on 'home' view — pass an empty string ('') only for the home screen where no tour is active."),
    vibe: zod_1.z
        .enum(["luxury", "adventure"])
        .describe("Visual theme to apply to the kiosk UI. 'luxury' = gold/dark palette, 'adventure' = vibrant/energetic palette."),
});
exports.LogKioskEventSchema = zod_1.z
    .object({
    eventType: zod_1.z
        .string()
        .min(1, "eventType cannot be empty")
        .max(128, "eventType must not exceed 128 characters")
        .describe("Category of the kiosk interaction event. Examples: 'tour_viewed', 'qr_scanned', 'idle_timeout', 'language_switch', 'booking_started'."),
    duration: zod_1.z
        .number()
        .int("duration must be a whole number of seconds")
        .min(0, "duration cannot be negative")
        .max(3600, "duration cannot exceed 3600 seconds (1 hour)")
        .describe("How long the guest spent on this interaction, in seconds. Use 0 for instantaneous events."),
    guestInterests: zod_1.z
        .array(zod_1.z
        .string()
        .min(1, "Each interest tag must be non-empty")
        .max(64, "Each interest tag must not exceed 64 characters"))
        .min(0)
        .max(20, "Cannot log more than 20 interest tags per event")
        .describe("Tags representing what the guest engaged with. Examples: ['desert_safari', 'dhow_cruise', 'luxury_hotel']. Pass an empty array if no interests detected."),
});
