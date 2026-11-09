import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Food from '../src/components/Food';
import { addFoodEntry, clearLocalData, db, deleteFood, getProfile, listFoodLog, listFoods, saveFood, saveProfile, today, updateFoodEntry } from '../src/db';
import { averageCalories, dayTotals, frequentFoods, fmtServings, parseQuick, searchFoods } from '../src/food';
import { buildExport, importFile } from '../src/backup';

beforeEach(clearLocalData);
afterEach(cleanup);

describe('food search', () => {
  it('finds foods by the start of any word and ranks exact and own foods first', () => {
    expect(searchFoods('ban')[0].name).toBe('Banana');
    expect(searchFoods('chick br').map((f) => f.name)).toContain('Chicken breast, grilled');
    expect(searchFoods('zzzz')).toEqual([]);
    expect(searchFoods('')).toEqual([]);
    const mine = [{ id: 'm1', name: 'Banana bread (mom)', serving: '1 slice', calories: 300 }];
    expect(searchFoods('banana', { mine }).map((f) => f.name).slice(0, 2)).toEqual(['Banana', 'Banana bread (mom)']);
    expect(searchFoods('banana b', { mine })[0].name).toBe('Banana bread (mom)');
    const dupe = [{ id: 'm2', name: 'banana', calories: 90 }];
    expect(searchFoods('banana', { mine: dupe }).filter((f) => f.name.toLowerCase() === 'banana')).toHaveLength(1);
  });
  it('parses quick entries', () => {
    expect(parseQuick('chicken salad 450')).toEqual({ name: 'chicken salad', calories: 450 });
    expect(parseQuick('pizza 300 cal')).toEqual({ name: 'pizza', calories: 300 });
    expect(parseQuick('450')).toBeNull();
    expect(parseQuick('banana')).toBeNull();
    expect(parseQuick('2 eggs')).toBeNull();
  });
  it('totals by servings and tolerates missing calories', () => {
    const t = dayTotals([
      { calories: 100, protein: 10, carbs: 5, fat: 2, servings: 2 },
      { calories: null, servings: 1 },
      { calories: 50, servings: 1, deleted_at: 'x' },
    ]);
    expect(t).toMatchObject({ calories: 200, protein: 20, count: 2, unknown: 1 });
    expect(fmtServings(1.5)).toBe('1½');
    expect(fmtServings(0.25)).toBe('¼');
  });
  it('averages only with enough days and ranks frequent foods', () => {
    const d = (n) => new Date(Date.now() - n * 86400000).toLocaleDateString('en-CA');
    const log = [0, 1, 2].map((n) => ({ id: `a${n}`, date: d(n), time: '08:00', name: 'Oats', calories: 300, servings: 1, created_at: 'x' }));
    expect(averageCalories(log.slice(0, 2), d(0))).toBeNull();
    expect(averageCalories(log, d(0))).toEqual({ avg: 300, days: 3 });
    expect(frequentFoods(log, d(0))[0].name).toBe('Oats');
  });
});

describe('food storage', () => {
  it('saves foods without duplicates, snapshots nutrition, and soft-deletes', async () => {
    const a = await saveFood({ name: ' Mom’s  soup ', serving: '1 bowl', calories: '250', protein: 'x' });
    const b = await saveFood({ name: 'mom’s soup', calories: 260 });
    expect(b.id).toBe(a.id);
    expect(a).toMatchObject({ calories: 250, protein: null });
    const e = await addFoodEntry({ name: 'Mom’s soup', servings: 2, calories: 250, food_id: a.id, time: '12:30' });
    await saveFood({ id: a.id, name: 'Mom’s soup', calories: 999 });
    expect((await listFoodLog())[0]).toMatchObject({ calories: 250, servings: 2, time: '12:30' });
    await deleteFood(a.id);
    expect(await listFoods()).toHaveLength(0);
    await updateFoodEntry(e.id, { time: 'bad', servings: -3, calories: 400 });
    expect((await listFoodLog())[0]).toMatchObject({ time: '', servings: 2, calories: 400 });
    await expect(addFoodEntry({ name: '  ' })).rejects.toThrow();
    expect((await addFoodEntry({ name: 'Toast', food_id: 'common:toast' })).food_id).toBeNull();
  });
  it('keeps targets on the profile within range', async () => {
    await saveProfile({ calorie_target: '2200', protein_target: 5 });
    expect(await getProfile()).toMatchObject({ calorie_target: 2200, protein_target: null });
  });
  it('round-trips through a backup without duplicating', async () => {
    const f = await saveFood({ name: 'Oats', calories: 150 });
    await addFoodEntry({ name: 'Oats', calories: 150, food_id: f.id, date: '2026-11-01', time: '07:30' });
    const exp = await buildExport();
    expect(exp.foods).toHaveLength(1);
    expect(exp.food_log[0]).toMatchObject({ date: '2026-11-01', time: '07:30' });
    const file = { text: async () => JSON.stringify(exp) };
    expect((await importFile(file)).skipped).toBe(2);
    await clearLocalData();
    const out = await importFile(file);
    expect(out.foods).toBe(2);
    expect(await db.foodLog.count()).toBe(1);
  });
});

