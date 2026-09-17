/* Where the website's photos live.
   Photos are held in Supabase Storage, not in this repository, so staff can
   add them from the staff page and have them appear straight away — no
   redeploy, no GitHub. Nothing secret lives here: the bucket is public to
   read, and writes only happen inside the upload function, which checks the
   staff passcode server-side. */
window.WILLY_PHOTOS = {
  bucketUrl: 'https://wbduprgcuuxbgsjnixcf.supabase.co/storage/v1/object/public/willy-auto',
  uploadUrl: 'https://wbduprgcuuxbgsjnixcf.supabase.co/functions/v1/willy-auto-upload',
  url: function (path) { return this.bucketUrl + '/' + path; }
};

/* The workshop's location.
   `mapsUrl` is Willy Auto's own Google Maps link — it opens the exact place in
   Google Maps or the Maps app, so every "directions" link on the site uses it.

   `embedQuery` drives the embedded map: the workshop's coordinates in Banana
   Hill, Kiambu. Google's embed endpoint cannot take a maps.app.goo.gl short
   link, which is why the coordinates are here rather than the link. Clear this
   and the panel falls back to a clickable map card. */
window.WILLY_LOCATION = {
  mapsUrl: 'https://maps.app.goo.gl/1HLa4oh5gYuCqTV26',
  embedQuery: '-1.1830138,36.7633311',
  zoom: 17
};
