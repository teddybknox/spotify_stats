import { describe, expect, it } from 'vitest';
import { cleanAlbum, norm } from './deezer';

describe('album and name matching', () => {
  it('drops edition noise from album titles', () => {
    expect(cleanAlbum('Hunky Dory (2015 Remaster)')).toBe('Hunky Dory');
    expect(cleanAlbum('A Charlie Brown Christmas [2012 Remastered & Expanded Edition]')).toBe('A Charlie Brown Christmas');
    expect(cleanAlbum('Quadrophenia - Super Deluxe Edition')).toBe('Quadrophenia');
    expect(cleanAlbum('Abbey Road')).toBe('Abbey Road');
  });
  it('normalises names for comparison', () => {
    expect(norm('Simon & Garfunkel')).toBe(norm('simon and garfunkel'));
    expect(norm('Beyoncé')).toBe('beyonce');
    expect(norm('Anderson .Paak')).toBe('anderson paak');
  });
});
