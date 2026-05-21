import { chromium } from 'playwright';
import { test, expect } from 'playwright/test';

const CDP_ENDPOINT = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9222';
const TODOMVC_URL = 'https://todomvc.com/examples/react/dist/';

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
  await page.goto(TODOMVC_URL);
});

test.afterEach(async () => {
  await page.close();
});

// Makes the filter tests with URL assertion working (Chromium):
// test.beforeAll(async () => {
//   browser = await chromium.launch({ headless: false });
// });

// test.afterAll(async () => {
//   await browser.close();
// });

// test.beforeEach(async () => {
//   page = await browser.newPage();
//   await page.goto(TODOMVC_URL);
// });

async function addTodo(text) {
  await page.locator('.new-todo').fill(text);
  await page.locator('.new-todo').press('Enter');
}

test('add a todo item', async () => {
  await addTodo('Buy groceries');
  await expect(page.locator('.todo-list li')).toHaveCount(1);
  await expect(page.locator('.todo-list li label')).toHaveText('Buy groceries');
});

test('complete a todo item', async () => {
  await addTodo('Buy groceries');
  await page.locator('.toggle').first().click();
  await expect(page.locator('.todo-list li.completed')).toHaveCount(1);
});

test('filter completed todos', async () => {
  await addTodo('Buy groceries');
  await page.locator('.toggle').first().click();
  await page.locator('a[href="#/completed"]').click();
  await page.waitForURL('**#/completed');
  await expect(page.locator('.todo-list li')).toHaveCount(1);
  await expect(page.locator('.todo-list li.completed')).toHaveCount(1);
});

// test('filter active todos shows empty list', async () => {
//   await addTodo('Buy groceries');
//   await page.locator('.toggle').first().click();
//   await page.locator('a[href="#/active"]').click();
//   await page.waitForURL('**#/active');
//   await expect(page.locator('.todo-list li')).toHaveCount(0);
// });
