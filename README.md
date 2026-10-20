# eswatini
eswatinitravel

## My Design storefront
Run `npm install && npm start` (http://localhost:3000), `npm test` for tests.
Payments (EasyPaisa/JazzCash), couriers, image recognition and social posting are adapters in `src/services/` running in sandbox mode until real credentials are wired in.
The hero is a canvas-rendered rotating 3D wireframe; Three.js can replace it.

Open `/admin.html` for the camera barcode scanner (needs HTTPS or localhost and a browser with BarcodeDetector, e.g. Chrome/Android).

Admin endpoints (`/api/products`, `/api/inventory/*`) require `Authorization: Bearer $ADMIN_TOKEN`; set `ADMIN_TOKEN` before starting.

Email: set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` (and `SMTP_SECURE=true` for port 465) to send order confirmations. Without `SMTP_HOST`, emails are only stored in the `emails` table.
