import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const nestedRecord = (record: Record<string, unknown>, key: string) => {
  const value = record[key];
  if (!isRecord(value)) throw new TypeError(`Expected ${key} to be an object`);
  return value;
};

test('Windows release artifacts stay aligned across packaging and distribution', async () => {
  const [packageText, workflow, installer, readme] = await Promise.all([
    readFile(new URL('../package.json', import.meta.url), 'utf8'),
    readFile(new URL('../.github/workflows/build.yml', import.meta.url), 'utf8'),
    readFile(new URL('../installer.bat', import.meta.url), 'utf8'),
    readFile(new URL('../README.md', import.meta.url), 'utf8'),
  ]);

  const packageConfig = JSON.parse(packageText) as unknown;
  if (!isRecord(packageConfig)) throw new TypeError('Expected package.json to contain an object');
  const build = nestedRecord(packageConfig, 'build');
  const win = nestedRecord(build, 'win');
  const nsis = nestedRecord(build, 'nsis');
  const portable = nestedRecord(build, 'portable');

  assert.deepEqual(win.target, ['nsis', 'portable']);
  assert.equal(nsis.artifactName, 'MTR Diagnostic Suite Setup.exe');
  assert.equal(portable.artifactName, 'MTR Diagnostic Suite Portable.exe');

  assert.equal((workflow.match(/uses: softprops\/action-gh-release@v2/g) ?? []).length, 1);
  assert.match(workflow, /release\/\*\*\/\*\.exe/);

  assert.match(installer, /MTR%%20Diagnostic%%20Suite%%20Setup\.exe/);
  assert.doesNotMatch(installer, /Portable\.exe/i);

  assert.match(readme, /MTR Diagnostic Suite Setup\.exe[\s\S]*NSIS installer/i);
  assert.match(readme, /MTR Diagnostic Suite Portable\.exe[\s\S]*no-install/i);
  assert.match(readme, /Both editions must still be run as Administrator/i);
});