describe('Food tab (tracking)', () => {
  beforeEach(() => saveProfile({ food_mode: 'track' }));
  it('autofills, logs with a time, edits, deletes with undo, and adds a new food', async () => {
    const user = userEvent.setup();
    render(<Food />);
    const box = await screen.findByRole('combobox');
    await user.type(box, 'ban');
    await user.click(await screen.findByRole('button', { name: /^Banana/ }));
    const form = screen.getByRole('form', { name: 'Add food' });
    const time = form.querySelector('input[type="time"]');
    await user.clear(time);
    await user.type(time, '08:15');
    await user.click(within(form).getByRole('button', { name: 'Add' }));
    await waitFor(async () => expect(await listFoodLog()).toHaveLength(1));
    expect((await listFoodLog())[0]).toMatchObject({ name: 'Banana', time: '08:15', calories: 105 });
    expect(await screen.findByText(/Added Banana/)).toBeTruthy();

    // not in the list: add as new, saved for next time
    await user.type(screen.getByRole('combobox'), 'grandma stew');
    await user.click(screen.getByRole('button', { name: /Add “grandma stew” as a new food/ }));
    const form2 = screen.getByRole('form', { name: 'Add food' });
    const cal = within(form2).getByLabelText('Calories');
    await user.type(cal, '320');
    await user.click(within(form2).getByRole('button', { name: 'Add' }));
    await waitFor(async () => expect(await listFoods()).toHaveLength(1));
    expect((await listFoods())[0]).toMatchObject({ name: 'grandma stew', calories: 320 });

    // typing it again now finds your own food
    await user.type(await screen.findByRole('combobox'), 'grand');
    expect(await screen.findByText('Mine')).toBeTruthy();
    await user.clear(screen.getByRole('combobox'));

    // edit then delete and undo
    await user.click(await screen.findByRole('button', { name: 'Edit Banana' }));
    const edit = screen.getByRole('form', { name: 'Edit food entry' });
    const qty = within(edit).getByLabelText('Servings');
    await user.clear(qty);
    await user.type(qty, '2');
    await user.click(within(edit).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await listFoodLog()).find((e) => e.name === 'Banana').servings).toBe(2));
    await user.click(await screen.findByRole('button', { name: 'Edit Banana' }));
    await user.click(screen.getByRole('button', { name: 'Delete entry' }));
    await waitFor(async () => expect(await listFoodLog()).toHaveLength(1));
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(async () => expect(await listFoodLog()).toHaveLength(2));
  });

  it('logs a quick "name calories" entry, copies yesterday, and sets a goal', async () => {
    const user = userEvent.setup();
    const y = new Date(Date.now() - 86400000).toLocaleDateString('en-CA');
    await addFoodEntry({ name: 'Yogurt', calories: 120, date: y, time: '09:00' });
    render(<Food />);
    await user.click(await screen.findByRole('button', { name: 'Copy yesterday’s foods' }));
    await waitFor(async () => expect((await listFoodLog()).filter((e) => e.date === today())).toHaveLength(1));

    await user.type(screen.getByRole('combobox'), 'zzz casserole 450');
    await user.click(await screen.findByRole('button', { name: /Log zzz casserole/ }));
    await user.click(within(screen.getByRole('form', { name: 'Add food' })).getByRole('button', { name: 'Add' }));
    await waitFor(async () => expect((await listFoodLog()).some((e) => e.name === 'zzz casserole' && e.calories === 450)).toBe(true));

    await user.click(screen.getByRole('button', { name: /Set a daily goal/ }));
    await user.type(screen.getByLabelText('Daily calories'), '2000');
    await user.click(screen.getByRole('button', { name: 'Save goal' }));
    expect(await screen.findByText(/cal left of 2000/)).toBeTruthy();
  });
});
