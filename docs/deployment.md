# Deployment

This app is fully static (no backend — graph sharing is encoded into the URL
itself), so it deploys to any static host. `npm run build` produces a
`dist/` folder that is the entire deployable output.

## Vercel

1. Push the repository to GitHub (or GitLab/Bitbucket).
2. In the Vercel dashboard, **Add New → Project**, and import the repo.
   Vercel auto-detects Vite; the defaults are already correct:
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
3. Deploy. Every subsequent push to the connected branch redeploys
   automatically.

No `vercel.json` is required, but one is included for explicitness:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist"
}
```

## Netlify

1. Push the repository to GitHub (or GitLab/Bitbucket).
2. In the Netlify dashboard, **Add new site → Import an existing project**,
   and pick the repo. The included `netlify.toml` sets the build command and
   publish directory automatically:

```toml
[build]
  command = "npm run build"
  publish = "dist"
```

3. Deploy. Pushes to the connected branch redeploy automatically.

## GitHub Pages

GitHub Pages serves from a subpath (`https://<user>.github.io/<repo>/`)
unless you're using a custom domain, so Vite needs to know that subpath at
build time.

1. **If deploying to a custom domain** (or to `<user>.github.io` as the repo
   itself), skip to step 3 — no path change is needed.
2. **If deploying to `<user>.github.io/<repo>/`**, add a `base` to
   `vite.config.ts` before the `plugins` line:

   ```ts
   export default defineConfig({
     base: '/<repo>/', // replace <repo> with the actual repository name
     plugins: [react()],
     // ...
   })
   ```

3. In the repository's **Settings → Pages**, set **Source** to
   **GitHub Actions**.
4. Add the included workflow at `.github/workflows/deploy.yml` (already in
   this repo) and push to `main`. It builds the project and publishes
   `dist/` to Pages on every push.

The deploy status and URL appear under the repo's **Actions** tab and in
**Settings → Pages** once the first run completes.
