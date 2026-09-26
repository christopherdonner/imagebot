const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');
const Database = require('better-sqlite3');

function createOrderStore(databasePath = process.env.ORDERS_DB_PATH || path.join(__dirname, 'data', 'orders.sqlite')) {
  if (databasePath !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true });
  }

  const database = new Database(databasePath);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  database.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      confirmation_code TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT,
      address_line1 TEXT NOT NULL,
      address_line2 TEXT,
      city TEXT NOT NULL,
      province TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      subtotal_cents INTEGER NOT NULL,
      shipping_cents INTEGER NOT NULL,
      total_cents INTEGER NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'etransfer',
      payment_status TEXT NOT NULL DEFAULT 'pending',
      fulfillment_status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      artwork_path TEXT NOT NULL,
      product_type TEXT NOT NULL,
      variant TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 10),
      unit_price_cents INTEGER NOT NULL,
      line_total_cents INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at);
    CREATE INDEX IF NOT EXISTS orders_payment_status_idx ON orders(payment_status);
  `);

  const insertOrder = database.prepare(`
    INSERT INTO orders (
      confirmation_code, customer_name, customer_email, customer_phone,
      address_line1, address_line2, city, province, postal_code,
      subtotal_cents, shipping_cents, total_cents
    ) VALUES (
      @confirmationCode, @customerName, @customerEmail, @customerPhone,
      @addressLine1, @addressLine2, @city, @province, @postalCode,
      @subtotalCents, @shippingCents, @totalCents
    )
  `);
  const insertItem = database.prepare(`
    INSERT INTO order_items (
      order_id, artwork_path, product_type, variant, quantity,
      unit_price_cents, line_total_cents
    ) VALUES (
      @orderId, @artworkPath, @productType, @variant, @quantity,
      @unitPriceCents, @lineTotalCents
    )
  `);

  const saveOrder = database.transaction((order) => {
    const confirmationCode = `CD-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const result = insertOrder.run({
      confirmationCode,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      addressLine1: order.addressLine1,
      addressLine2: order.addressLine2,
      city: order.city,
      province: order.province,
      postalCode: order.postalCode,
      subtotalCents: order.subtotalCents,
      shippingCents: order.shippingCents,
      totalCents: order.totalCents
    });
    for (const item of order.items) {
      insertItem.run({
        orderId: result.lastInsertRowid,
        artworkPath: item.artworkPath,
        productType: item.productType,
        variant: item.variant,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        lineTotalCents: item.lineTotalCents
      });
    }
    return { ...order, confirmationCode };
  });

  const findOrder = database.prepare(`
    SELECT orders.*, order_items.artwork_path, order_items.product_type,
      order_items.variant, order_items.quantity, order_items.unit_price_cents,
      order_items.line_total_cents
    FROM orders
    JOIN order_items ON order_items.order_id = orders.id
    WHERE orders.confirmation_code = ?
  `);
  const listActiveOrders = database.prepare(`
    SELECT *
    FROM orders
    WHERE fulfillment_status NOT IN ('shipped', 'cancelled')
    ORDER BY created_at DESC, id DESC
  `);
  const findItemsForOrder = database.prepare(`
    SELECT artwork_path, product_type, variant, quantity,
      unit_price_cents, line_total_cents
    FROM order_items
    WHERE order_id = ?
    ORDER BY id
  `);
  const findOrderById = database.prepare('SELECT * FROM orders WHERE id = ?');
  const updateOrderStatuses = database.prepare(`
    UPDATE orders
    SET payment_status = @paymentStatus, fulfillment_status = @fulfillmentStatus
    WHERE id = @id
  `);
  const deleteOrderById = database.prepare('DELETE FROM orders WHERE id = ?');
  const updateStatuses = database.transaction((id, paymentStatus, fulfillmentStatus) => {
    if (!['pending', 'paid'].includes(paymentStatus)) throw new Error('Invalid payment status.');
    if (!['pending', 'shipped'].includes(fulfillmentStatus)) throw new Error('Invalid fulfillment status.');
    return updateOrderStatuses.run({ id, paymentStatus, fulfillmentStatus }).changes;
  });
  const deleteOrder = database.transaction((id) => {
    const order = findOrderById.get(id);
    if (!order) return null;
    deleteOrderById.run(id);
    return order;
  });

  return {
    createOrder: saveOrder,
    findOrder: (confirmationCode) => findOrder.all(confirmationCode),
    findOrderById: (id) => findOrderById.get(id),
    listActiveOrders: () => listActiveOrders.all().map((order) => ({
      ...order,
      items: findItemsForOrder.all(order.id)
    })),
    updateStatuses,
    deleteOrder,
    close: () => database.close()
  };
}

module.exports = { createOrderStore };