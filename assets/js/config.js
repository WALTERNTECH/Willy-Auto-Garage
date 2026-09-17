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
