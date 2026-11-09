import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Food from '../src/components/Food';
import Journal from '../src/components/Journal';
import { addFoodEntry, clearLocalData, db, getFoodNote, getProfile, listFoodNotes, mergeDuplicateNotes, saveFoodNote, saveProfile, today } from '../src/db';
import { foodMode } from '../src/food';
import { buildExport, importFile } from '../src/backup';

beforeEach(clearLocalData);
afterEach(cleanup);

describe('journal storage', () => {
  it('keeps one note per day, updates it, and removes it when emptied', async () => {
    const a = await saveFoodNote({ date: '2026-11-01', text: 'Oats', feeling: 'great' });
    const b = await saveFoodNote({ date: '2026-11-01', text: 'Oats and eggs', feeling: 'bogus' });
    expect(b.id).toBe(a.id);
    expect(await listFoodNotes()).toHaveLength(1);
    expect(await getFoodNote('2026-11-01')).toMatchObject({ text: 'Oats and eggs', feeling: '' });
    await saveFoodNote({ date: '2026-11-01', text: '   ' });
    expect(await getFoodNote('2026-11-01')).toBeNull();
    await expect(saveFoodNote({ date: 'nope', text: 'x' })).rejects.toThrow();
    expect((await saveFoodNote({ date: '2026-11-02', text: 'x'.repeat(6000) })).text).toHaveLength(5000);
  });
  it('merges notes started on two devices without losing text', async () => {
    const now = new Date().toISOString();
    await db.foodNotes.bulkPut([
      { id: 'a', date: '2026-11-03', text: 'Toast', feeling: '', created_at: now, updated_at: '2026-11-03T08:00:00Z', dirty: 0, rev: 1 },
      { id: 'b', date: '2026-11-03', text: 'Soup', feeling: 'okay', created_at: now, updated_at: '2026-11-03T09:00:00Z', dirty: 0, rev: 1 },
    ]);
    expect(await mergeDuplicateNotes()).toBe(1);
    const notes = await listFoodNotes();
    expect(notes).toHaveLength(1);
    expect(notes[0].text).toContain('Soup');
    expect(notes[0].text).toContain('Toast');
    expect(notes[0].feeling).toBe('okay');
  });
  it('defaults to journal for new people and tracking for existing loggers', async () => {
    expect(foodMode(null, [])).toBe('journal');
    expect(foodMode({}, [{ id: 1 }])).toBe('track');
    expect(foodMode({ food_mode: 'journal' }, [{ id: 1 }])).toBe('journal');
    await saveProfile({ food_mode: 'weird' });
    expect((await getProfile()).food_mode).toBeNull();
    await saveProfile({ food_mode: 'track' });
    expect((await getProfile()).food_mode).toBe('track');
  });
  it('round-trips through a backup', async () => {
    await saveFoodNote({ date: '2026-11-04', text: 'Pasta', feeling: 'great' });
    const exp = await buildExport();
    expect(exp.food_notes).toHaveLength(1);
    const file = { text: async () => JSON.stringify(exp) };
    expect((await importFile(file)).skipped).toBe(1);
    await clearLocalData();
    expect((await importFile(file)).foods).toBe(1);
    expect((await getFoodNote('2026-11-04')).text).toBe('Pasta');
  });
});

describe('journal screen', () => {
  it('autosaves typing, stamps the time, and records how it felt', async () => {
    const user = userEvent.setup();
    render(<Journal onSwitch={() => {}} />);
    const box = await screen.findByPlaceholderText(/What did you eat today/);
    await user.type(box, 'Oatmeal with berries');
    await user.click(screen.getByRole('button', { name: 'Add the time' }));
    await user.click(screen.getByRole('button', { name: 'Okay' }));
    await waitFor(async () => expect((await getFoodNote(today()))?.feeling).toBe('okay'), { timeout: 3000 });
    const note = await getFoodNote(today());
    expect(note.text).toMatch(/^Oatmeal with berries\n.+ – $/);
    await user.click(screen.getByRole('button', { name: 'Okay' }));
    await waitFor(async () => expect((await getFoodNote(today()))?.feeling).toBe(''), { timeout: 3000 });
  });
  it('lists earlier days and opens one', async () => {
    const user = userEvent.setup();
    await saveFoodNote({ date: '2026-10-20', text: 'Chili at the game' });
    render(<Journal onSwitch={() => {}} />);
    await user.click(await screen.findByRole('button', { name: /Open .*Oct 20/ }));
    expect(await screen.findByDisplayValue('Chili at the game')).toBeTruthy();
  });
  it('the Food tab shows the journal for new people and tracking after switching', async () => {
    const user = userEvent.setup();
    render(<Food />);
    expect(await screen.findByPlaceholderText(/What did you eat today/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Switch to calorie tracking' }));
    expect(await screen.findByRole('combobox')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Switch to journal' }));
    expect(await screen.findByPlaceholderText(/What did you eat today/)).toBeTruthy();
  });
  it('existing food loggers stay on tracking', async () => {
    await addFoodEntry({ name: 'Toast', calories: 90 });
    render(<Food />);
    expect(await screen.findByRole('combobox')).toBeTruthy();
  });
});
