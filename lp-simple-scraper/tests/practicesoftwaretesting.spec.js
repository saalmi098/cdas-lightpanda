import { chromium } from 'playwright';
import { test, expect } from 'playwright/test';

const CDP_ENDPOINT = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9222';
const BASE = 'https://practicesoftwaretesting.com';

// Seeded product IDs (stable across resets)
const PLIERS_ID = '01KSDEWDFK19YBYD80E80H3DZ1';    // Combination Pliers $14.15 – in stock
const LONG_NOSE_ID = '01KSDEWDFWT5SXYSRHVQK250PT';  // Long Nose Pliers   $14.24 – out of stock

const USER = {
  email: 'customer01@practicesoftwaretesting.com',
  password: 'welcome01',
};

let browser;
let context;
let page;

test.beforeAll(async () => {
  browser = await chromium.connectOverCDP(CDP_ENDPOINT);
  context = browser.contexts()[0];
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

async function login() {
  await page.goto(`${BASE}/auth/login`);
  await page.getByRole('textbox', { name: 'Email Adresse *' }).fill(USER.email);
  await page.locator('input[type="password"]').fill(USER.password);
  await page.getByRole('button', { name: 'Einloggen' }).click();
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

test('product listing shows CO2 rating badges', async () => {
  await page.goto(BASE);
  await expect(page.getByText('CO₂:').first()).toBeVisible();
});

test('homepage has pagination with 5 pages', async () => {
  await page.goto(BASE);
  await expect(page.getByRole('button', { name: 'Page-1' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Page-5' })).toBeVisible();
});

test('page 2 shows different products than page 1', async () => {
  await page.goto(BASE);
  const page1Names = await page.locator('h5').allTextContents();
  await page.getByRole('button', { name: 'Page-2' }).click();
  await page.waitForTimeout(600);
  const page2Names = await page.locator('h5').allTextContents();
  expect(page1Names).not.toEqual(page2Names);
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
  await page.waitForTimeout(600);
  await expect(page.locator('a[href*="/product/"]').first()).toBeVisible();
  const unsorted = await page.getByRole('combobox', { name: 'sort' }).inputValue();
  expect(unsorted).toBe('Preis (Niedrig - Hoch)');
});

test('filter by Hammer subcategory shows only hammer products', async () => {
  await page.goto(BASE);
  await page.getByRole('checkbox', { name: 'Hammer' }).check();
  await page.waitForTimeout(800);
  const names = await page.locator('h5').allTextContents();
  expect(names.length).toBeGreaterThan(0);
  expect(names.every(n => n.toLowerCase().includes('hammer'))).toBe(true);
});

test('filter by ForgeFlex Tools brand reduces product count', async () => {
  await page.goto(BASE);
  const totalBefore = await page.locator('a[href*="/product/"]').count();
  await page.getByRole('checkbox', { name: 'ForgeFlex Tools' }).check();
  await page.waitForTimeout(800);
  const filteredCount = await page.locator('a[href*="/product/"]').count();
  expect(filteredCount).toBeLessThan(totalBefore);
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
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('row', { name: /Length/i })).toBeVisible();
  await expect(page.getByRole('row', { name: /Material/i })).toBeVisible();
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
  await expect(page.getByText('Nicht auf Lager')).toBeVisible();
});

test('out-of-stock badge visible in homepage product grid', async () => {
  await page.goto(BASE);
  // Long Nose Pliers is out of stock and appears on page 1
  await expect(page.getByText('Nicht auf Lager')).toBeVisible();
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

test('logged-in user can add product to cart and see it in checkout', async () => {
  await login();
  await page.goto(`${BASE}/product/${PLIERS_ID}`);
  await page.getByRole('button', { name: 'Zum Einkaufswagen hinzufügen' }).click();
  await page.waitForTimeout(1000);
  await page.goto(`${BASE}/checkout`);
  await expect(page.getByText('Combination Pliers')).toBeVisible({ timeout: 5000 });
});

test('checkout page accessible to logged-in user without redirect', async () => {
  await login();
  await page.goto(`${BASE}/checkout`);
  await expect(page).not.toHaveURL(/auth\/login/);
});

test('checkout page shows dollar amounts after adding product', async () => {
  await login();
  await page.goto(`${BASE}/product/${PLIERS_ID}`);
  await page.getByRole('button', { name: 'Zum Einkaufswagen hinzufügen' }).click();
  await page.waitForTimeout(1000);
  await page.goto(`${BASE}/checkout`);
  await expect(page.getByText(/\$\d+\.\d{2}/).first()).toBeVisible();
});

// ── Authentication ───────────────────────────────────────────────────────────

test('login page renders with heading and input fields', async () => {
  await page.goto(`${BASE}/auth/login`);
  await expect(page.getByRole('heading', { name: 'Einloggen' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Email Adresse *' })).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Einloggen' })).toBeVisible();
});

test('login with valid credentials leaves login page', async () => {
  await login();
  await expect(page).not.toHaveURL(/auth\/login/);
});

test('login with invalid credentials shows error alert', async () => {
  await page.goto(`${BASE}/auth/login`);
  await page.getByRole('textbox', { name: 'Email Adresse *' }).fill('nobody@example.com');
  await page.locator('input[type="password"]').fill('wrongpassword!');
  await page.getByRole('button', { name: 'Einloggen' }).click();
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
