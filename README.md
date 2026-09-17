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

## 1. Photos

Photos do **not** live in this repository. They live in a Supabase Storage bucket, so staff can add
them from the staff page and they appear on the site straight away -- no GitHub, no redeploy.

### How staff add a photo

1. Open **/staff.html** (linked as *Staff photo upload* in the footer) on a phone or tablet.
2. Enter the staff passcode once. The device remembers it.
3. Pick a photo for any slot. It goes live within about a minute.

There are 25 slots: three for the homepage slider, and a before/after pair for each of the 11
services. Each photo is cropped to that slot's shape (16:9 at 1600x900 for the slider, 4:3 at
1200x900 for the service panes), scaled down and compressed in the browser before upload, so a 6 MB
phone photo arrives as roughly 150 KB.

### Where it goes

| | |
|---|---|
| Bucket | `willy-auto` in the **Krypton** Supabase project |
| Slider | `hero/slide-1.jpg` ... `slide-3.jpg` |
| Services | `services/<service>-before.jpg` and `-after.jpg` |
| Upload endpoint | the `willy-auto-upload` edge function |

### How the site finds a photo

Each `<img>` tries three things in order, so nothing ever shows a broken image:

1. the bucket copy,
2. a file committed to `assets/img/...` at the same name (a manual backstop),
3. the styled placeholder naming the slot.

The slider builds itself from whatever loads: three photos gives three slides, one gives a still
image with no arrows, none shows a panel pointing staff at the uploader.

## 2. Changing the staff passcode

The passcode is never stored anywhere in this repository. Only its SHA-256 hash is kept, in the
`public.willy_auto_config` table of the Krypton project, which has row-level security on and no
policies -- so nothing but the edge function (running as the service role) can read it.

To change it, run this in the Krypton SQL editor with your own hash:

```sql
-- generate the hash first, e.g.:  echo -n 'NEW-PASSCODE' | sha256sum
update public.willy_auto_config
   set value = '<new sha256 hex>', updated_at = now()
 where key = 'staff_passcode_sha256';
```

The change takes effect within a minute (the function caches the hash briefly). Every device then
needs the new passcode; staff can clear the old one with **Lock this device** on the staff page.

A note on what the passcode protects: anyone holding it can replace the photos on the website. It
cannot read or touch anything else in the Krypton project -- the upload function only accepts paths
matching the slots above, and only writes to the `willy-auto` bucket.

## 3. The map

The workshop is at **Banana Hill, Kiambu County** — `-1.1830138, 36.7633311`.

Two separate things use it:

- **Every "directions" link** (the workshop card, the map panel, the button beneath it) opens Willy
  Auto's own Google Maps place: `https://maps.app.goo.gl/1HLa4oh5gYuCqTV26`
- **The embedded map** uses the coordinates, because Google's embed endpoint cannot accept a
  `maps.app.goo.gl` short link.

Both live in `assets/js/config.js`:

```js
window.WILLY_LOCATION = {
  mapsUrl: 'https://maps.app.goo.gl/1HLa4oh5gYuCqTV26',
  embedQuery: '-1.1830138,36.7633311',
  zoom: 17
};
```

Clearing `embedQuery` falls back to a clickable map card instead of an embed — useful if the
location ever moves and the new coordinates are not to hand yet.

## 4. The logo

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

## 5. Details to confirm before going live

Search `index.html` for these and replace with the real values:

| What | Currently | Where |
|---|---|---|
| Street address | `Banana Hill, Kiambu County` — no street or building name yet | Contact section + JSON-LD at the top of `index.html` |
| Embedded map | live, pinned to the Banana Hill coordinates | `embedQuery` in `assets/js/config.js` |
| Opening hours | Mon–Fri 8–6, Sat 8–5, Sun closed | Top bar, Contact section, footer, JSON-LD |
| Stats | 10+ years, 2,500+ cars, 4.9/5 | "Willy Auto at a glance" section |
| Reviews | three sample customer stories | Reviews section |
| Social links | `href="#"` | Footer `.socials` |
| Canonical URL / sitemap | `willy-auto-garage.onrender.com` | `<head>`, `robots.txt`, `sitemap.xml` |

The three sample reviews are placeholders written in the right shape — swap in real customer words
before launch.

## 6. Changing the phone number or email

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
index.html              the public site — one page, sectioned
staff.html              internal photo uploader (slider + before/after)
supabase/
  willy-auto-upload/    edge function source (deployed to the Krypton project)
404.html                not-found page
render.yaml             Render blueprint (static site, no build)
robots.txt / sitemap.xml
assets/
  css/styles.css        design tokens + all styling
  css/staff.css         staff page only
  js/main.js            menu, scroll effects, WhatsApp form handoff
  js/config.js          photo storage endpoints + the workshop location
  js/services.js        the service list, shared with the staff page
  js/main.js            also runs the homepage slider
  js/staff.js           passcode, photo resize, upload
  img/
    logo.svg            placeholder emblem on dark navy
    favicon.svg
    hero/               optional local copies of the slider photos
    services/           optional local copies of the before/after photos
scripts/
  recolor-logo.mjs      puts a logo's background on brand dark navy
```

## Brand

The page is white from top to bottom -- sections are separated by hairline rules rather than
coloured blocks. Blue carries the accents, near-black carries the type, and the only solid dark
element is the logo plate.

| Token | Value | Used for |
|---|---|---|
| White | `#ffffff` | Every section background |
| Ink | `#0b0e14` | Headings |
| Body | `#454d5c` | Body copy |
| Muted | `#6f7788` | Captions and meta |
| Hairline | `#e7e9ee` | Section rules, card borders |
| Brand blue | `#1552d0` | Buttons, links, icons, accents |
| Blue tint | `#eff4fd` | Icon chips, the quote band |
| Navy | `#0b1a33` | Logo plate, step numbers |
| Green | `#12a150` | WhatsApp actions only |

Type is **Inter** throughout -- a neo-grotesque, loaded as a variable font. Body is 16px, with
15px for secondary copy and 13px for meta. Headings top out at 42px on desktop.
