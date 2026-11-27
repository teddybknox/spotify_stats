import { describe, expect, it } from 'vitest';
import { cleanTitle, decadeOf, lookupYear, pickDzAlbums, pickMbYear, type MbReleaseGroup } from './release-core';

const rg = (title: string, date: string, artist: string, type = 'Album'): MbReleaseGroup => ({
  title,
  'first-release-date': date,
  'primary-type': type,
  'artist-credit': [{ name: artist, artist: { name: artist } }],
});

describe('release years', () => {
  it('cleans album titles', () => {
    expect(cleanTitle('A Charlie Brown Christmas [2012 Remastered & Expanded Edition]')).toBe('A Charlie Brown Christmas');
    expect(cleanTitle('Home EP')).toBe('Home');
    expect(cleanTitle('Hunky Dory (2015 Remaster)')).toBe('Hunky Dory');
    expect(cleanTitle('The Stranger (Legacy Edition)')).toBe('The Stranger');
    expect(cleanTitle('Abbey Road')).toBe('Abbey Road');
  });
  it('labels decades', () => {
    expect(decadeOf(1977)).toBe('1970s');
    expect(decadeOf(2000)).toBe('2000s');
  });
  it('takes the original year from MusicBrainz, ignoring other artists and titles', () => {
    const groups = [
      rg('The Stranger', '1977-09-29', 'Billy Joel'),
      rg('The Stranger', '2019-01-01', 'Someone Else'),
      rg('Stranger Things', '1970', 'Billy Joel'),
      rg('The Stranger', '2008-07-01', 'Billy Joel', 'Compilation'),
    ];
    expect(pickMbYear(groups, 'Billy Joel', 'The Stranger (30th Anniversary Legacy Edition)')).toBe(1977);
    expect(pickMbYear(groups, 'Billy Joel', 'Glass Houses')).toBeNull();
  });
  it('prefers the studio album over a same-titled compilation or single', () => {
    const groups = [
      { ...rg('The Beatles', '1967', 'The Beatles'), 'secondary-types': ['Compilation'] },
      rg('The Beatles', '1968-11-22', 'The Beatles'),
    ];
    expect(pickMbYear(groups, 'The Beatles', 'The Beatles')).toBe(1968);
  });
  it('matches a band name that adds or drops "Trio"', () => {
    const groups = [
      { ...rg('A Charlie Brown Christmas', '1965-12', 'Vince Guaraldi'), 'secondary-types': ['Soundtrack'] },
      { ...rg('A Charlie Brown Christmas', '2012', 'Vince Guaraldi Trio'), 'secondary-types': ['Soundtrack'] },
    ];
    expect(pickMbYear(groups, 'Vince Guaraldi Trio', 'A Charlie Brown Christmas [2012 Remastered & Expanded Edition]')).toBe(1965);
    expect(pickMbYear([rg('X', '1990', 'Ann')], 'Joanne', 'X')).toBeNull();
  });
  it('accepts joint credits', () => {
    const g: MbReleaseGroup = {
      title: 'Watch the Throne',
      'first-release-date': '2011-08-08',
      'artist-credit': [
        { name: 'JAY-Z', joinphrase: ' & ' },
        { name: 'Kanye West', joinphrase: '' },
      ],
    };
    expect(pickMbYear([g], 'Kanye West', 'Watch The Throne')).toBe(2011);
  });
  it('matches Deezer albums by artist and title', () => {
    const hits = [
      { id: 1, title: 'Malibu', artist: { name: 'Someone' } },
      { id: 2, title: 'Malibu', artist: { name: 'Anderson .Paak' } },
    ];
    expect(pickDzAlbums(hits, 'Anderson .Paak', 'Malibu').map((h) => h.id)).toEqual([2]);
  });
  it('ignores remastered editions on Deezer', async () => {
    const get = async (url: string) => {
      if (url.includes('musicbrainz')) return { 'release-groups': [] };
      if (url.includes('search/album')) return { data: [{ id: 1, title: 'Revolver (Remastered)', artist: { name: 'The Beatles' } }] };
      throw new Error(url);
    };
    expect(await lookupYear('The Beatles', 'Revolver', get)).toEqual({ year: null, source: null });
    expect(await lookupYear('The Beatles', 'Revolver (Remastered 2009)', get)).toEqual({ year: null, source: null });
  });
  it('falls back to Deezer when MusicBrainz has nothing', async () => {
    const get = async (url: string) => {
      if (url.includes('musicbrainz')) return { 'release-groups': [] };
      if (url.includes('search/album')) return { data: [{ id: 9, title: 'Home EP', artist: { name: 'Sophie Seng' } }] };
      if (url.includes('/album/9')) return { release_date: '2019-03-01' };
      throw new Error(url);
    };
    expect(await lookupYear('Sophie Seng', 'Home EP', get)).toEqual({ year: 2019, source: 'deezer' });
  });
});
