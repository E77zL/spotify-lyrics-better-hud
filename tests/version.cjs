'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), version = require('../package.json').version;
assert(/^\d+\.\d+\.\d+$/.test(version));
assert.equal(require('../app/package.json').version, version);
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const native = read('native/bridge.rc'), installer = read('installer/Installer.cs');
assert(native.includes('FILEVERSION ' + version.replaceAll('.', ',') + ',0'));
assert(native.includes('"ProductVersion", "' + version + '"'));
assert(installer.includes('AssemblyFileVersion("' + version + '.0")'));
assert(installer.includes('AssemblyVersion("' + version + '.0")'));
for (const file of ['Build.ps1', 'installer/Installer.cs', 'installer/ConsoleActions.ps1', 'README.md', 'RELEASING.md', '.github/workflows/build.yml']) {
  assert(read(file).includes(version), file + ': release version missing');
  assert(!/(?<![\d.])1\.2(?!\.\d)/.test(read(file)), file + ': old release label remains');
}
assert(read('CHANGELOG.md').includes('## ' + version));
console.log('PASS package, native module, installer, build filenames, CI and release docs all agree on ' + version);
