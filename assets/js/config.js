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

   `embedQuery` drives the embedded map. Google's embed endpoint cannot take a
   maps.app.goo.gl short link, so it needs coordinates ("-1.2345,36.7890") or a
   full street address. Leave it empty and the panel shows a clickable map card
   instead of pinning the wrong place. To fill it in: open the workshop in
   Google Maps on a computer and copy the numbers after the @ in the address
   bar, e.g. .../@-1.2345,36.789,17z  ->  embedQuery: '-1.2345,36.789' */
window.WILLY_LOCATION = {
  mapsUrl: 'https://maps.app.goo.gl/1HLa4oh5gYuCqTV26',
  embedQuery: '',
  zoom: 17
};
