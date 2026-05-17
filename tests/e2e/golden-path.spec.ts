import { test, expect } from '@playwright/test';

test('search → result → reveal details → share', async ({ page, context }) => {
  await context.route('**/api/disambiguate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{
          slug: 'fourth-wing-yarros-2023',
          title: 'Fourth Wing', creator: 'Rebecca Yarros', year: 2023, medium: 'book',
        }],
      }),
    });
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: /is it smut\?/i })).toBeVisible();

  await page.getByPlaceholder(/type a book, movie/i).fill('Fourth Wing');
  await page.getByRole('button', { name: /find out/i }).click();

  await page.waitForURL(/\/r\/fourth-wing-yarros-2023/, { timeout: 10_000 });
  expect(page.url()).toContain('/r/fourth-wing-yarros-2023');
});
