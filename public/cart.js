const CART_STORAGE_KEY = 'imagebot-cart';
const shirtSizes = ['S', 'M', 'L', 'XL', 'XXL'];

function readCart() {
  try {
    const cart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
    if (!Array.isArray(cart)) return [];
    return cart.filter((item) => item && typeof item.artworkPath === 'string'
      && item.artworkPath.startsWith('img/') && !item.artworkPath.includes('..')
      && ['print', 'tshirt'].includes(item.productType)
      && (item.productType === 'print' ? ['4x6', '8x10'] : shirtSizes).includes(item.variant)
      && Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 10);
  } catch (_error) {
    return [];
  }
}

function writeCart(cart) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  updateCartCount(cart);
}

function updateCartCount(cart = readCart()) {
  const count = cart.reduce((total, item) => total + item.quantity, 0);
  const countElement = document.querySelector('#cart-count');
  const cartLink = document.querySelector('.shop-cart');
  if (countElement) countElement.textContent = String(count);
  if (cartLink) cartLink.setAttribute('aria-label', `Shopping cart, ${count} ${count === 1 ? 'item' : 'items'}`);
}

function currency(cents) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100);
}

function priceFor(productType, variant, prices) {
  if (productType === 'tshirt') return prices.tshirt;
  return variant === '4x6' ? prices.print4x6 : prices.print8x10;
}

function updateViewerPrice() {
  const viewerOrder = document.querySelector('.viewer-order');
  const product = document.querySelector('#viewer-product');
  const variant = document.querySelector('#viewer-variant');
  const priceElement = document.querySelector('#viewer-price');
  if (!viewerOrder || !product || !variant || !priceElement) return;

  const prices = {
    print4x6: Number(viewerOrder.dataset.print4x6),
    print8x10: Number(viewerOrder.dataset.print8x10),
    tshirt: Number(viewerOrder.dataset.tshirt)
  };
  const isShirt = product.value === 'tshirt';
  const options = isShirt ? shirtSizes : ['4x6', '8x10'];
  const previousVariant = variant.value;
  variant.replaceChildren(...options.map((size) => {
    const option = document.createElement('option');
    option.value = size;
    option.textContent = isShirt ? size : `${size.replace('x', ' x ')} in`;
    return option;
  }));
  if (options.includes(previousVariant)) variant.value = previousVariant;
  variant.setAttribute('aria-label', isShirt ? 'Select T-shirt size' : 'Select print size');
  priceElement.textContent = currency(priceFor(product.value, variant.value, prices));
}

function addViewerItem() {
  const viewer = document.querySelector('.viewer');
  const feedback = document.querySelector('#cart-feedback');
  if (!viewer?.dataset.artworkPath) {
    if (feedback) feedback.textContent = 'Choose a drawing first.';
    return;
  }

  const productType = document.querySelector('#viewer-product').value;
  const variant = document.querySelector('#viewer-variant').value;
  const cart = readCart();
  const existing = cart.find((item) => item.artworkPath === viewer.dataset.artworkPath
    && item.productType === productType && item.variant === variant);
  if (existing) {
    existing.quantity = Math.min(existing.quantity + 1, 10);
  } else {
    cart.push({
      artworkPath: viewer.dataset.artworkPath,
      artworkName: viewer.dataset.artworkName || 'Drawing',
      productType,
      variant,
      quantity: 1
    });
  }
  writeCart(cart);
  renderCart();
  if (feedback) feedback.textContent = 'Added to your cart.';
}

