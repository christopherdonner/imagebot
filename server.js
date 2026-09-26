require('dotenv').config();

const express = require("express"),
  app = express(),
  exphbs = require("express-handlebars"),
  resizeImg = require('resize-img'),
  { createOrderStore } = require('./orderStore'),
  { appendOrderLog, appendOrderStatusChange, appendOrderDeleted } = require('./orderLogger'),
  { sendOrderEmails } = require('./orderMailer'),
  http = require('http'),
  https = require('https'),
  fs = require('fs'),
  path = require('path'),
  tqdm = require('tqdm'),
  util = require('util'),
  exec = util.promisify(require('child_process').exec),
  crypto = require('crypto'),
  PORT = Number(process.env.PORT || 443),
  HTTP_PORT = Number(process.env.HTTP_PORT || 80),
  PUBLIC_HOSTNAME = process.env.PUBLIC_HOSTNAME || 'christopherdonner.ca',
  LETSENCRYPT_LIVE_DIR = process.env.LETSENCRYPT_LIVE_DIR || path.join('/etc/letsencrypt/live', PUBLIC_HOSTNAME),
  TLS_KEY_PATH = process.env.TLS_KEY_PATH || path.join(LETSENCRYPT_LIVE_DIR, 'privkey.pem'),
  TLS_CERT_PATH = process.env.TLS_CERT_PATH || path.join(LETSENCRYPT_LIVE_DIR, 'fullchain.pem'),
  ACME_WEBROOT = path.resolve(process.env.ACME_WEBROOT || path.join(__dirname, 'acme-webroot')),
  DEV_HTTP = process.env.DEV_HTTP === 'true';

const { initializeVisitorLog, makeVisitorLogEntry, appendVisitorLog } = require('./visitorLogger');
const { calculateShippingCents } = require('./orderPricing');
const adminCsrfTokens = new Map();

let id = 0,
  caption = "",
  directoryList = [],
  imagesArray = [],
  directoryListSimple = [],
  assetPath = "./public/img/",
  publicDirectory = path.join(__dirname, 'public'),
  orderStore = createOrderStore(),
  commercePrices = {
    print4x6: priceFromEnvironment('PRINT_4X6_PRICE_CENTS', 1500),
    print8x10: priceFromEnvironment('PRINT_8X10_PRICE_CENTS', 2500),
    tshirt: priceFromEnvironment('TSHIRT_PRICE_CENTS', 3500),
    printShipping: priceFromEnvironment('PRINT_SHIPPING_CENTS', 100),
    tshirtShipping: priceFromEnvironment('TSHIRT_SHIPPING_CENTS', 1000)
  };

// Sets up the Express app to handle data parsing
app.use(express.urlencoded({ extended: true, limit: '32kb' }));
app.use(express.json({ limit: '32kb' }));
if (!DEV_HTTP) {
  app.use((req, res, next) => {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    next();
  });
}

// set public directory for assetts
app.use(express.static('public'));

app.engine("handlebars", exphbs({ defaultLayout: "main", partialsDir: __dirname + "/views/" }));
app.set("view engine", "handlebars");
app.locals.commerce = { ...commercePrices, paymentEmail: process.env.PAYMENT_EMAIL || '' };

function priceFromEnvironment(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

function listArtworkFiles(directory = path.join(publicDirectory, 'img'), relativeDirectory = 'img') {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return listArtworkFiles(absolutePath, relativePath);
    if (entry.isFile() && /\.(png|jpe?g|webp|gif)$/i.test(entry.name) && !entry.name.endsWith('.thumb.png')) {
      return [relativePath];
    }
    return [];
  });
}

function artworkUrl(relativePath) {
  return `/${relativePath.split('/').map(encodeURIComponent).join('/')}`;
}

function getArtworkCatalog() {
  return listArtworkFiles().sort().map((artworkPath) => {
    const thumbnailPath = `${path.join(publicDirectory, artworkPath)}.thumb.png`;
    return {
      artworkPath,
      name: path.basename(artworkPath).replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '),
      image: artworkUrl(artworkPath),
      thumb: fs.existsSync(thumbnailPath) ? artworkUrl(`${artworkPath}.thumb.png`) : artworkUrl(artworkPath)
    };
  });
}

function formatCurrency(cents) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100);
}

