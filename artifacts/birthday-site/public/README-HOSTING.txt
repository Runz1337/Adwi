BIRTHDAY WEBSITE — STATIC BUILD
================================

This folder is a fully static build of the site. No Node.js server is required.
Just upload EVERYTHING in this folder to any static web host.

── OPTION 1: Netlify Drop (easiest) ──
1. Go to https://app.netlify.com/drop
2. Drag & drop this entire folder onto the page
3. Done — you get a live URL instantly

── OPTION 2: Vercel ──
1. Go to https://vercel.com/new
2. Or use: npx vercel deploy --prebuilt --prod  (from inside this folder)

── OPTION 3: GitHub Pages ──
1. Create a repo, push this folder's contents to the "gh-pages" branch
2. Enable Pages in repo settings (source: gh-pages branch)

── OPTION 4: Cloudflare Pages ──
1. Go to https://dash.cloudflare.com → Pages → Upload assets
2. Drag & drop this folder

── OPTION 5: Any web server (nginx / Apache / cPanel) ──
Copy the contents of this folder into your web root
(e.g. /var/www/html or public_html).

IMPORTANT NOTES
---------------
- index.html is the entry point. Keep the folder structure intact.
- The site is a single-page experience (100 to -25 scroll journey).
- Total size is ~67 MB (3D models + audio), first load may take a moment.
- Works on modern browsers; best experienced on desktop with a mouse/trackpad,
  and on mobile with touch.
