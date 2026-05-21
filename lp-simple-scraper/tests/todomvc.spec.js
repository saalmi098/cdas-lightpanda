import { chromium } from 'playwright';
import { test, expect } from 'playwright/test';

const CDP_ENDPOINT = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9222';
const TODOMVC_URL = 'https://todomvc.com/examples/react/dist/';

let browser;
let page;

test.beforeAll(async () => {
  browser = await chromium.connectOverCDP(CDP_ENDPOINT);
  const context = browser.contexts()[0];
  page = await context.newPage();
  await page.goto(TODOMVC_URL);
});

test.afterAll(async () => {
  await browser.close();
});

test('add a todo item', async () => {
  await page.locator('.new-todo').fill('Buy groceries');
  await page.locator('.new-todo').press('Enter');
  await expect(page.locator('.todo-list li')).toHaveCount(1);
  await expect(page.locator('.todo-list li label')).toHaveText('Buy groceries');
});

test('complete a todo item', async () => {
  await page.locator('.toggle').first().click();
  await expect(page.locator('.todo-list li.completed')).toHaveCount(1);
});

test('filter completed todos', async () => {
  await page.locator('a[href="#/completed"]').click();
  await expect(page.locator('.todo-list li')).toHaveCount(1);
  await expect(page.locator('.todo-list li.completed')).toHaveCount(1);
});

test('filter active todos shows empty list', async () => {
  await page.locator('a[href="#/active"]').click();
  await expect(page.locator('.todo-list li')).toHaveCount(0);
});