function adminCredentialsMatch(username, password) {
  const expectedUsername = process.env.ADMIN_USERNAME || '';
  const expectedPassword = process.env.ADMIN_PASSWORD || '';
  const hash = (value) => crypto.createHash('sha256').update(value).digest();
  const usernameMatches = crypto.timingSafeEqual(hash(username), hash(expectedUsername));
  const passwordMatches = crypto.timingSafeEqual(hash(password), hash(expectedPassword));
  return Boolean(expectedUsername && expectedPassword && usernameMatches && passwordMatches);
}

function requireAdmin(req, res, next) {
  const localAddresses = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
  if (!req.secure && !(DEV_HTTP && localAddresses.includes(req.socket.remoteAddress))) {
    return res.status(403).send('Admin access requires HTTPS.');
  }

  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).send('Admin access is not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD.');
  }

  const authorization = req.get('authorization') || '';
  const encodedCredentials = authorization.match(/^Basic\s+([A-Za-z0-9+/]+=*)$/i)?.[1];
  if (encodedCredentials) {
    const decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString('utf8');
    const separator = decodedCredentials.indexOf(':');
    if (separator >= 0 && adminCredentialsMatch(decodedCredentials.slice(0, separator), decodedCredentials.slice(separator + 1))) {
      return next();
    }
  }

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('WWW-Authenticate', 'Basic realm="Imagebot order admin", charset="UTF-8"');
  return res.status(401).send('Admin credentials required.');
}

function createAdminCsrfToken() {
  const now = Date.now();
  for (const [token, expiresAt] of adminCsrfTokens) {
    if (expiresAt <= now) adminCsrfTokens.delete(token);
  }
  const token = crypto.randomBytes(32).toString('hex');
  adminCsrfTokens.set(token, now + 15 * 60 * 1000);
  return token;
}

function requireAdminCsrf(req, res, next) {
  const token = String(req.body.adminCsrfToken || '');
  const expiresAt = adminCsrfTokens.get(token);
  if (!expiresAt || expiresAt <= Date.now()) {
    adminCsrfTokens.delete(token);
    return res.status(403).send('This admin form has expired. Return to the order list and try again.');
  }
  adminCsrfTokens.delete(token);
  return next();
}

initializeVisitorLog();

async function blip(file) {
  const { stdout, stderr } = await exec(`py blip.py ./public/img/"${file}"`);
  return stdout;
}

function deleteOldThumbnails(directory) {
  const files = fs.readdirSync(directory);
  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.lstatSync(fullPath);

    if (stat.isDirectory()) {
      deleteOldThumbnails(fullPath);
    } else if (file.endsWith('.thumb.png')) {
      try {
        fs.unlinkSync(fullPath);
      } catch (error) {
        console.warn(`Could not remove old thumbnail ${fullPath}:`, error.message);
      }
    }
  }
}

deleteOldThumbnails('./public/img/');

async function buildGallery() {
  return new Promise((resolve, reject) => {
    fs.readdir('./public/img/', async (err, files) => {
      if (err) {
        console.error('Error reading gallery directory:', err);
        reject(err);
        return;
      }

      console.log("building home page gallery...");

      for (let file of tqdm(files)) {
        let isDir = fs.existsSync(`${assetPath}${file}`) && fs.lstatSync(`${assetPath}${file}`).isDirectory();
        if (isDir) {
          directoryList.push(`${assetPath}${file}`);
          directoryListSimple.push(file);
        }
        else if (!file.includes('thumb.png')) {
          try {
            const image = await resizeImg(fs.readFileSync(`${assetPath}${file}`), {
              width: 256,
              height: 256
            });

            // Call blip for auto-captioning
            const caption = await blip(file);

            imagesArray.push({
              name: file,
              image: `img/${file}`,
              thumb: `img/${file}.thumb.png`,
              description: caption.trim(),
              id: id
            });
            id++;

            fs.writeFileSync(`./public/img/${file}.thumb.png`, image);
          } catch (error) {
            console.error(`Error processing file ${file}:`, error.message);
          }
        }
      }

      if (directoryList.length > 0) {
        console.log(`building ${directoryList.length} sub-galleries...`);
        for (let dir of directoryList) {
          let dirImagesArray = [];
          app.get(`/${directoryListSimple[directoryList.indexOf(dir)]}`, (req, res) => {
            res.render("index", { directoryListSimple: directoryListSimple, images: dirImagesArray });
          });

          let dirFiles = fs.readdirSync(dir);
          for (let file of tqdm(dirFiles)) {
            if (!file.includes('thumb.png')) {
              try {
                const image = await resizeImg(fs.readFileSync(`${dir}/${file}`), {
                  width: 128,
                  height: 128
                });

                // Call blip for auto-captioning
                const caption = await blip(`${directoryListSimple[directoryList.indexOf(dir)]}/${file}`);

                dirImagesArray.unshift({
                  name: file.split("_")[0],
                  image: `img/${directoryListSimple[directoryList.indexOf(dir)]}/${file}`,
                  thumb: `img/${directoryListSimple[directoryList.indexOf(dir)]}/${file}.thumb.png`,
                  description: caption.trim(),
                  id: id
                });
                id++;
                fs.writeFileSync(`${dir}/${file}.thumb.png`, image);
              } catch (error) {
                console.error(`Error processing file ${file}:`, error.message);
              }
            }
          }
        }
      }

      resolve();
    });
  });
}

