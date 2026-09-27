const fs = require('fs');
const path = require('path');

function appendOrderLog(order, confirmationCode, logPath = process.env.ORDER_LOG_PATH || path.join(__dirname, 'data', 'orders.jsonl')) {
  const entry = {
    event: 'order_created',
    createdAt: new Date().toISOString(),
    confirmationCode,
    paymentMethod: 'etransfer',
    paymentStatus: 'pending',
    fulfillmentStatus: 'pending',
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    totalCents: order.totalCents,
    items: order.items.map((item) => ({
      artworkPath: item.artworkPath,
      productType: item.productType,
      variant: item.variant,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      lineTotalCents: item.lineTotalCents
    }))
  };
  return appendEntry(entry, logPath);
}

function appendOrderStatusChange(confirmationCode, changes, logPath = process.env.ORDER_LOG_PATH || path.join(__dirname, 'data', 'orders.jsonl')) {
  return appendEntry({
    event: 'order_status_changed',
    createdAt: new Date().toISOString(),
    confirmationCode,
    changes
  }, logPath);
}

function appendOrderDeleted(confirmationCode, logPath = process.env.ORDER_LOG_PATH || path.join(__dirname, 'data', 'orders.jsonl')) {
  return appendEntry({
    event: 'order_deleted',
    createdAt: new Date().toISOString(),
    confirmationCode
  }, logPath);
}

function appendEntry(entry, logPath) {
  const resolvedPath = path.resolve(logPath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.appendFileSync(resolvedPath, `${JSON.stringify(entry)}\n`, { encoding: 'utf8', flag: 'a' });
  return entry;
}

module.exports = { appendOrderLog, appendOrderStatusChange, appendOrderDeleted };