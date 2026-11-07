# Pockit

Save every good link, article, video, tweet, repo, AI prompt, snippet, and note in one place. Find any of it again with full-text search. It runs free on Cloudflare Workers + D1, installs on your phone as a PWA, and shows up in the Android share sheet.

## Develop

```sh
npm install
echo 'POCKIT_PASSWORD=dev' > .dev.vars
npm run db:migrate:local
npm run dev
```

## Deploy

```sh
npx wrangler login
npx wrangler d1 create pockit        # paste the printed database_id into wrangler.jsonc
npm run db:migrate:remote
npx wrangler secret put POCKIT_PASSWORD
npm run deploy
```

Open the deployed URL on your phone and choose "Install app" (Chrome) or "Add to Home Screen". After that, share from any app to Pockit.

To save the current tab on desktop, add this bookmarklet:

```js
javascript:location.href='https://YOUR-POCKIT.workers.dev/share?url='+encodeURIComponent(location.href)
```
