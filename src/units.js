// Body weight is stored in kg and lengths in cm; these convert for display.
// (Logged lifting weights are NOT converted: they are whatever number you typed.)
const LB_PER_KG = 2.2046226218;
const CM_PER_IN = 2.54;

export const kgToLb = (kg) => kg * LB_PER_KG;
export const lbToKg = (lb) => lb / LB_PER_KG;
export const cmToIn = (cm) => cm / CM_PER_IN;
export const inToCm = (inch) => inch * CM_PER_IN;

const round1 = (n) => Math.round(n * 10) / 10;

// kg -> number in the user's unit ('lb' | 'kg'), one decimal.
export const weightOut = (kg, unit) => (kg == null ? null : round1(unit === 'kg' ? kg : kgToLb(kg)));
// number in the user's unit -> kg (not rounded, so round trips stay stable).
export const weightIn = (v, unit) => (unit === 'kg' ? Number(v) : lbToKg(Number(v)));

export const lengthUnit = (unit) => (unit === 'kg' ? 'cm' : 'in');
export const lengthOut = (cm, unit) => (cm == null ? null : round1(unit === 'kg' ? cm : cmToIn(cm)));
export const lengthIn = (v, unit) => (unit === 'kg' ? Number(v) : inToCm(Number(v)));

// Height is shown as cm for kg users and total inches for lb users.
export const heightOut = lengthOut;
export const heightIn = lengthIn;