buildGallery().catch(err => console.error('Gallery build failed:', err));

app.get('/', (req, res) => {
  res.render("index", { directoryListSimple: directoryListSimple, images: imagesArray });
  const logEntry = makeVisitorLogEntry(req);
  appendVisitorLog(logEntry);
});

app.get('/about', (req, res) => {
  res.render("about", { directoryListSimple: directoryListSimple });
});

app.get('/cv', (req, res) => {
  res.render("cv", { directoryListSimple: directoryListSimple, images: imagesArray });
});

app.get('/contact', (req, res) => {
  res.render("contact", { directoryListSimple: directoryListSimple });
});

app.get('/cart', (req, res) => {
  res.render('cart', { directoryListSimple: directoryListSimple });
});

app.get('/admin/orders', requireAdmin, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const orders = orderStore.listActiveOrders().map((order) => ({
    ...order,
    totalDisplay: formatCurrency(order.total_cents),
    subtotalDisplay: formatCurrency(order.subtotal_cents),
    shippingDisplay: formatCurrency(order.shipping_cents),
    paymentPendingSelected: order.payment_status === 'pending',
    paymentPaidSelected: order.payment_status === 'paid',
    fulfillmentPendingSelected: order.fulfillment_status === 'pending',
    fulfillmentShippedSelected: order.fulfillment_status === 'shipped',
    statusCsrfToken: createAdminCsrfToken(),
    deleteCsrfToken: createAdminCsrfToken(),
    items: order.items.map((item) => ({
      ...item,
      image: artworkUrl(item.artwork_path),
      productLabel: item.product_type === 'tshirt' ? 'T-shirt' : 'Print',
      lineTotalDisplay: formatCurrency(item.line_total_cents)
    }))
  }));
  res.render('admin-orders', {
    directoryListSimple: directoryListSimple,
    orders
  });
});

app.post('/admin/orders/:id/status', requireAdmin, requireAdminCsrf, (req, res) => {
  const orderId = Number(req.params.id);
  const paymentStatus = String(req.body.paymentStatus || '');
  const fulfillmentStatus = String(req.body.fulfillmentStatus || '');
  if (!Number.isSafeInteger(orderId) || orderId < 1
    || !['pending', 'paid'].includes(paymentStatus)
    || !['pending', 'shipped'].includes(fulfillmentStatus)) {
    return res.status(400).send('Invalid order status update.');
  }

  const existingOrder = orderStore.findOrderById(orderId);
  if (!existingOrder) return res.status(404).send('Order not found.');

  const changes = {};
  if (existingOrder.payment_status !== paymentStatus) {
    changes.paymentStatus = { from: existingOrder.payment_status, to: paymentStatus };
  }
  if (existingOrder.fulfillment_status !== fulfillmentStatus) {
    changes.fulfillmentStatus = { from: existingOrder.fulfillment_status, to: fulfillmentStatus };
  }

  if (Object.keys(changes).length) {
    orderStore.updateStatuses(orderId, paymentStatus, fulfillmentStatus);
    try {
      appendOrderStatusChange(existingOrder.confirmation_code, changes);
    } catch (error) {
      console.error(`Order ${existingOrder.confirmation_code} updated, but audit log append failed:`, error.message);
    }
  }
  return res.redirect(303, '/admin/orders');
});

