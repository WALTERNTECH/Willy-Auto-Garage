# Willy Auto Perfection Centre

Marketing website for **Willy Auto Perfection Centre** — accident repair & restoration, spray
painting and full mechanical service in Nairobi, Kenya.

Built as a plain static site: HTML, CSS and vanilla JavaScript. No build step, no framework, no
dependencies. Open `index.html` and it works.

**Every call to action lands in WhatsApp** on `+254 710 817390` with the customer's details already
written into the message, so an enquiry never sits unread in an inbox.

---

## Quick start

```bash
# preview locally on http://localhost:8000
python3 -m http.server 8000
```

---

## 1. Adding the real photos

The before/after panes under each service show a styled placeholder with the exact filename it is
waiting for. **Drop a photo in at that path and it appears automatically** — no code changes needed.

Save them as `.jpg`, landscape, ideally **1200 × 900** (4:3). Keep each file under ~300 KB so the
page stays fast; shoot the "before" and "after" from roughly the same angle and distance so the split
reads properly.

| Service | Before photo | After photo |
|---|---|---|
| Spray Painting | `assets/img/services/spray-painting-before.jpg` | `assets/img/services/spray-painting-after.jpg` |
| Car Buffing & Polishing | `assets/img/services/car-buffing-before.jpg` | `assets/img/services/car-buffing-after.jpg` |
| Car Accessories | `assets/img/services/car-accessories-before.jpg` | `assets/img/services/car-accessories-after.jpg` |
| Routine Maintenance | `assets/img/services/routine-maintenance-before.jpg` | `assets/img/services/routine-maintenance-after.jpg` |
| Brake Services | `assets/img/services/brake-services-before.jpg` | `assets/img/services/brake-services-after.jpg` |
| Air Conditioning & Heating | `assets/img/services/air-conditioning-before.jpg` | `assets/img/services/air-conditioning-after.jpg` |
| Suspension & Steering | `assets/img/services/suspension-steering-before.jpg` | `assets/img/services/suspension-steering-after.jpg` |
| Pre-Purchase Inspections | `assets/img/services/pre-purchase-inspection-before.jpg` | `assets/img/services/pre-purchase-inspection-after.jpg` |
| Wheel Alignment | `assets/img/services/wheel-alignment-before.jpg` | `assets/img/services/wheel-alignment-after.jpg` |
| Diagnostic Services | `assets/img/services/diagnostics-before.jpg` | `assets/img/services/diagnostics-after.jpg` |
| Arc Welding & Fabrication | `assets/img/services/arc-welding-before.jpg` | `assets/img/services/arc-welding-after.jpg` |

## 2. The logo

The site currently shows a placeholder emblem (`assets/img/logo.svg`) drawn on the brand dark navy.

To use the real logo, save it as **`assets/img/logo.png`** — the header and footer pick it up
automatically and fall back to the placeholder if the file is missing.

If your logo file has the light-blue background and you want it dark navy, run:

```bash
node scripts/recolor-logo.mjs willy-logo.png assets/img/logo.png
```

That flood-fills the background from the edges inwards to `#071026` and leaves the emblem itself
untouched. Pure Node, no `npm install`. (A transparent-background PNG also works — it sits on a dark
navy plate in the header either way.)

## 3. Details to confirm before going live

Search `index.html` for these and replace with the real values:

| What | Currently | Where |
|---|---|---|
| Street address | `Nairobi, Kenya` | Contact section + JSON-LD at the top of `index.html` |
| Google Map pin | a general Nairobi map | the `<iframe>` and the "Get directions" link in the Contact section |
| Opening hours | Mon–Fri 8–6, Sat 8–5, Sun closed | Top bar, Contact section, footer, JSON-LD |
| Stats | 10+ years, 2,500+ cars, 4.9/5 | "Willy Auto at a glance" section |
| Reviews | three sample customer stories | Reviews section |
| Social links | `href="#"` | Footer `.socials` |
| Canonical URL / sitemap | `willy-auto-garage.onrender.com` | `<head>`, `robots.txt`, `sitemap.xml` |

The three sample reviews are placeholders written in the right shape — swap in real customer words
before launch.

## 4. Changing the phone number or email

They appear in two places:

- `index.html` — `tel:` links, `mailto:` links and `wa.me` links
- `assets/js/main.js` — the `WHATSAPP_NUMBER` and `EMAIL` constants at the top

The WhatsApp number is in international format with no `+` or spaces: `254710817390`.

---

## Deploying on Render

The repo includes `render.yaml`, so Render can pick it up as a blueprint. Manual setup is just as
quick:

- **Type:** Static Site
- **Build command:** *(leave empty)*
- **Publish directory:** `.`
- **Branch:** `main`

Every push to `main` redeploys automatically.

### Adding a custom domain

Render Dashboard → the service → **Settings → Custom Domains**. Add `willyautoperfection.co.ke`
(or whichever domain), then create the CNAME record Render shows you at your registrar. TLS is
issued automatically.

---

## Project layout

```
index.html              the whole site — one page, sectioned
404.html                not-found page
render.yaml             Render blueprint (static site, no build)
robots.txt / sitemap.xml
assets/
  css/styles.css        design tokens + all styling
  js/main.js            menu, scroll effects, WhatsApp form handoff
  img/
    logo.svg            placeholder emblem on dark navy
    favicon.svg
    services/           before/after photos go here
scripts/
  recolor-logo.mjs      puts a logo's background on brand dark navy
```

## Brand

| Token | Value | Used for |
|---|---|---|
| Dark navy | `#071026` | Header plate, hero, dark sections, footer |
| Deep navy | `#0d1f45` | Gradients, icon fills |
| Brand blue | `#1259d6` | Buttons, links, accents |
| Light blue | `#57a2ff` | Highlights on dark backgrounds |
| White | `#ffffff` | Page background |
| Ink | `#0a0f1c` | Headings and body text |

Headings: **Archivo**. Body: **Inter**.
