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

## Saving from your devices

- **iPhone.** Open the deployed URL in Safari, then Share > Add to Home Screen. iOS doesn't let web apps join the share sheet, so add the "Save to Pockit" Shortcut instead. The app's Settings sheet lists the steps and copies the URL and token for you.
- **Laptop.** Drag the bookmarklet from Settings to your bookmarks bar. Press `/` to search, `N` to add, `Ctrl+Enter` to save text.
- **Android.** Install the app from Chrome. Pockit then appears in the share sheet.

The Shortcut authenticates with `Authorization: Bearer <token>`. The token is derived from `POCKIT_PASSWORD`, so changing the password revokes it.
