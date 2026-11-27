import { describe, expect, it } from 'vitest';
import { uploadId } from './saved';

describe('uploadId', () => {
  it('is the same for the same files in any order', () => {
    const a = [{ name: 'a.json', size: 10 }, { name: 'b.json', size: 20 }];
    expect(uploadId(a)).toBe(uploadId([...a].reverse()));
  });
  it('differs when a file changes size', () => {
    expect(uploadId([{ name: 'my_spotify_data.zip', size: 1 }])).not.toBe(uploadId([{ name: 'my_spotify_data.zip', size: 2 }]));
  });
});
