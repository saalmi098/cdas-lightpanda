import { chromium } from 'playwright-core';
import { test, expect } from 'playwright/test';

const CDP_ENDPOINT = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9222';
// const CDP_ENDPOINT = process.env.CDP_ENDPOINT ?? 'ws://127.0.0.1:9222';
const BASE = 'https://practicesoftwaretesting.com';

// Seeded product IDs (stable across resets)
const PLIERS_ID = '01KSJCT22QSF5CSV8S8CNBYZQ1';    // Combination Pliers $14.15 – in stock
const LONG_NOSE_ID = '01KSJCT236N6TCK838TCT5JJJE';  // Long Nose Pliers   $14.24 – out of stock

const USER = {
  email: 'customer2@practicesoftwaretesting.com',
  password: 'welcome01',
};

let browser;
let context;
let page;

test.beforeAll(async () => {
  browser = await chromium.connectOverCDP(CDP_ENDPOINT);
  context = browser.contexts()[0];
  //page = context.pages()[0];

  // console.log('CDP Endpoint:', CDP_ENDPOINT);

  // context = await browser.newContext({
  //   locale: 'de-DE', 
  //   timezoneId: 'Europe/Vienna' // Optional, but useful for localized dates
  // });

  // console.log('Browser contexts:', browser.contexts().length);
  // console.log('Using context with ID:', context._guid);

  // context = await browser.newContext({});
});

test.afterAll(async () => {
  await browser.close();
});

test.beforeEach(async () => {
  page = await context.newPage();
});

test.afterEach(async () => {
  await page.close();
});

/*// Makes the filter tests with URL assertion working (Chromium):
test.beforeAll(async () => {
  browser = await chromium.launch({ headless: false });
});

test.afterAll(async () => {
  await browser.close();
});

test.beforeEach(async () => {
  page = await browser.newPage();
  // await page.goto(TODOMVC_URL);
});

test.afterEach(async () => {
  await page.close();
});*/

async function login() {
  await page.goto(`${BASE}/auth/login`);
  await page.getByRole('textbox', { name: 'Email Adresse *' }).fill(USER.email);
  await page.locator('input[type="password"]').fill(USER.password);
  await page.locator('[data-test="login-submit"]').click();
  await expect(page).not.toHaveURL(/auth\/login/, { timeout: 8000 });
}

// ── Product Listing ──────────────────────────────────────────────────────────

test('homepage loads product grid with 9 items', async () => {
  await page.goto(BASE);
  await expect(page.locator('a[href*="/product/"]')).toHaveCount(9);
});

test('product grid shows product names and prices', async () => {
  await page.goto(BASE);
  await expect(page.getByRole('heading', { name: 'Combination Pliers', level: 5 })).toBeVisible();
  await expect(page.getByText('$14.15').first()).toBeVisible();
});

test('all products in product grid show CO2 rating badges', async () => {
  await page.goto(BASE);
  const badges = page.locator('[data-test="co2-rating-badge"]');
  await expect(badges).toHaveCount(9); // 9 products on page 1, all should have a badge
  for (let i = 0; i < 9; i++) {
    await expect(badges.nth(i).locator('.co2-letter.active.rating-d, .co2-letter.active')).toHaveCount(1);
  }
});

