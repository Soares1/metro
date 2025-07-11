/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 * @oncall react_native
 */

'use strict';

const getPackages = require('../_getPackages');
const ENGINES = require('../../package.json').engines;
const METRO_VERSION = require('../../packages/metro/package.json').version;
const fs = require('fs');
const path = require('path');

function readPackageJson(packagePath) {
  return require(path.join(packagePath, 'package.json'));
}

function checkAssertionInPackages(packages, assertionCb) {
  for (const packagePath of packages) {
    try {
      assertionCb(packagePath);
    } catch (e) {
      console.error(
        `Failed to pass assertion in package ${path.basename(packagePath)}`,
      );
      throw e;
    }
  }
}

test('forces all package names to match their folder name', () => {
  checkAssertionInPackages(getPackages(), packagePath => {
    expect(readPackageJson(packagePath).name).toEqual(
      path.basename(packagePath),
    );
  });
});

test('forces all packages to use the main metro version', () => {
  checkAssertionInPackages(getPackages(), packagePath => {
    expect(readPackageJson(packagePath).version).toEqual(METRO_VERSION);
  });
});

test('forces all packages to use the root "engines" spec', () => {
  checkAssertionInPackages(getPackages(), packagePath => {
    expect(readPackageJson(packagePath).engines).toEqual(ENGINES);
  });
});

test('forces all metro dependencies to be fixed to the main version', () => {
  const packages = getPackages();
  const packageNames = new Set(
    packages.map(packageName => path.basename(packageName)),
  );

  checkAssertionInPackages(packages, packagePath => {
    const dependencies = readPackageJson(packagePath).dependencies || {};

    for (const [name, version] of Object.entries(dependencies)) {
      if (packageNames.has(name)) {
        expect(version).toEqual(METRO_VERSION);
      }
    }
  });
});

test('forces all packages to have a prepare-release and cleanup-release scripts', () => {
  checkAssertionInPackages(getPackages(), packagePath => {
    expect(readPackageJson(packagePath).scripts).toEqual(
      expect.objectContaining({
        'prepare-release': expect.any(String),
        'cleanup-release': expect.any(String),
      }),
    );
  });
});

test('forces all packages to have a src/ folder', () => {
  checkAssertionInPackages(getPackages(), packagePath => {
    expect(fs.lstatSync(path.join(packagePath, 'src')).isDirectory()).toBe(
      true,
    );
  });
});

test('forces all packages to have an .npmignore with expected entries', () => {
  checkAssertionInPackages(getPackages(), packagePath => {
    const npmIgnorePath = path.join(packagePath, '.npmignore');
    expect(fs.existsSync(npmIgnorePath)).toBe(true);
    const lines = fs.readFileSync(npmIgnorePath, 'utf-8').split('\n');
    expect(lines).toEqual(
      expect.arrayContaining([
        '**/__mocks__/',
        '**/__tests__/',
        '/build/',
        '/src.real/',
        '/types/',
        'yarn.lock',
      ]),
    );
  });
});

test('use package.json#exports, exporting a main and package.json', () => {
  checkAssertionInPackages(getPackages(), packagePath => {
    const packageJson = readPackageJson(packagePath);
    expect(packageJson.exports).toEqual(
      expect.objectContaining({
        ...(packageJson.main != null
          ? {
              '.': packageJson.main.startsWith('./')
                ? packageJson.main
                : './' + packageJson.main,
            }
          : null),
        './package.json': './package.json',
        './private/*': './src/*.js',
      }),
    );
  });
});
