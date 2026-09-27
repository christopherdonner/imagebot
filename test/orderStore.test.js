const test = require('node:test');
const assert = require('node:assert/strict');
const { createOrderStore } = require('../orderStore');

test('persists an order with multiple product lines and pending statuses', (context) => {
  const store = createOrderStore(':memory:');
  context.after(() => store.close());

  const order = store.createOrder({
    customerName: 'Test Customer',
    customerEmail: 'test@example.com',
    customerPhone: '',
    addressLine1: '1 Main Street',
    addressLine2: '',
    city: 'Waterloo',
    province: 'ON',
    postalCode: 'N2L 1A1',
    subtotalCents: 5000,
    shippingCents: 1000,
    totalCents: 6000,
    items: [
      { artworkPath: 'img/drawing.png', productType: 'print', variant: '4x6', quantity: 1, unitPriceCents: 1500, lineTotalCents: 1500 },
      { artworkPath: 'img/drawing.png', productType: 'tshirt', variant: 'XL', quantity: 1, unitPriceCents: 3500, lineTotalCents: 3500 }
    ]
  });

  const savedLines = store.findOrder(order.confirmationCode);
  assert.equal(savedLines.length, 2);
  assert.equal(savedLines[0].total_cents, 6000);
  assert.equal(savedLines[0].payment_status, 'pending');
  assert.deepEqual(savedLines.map((line) => [line.product_type, line.variant]), [
    ['print', '4x6'],
    ['tshirt', 'XL']
  ]);

  const activeOrder = store.listActiveOrders()[0];
  assert.equal(activeOrder.items.length, 2);
  assert.equal(store.updateStatuses(activeOrder.id, 'paid', 'shipped'), 1);
  assert.equal(store.listActiveOrders().length, 0);
  assert.equal(store.updateStatuses(activeOrder.id, 'pending', 'pending'), 1);
  assert.equal(store.listActiveOrders().length, 1);
  assert.equal(store.deleteOrder(activeOrder.id).confirmation_code, order.confirmationCode);
  assert.equal(store.findOrder(order.confirmationCode).length, 0);
  assert.equal(store.listActiveOrders().length, 0);
});