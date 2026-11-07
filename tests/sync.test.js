import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// A tiny in-memory stand-in for Supabase: tables of rows keyed by id, an updated_at
// that the "server" assigns, and the query shapes sync.js uses.
const fake = vi.hoisted(() => {
  const state = { userId: 'user-1', tables: {}, clock: 0, calls: [] };
  const rows = (name) => (state.tables[name] ??= new Map());
  const stamp = () => new Date(Date.UTC(2026, 10, 1, 0, 0, ++state.clock)).toISOString();
  const client = {
    auth: {
      getSession: async () => ({ data: { session: state.userId ? { user: { id: state.userId } } : null } }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    rpc: async (name) => {
      state.calls.push(['rpc', name]);
      return { error: null };
    },
    from: (name) => ({
      upsert: (payload) => {
        state.calls.push(['upsert', name, payload]);
        const out = payload.map((p) => {
          const row = { ...(rows(name).get(p.id) || {}), ...p, updated_at: stamp() };
          rows(name).set(p.id, row);
          return { id: row.id, updated_at: row.updated_at };
        });
        return { select: async () => ({ data: out, error: null }) };
      },
      select: () => {
        let since = null;
        const q = {
          order: () => q,
          limit: () => q,
          gte: (_c, v) => ((since = v), q),
          then: (res, rej) =>
            Promise.resolve({
              data: [...rows(name).values()]
                .filter((r) => r.user_id === state.userId || r.id === state.userId || r.user_id === undefined) // row-level security
                .filter((r) => !since || r.updated_at >= since).sort((a, b) => a.updated_at.localeCompare(b.updated_at)),
              error: null,
            }).then(res, rej),
        };
        return q;
      },
    }),
  };
  return { state, client };
});

vi.mock('@supabase/supabase-js', () => ({ createClient: () => fake.client }));

let sync;
let dbm;
beforeAll(async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'http://fake.local');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'key');
  vi.resetModules();
  dbm = await import('../src/db.js');
  sync = await import('../src/sync.js');
});

beforeEach(async () => {
  fake.state.tables = {};
  fake.state.calls = [];
  fake.state.userId = 'user-1';
  await dbm.clearLocalData();
});

describe('sync of the new tables', () => {
  it('uploads body entries and goals, marks them clean, and a second device receives them', async () => {
    await dbm.saveBodyEntry({ date: '2026-11-01', weight_kg: 80, measurements: { waist: 90 } });
    await dbm.saveGoal({ type: 'weekly_workouts', target: 3 });
    expect(await sync.runSync()).toBe(true);

    expect(fake.state.tables.body_entries.size).toBe(1);
    expect([...fake.state.tables.body_entries.values()][0]).toMatchObject({ user_id: 'user-1', weight_kg: 80 });
    expect([...fake.state.tables.goals.values()][0]).toMatchObject({ user_id: 'user-1', type: 'weekly_workouts', target: 3 });
    expect(await dbm.db.bodyEntries.where('dirty').equals(1).count()).toBe(0);

    // "Second device": wipe local data (this also resets the sync cursors) and sync again.
    await dbm.clearLocalData();
    await sync.runSync();
    const entries = await dbm.listBodyEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ date: '2026-11-01', weight_kg: 80, dirty: 0 });
    expect(await dbm.listGoals()).toHaveLength(1);
  });

  it('stores the profile under the account id on the server but "me" on the device', async () => {
    await dbm.saveProfile({ display_name: 'Chris', units: 'kg', height_cm: 180 });
    await sync.runSync();
    const server = fake.state.tables.profiles.get('user-1');
    expect(server).toMatchObject({ id: 'user-1', display_name: 'Chris', units: 'kg', height_cm: 180 });
    expect(await dbm.db.profile.get('me')).toMatchObject({ dirty: 0, display_name: 'Chris' });
    expect(await dbm.db.profile.count()).toBe(1);
  });

  it("a brand-new device's default profile does not overwrite the account's real one", async () => {
    fake.state.tables.profiles = new Map([
      ['user-1', { id: 'user-1', display_name: 'Chris', units: 'kg', height_cm: 180, week_start: 1, updated_at: '2026-10-01T00:00:00.000Z' }],
    ]);
    await dbm.saveProfile({ display_name: '', units: 'lb' }); // edited before the first sync
    await sync.runSync();
    expect(await dbm.getProfile()).toMatchObject({ display_name: 'Chris', units: 'kg' });
    expect(fake.state.tables.profiles.get('user-1').display_name).toBe('Chris');
  });

  it('a synced profile edited later is pushed, not overwritten', async () => {
    await dbm.saveProfile({ display_name: 'Chris' });
    await sync.runSync();
    await dbm.saveProfile({ display_name: 'Chris K' });
    await sync.runSync();
    expect(fake.state.tables.profiles.get('user-1').display_name).toBe('Chris K');
    expect((await dbm.getProfile()).display_name).toBe('Chris K');
  });
});

describe('whose data is on this device', () => {
  it('records the signed-in account as the owner', async () => {
    await sync.runSync();
    expect(dbm.getOwner()).toBe('user-1');
  });

  it('a different account never inherits (or uploads) the previous account\'s rows', async () => {
    await dbm.saveBodyEntry({ date: '2026-11-01', weight_kg: 80 });
    await sync.runSync();
    await dbm.saveBodyEntry({ date: '2026-11-02', weight_kg: 81 }); // unsynced edit by user-1

    fake.state.userId = 'user-2';
    fake.state.calls = [];
    await sync.runSync();

    expect(await dbm.listBodyEntries()).toEqual([]);
    expect(fake.state.calls.filter((c) => c[0] === 'upsert')).toEqual([]);
    expect(dbm.getOwner()).toBe('user-2');
  });

  it('keeps the first account\'s data when it simply signs in again', async () => {
    await dbm.saveBodyEntry({ date: '2026-11-01', weight_kg: 80 });
    await sync.runSync();
    await sync.runSync();
    expect(await dbm.listBodyEntries()).toHaveLength(1);
  });

  it('data created before accounts existed is adopted by the first account that signs in', async () => {
    await dbm.saveBodyEntry({ date: '2026-11-01', weight_kg: 80 });
    expect(dbm.getOwner()).toBeNull();
    await sync.runSync();
    expect(fake.state.tables.body_entries.size).toBe(1);
  });
});

describe('deleting data', () => {
  it('clearLocalData removes every table, the sync cursors and the owner', async () => {
    await dbm.saveBodyEntry({ date: '2026-11-01', weight_kg: 80 });
    await dbm.saveGoal({ type: 'weekly_workouts', target: 3 });
    await dbm.saveProfile({ display_name: 'A' });
    await sync.runSync();
    await dbm.clearLocalData();
    for (const t of dbm.db.tables) expect(await t.count()).toBe(0);
    expect(dbm.getOwner()).toBeNull();
  });
});
