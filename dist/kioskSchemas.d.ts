import { z } from "zod";
export declare const UpdateKioskViewSchema: z.ZodObject<{
    viewType: z.ZodEnum<["home", "tour_details", "booking_qr"]>;
    tourID: z.ZodString;
    vibe: z.ZodEnum<["luxury", "adventure"]>;
}, "strip", z.ZodTypeAny, {
    viewType: "home" | "tour_details" | "booking_qr";
    tourID: string;
    vibe: "luxury" | "adventure";
}, {
    viewType: "home" | "tour_details" | "booking_qr";
    tourID: string;
    vibe: "luxury" | "adventure";
}>;
export declare const LogKioskEventSchema: z.ZodObject<{
    eventType: z.ZodString;
    duration: z.ZodNumber;
    guestInterests: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    eventType: string;
    duration: number;
    guestInterests: string[];
}, {
    eventType: string;
    duration: number;
    guestInterests: string[];
}>;
export type UpdateKioskViewInput = z.infer<typeof UpdateKioskViewSchema>;
export type LogKioskEventInput = z.infer<typeof LogKioskEventSchema>;
//# sourceMappingURL=kioskSchemas.d.ts.map