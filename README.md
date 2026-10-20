# eswatini
eswatinitravel

## My Design storefront
Run `npm install && npm start` (http://localhost:3000), `npm test` for tests.
Payments (EasyPaisa/JazzCash), couriers, image recognition and social posting are adapters in `src/services/` running in sandbox mode until real credentials are wired in.
The hero is a canvas-rendered rotating 3D wireframe; Three.js can replace it.

Open `/admin.html` for the camera barcode scanner (needs HTTPS or localhost and a browser with BarcodeDetector, e.g. Chrome/Android).

Admin endpoints (`/api/products`, `/api/inventory/*`) require `Authorization: Bearer $ADMIN_TOKEN`; set `ADMIN_TOKEN` before starting.

Email: set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` (and `SMTP_SECURE=true` for port 465) to send order confirmations. Without `SMTP_HOST`, emails are only stored in the `emails` table.

Themes: `GET /api/themes` lists the 10 themes and the store default; `PUT /api/themes/default` (admin) with `{"id":"light-sky"}` changes the default. A visitor's own choice is kept in their browser and overrides it.

Payments: each wallet has a merchant ID, account title and mode, set with `PUT /api/payments/config/:method` (admin; `easypaisa` or `jazzcash`). `GET /api/payments/methods` lists them publicly.
- `manual` (default): the order is held as `awaiting_payment` and the customer gets instructions to send money to your account. An admin calls `POST /api/orders/:id/confirm-payment` to book the courier and email tracking.
- `api`: the gateway adapter charges immediately (sandbox until real API calls are written).
