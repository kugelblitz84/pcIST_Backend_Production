# Heroku Configuration for Puppeteer/Chrome

## Required Buildpacks:
```
heroku buildpacks:clear
heroku buildpacks:add heroku/nodejs
heroku buildpacks:add https://github.com/heroku/heroku-buildpack-chrome-for-testing.git
```

## Environment Variables:
```
heroku config:set NODE_ENV=production
heroku config:set PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
heroku config:set PUPPETEER_EXECUTABLE_PATH=/app/.chrome-for-testing/chrome-linux64/chrome
```

## Key Changes Made:

### 1. Enhanced Puppeteer Launch Args
- Added `--disable-dev-shm-usage` for limited memory environments
- Added font rendering consistency flags
- Added Heroku-specific memory optimizations

### 2. Consistent Font Stack
- Changed from "Inter" to system fonts for better Heroku compatibility
- Added `text-rendering: optimizeLegibility`

### 3. Environment Detection
- Detects Heroku environment via `process.env.DYNO`
- Applies different timeouts and rendering options

### 4. Better Timing
- Longer timeouts for Heroku (30s vs 10s)
- Additional wait times for font/image loading
- Extended layout settling time

### 5. Improved Logo Processing
- Consistent Sharp image processing
- Better compression settings
- Transparent background handling

## Troubleshooting:

If PDFs still differ between local and Heroku:
1. Check Chrome version: `heroku run google-chrome --version`
2. Test font availability: `heroku run fc-list`
3. Monitor memory usage during PDF generation
4. Consider using a custom buildpack with specific Chrome version

## Testing:
Deploy and compare PDFs generated from:
- Direct download endpoint
- Email attachment
- Mobile device rendering
