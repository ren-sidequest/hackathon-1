import { expect, it } from 'vitest';
import { isDialogBackdropClick } from '../../shared/dialog-events';

const dialog = { getBoundingClientRect: () => ({ left: 230, right: 1050, top: 255.8, bottom: 464.2 }) };
const click = (clientX: number, clientY: number, target: unknown = dialog) =>
  isDialogBackdropClick({ target, currentTarget: dialog, clientX, clientY });

it('keeps a dialog open when its interior padding is the click target', () => {
  expect(click(240, 356)).toBe(false);
  expect(click(1040, 356)).toBe(false);
  expect(click(500, 260)).toBe(false);
  expect(click(500, 460)).toBe(false);
});

it('does not treat the dialog border as its backdrop', () => {
  expect(click(230, 356)).toBe(false);
  expect(click(1050, 356)).toBe(false);
  expect(click(500, 255.8)).toBe(false);
  expect(click(500, 464.2)).toBe(false);
});

it('recognizes actual backdrop clicks on every side of the dialog', () => {
  expect(click(229, 356)).toBe(true);
  expect(click(1051, 356)).toBe(true);
  expect(click(500, 255)).toBe(true);
  expect(click(500, 465)).toBe(true);
});

it('ignores child clicks even when the child extends outside the dialog bounds', () => {
  expect(click(500, 356, {})).toBe(false);
  expect(click(200, 356, {})).toBe(false);
});
