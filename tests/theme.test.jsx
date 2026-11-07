import { afterEach, beforeEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Settings from '../src/components/Settings';
import { applyTheme, getTheme, setTheme } from '../src/theme';

const sync = { enabled: false, session: null, status: 'idle', error: '', lastSynced: null, pending: 0, syncNow() {}, signIn() {}, signOut() {}, deleteAccount() {} };
const attr = () => document.documentElement.getAttribute('data-theme');

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});
afterEach(cleanup);

it('defaults to following the device', () => {
  expect(getTheme()).toBe('system');
  applyTheme();
  expect(attr()).toBeNull();
});

it('forces light or dark, remembers it, and can go back to the device setting', () => {
  setTheme('dark');
  expect(attr()).toBe('dark');
  expect(getTheme()).toBe('dark');
  setTheme('light');
  expect(attr()).toBe('light');
  setTheme('system');
  expect(attr()).toBeNull();
  expect(localStorage.getItem('repwise.theme')).toBeNull();
});

it('ignores a junk stored value', () => {
  localStorage.setItem('repwise.theme', 'purple');
  expect(getTheme()).toBe('system');
});

it('can be changed from Settings', async () => {
  const user = userEvent.setup();
  render(<Settings sync={sync} unit="lb" setUnit={() => {}} onExported={() => {}} />);
  const select = await screen.findByLabelText('Appearance (this device)');
  expect(select.value).toBe('system');
  await user.selectOptions(select, 'dark');
  expect(attr()).toBe('dark');
  expect(select.value).toBe('dark');
  await user.selectOptions(select, 'system');
  expect(attr()).toBeNull();
});
