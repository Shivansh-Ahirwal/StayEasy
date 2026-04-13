# Yoyo Stays

Solo-dev hotel booking stack: **Django REST** + **React (Vite)**, aligned with a **$0 hosting** path.

## Free-tier mapping (production-shaped)

| Piece | Free option | Notes |
| --- | --- | --- |
| Frontend | [Vercel](https://vercel.com) | Set `VITE_API_URL` to your API origin. |
| API | [Render](https://render.com) / [Fly.io](https://fly.io) / [Railway](https://railway.app) | Free tiers often sleep or cap hours; fine for demos. |
| Database | [Neon](https://neon.tech) or [Supabase](https://supabase.com) | **PostgreSQL** (not MySQL) — same Django models, `DATABASE_URL`. |
| Redis | [Upstash](https://upstash.com) | Cache + future Celery broker; set `REDIS_URL`. |
| Object storage | [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/) or AWS S3 free tier | Wire when you add hotel images. |
| Payments | [Razorpay](https://razorpay.com) test mode | No charge in test; booking stays **pending** until verify. |
| Logs / analytics | Skip Mongo at first | Add when traffic justifies it. |

Local development uses **SQLite** if `DATABASE_URL` is unset, or **Docker Compose** for Postgres + Redis + API.

## Quick start (no Docker)

```bash
cd backend
python3 -m venv ../.venv
../.venv/bin/pip install -r requirements.txt
cp .env.example .env # optional
../.venv/bin/python manage.py migrate
../.venv/bin/python manage.py runserver
```

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies `/api` to `http://127.0.0.1:8000`.

Create **countries** and **cities** under **Locations** in Django admin (India + major cities are seeded by migration), then create a **manager** user (**role** = `manager`). Add hotels with a **city** and optional **address line**; list/detail APIs still expose a combined **`location`** string for display.

Bulk load from **`oyo_hotels.csv`** (repo root):

```bash
cd backend
../.venv/bin/python manage.py import_oyo_hotels
# or: ../.venv/bin/python manage.py import_oyo_hotels /path/to/oyo_hotels.csv
```

This creates **India** if needed, **cities** from the file (e.g. Delhi, Bengaluru), **1126+ hotels** with `oyo_id`, address, rating, coordinates, and a default **Standard** room. Duplicate `oyo_id` rows in the CSV are skipped. A manager user **`csv-import@yoyo.local`** (no password) owns imported hotels unless you reassign them in admin.

## Docker Compose

```bash
docker compose up --build
```

- **API:** `http://localhost:8000/api/`
- **Frontend (Vite):** `http://localhost:5173` — proxies `/api` to the `api` container.

The first build runs `npm install` in the image; a named volume keeps `node_modules` so bind-mounting `./frontend` does not wipe dependencies. After changing `package.json`, rebuild: `docker compose build frontend`.

## API overview (Phase 1)

- `POST /api/auth/register/` — email, password, first_name, last_name
- `POST /api/auth/login/` — SimpleJWT (`email`, `password`)
- `GET /api/auth/me/` — current user (Bearer token)
- `GET /api/countries/`, `GET /api/cities/?country=<id>&q=` — geography (public)
- `GET/POST /api/hotels/` — list public; **create** (manager): `name`, `city_id`, optional `address_line`, `description`; responses include nested `city` and read-only `location`
- `GET/POST /api/rooms/?hotel_id=` — list public; create requires manager
- `GET/POST /api/bookings/` — authenticated; creates **pending** booking until Razorpay succeeds
- `POST /api/payments/razorpay/create-order/` — body `{ "booking_id": <int> }`; returns `key_id`, `order_id`, `amount` (paise) for Checkout
- `POST /api/payments/razorpay/verify/` — body `{ booking_id, razorpay_order_id, razorpay_payment_id, razorpay_signature }` from Checkout handler; confirms booking

**Razorpay (free test mode):** In [Dashboard](https://dashboard.razorpay.com/) → API Keys (Test), set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` on the API (same pair — mixing test key_id with live secret breaks verification). Use **test** keys only (`rzp_test_…`). After entering a [test card](https://razorpay.com/docs/payments/payments/test-card-upi-details/) (e.g. Visa `4111 1111 1111 1111` or Mastercard `5267 3181 8797 5449`, any future expiry, any CVV), Razorpay shows a **mock bank page** — tap **Success** to finish (tap **Failure** to simulate a decline). For UPI in test mode, use `success@razorpay`.

## Roadmap

Phase 3: Celery email, Redis caching, reviews polish.