function createCartRow(item, prices) {
  const row = document.createElement('article');
  row.className = 'cart-row';

  const image = document.createElement('img');
  image.src = `/${item.artworkPath.split('/').map(encodeURIComponent).join('/')}`;
  image.alt = '';
  image.loading = 'lazy';
  row.appendChild(image);

  const detail = document.createElement('div');
  detail.className = 'cart-item-detail';
  const name = document.createElement('h3');
  name.textContent = item.artworkName || item.artworkPath.split('/').pop();
  const product = document.createElement('p');
  product.textContent = `${item.productType === 'tshirt' ? 'T-shirt' : 'Print'} / ${item.variant}`;
  detail.append(name, product);
  row.appendChild(detail);

  const quantityLabel = document.createElement('label');
  quantityLabel.className = 'cart-quantity';
  quantityLabel.textContent = 'Qty';
  const quantityInput = document.createElement('input');
  quantityInput.type = 'number';
  quantityInput.min = '1';
  quantityInput.max = '10';
  quantityInput.value = String(item.quantity);
  quantityInput.setAttribute('aria-label', `Quantity for ${name.textContent}`);
  quantityLabel.appendChild(quantityInput);
  row.appendChild(quantityLabel);

  const itemPrice = priceFor(item.productType, item.variant, prices);
  const total = document.createElement('strong');
  total.className = 'cart-line-total';
  total.textContent = currency(itemPrice * item.quantity);
  row.appendChild(total);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'cart-remove';
  remove.textContent = 'Remove';
  remove.setAttribute('aria-label', `Remove ${name.textContent} from cart`);
  row.appendChild(remove);

  quantityInput.addEventListener('change', () => {
    const value = Number(quantityInput.value);
    if (Number.isInteger(value) && value >= 1 && value <= 10) {
      item.quantity = value;
      updateCartFromPage();
    } else {
      quantityInput.value = String(item.quantity);
    }
  });
  remove.addEventListener('click', () => {
    writeCart(readCart().filter((entry) => !(entry.artworkPath === item.artworkPath
      && entry.productType === item.productType && entry.variant === item.variant)));
    renderCart();
  });

  return row;
}

function updateCartFromPage() {
  const rows = [...document.querySelectorAll('.cart-row')];
  const cart = readCart();
  rows.forEach((row, index) => {
    const quantity = Number(row.querySelector('input[type="number"]').value);
    if (cart[index] && Number.isInteger(quantity) && quantity >= 1 && quantity <= 10) cart[index].quantity = quantity;
  });
  writeCart(cart);
  renderCart();
}

function renderCart() {
  const cartElement = document.querySelector('#shopping-cart');
  if (!cartElement) return;

  const prices = {
    print4x6: Number(cartElement.dataset.print4x6),
    print8x10: Number(cartElement.dataset.print8x10),
    tshirt: Number(cartElement.dataset.tshirt),
    printShipping: Number(cartElement.dataset.printShipping),
    tshirtShipping: Number(cartElement.dataset.tshirtShipping)
  };
  const cart = readCart();
  const lines = document.querySelector('#cart-lines');
  const checkout = document.querySelector('#cart-checkout');
  const empty = document.querySelector('#cart-empty');
  lines.replaceChildren(...cart.map((item) => createCartRow(item, prices)));
  checkout.hidden = cart.length === 0;
  empty.hidden = cart.length !== 0;

  const subtotal = cart.reduce((sum, item) => sum + priceFor(item.productType, item.variant, prices) * item.quantity, 0);
  const shipping = cart.reduce((sum, item) => {
    const rate = item.productType === 'tshirt' ? prices.tshirtShipping : prices.printShipping;
    return sum + rate * item.quantity;
  }, 0);
  document.querySelector('#cart-subtotal').textContent = currency(subtotal);
  document.querySelector('#cart-shipping').textContent = currency(shipping);
  document.querySelector('#cart-total').textContent = currency(subtotal + shipping);
  document.querySelector('#checkout-items').value = JSON.stringify(cart.map(({ artworkPath, productType, variant, quantity }) => ({
    artworkPath, productType, variant, quantity
  })));
  updateCartCount(cart);
}

document.addEventListener('DOMContentLoaded', () => {
  const product = document.querySelector('#viewer-product');
  const variant = document.querySelector('#viewer-variant');
  const addButton = document.querySelector('#add-to-cart');
  product?.addEventListener('change', updateViewerPrice);
  variant?.addEventListener('change', updateViewerPrice);
  addButton?.addEventListener('click', addViewerItem);
  document.querySelectorAll('.shop-artwork').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const artworkImage = button.closest('.gallery-item')?.querySelector('img[data-id]');
      if (!artworkImage || typeof view !== 'function') return;
      view(artworkImage, artworkImage.dataset.id);
      product?.focus();
    });
  });

  if (document.querySelector('.order-confirmation')) writeCart([]);
  updateViewerPrice();
  updateCartCount();
  renderCart();

  document.querySelector('#checkout-form')?.addEventListener('submit', (event) => {
    const cart = readCart();
    if (cart.length === 0) {
      event.preventDefault();
      renderCart();
      return;
    }
    document.querySelector('#checkout-items').value = JSON.stringify(cart.map(({ artworkPath, productType, variant, quantity }) => ({
      artworkPath, productType, variant, quantity
    })));
  });
});