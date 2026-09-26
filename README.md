# imagebot
art gallery/css sandbox

create a subfolder of /public/ named /img/ and populate it with png or jpg files, server will build and serve webpage of those images.

sub-folers of /img/ will generate elements in the header using the folder names with routes to pages populated with the contents of said folder.

takes a directory listing of /public/img, creates thumbnail files, and uses the resulting array of filenames to build a web page of img tags pointing to the files in the /public/img directory.
On hover, the SRC property for the IMG tag is set to the original, high quality image. Each image is passed to a variety of local BLIP transformers, after which, a sub-agent evaluates the captions against the image and selects the best one. 

Instructions:
Clone repo
Browse to root. Run: npm install
cd public
mkdir img
Place images in the ./public/img/ directory
Run: npm start
browse to: localhost on the port specified 

Environment Variables:
- `VISITORS_LOG` — filename for visitor log output (default: `visitors.log`)
- `SKIP_IPS` — comma-separated list of IP addresses to exclude from visitor logging

Create a local `.env` file from `.env.example` before starting the server.

## HTTPS and Let’s Encrypt

Production startup now requires a Let’s Encrypt certificate and listens on HTTPS port 443. The app also listens on HTTP port 80 for HTTP-01 challenge files and redirects all other requests to HTTPS. Set `PUBLIC_HOSTNAME` to the public DNS name covered by the certificate. `LETSENCRYPT_LIVE_DIR` defaults to `/etc/letsencrypt/live/<PUBLIC_HOSTNAME>`; alternatively, set `TLS_KEY_PATH` and `TLS_CERT_PATH` to the `privkey.pem` and `fullchain.pem` files. The app reads certificates on startup, so restart it after renewal.

Example Linux setup with Certbot webroot validation:

1. Point the domain's DNS A/AAAA records at the server. Permit inbound TCP ports 80 and 443 in the host firewall and any cloud firewall.
2. Install Certbot using the operating system's package instructions. Create the configured ACME webroot, for example `sudo mkdir -p /var/www/imagebot-acme/.well-known/acme-challenge`, and set `ACME_WEBROOT=/var/www/imagebot-acme` in `.env`.
3. Start the app before the first certificate exists. It will log that TLS is not installed yet, serve HTTP-01 challenge files on port 80, and temporarily return 503 for other HTTP requests.
4. With the app's challenge listener reachable on port 80, issue the certificate: `sudo certbot certonly --webroot -w /var/www/imagebot-acme -d christopherdonner.ca` (replace the domain as appropriate). Then restart the app to load the new certificate and bring up HTTPS.
5. Run the Node service with read access to the certificate files and permission to bind ports 80 and 443. Prefer a systemd service with narrowly scoped `CAP_NET_BIND_SERVICE` or a reverse proxy/service manager rather than running the app as root. Ensure the service starts after certificates exist.
6. Automate renewal with Certbot's systemd timer, then restart the Node service after successful renewal. For example, configure a deploy hook to run `systemctl restart imagebot` (replace with the actual service name), and verify renewal with `sudo certbot renew --dry-run`.

For local development without certificates, set `DEV_HTTP=true` and `NODE_ENV` to anything other than `production`; the app then serves plain HTTP on `PORT` and does not start the redirect/ACME listener. Never enable this mode in production. In production, leave `DEV_HTTP=false`, use `PORT=443`, and set `HTTP_PORT=80`.

## Orders and the drawing shop

The viewer lets customers add a selected drawing as a print or T-shirt. Prints are available in 4 x 6 and 8 x 10 inch sizes; T-shirts are available in S, M, L, XL, and XXL. The cart stays in the customer's browser until checkout. Orders and line items are then saved to SQLite in `data/orders.sqlite` (override with `ORDERS_DB_PATH`). Keep backups of this file; it contains customer contact and shipping details. The database directory is excluded from Git.

Prices are configured in cents in `.env`:

- `PRINT_4X6_PRICE_CENTS` — default 1500 ($15.00 CAD)
- `PRINT_8X10_PRICE_CENTS` — default 2500 ($25.00 CAD)
- `TSHIRT_PRICE_CENTS` — default 3500 ($35.00 CAD)
- `PRINT_SHIPPING_CENTS` — shipping per print, default 100 ($1.00 CAD each)
- `TSHIRT_SHIPPING_CENTS` — shipping per T-shirt, default 1000 ($10.00 CAD each)
- `PAYMENT_EMAIL` — address where customers send their e-transfer; the order reference is included in the instructions

Checkout currently accepts Canadian shipping addresses and e-transfer only. Shipping is calculated per item quantity, so a cart with two prints and three T-shirts has a $32.00 CAD shipping charge at the default rates. Update prices and shipping before accepting real orders.

Set the SMTP values in `.env` to enable receipts and the optional store notification:

- `SMTP_HOST`, `SMTP_PORT`, and `SMTP_SECURE` — mail server connection (`SMTP_SECURE=true` for implicit TLS, commonly port 465; use `false` for STARTTLS, commonly port 587)
- `SMTP_USER` and `SMTP_PASS` — optional server credentials, as required by your provider
- `SMTP_FROM` — sender address (defaults to `SMTP_USER`)
- `STORE_ORDER_EMAIL` — optional address to receive a copy of new orders

Orders are saved even if SMTP is unavailable; the confirmation page will say when a customer receipt could not be delivered. Run `npm test` to check the SQLite order store.

### Admin order management

Set non-empty `ADMIN_USERNAME` and `ADMIN_PASSWORD` values in `.env`, restart the app, and visit `/admin/orders` over HTTPS. The browser will prompt for HTTP Basic credentials. Admin forms use short-lived, one-use request tokens; keep the `.env` file private and use a unique, strong password.

For each active order, choose payment status (`Pending` or `Paid`) and fulfillment status (`Pending` or `Shipped`), then select **Save status**. Orders marked shipped leave the active-orders list. Select **Delete order** to permanently remove the order and its line items from SQLite; the browser asks for confirmation first. Status changes and deletions are appended to the JSONL order log as audit events. The admin page does not currently provide a shipped-order history or a way to restore a deleted order.
