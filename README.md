# Kiosk Bridge v2.0.1 — Multimodal Digital Concierge

**Travel Expert™ | The AI Concierge**

Voice-driven AI concierge kiosk for Dubai hospitality. Vapi handles voice. This bridge routes visual commands to a React frontend via Socket.io.

## Architecture

```
Guest speaks → Vapi (voice + LLM) → POST /vapi/function-call → relay.js
                                                                    │
                                                          Socket.io │
                                                                    ▼
                                                          Kiosk Browser
                                                    (KioskUIController.jsx)
```

## What It Does

| Tool | Socket Event | Frontend Result |
|------|-------------|-----------------|
| `show_attraction` | `SHOW_ATTRACTION` | Animated card with image/video/facts + pricing |
| `show_menu` | `SHOW_MENU` | Browsable grid (8 tours, 6 restaurants, 6 activities, 5 transfers) |
| `set_mood` | `SET_MOOD` | 600ms CSS theme transition across 5 mood palettes |
| `avatar_state` | `AVATAR_STATE` | Avatar expression + gesture update |
| `send_booking_to_human` | `BOOKING_CONFIRMED` | Telegram/Email/WhatsApp notifications |

## Files

| File | Purpose | Deploy To |
|------|---------|-----------|
| `relay.js` | Bridge server — routes Vapi tools to kiosk | Render |
| `KioskUIController.jsx` | React UI layer — cards, grids, mood sync | GitHub Pages |
| `kiosk-multimodal.css` | Mood-driven styles, animations, layout | GitHub Pages |
| `vapi-tool-schemas.json` | Tool definitions — paste into Vapi dashboard | Vapi |
| `package.json` | Node.js dependencies | Render |
| `INTEGRATION.md` | Step-by-step integration guide | Reference |

## Deploy

```bash
# 1. Push to Render (auto-deploys from main)
git add -A
git commit -m "v2.0.1-finalized: multimodal concierge"
git push origin main

# 2. Verify
curl https://kiosk-bridge.onrender.com/health
# → { "version": "2.0.1-finalized", "registries": { "attractions": 5, "menu_types": 4, "moods": 5 } }

# 3. Add tool schemas to Vapi Dashboard
# Assistant → Functions → paste each tool from vapi-tool-schemas.json
# Server URL: https://kiosk-bridge.onrender.com/vapi/function-call
```

## Mood Themes

| Mood | Primary | Trigger |
|------|---------|---------|
| Gold | `#C5A355` | Luxury, default |
| Blue | `#4FC3F7` | Ocean, spa, calm |
| Amber | `#FFB74D` | Desert, warmth |
| Emerald | `#66BB6A` | Nature, parks |
| Coral | `#FF7043` | Beach, sunset |

## Safety Features

- **Mood transition guard**: 600ms primary + 1200ms hard kill prevents stuck CSS overlay
- **Connection drop recovery**: Clears all timers, resets to IDLE in 10s, re-syncs on reconnect
- **Asset preloader**: 5 WebP images cached on mount, 5 MP4 videos preloaded with `fetchpriority="low"`
- **Auto-reset**: Cards dismiss after 45s (attractions) or 60s (menus) of inactivity
- **Category sanitization**: Empty strings, whitespace, and case mismatches handled server-side

---

*Travel Expert™ | Luxury Travel · Storytelling · AI-Optimized Experiences™*
