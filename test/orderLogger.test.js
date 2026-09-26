const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { appendOrderLog } = require('../orderLogger');

test('appends one structured order entry without customer contact details', (context) => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'imagebot-order-log-'));
  const logPath = path.join(tempDirectory, 'nested', 'orders.jsonl');
  context.after(() => fs.rmSync(tempDirectory, { recursive: true, force: true }));

  const order = {
    customerName: 'Private Customer Name',
    customerEmail: 'private@example.com',
    addressLine1: 'Private Street Address',
    subtotalCents: 1500,
    shippingCents: 1000,
    totalCents: 2500,
    items: [{
      artworkPath: 'img/drawing.png',
      productType: 'print',
      variant: '4x6',
      quantity: 1,
      unitPriceCents: 1500,
      lineTotalCents: 1500
    }]
  };

  appendOrderLog(order, 'CD-TEST-123456', logPath);
  const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
  assert.equal(lines.length, 1);

  const entry = JSON.parse(lines[0]);
  assert.equal(entry.confirmationCode, 'CD-TEST-123456');
  assert.equal(entry.paymentStatus, 'pending');
  assert.deepEqual(entry.items.map((item) => [item.productType, item.variant, item.quantity]), [
    ['print', '4x6', 1]
  ]);
  assert.equal(lines[0].includes('private@example.com'), false);
  assert.equal(lines[0].includes('Private Street Address'), false);
});