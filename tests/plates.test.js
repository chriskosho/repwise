import { describe, expect, it } from 'vitest';
import { PLATE_DEFAULTS, parsePlates, plateSetup, plateText, platesPerSide } from '../src/plates';

const lb = plateSetup({}, 'lb');
const kg = plateSetup({}, 'kg');
describe('plate math', () => {
  it('loads each side greedily', () => {
    expect(platesPerSide(135, lb).perSide).toEqual([45]);
    expect(platesPerSide(225, lb).perSide).toEqual([45, 45]);
    expect(platesPerSide(185, lb).perSide).toEqual([45, 25]);
    expect(platesPerSide(100, kg).perSide).toEqual([25, 15]);
  });
  it('handles the bar, light weights and weights you cannot make', () => {
    expect(platesPerSide(45, lb)).toBeNull();
    expect(platesPerSide(30, lb)).toBeNull();
    expect(plateText(48, lb, 'lb')).toMatch(/Each side: 0|short/);
    expect(plateText(137, lb, 'lb')).toBe('Each side: 45 (2 lb short with your plates)');
    expect(plateText(135, lb, 'lb')).toBe('Each side: 45');
  });
  it('uses your own bar and plates', () => {
    const s = plateSetup({ bar_lb: '35', plates_lb: '25, 10, 5' }, 'lb');
    expect(s).toEqual({ bar: 35, plates: [25, 10, 5] });
    expect(platesPerSide(95, s).perSide).toEqual([25, 5]);
    expect(parsePlates('45 35, 45; x')).toEqual([45, 35]);
    expect(PLATE_DEFAULTS.kg.bar).toBe(20);
  });
});