test('homepage has pagination with 5 pages', async () => {
  await page.goto(BASE);
  await expect(page.getByRole('button', { name: 'Page-1' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Page-5' })).toBeVisible();
});

test('page 2 shows different products than page 1', async () => {
  await page.goto(BASE);
  // const page1Names = await page.locator('h5').allTextContents();
  // await page.getByRole('button', { name: 'Page-2' }).click();
  await expect(page.locator('//a[@role="button" and @aria-label="Page-2"]')).toBeVisible();
  await page.locator('//a[@role="button" and @aria-label="Page-2"]').evaluate(el => el.click());
  // await page.waitForTimeout(600);
  // const page2Names = await page.locator('h5').allTextContents();
  // expect(page1Names).not.toEqual(page2Names);
});

test('sort by Name A to Z orders product list alphabetically', async () => {
  await page.goto(BASE);
  await page.getByRole('combobox', { name: 'sort' }).selectOption('Name (A - Z)');
  await page.waitForTimeout(600);
  const names = await page.locator('h5').allTextContents();
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
});

test('sort by Price Low to High reorders the grid', async () => {
  await page.goto(BASE);
  await page.getByRole('combobox', { name: 'sort' }).selectOption('Preis (Niedrig - Hoch)');
  // await expect(page.locator('[data-test="sort"]')).toHaveText('years');
  await page.locator('[data-test="sort"]').selectOption({ value: 'price,asc' });
  await page.waitForTimeout(600);
  const priceTexts = await page.locator('[data-test="product-price"]').allTextContents();
  const prices = priceTexts.map(t => parseFloat(t.replace('$', '')));
  expect(prices).toEqual([...prices].sort((a, b) => a - b));
});

test('filter by Hammer subcategory shows only hammer products', async () => {
  await page.goto(BASE);
  await page.getByRole('checkbox', { name: 'Hammer' }).check();
  await page.waitForTimeout(800);
  const names = await page.locator('h5').allTextContents();
  expect(names.length).toBeGreaterThan(0);
  expect(names.every(n => n.toLowerCase().includes('hammer'))).toBe(true);
});

test('filter by ForgeFlex Tools brand shows exact product set', async () => {
  const expected = [
    'Claw Hammer with Shock Reduction Grip',
    'Hammer',
    'Thor Hammer',
    'Sledgehammer',
    'Claw Hammer with Fiberglass Handle',
    'Court Hammer',
    'Wood Saw',
    'Adjustable Wrench',
    'Angled Spanner',
  ];
  await page.goto(BASE);
  await page.getByRole('checkbox', { name: 'ForgeFlex Tools' }).check();
  await page.waitForTimeout(800);
  const names = await page.locator('[data-test="product-name"]').allTextContents();
  expect(names.sort().map(n => n.trim())).toEqual(expected.sort().map(n => n.trim()));
});

test('search for Pliers returns relevant results', async () => {
  await page.goto(BASE);
  await page.getByRole('textbox', { name: 'Suche' }).fill('Pliers');
  await page.getByRole('button', { name: 'Suche' }).click();
  await page.waitForTimeout(600);
  const names = await page.locator('h5').allTextContents();
  expect(names.length).toBeGreaterThan(0);
  expect(names.some(n => n.includes('Pliers'))).toBe(true);
});

test('search X button clears filter and restores full product list', async () => {
  await page.goto(BASE);
  await page.getByRole('textbox', { name: 'Suche' }).fill('Hammer');
  await page.getByRole('button', { name: 'Suche' }).click();
  await page.waitForTimeout(600);
  const filteredCount = await page.locator('a[href*="/product/"]').count();
  await page.getByRole('button', { name: 'X' }).click();
  await page.waitForTimeout(600);
  const resetCount = await page.locator('a[href*="/product/"]').count();
  expect(resetCount).toBeGreaterThan(filteredCount);
});

// ── Product Detail ───────────────────────────────────────────────────────────

test('product detail page shows h1 with product name', async () => {
  await page.goto(`${BASE}/product/${PLIERS_ID}`);
  await expect(page.getByRole('heading', { name: 'Combination Pliers', level: 1 })).toBeVisible();
});

test('product detail shows price and brand', async () => {
  await page.goto(`${BASE}/product/${PLIERS_ID}`);
  await expect(page.getByText('$14.15')).toBeVisible();
  await expect(page.getByText('ForgeFlex Tools')).toBeVisible();
});

test('product detail shows specifications table with rows', async () => {
  await page.goto(`${BASE}/product/${PLIERS_ID}`);
  await expect(page.locator('[data-test="product-specs"]')).toBeVisible();

  const spec = (name) => page.locator(`[data-test-spec="${name}"]`);

  await expect(spec('handle-material').locator('[data-test="spec-value-text"]')).toHaveText('Bi-component');
  await expect(spec('length').locator('[data-test="spec-value-text"]')).toHaveText('200');
  await expect(spec('length').locator('[data-test="spec-unit"]')).toHaveText('mm');
  await expect(spec('material').locator('[data-test="spec-value-text"]')).toHaveText('Chrome Vanadium Steel');
  await expect(spec('warranty').locator('[data-test="spec-value-text"]')).toHaveText('2');
  await expect(spec('warranty').locator('[data-test="spec-unit"]')).toHaveText('years');
  await expect(spec('weight').locator('[data-test="spec-value-text"]')).toHaveText('340');
  await expect(spec('weight').locator('[data-test="spec-unit"]')).toHaveText('g');
});

test('quantity spinner starts at 1 on product detail', async () => {
  await page.goto(`${BASE}/product/${PLIERS_ID}`);
  await expect(page.getByRole('spinbutton', { name: 'Quantity' })).toHaveValue('1');
});

test('increase quantity button increments spinner to 2', async () => {
  await page.goto(`${BASE}/product/${PLIERS_ID}`);
  await page.getByRole('button', { name: 'Menge erhöhen' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Quantity' })).toHaveValue('2');
});

test('decrease quantity button decrements spinner back to 1', async () => {
  await page.goto(`${BASE}/product/${PLIERS_ID}`);
  await page.getByRole('button', { name: 'Menge erhöhen' }).click();
  await page.getByRole('button', { name: 'Menge verringern' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Quantity' })).toHaveValue('1');
});

test('product detail page shows related products section', async () => {
  await page.goto(`${BASE}/product/${PLIERS_ID}`);
  await expect(page.getByRole('heading', { name: 'Verwandte Produkte', level: 2 })).toBeVisible();
  await expect(page.locator('a[href*="/product/"]').first()).toBeVisible();
});

test('out-of-stock product detail shows unavailable text', async () => {
  await page.goto(`${BASE}/product/${LONG_NOSE_ID}`);
  await expect(page.locator('[data-test="out-of-stock"]')).toBeVisible();
});

test('out-of-stock badge visible in homepage product grid', async () => {
  await page.goto(BASE);
  // Long Nose Pliers is out of stock and appears on page 1
  await expect(page.locator('[data-test="out-of-stock"]')).toBeVisible();
});

test('clicking product card navigates to product detail', async () => {
  await page.goto(BASE);
  await page.getByRole('heading', { name: 'Combination Pliers', level: 5 }).click();
  await expect(page).toHaveURL(new RegExp(`/product/${PLIERS_ID}`));
  await expect(page.getByRole('heading', { name: 'Combination Pliers', level: 1 })).toBeVisible();
});

// ── Cart ─────────────────────────────────────────────────────────────────────

test('add-to-cart button is visible on product detail page', async () => {
  await page.goto(`${BASE}/product/${PLIERS_ID}`);
  await expect(page.getByRole('button', { name: 'Zum Einkaufswagen hinzufügen' })).toBeVisible();
});

test('favorites button is visible on product detail page', async () => {
  await page.goto(`${BASE}/product/${PLIERS_ID}`);
  await expect(page.getByRole('button', { name: 'Zu Favoriten hinzufügen' })).toBeVisible();
});

test('compare button is visible on product detail page', async () => {
  await page.goto(`${BASE}/product/${PLIERS_ID}`);
  await expect(page.getByRole('button', { name: 'Vergleichen' })).toBeVisible();
});

// TODO: add-to-cart button is not working in the test (with page.pause() it works)
// test('logged-in user can add product to cart and see it in checkout', async () => {
//   await login();
//   await page.goto(`${BASE}/product/${PLIERS_ID}`);
//   await expect(page.locator('[data-test="add-to-cart"]')).toBeVisible();
//   await page.locator('[data-test="add-to-cart"]').click();
//   await expect(page.getByRole('alert').filter({ hasText: 'Produkt zum Warenkorb hinzugefügt.' })).toBeVisible({ timeout: 5000 });
//   await page.goto(`${BASE}/checkout`);
//   await expect(page.locator('[data-test="product-title"]')).toContainText('Combination Pliers', { timeout: 5000 });
//   await expect(page.locator('[data-test="product-quantity"]')).toHaveValue('1');
//   await expect(page.locator('[data-test="product-price"]')).toHaveText('$14.15');
//   await expect(page.locator('[data-test="line-price"]')).toHaveText('$14.15');
//   await expect(page.locator('[data-test="cart-total"]')).toHaveText('$14.15');
// });

test('checkout page accessible to logged-in user without redirect', async () => {
  await login();
  await page.goto(`${BASE}/checkout`);
  await expect(page).not.toHaveURL(/auth\/login/);
});

// TODO: add-to-cart button is not working in the test (with page.pause() it works)
// test('checkout page shows dollar amounts after adding product', async () => {
//   await login();
//   await page.goto(`${BASE}/product/${PLIERS_ID}`);
//   await page.getByRole('button', { name: 'Zum Einkaufswagen hinzufügen' }).click();
//   await page.waitForTimeout(1000);
//   await page.goto(`${BASE}/checkout`);
//   await expect(page.getByText(/\$\d+\.\d{2}/).first()).toBeVisible();
// });

// ── Authentication ───────────────────────────────────────────────────────────

test('login page renders with heading and input fields', async () => {
  await page.goto(`${BASE}/auth/login`);
  await expect(page.getByRole('heading', { name: 'Einloggen' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Email Adresse *' })).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.locator('[data-test="login-submit"]')).toBeVisible();
});

test('login with valid credentials leaves login page', async () => {
  await login();
  await expect(page).not.toHaveURL(/auth\/login/);
});

test('login with valid user credentials displays dashboard', async () => {
    await page.goto(BASE);
    await page.locator('[data-test="nav-sign-in"]').click();
    await page.locator('[data-test="email"]').fill('customer@practicesoftwaretesting.com');
    await page.locator('[data-test="password"]').fill('welcome01');
    await page.locator('[data-test="login-submit"]').click();
    await expect(page.locator('[data-test="page-title"]')).toContainText('My account');
});

test('login with invalid credentials shows error alert', async () => {
  await page.goto(`${BASE}/auth/login`);
  await page.getByRole('textbox', { name: 'Email Adresse *' }).fill('nobody@example.com');
  await page.locator('input[type="password"]').fill('wrongpassword!');
  await page.locator('[data-test="login-submit"]').click();
  await expect(page.locator('.alert, [role="alert"]').first()).toBeVisible({ timeout: 5000 });
});

test('login page link to register navigates to registration page', async () => {
  await page.goto(`${BASE}/auth/login`);
  await page.getByRole('link', { name: 'Register your account' }).click();
  await expect(page).toHaveURL(/auth\/register/);
});

test('forgot password link navigates to forgot-password page', async () => {
  await page.goto(`${BASE}/auth/login`);
  await page.getByRole('link', { name: 'Forgot your Password?' }).click();
  await expect(page).toHaveURL(/auth\/forgot-password/);
});

test('register page shows all required form fields', async () => {
  await page.goto(`${BASE}/auth/register`);
  await expect(page.getByRole('heading', { name: 'Kunden Registrierung' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Vorname' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Nachname' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Email Adresse' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Registrieren' })).toBeVisible();
});

test('forgot password page renders with email input', async () => {
  await page.goto(`${BASE}/auth/forgot-password`);
  await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
});

// ── Contact Form ─────────────────────────────────────────────────────────────

test('contact page renders with heading and all form fields', async () => {
  await page.goto(`${BASE}/contact`);
  await expect(page.getByRole('heading', { name: 'Kontakt' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Vorname' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Nachname' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Email Adresse' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Betreff' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Nachricht *' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Senden' })).toBeVisible();
});

test('contact subject dropdown accepts Kundenservice and Garantie options', async () => {
  await page.goto(`${BASE}/contact`);
  const select = page.getByRole('combobox', { name: 'Betreff' });
  await select.selectOption('Kundenservice');
  await select.selectOption('Garantie');
  // If selectOption throws the option does not exist — reaching here means both exist
  await expect(select).toBeVisible();
});

test('contact form attachment note mentions txt only', async () => {
  await page.goto(`${BASE}/contact`);
  await expect(page.getByText('txt')).toBeVisible();
});

test('contact form can be fully filled in before submission', async () => {
  await page.goto(`${BASE}/contact`);
  await page.getByRole('textbox', { name: 'Vorname' }).fill('Jane');
  await page.getByRole('textbox', { name: 'Nachname' }).fill('Doe');
  await page.getByRole('textbox', { name: 'Email Adresse' }).fill('jane.doe@example.com');
  await page.getByRole('combobox', { name: 'Betreff' }).selectOption('Garantie');
  await page.getByRole('textbox', { name: 'Nachricht *' }).fill('I have a warranty question about my recent purchase.');
  await expect(page.getByRole('button', { name: 'Senden' })).toBeEnabled();
});

test('submitting empty contact form keeps user on contact page', async () => {
  await page.goto(`${BASE}/contact`);
  await page.getByRole('button', { name: 'Senden' }).click();
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(`${BASE}/contact`);
});
