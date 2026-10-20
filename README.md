# eswatini
eswatinitravel

## My Design storefront
Run `npm install && npm start` (http://localhost:3000), `npm test` for tests.
Payments (EasyPaisa/JazzCash), couriers, image recognition and social posting are adapters in `src/services/` running in sandbox mode until real credentials are wired in.
The hero is a canvas-rendered rotating 3D wireframe; Three.js can replace it.

Open `/admin.html` for the camera barcode scanner (needs HTTPS or localhost and a browser with BarcodeDetector, e.g. Chrome/Android).

Admin endpoints (`/api/products`, `/api/inventory/*`) require `Authorization: Bearer $ADMIN_TOKEN`; set `ADMIN_TOKEN` before starting.
