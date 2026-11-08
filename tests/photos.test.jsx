import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Photos from '../src/components/Photos';
import { addPhoto, clearLocalData, db, deletePhoto, listPhotos, saveBodyEntry, today, updatePhoto } from '../src/db';

const buf = (n = 8) => new Uint8Array(n).fill(7).buffer;
beforeEach(clearLocalData);
afterEach(cleanup);

describe('photo storage', () => {
  it('stores, lists newest first, edits and deletes', async () => {
    const a = await addPhoto({ data: buf(), date: '2026-09-01', pose: 'front' });
    const b = await addPhoto({ data: buf(), date: '2026-10-15', pose: 'bogus', note: 'x'.repeat(500) });
    const list = await listPhotos();
    expect(list.map((p) => p.id)).toEqual([b.id, a.id]);
    expect(list[0]).toMatchObject({ pose: '', type: 'image/jpeg' });
    expect(list[0].note).toHaveLength(200);
    await updatePhoto(a.id, { date: '2026-11-01', pose: 'side', note: 'week 8' });
    expect((await listPhotos())[0]).toMatchObject({ id: a.id, date: '2026-11-01', pose: 'side', note: 'week 8' });
    await updatePhoto(a.id, { date: 'nope' });
    expect((await db.photos.get(a.id)).date).toBe('2026-11-01');
    await deletePhoto(a.id);
    expect(await listPhotos()).toHaveLength(1);
  });
  it('rejects empty and oversized photos', async () => {
    await expect(addPhoto({ data: new ArrayBuffer(0) })).rejects.toThrow(/could not be read/);
    await expect(addPhoto({ data: new ArrayBuffer(16 * 1024 * 1024) })).rejects.toThrow(/too large/);
    await expect(addPhoto({ data: 'text' })).rejects.toThrow();
  });
  it('is wiped with the rest of the local data and is not part of sync', async () => {
    await addPhoto({ data: buf() });
    await clearLocalData();
    expect(await listPhotos()).toHaveLength(0);
    const { TABLES } = await import('../src/sync');
    expect(TABLES?.map?.((t) => t.remote) ?? []).not.toContain('photos');
  });
});

describe('photos card', () => {
  const file = (name) => new File([new Uint8Array([1, 2, 3, 4])], name, { type: 'image/jpeg' });

  it('adds a photo from the picker and shows it', async () => {
    render(<Photos entries={[]} unit="lb" />);
    expect(await screen.findByText(/Add a photo now/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Choose photos'), { target: { files: [file('a.jpg')] } });
    await waitFor(async () => expect(await listPhotos()).toHaveLength(1));
    expect(await screen.findByRole('button', { name: /Open photo from/ })).toBeTruthy();
    expect((await listPhotos())[0].date).toBe(today());
  });

  it('opens a photo to change its date and pose, then deletes it after confirming', async () => {
    const user = userEvent.setup();
    const p = await addPhoto({ data: buf(), date: '2026-10-01' });
    render(<Photos entries={[]} unit="lb" />);
    await user.click(await screen.findByRole('button', { name: /Open photo from Oct 1, 2026/ }));
    await user.selectOptions(screen.getByLabelText('Pose'), 'side');
    await waitFor(async () => expect((await db.photos.get(p.id)).pose).toBe('side'));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Yes, delete photo' }));
    await waitFor(async () => expect(await listPhotos()).toHaveLength(0));
  });

  it('compares two photos with the weight at each date', async () => {
    const user = userEvent.setup();
    await saveBodyEntry({ date: '2026-09-01', weight_kg: 90 });
    await saveBodyEntry({ date: '2026-11-01', weight_kg: 85 });
    await addPhoto({ data: buf(), date: '2026-09-02', pose: 'front' });
    await addPhoto({ data: buf(), date: '2026-11-02', pose: 'front' });
    const entries = [{ date: '2026-09-01', weight_kg: 90 }, { date: '2026-11-01', weight_kg: 85 }];
    render(<Photos entries={entries} unit="kg" />);
    await user.click(await screen.findByRole('button', { name: 'Compare' }));
    expect(screen.getByText('Tap two photos to compare them.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'First vs latest' }));
    expect(screen.getByText(/90 kg/)).toBeTruthy();
    expect(screen.getByText(/85 kg/)).toBeTruthy();
    expect(screen.getByText('61 days apart')).toBeTruthy();
  });
});
