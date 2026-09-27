const nodemailer = require('nodemailer');

const sender = process.env.SMTP_FROM || process.env.SMTP_USER;
const transporter = process.env.SMTP_HOST && sender
  ? nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER && process.env.SMTP_PASS
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined
  })
  : null;

function formatCurrency(cents) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100);
}

function orderLines(order) {
  return order.items.map((item) =>
    `${item.quantity} x ${item.artworkName} - ${item.productLabel} (${item.variant}) at ${formatCurrency(item.unitPriceCents)} each`
  ).join('\n');
}

function messageForOrder(order) {
  const paymentInstructions = process.env.PAYMENT_EMAIL
    ? `Send an e-transfer to ${process.env.PAYMENT_EMAIL} and include ${order.confirmationCode} in the message.`
    : 'Reply to this email to arrange e-transfer payment.';
  return [
    `Order ${order.confirmationCode}`,
    '',
    orderLines(order),
    '',
    `Subtotal: ${formatCurrency(order.subtotalCents)}`,
    `Shipping: ${formatCurrency(order.shippingCents)}`,
    `Total: ${formatCurrency(order.totalCents)} CAD`,
    '',
    paymentInstructions,
    '',
    `Ship to: ${order.customerName}, ${order.addressLine1}${order.addressLine2 ? `, ${order.addressLine2}` : ''}, ${order.city}, ${order.province}, ${order.postalCode}`
  ].join('\n');
}

async function sendOrderEmails(order) {
  if (!transporter) return { configured: false, customerSent: false };

  const text = messageForOrder(order);
  await transporter.sendMail({
    from: sender,
    to: order.customerEmail,
    subject: `Order ${order.confirmationCode} received`,
    text
  });

  let storeNotified = false;
  if (process.env.STORE_ORDER_EMAIL) {
    try {
      await transporter.sendMail({
        from: sender,
        to: process.env.STORE_ORDER_EMAIL,
        replyTo: order.customerEmail,
        subject: `New order ${order.confirmationCode}`,
        text
      });
      storeNotified = true;
    } catch (error) {
      console.error(`Could not send store notification for ${order.confirmationCode}:`, error.message);
    }
  }

  return { configured: true, customerSent: true, storeNotified };
}

module.exports = { sendOrderEmails };