app.post('/admin/orders/:id/delete', requireAdmin, requireAdminCsrf, (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isSafeInteger(orderId) || orderId < 1) return res.status(400).send('Invalid order ID.');

  const deletedOrder = orderStore.deleteOrder(orderId);
  if (!deletedOrder) return res.status(404).send('Order not found.');
  try {
    appendOrderDeleted(deletedOrder.confirmation_code);
  } catch (error) {
    console.error(`Order ${deletedOrder.confirmation_code} deleted, but audit log append failed:`, error.message);
  }
  return res.redirect(303, '/admin/orders');
});

app.post('/orders', async (req, res) => {
  const formData = {
    customerName: String(req.body.customerName || '').trim(),
    customerEmail: String(req.body.customerEmail || '').trim(),
    customerPhone: String(req.body.customerPhone || '').trim(),
    addressLine1: String(req.body.addressLine1 || '').trim(),
    addressLine2: String(req.body.addressLine2 || '').trim(),
    city: String(req.body.city || '').trim(),
    province: String(req.body.province || '').trim(),
    postalCode: String(req.body.postalCode || '').trim().toUpperCase()
  };
  let submittedItems;
  try {
    submittedItems = JSON.parse(req.body.items || '[]');
  } catch (_error) {
    submittedItems = null;
  }

  const errors = [];
  if (formData.customerName.length < 2 || formData.customerName.length > 100) errors.push('Enter your name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.customerEmail) || formData.customerEmail.length > 254) errors.push('Enter a valid email address.');
  if (formData.customerPhone.length > 40) errors.push('Phone number must be 40 characters or fewer.');
  if (!formData.addressLine1 || formData.addressLine1.length > 120) errors.push('Enter a valid street address.');
  if (formData.addressLine2.length > 120) errors.push('Address line 2 must be 120 characters or fewer.');
  if (!formData.city || formData.city.length > 80) errors.push('Enter a valid city.');
  if (!formData.province || formData.province.length > 80) errors.push('Enter a valid province or territory.');
  if (!/^[A-Z]\d[A-Z][ -]?\d[A-Z]\d$/.test(formData.postalCode)) errors.push('Enter a valid Canadian postal code.');
  if (!Array.isArray(submittedItems) || submittedItems.length < 1 || submittedItems.length > 30) {
    errors.push('Your cart must contain between 1 and 30 items.');
  }

  const artworkCatalog = new Map(getArtworkCatalog().map((artwork) => [artwork.artworkPath, artwork]));
  const items = [];
  if (Array.isArray(submittedItems) && submittedItems.length <= 30) {
    for (const submittedItem of submittedItems) {
      const artwork = artworkCatalog.get(String(submittedItem.artworkPath || ''));
      const productType = submittedItem.productType;
      const variant = String(submittedItem.variant || '');
      const quantity = Number(submittedItem.quantity);
      const variantAllowed = productType === 'print'
        ? ['4x6', '8x10'].includes(variant)
        : productType === 'tshirt' && ['S', 'M', 'L', 'XL', 'XXL'].includes(variant);
      if (!artwork || !variantAllowed || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
        errors.push('One or more cart items are invalid. Please review your cart.');
        break;
      }

      const unitPriceCents = productType === 'tshirt'
        ? commercePrices.tshirt
        : variant === '4x6' ? commercePrices.print4x6 : commercePrices.print8x10;
      items.push({
        artworkPath: artwork.artworkPath,
        artworkName: artwork.name,
        image: artwork.image,
        productType,
        productLabel: productType === 'tshirt' ? 'T-shirt' : 'Print',
        variant,
        quantity,
        unitPriceCents,
        lineTotalCents: unitPriceCents * quantity
      });
    }
  }

  if (errors.length) {
    return res.status(400).render('cart', {
      directoryListSimple: directoryListSimple,
      orderError: errors[0],
      formData: formData
    });
  }

  const subtotalCents = items.reduce((total, item) => total + item.lineTotalCents, 0);
  const shippingCents = calculateShippingCents(items, {
    print: commercePrices.printShipping,
    tshirt: commercePrices.tshirtShipping
  });
  const order = {
    ...formData,
    subtotalCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents,
    items
  };
  const savedOrder = orderStore.createOrder({
    ...order,
    items: items.map(({ artworkPath, productType, variant, quantity, unitPriceCents, lineTotalCents }) => ({
      artworkPath, productType, variant, quantity, unitPriceCents, lineTotalCents
    }))
  });
  try {
    appendOrderLog(order, savedOrder.confirmationCode);
  } catch (error) {
    console.error(`Order ${savedOrder.confirmationCode} saved, but order log append failed:`, error.message);
  }

  let emailSent = false;
  try {
    const emailResult = await sendOrderEmails({ ...order, confirmationCode: savedOrder.confirmationCode });
    emailSent = emailResult.customerSent;
  } catch (error) {
    console.error(`Order ${savedOrder.confirmationCode} saved, but email delivery failed:`, error.message);
  }

  const confirmationOrder = {
    ...order,
    confirmationCode: savedOrder.confirmationCode,
    subtotalDisplay: formatCurrency(order.subtotalCents),
    shippingDisplay: formatCurrency(order.shippingCents),
    totalDisplay: formatCurrency(order.totalCents),
    items: items.map((item) => ({ ...item, lineTotalDisplay: formatCurrency(item.lineTotalCents) }))
  };
  res.status(201).render('order-confirmation', {
    directoryListSimple: directoryListSimple,
    order: confirmationOrder,
    emailSent: emailSent,
    paymentEmail: process.env.PAYMENT_EMAIL || ''
  });
});

if (DEV_HTTP) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DEV_HTTP cannot be enabled when NODE_ENV=production.');
  }
  http.createServer(app).listen(PORT, () => {
    console.log(`Development HTTP server listening on port ${PORT}; do not use this mode in production.`);
  });
} else {
  if (!/^[a-z0-9.-]+$/i.test(PUBLIC_HOSTNAME)) {
    throw new Error('PUBLIC_HOSTNAME must be a hostname without a scheme or port.');
  }

  const tlsAvailable = fs.existsSync(TLS_KEY_PATH) && fs.existsSync(TLS_CERT_PATH);
  const httpsServer = tlsAvailable
    ? https.createServer({
      key: fs.readFileSync(TLS_KEY_PATH),
      cert: fs.readFileSync(TLS_CERT_PATH)
    }, app)
    : null;
  const httpServer = http.createServer((req, res) => {
    const challengePrefix = '/.well-known/acme-challenge/';
    const pathname = new URL(req.url, `http://${PUBLIC_HOSTNAME}`).pathname;

    if (pathname.startsWith(challengePrefix)) {
      const token = pathname.slice(challengePrefix.length);
      if (!['GET', 'HEAD'].includes(req.method) || !/^[A-Za-z0-9_-]{1,255}$/.test(token)) {
        res.writeHead(404).end();
        return;
      }

      const challengeRoot = path.resolve(ACME_WEBROOT, '.well-known', 'acme-challenge');
      const challengeFile = path.resolve(challengeRoot, token);
      if (path.dirname(challengeFile) !== challengeRoot) {
        res.writeHead(404).end();
        return;
      }

      fs.readFile(challengeFile, (error, contents) => {
        if (error) {
          res.writeHead(404).end();
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(req.method === 'HEAD' ? undefined : contents);
      });
      return;
    }

    if (!tlsAvailable) {
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '300' });
      res.end('HTTPS certificate is not installed yet. Complete Let\'s Encrypt setup, then restart the app.');
      return;
    }

    const httpsPort = PORT === 443 ? '' : `:${PORT}`;
    res.writeHead(['GET', 'HEAD'].includes(req.method) ? 301 : 308, {
      Location: `https://${PUBLIC_HOSTNAME}${httpsPort}${req.url}`
    });
    res.end();
  });

  if (httpsServer) {
    httpsServer.listen(PORT, () => {
      console.log(`HTTPS server listening on port ${PORT}`);
    });
  } else {
    console.warn(`TLS certificate not found at ${TLS_CERT_PATH}; HTTP-01 challenge server is ready for first-time Certbot issuance.`);
  }

  httpServer.listen(HTTP_PORT, () => {
    console.log(`HTTP-to-HTTPS and ACME challenge server listening on port ${HTTP_PORT}`);
  });
}