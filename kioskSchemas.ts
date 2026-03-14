// ============================================================
// kiosk-orchestrator-mcp | schemas/kioskSchemas.ts
// Dubai Luxury Kiosk — Zod Validation Schemas
// ============================================================

import { z } from "zod";

export const UpdateKioskViewSchema = z
  .object({
    viewType: z
      .enum(["home", "tour_details", "booking_qr"])
      .describe(
        "The screen to display on the kiosk. 'home' = landing screen, 'tour_details' = full tour info, 'booking_qr' = QR code for booking confirmation."
      ),
    tourID: z
      .string()
      .min(1, "tourID cannot be empty")
      .max(64, "tourID must not exceed 64 characters")
      .describe(
        "Unique identifier for the tour being displayed. Required even on 'home' view — pass an empty string ('') only for the home screen where no tour is active."
      ),
    vibe: z
      .enum(["luxury", "adventure"])
      .describe(
        "Visual theme to apply to the kiosk UI. 'luxury' = gold/dark palette, 'adventure' = vibrant/energetic palette."
      ),
  })
  .strict();

export const LogKioskEventSchema = z
  .object({
    eventType: z
      .string()
      .min(1, "eventType cannot be empty")
      .max(128, "eventType must not exceed 128 characters")
      .describe(
        "Category of the kiosk interaction event. Examples: 'tour_viewed', 'qr_scanned', 'idle_timeout', 'language_switch', 'booking_started'."
      ),
    duration: z
      .number()
      .int("duration must be a whole number of seconds")
      .min(0, "duration cannot be negative")
      .max(3600, "duration cannot exceed 3600 seconds (1 hour)")
      .describe(
        "How long the guest spent on this interaction, in seconds. Use 0 for instantaneous events."
      ),
    guestInterests: z
      .array(
        z
          .string()
          .min(1, "Each interest tag must be non-empty")
          .max(64, "Each interest tag must not exceed 64 characters")
      )
      .min(0)
      .max(20, "Cannot log more than 20 interest tags per event")
      .describe(
        "Tags representing what the guest engaged with. Examples: ['desert_safari', 'dhow_cruise', 'luxury_hotel']. Pass an empty array if no interests detected."
      ),
  })
  .strict();

export type UpdateKioskViewInput = z.infer<typeof UpdateKioskViewSchema>;
export type LogKioskEventInput = z.infer<typeof LogKioskEventSchema>;
