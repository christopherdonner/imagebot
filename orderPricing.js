function calculateShippingCents(items, rates) {
  return items.reduce((shipping, item) => {
    const rate = item.productType === 'tshirt' ? rates.tshirt : rates.print;
    return shipping + rate * item.quantity;
  }, 0);
}

module.exports = { calculateShippingCents };