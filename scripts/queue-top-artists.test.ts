import { describe, expect, it } from 'vitest';
import { parseListenersPage } from './queue-top-artists';

describe('parseListenersPage', () => {
  it('reads artist names out of the kworb table', () => {
    const html = `<tr><td>1</td><td class="text"><div><a href="artist/0du5_songs.html">Bruno Mars</a></div></td></tr>
      <tr><td>2</td><td class="text"><div><a href="artist/1abc_songs.html">Simon &amp; Garfunkel</a></div></td></tr>
      <tr><td>3</td><td class="text"><div><a href="artist/2abc_songs.html">Guns N&#39; Roses</a></div></td></tr>`;
    expect(parseListenersPage(html)).toEqual(['Bruno Mars', 'Simon & Garfunkel', "Guns N' Roses"]);
  });
});
