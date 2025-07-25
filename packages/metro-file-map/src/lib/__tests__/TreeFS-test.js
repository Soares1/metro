/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @oncall react_native
 */

import type {CanonicalPath, FileData, FileMetadata} from '../../flow-types';
import type TreeFSType from '../TreeFS';

import H from '../../constants';

let mockPathModule;
jest.mock('path', () => mockPathModule);

describe.each([['win32'], ['posix']])('TreeFS on %s', platform => {
  // Convenience function to write paths with posix separators but convert them
  // to system separators
  const p: string => string = filePath =>
    platform === 'win32'
      ? filePath.replace(/\//g, '\\').replace(/^\\/, 'C:\\')
      : filePath;

  let tfs: TreeFSType;
  let TreeFS: Class<TreeFSType>;

  beforeEach(() => {
    jest.resetModules();
    mockPathModule = jest.requireActual<{}>('path')[platform];
    TreeFS = require('../TreeFS').default;
    tfs = new TreeFS({
      rootDir: p('/project'),
      files: new Map<CanonicalPath, FileMetadata>([
        [p('foo/another.js'), ['another', 123, 2, 0, '', '', 0]],
        [p('foo/owndir'), ['', 0, 0, 0, '', '', '.']],
        [p('foo/link-to-bar.js'), ['', 0, 0, 0, '', '', p('../bar.js')]],
        [p('foo/link-to-another.js'), ['', 0, 0, 0, '', '', p('another.js')]],
        [p('../outside/external.js'), ['', 0, 0, 0, '', '', 0]],
        [p('bar.js'), ['bar', 234, 3, 0, '', '', 0]],
        [p('link-to-foo'), ['', 456, 0, 0, '', '', p('./../project/foo')]],
        [p('abs-link-out'), ['', 456, 0, 0, '', '', p('/outside/./baz/..')]],
        [p('root'), ['', 0, 0, 0, '', '', '..']],
        [p('link-to-nowhere'), ['', 123, 0, 0, '', '', p('./nowhere')]],
        [p('link-to-self'), ['', 123, 0, 0, '', '', p('./link-to-self')]],
        [p('link-cycle-1'), ['', 123, 0, 0, '', '', p('./link-cycle-2')]],
        [p('link-cycle-2'), ['', 123, 0, 0, '', '', p('./link-cycle-1')]],
        [p('node_modules/pkg/a.js'), ['a', 123, 0, 0, '', '', 0]],
        [p('node_modules/pkg/package.json'), ['pkg', 123, 0, 0, '', '', 0]],
      ]),
      processFile: () => {
        throw new Error('Not implemented');
      },
    });
  });

  test('all files iterator returns all regular files by real path', () => {
    expect(tfs.getAllFiles().sort()).toEqual([
      p('/outside/external.js'),
      p('/project/bar.js'),
      p('/project/foo/another.js'),
      p('/project/node_modules/pkg/a.js'),
      p('/project/node_modules/pkg/package.json'),
    ]);
  });

  test.each([
    p('/outside/external.js'),
    p('/project/bar.js'),
    p('/project/foo/another.js'),
    p('/project/foo/link-to-another.js'),
    p('/project/link-to-foo/another.js'),
    p('/project/link-to-foo/link-to-another.js'),
    p('/project/root/outside/external.js'),
  ])('existence check passes for regular files via symlinks: %s', filePath => {
    expect(tfs.exists(filePath)).toBe(true);
  });

  test('existence check fails for directories, symlinks to directories, or symlinks to nowhere', () => {
    expect(tfs.exists(p('/project/foo'))).toBe(false);
    expect(tfs.exists(p('/project/link-to-foo'))).toBe(false);
    expect(tfs.exists(p('/project/link-to-nowhere'))).toBe(false);
  });

  test('implements linkStats()', () => {
    expect(tfs.linkStats(p('/project/link-to-foo/another.js'))).toEqual({
      fileType: 'f',
      modifiedTime: 123,
      size: 2,
    });
    expect(tfs.linkStats(p('bar.js'))).toEqual({
      fileType: 'f',
      modifiedTime: 234,
      size: 3,
    });
    expect(tfs.linkStats(p('./link-to-foo'))).toEqual({
      fileType: 'l',
      modifiedTime: 456,
      size: 0,
    });
  });

  describe('lookup', () => {
    test.each([
      [
        p('/project/foo/link-to-another.js'),
        p('/project/foo/another.js'),
        [p('/project/foo/link-to-another.js')],
      ],
      [
        p('/project/foo/link-to-bar.js'),
        p('/project/bar.js'),
        [p('/project/foo/link-to-bar.js')],
      ],
      [
        p('link-to-foo/link-to-another.js'),
        p('/project/foo/another.js'),
        [p('/project/link-to-foo'), p('/project/foo/link-to-another.js')],
      ],
      [
        p('/project/root/outside/external.js'),
        p('/outside/external.js'),
        [p('/project/root')],
      ],
      [p('/outside/../project/bar.js'), p('/project/bar.js'), []],
      [p('root/project/bar.js'), p('/project/bar.js'), [p('/project/root')]],
    ])(
      '%s -> %s through expected symlinks',
      (givenPath, expectedRealPath, expectedSymlinks) =>
        expect(tfs.lookup(givenPath)).toEqual({
          exists: true,
          links: new Set(expectedSymlinks),
          realPath: expectedRealPath,
          type: 'f',
        }),
    );

    test.each([
      [p('/project/bar.js/bad-parent'), [], p('/project/bar.js')],
      [p('/project/bar.js/'), [], p('/project/bar.js')],
      [
        p('/project/link-to-nowhere'),
        [p('/project/link-to-nowhere')],
        p('/project/nowhere'),
      ],
      [p('/project/not/exists'), [], p('/project/not')],
      [p('/project/root/missing'), [p('/project/root')], p('/missing')],
      [p('/project/../missing'), [], p('/missing')],
      [p('/project/foo/../../missing'), [], p('/missing')],
      [p('/project/foo/../../project/missing'), [], p('/project/missing')],
    ])(
      'non-existence for bad paths, missing files or broken links %s',
      (givenPath, expectedSymlinks, missingPath) =>
        expect(tfs.lookup(givenPath)).toEqual({
          exists: false,
          links: new Set(expectedSymlinks),
          missing: missingPath,
        }),
    );

    test.each([
      [p('/project/foo'), p('/project/foo')],
      [p('/project/foo/'), p('/project/foo')],
      [p('/project/root/outside'), p('/outside')],
    ])('returns type: d for %s', (givenPath, expectedRealPath) =>
      expect(tfs.lookup(givenPath)).toMatchObject({
        exists: true,
        type: 'd',
        realPath: expectedRealPath,
      }),
    );

    test('traversing the same symlink multiple times does not imply a cycle', () => {
      expect(
        tfs.lookup(p('/project/foo/owndir/owndir/another.js')),
      ).toMatchObject({
        exists: true,
        realPath: p('/project/foo/another.js'),
        type: 'f',
      });
    });

    test('ancestors of the root are not reported as missing', () => {
      const tfs = new TreeFS({
        rootDir: p('/deep/project/root'),
        files: new Map<CanonicalPath, FileMetadata>([
          [p('foo/index.js'), ['', 123, 0, 0, '', '', 0]],
          [p('link-up'), ['', 123, 0, 0, '', '', p('..')]],
        ]),
        processFile: () => {
          throw new Error('Not implemented');
        },
      });
      expect(tfs.lookup(p('/deep/missing/bar.js'))).toMatchObject({
        exists: false,
        missing: p('/deep/missing'),
      });
      expect(tfs.lookup(p('link-up/bar.js'))).toMatchObject({
        exists: false,
        missing: p('/deep/project/bar.js'),
      });
      expect(tfs.lookup(p('../../baz.js'))).toMatchObject({
        exists: false,
        missing: p('/deep/baz.js'),
      });
      expect(tfs.lookup(p('../../project/root/baz.js'))).toMatchObject({
        exists: false,
        missing: p('/deep/project/root/baz.js'),
      });
    });
  });

  describe('symlinks to an ancestor of the project root', () => {
    beforeEach(() => {
      tfs.addOrModify(p('foo/link-up-2'), ['', 0, 0, 0, '', '', p('../..')]);
    });

    test.each([
      [
        p('foo/link-up-2/project/bar.js'),
        p('/project/bar.js'),
        [p('/project/foo/link-up-2')],
      ],
      [
        p('foo/link-up-2/project/foo/link-up-2/project/bar.js'),
        p('/project/bar.js'),
        [p('/project/foo/link-up-2')],
      ],
      [
        p('foo/link-up-2/project/foo/link-up-2/outside/external.js'),
        p('/outside/external.js'),
        [p('/project/foo/link-up-2')],
      ],
    ])(
      'lookup can find files that go back towards the project root (%s)',
      (mixedPath, expectedRealPath, expectedSymlinks) => {
        expect(tfs.lookup(mixedPath)).toEqual({
          exists: true,
          realPath: expectedRealPath,
          links: new Set(expectedSymlinks),
          type: 'f',
        });
      },
    );

    test('matchFiles follows links up', () => {
      const matches = [
        ...tfs.matchFiles({
          rootDir: p('/project/foo'),
          follow: true,
          recursive: true,
        }),
      ];
      expect(matches).toContain(
        p('/project/foo/link-up-2/project/foo/another.js'),
      );
      // Only follow a symlink cycle once.
      expect(matches).not.toContain(
        p(
          '/project/foo/link-up-2/project/foo/link-up-2/project/foo/another.js',
        ),
      );
    });
  });

  describe('getDifference', () => {
    test('returns changed (inc. new) and removed files in given FileData', () => {
      const newFiles: FileData = new Map<CanonicalPath, FileMetadata>([
        [p('new-file'), ['', 789, 0, 0, '', '', 0]],
        [p('link-to-foo'), ['', 456, 0, 0, '', '', p('./foo')]],
        // Different modified time, expect new mtime in changedFiles
        [p('foo/another.js'), ['', 124, 0, 0, '', '', 0]],
        [p('link-cycle-1'), ['', 123, 0, 0, '', '', p('./link-cycle-2')]],
        [p('link-cycle-2'), ['', 123, 0, 0, '', '', p('./link-cycle-1')]],
        // Was a symlink, now a regular file
        [p('link-to-self'), ['', 123, 0, 0, '', '', 0]],
        [p('link-to-nowhere'), ['', 123, 0, 0, '', '', p('./nowhere')]],
        [p('node_modules/pkg/a.js'), ['a', 123, 0, 0, '', '', 0]],
        [p('node_modules/pkg/package.json'), ['pkg', 123, 0, 0, '', '', 0]],
      ]);
      expect(tfs.getDifference(newFiles)).toEqual({
        changedFiles: new Map<CanonicalPath, FileMetadata>([
          [p('new-file'), ['', 789, 0, 0, '', '', 0]],
          [p('foo/another.js'), ['', 124, 0, 0, '', '', 0]],
          [p('link-to-self'), ['', 123, 0, 0, '', '', 0]],
        ]),
        removedFiles: new Set([
          p('foo/owndir'),
          p('foo/link-to-bar.js'),
          p('foo/link-to-another.js'),
          p('../outside/external.js'),
          p('bar.js'),
          p('abs-link-out'),
          p('root'),
        ]),
      });
    });
  });

  describe('hierarchicalLookup', () => {
    let tfs: TreeFSType;

    beforeEach(() => {
      tfs = new TreeFS({
        rootDir: p('/A/B/C'),
        files: new Map<CanonicalPath, FileMetadata>(
          ([
            [
              p('a/1/package.json'),
              ['', 0, 0, 0, '', '', './real-package.json'],
            ],
            [
              p('a/2/package.json'),
              ['', 0, 0, 0, '', '', './notexist-package.json'],
            ],
            [p('a/b/c/d/link-to-C'), ['', 0, 0, 0, '', '', p('../../../..')]],
            [
              p('a/b/c/d/link-to-B'),
              ['', 0, 0, 0, '', '', p('../../../../..')],
            ],
            [
              p('a/b/c/d/link-to-A'),
              ['', 0, 0, 0, '', '', p('../../../../../..')],
            ],
            [
              p('n_m/workspace/link-to-pkg'),
              ['', 0, 0, 0, '', '', p('../../../workspace-pkg')],
            ],
          ]: Array<[CanonicalPath, FileMetadata]>).concat(
            [
              'a/package.json',
              // A directory named package.json should never match
              'a/b/package.json/index.js',
              'a/b/c/package.json',
              'a/b/c/d/foo.js',
              'a/1/real-package.json',
              'a/b/bar.js',
              'a/n_m/pkg/package.json',
              'a/n_m/pkg/foo.js',
              'a/n_m/pkg/subpath/deep/bar.js',
              'a/n_m/pkg/subpath/package.json',
              'a/n_m/pkg/n_m/pkg2/index.js',
              'a/n_m/pkg/n_m/pkg2/package.json',
              '../../package.json',
              '../../../a/b/package.json',
              '../workspace-pkg/package.json',
            ].map(posixPath => [p(posixPath), ['', 0, 0, 0, '', '', 0]]),
          ),
        ),
        processFile: () => {
          throw new Error('Not implemented');
        },
      });
    });

    test.each([
      ['/A/B/C/a', '/A/B/C/a/package.json', '', []],
      ['/A/B/C/a/b', '/A/B/C/a/package.json', 'b', ['/A/B/C/a/b/package.json']],
      [
        '/A/B/C/a/package.json',
        '/A/B/C/a/package.json',
        'package.json',
        ['/A/B/C/a/package.json'],
      ],
      [
        '/A/B/C/a/b/notexists',
        '/A/B/C/a/package.json',
        'b/notexists',
        ['/A/B/C/a/b/notexists', '/A/B/C/a/b/package.json'],
      ],
      ['/A/B/C/a/b/c', '/A/B/C/a/b/c/package.json', '', []],
      [
        '/A/B/C/other',
        '/A/package.json',
        'B/C/other',
        ['/A/B/C/other', '/A/B/C/package.json', '/A/B/package.json'],
      ],
      [
        '/A/B/C',
        '/A/package.json',
        'B/C',
        ['/A/B/C/package.json', '/A/B/package.json'],
      ],
      ['/A/B', '/A/package.json', 'B', ['/A/B/package.json']],
      [
        '/A/B/foo',
        '/A/package.json',
        'B/foo',

        ['/A/B/foo', '/A/B/package.json'],
      ],
      ['/A/foo', '/A/package.json', 'foo', ['/A/foo']],
      ['/foo', null, null, ['/foo', '/package.json']],
      [
        '/A/B/C/a/b/c/d/link-to-C/foo.js',
        '/A/B/C/a/b/c/package.json',
        'd/link-to-C/foo.js',
        [
          '/A/B/C/a/b/c/d/link-to-C',
          '/A/B/C/a/b/c/d/package.json',
          '/A/B/C/foo.js',
          '/A/B/C/package.json',
        ],
      ],
      [
        '/A/B/C/a/b/c/d/link-to-B/C/foo.js',
        '/A/B/C/a/b/c/package.json',
        'd/link-to-B/C/foo.js',
        [
          '/A/B/C/a/b/c/d/link-to-B',
          '/A/B/C/a/b/c/d/package.json',
          '/A/B/C/foo.js',
          '/A/B/C/package.json',
          '/A/B/package.json',
        ],
      ],
      [
        '/A/B/C/a/b/c/d/link-to-A/B/C/foo.js',
        '/A/package.json',
        'B/C/foo.js',
        [
          '/A/B/C/a/b/c/d/link-to-A',
          '/A/B/C/foo.js',
          '/A/B/C/package.json',
          '/A/B/package.json',
        ],
      ],
      [
        '/A/B/C/a/1/foo.js',
        '/A/B/C/a/1/real-package.json',
        'foo.js',
        ['/A/B/C/a/1/foo.js', '/A/B/C/a/1/package.json'],
      ],
      [
        '/A/B/C/a/2/foo.js',
        '/A/B/C/a/package.json',
        '2/foo.js',
        [
          '/A/B/C/a/2/foo.js',
          '/A/B/C/a/2/notexist-package.json',
          '/A/B/C/a/2/package.json',
        ],
      ],
      [
        '/A/B/C/a/n_m/pkg/notexist.js',
        '/A/B/C/a/n_m/pkg/package.json',
        'notexist.js',
        ['/A/B/C/a/n_m/pkg/notexist.js'],
      ],
      [
        '/A/B/C/a/n_m/pkg/subpath/notexist.js',
        '/A/B/C/a/n_m/pkg/subpath/package.json',
        'notexist.js',
        ['/A/B/C/a/n_m/pkg/subpath/notexist.js'],
      ],
      [
        '/A/B/C/a/n_m/pkg/otherpath/notexist.js',
        '/A/B/C/a/n_m/pkg/package.json',
        'otherpath/notexist.js',
        ['/A/B/C/a/n_m/pkg/otherpath'],
      ],
      // pkg3 does not exist, doesn't look beyond the containing n_m
      ['/A/B/C/a/n_m/pkg3/foo.js', null, null, ['/A/B/C/a/n_m/pkg3']],
      // Does not look beyond n_m, if n_m does not exist
      ['/A/B/C/a/b/n_m/pkg/foo', null, null, ['/A/B/C/a/b/n_m']],
      [
        '/A/B/C/n_m/workspace/link-to-pkg/subpath',
        '/A/B/workspace-pkg/package.json',
        'subpath',
        ['/A/B/C/n_m/workspace/link-to-pkg', '/A/B/workspace-pkg/subpath'],
      ],
    ])(
      '%s => %s (relative %s, invalidatedBy %s)',
      (
        startPath,
        expectedPath,
        expectedRelativeSubpath,
        expectedInvalidatedBy,
      ) => {
        const pathMap = (normalPosixPath: string) =>
          mockPathModule.resolve(p('/A/B/C'), p(normalPosixPath));
        const invalidatedBy = new Set<string>();
        expect(
          tfs.hierarchicalLookup(p(startPath), 'package.json', {
            breakOnSegment: 'n_m',
            invalidatedBy,
            subpathType: 'f',
          }),
        ).toEqual(
          expectedPath == null
            ? null
            : {
                absolutePath: pathMap(expectedPath),
                containerRelativePath: p(expectedRelativeSubpath),
              },
        );
        expect(invalidatedBy).toEqual(new Set(expectedInvalidatedBy.map(p)));
      },
    );
  });

  describe('matchFiles', () => {
    test('non-recursive, skipping deep paths', () => {
      expect(
        Array.from(
          tfs.matchFiles({
            filter: new RegExp(
              // Test starting with `./` since this is mandatory for parity with Webpack.
              /^\.\/.*/,
            ),
            filterComparePosix: true,
            follow: true,
            recursive: false,
            rootDir: p('/project'),
          }),
        ),
      ).toEqual([p('/project/bar.js')]);
    });

    test('inner directory', () => {
      expect(
        Array.from(
          tfs.matchFiles({
            filter: new RegExp(/.*/),
            follow: true,
            recursive: true,
            rootDir: p('/project/foo'),
          }),
        ),
      ).toEqual([
        p('/project/foo/another.js'),
        p('/project/foo/owndir/another.js'),
        p('/project/foo/owndir/link-to-bar.js'),
        p('/project/foo/owndir/link-to-another.js'),
        p('/project/foo/link-to-bar.js'),
        p('/project/foo/link-to-another.js'),
      ]);
    });

    test('outside rootDir', () => {
      expect(
        Array.from(
          tfs.matchFiles({
            filter: new RegExp(/.*/),
            follow: true,
            recursive: true,
            rootDir: p('/outside'),
          }),
        ),
      ).toEqual([p('/outside/external.js')]);
    });

    test('ancestor of project root includes project root', () => {
      expect(
        Array.from(
          tfs.matchFiles({
            filter: new RegExp(
              // Test starting with `./` since this is mandatory for parity with Webpack.
              /^\.\/.*\/bar\.js/,
            ),
            filterComparePosix: true,
            follow: true,
            recursive: true,
            rootDir: p('/'),
          }),
        ),
      ).toEqual([p('/project/bar.js')]);
    });

    test('recursive', () => {
      expect(
        Array.from(
          tfs.matchFiles({
            filter: new RegExp(/.*/),
            follow: true,
            recursive: true,
            rootDir: p('/project'),
          }),
        ),
      ).toEqual([
        p('/project/foo/another.js'),
        p('/project/foo/owndir/another.js'),
        p('/project/foo/owndir/link-to-bar.js'),
        p('/project/foo/owndir/link-to-another.js'),
        p('/project/foo/link-to-bar.js'),
        p('/project/foo/link-to-another.js'),
        p('/project/bar.js'),
        p('/project/link-to-foo/another.js'),
        p('/project/link-to-foo/owndir/another.js'),
        p('/project/link-to-foo/owndir/link-to-bar.js'),
        p('/project/link-to-foo/owndir/link-to-another.js'),
        p('/project/link-to-foo/link-to-bar.js'),
        p('/project/link-to-foo/link-to-another.js'),
        p('/project/abs-link-out/external.js'),
        p('/project/root/project/foo/another.js'),
        p('/project/root/project/foo/owndir/another.js'),
        p('/project/root/project/foo/owndir/link-to-bar.js'),
        p('/project/root/project/foo/owndir/link-to-another.js'),
        p('/project/root/project/foo/link-to-bar.js'),
        p('/project/root/project/foo/link-to-another.js'),
        p('/project/root/project/bar.js'),
        p('/project/root/project/link-to-foo/another.js'),
        p('/project/root/project/link-to-foo/owndir/another.js'),
        p('/project/root/project/link-to-foo/owndir/link-to-bar.js'),
        p('/project/root/project/link-to-foo/owndir/link-to-another.js'),
        p('/project/root/project/link-to-foo/link-to-bar.js'),
        p('/project/root/project/link-to-foo/link-to-another.js'),
        p('/project/root/project/abs-link-out/external.js'),
        p('/project/root/project/node_modules/pkg/a.js'),
        p('/project/root/project/node_modules/pkg/package.json'),
        p('/project/root/outside/external.js'),
        p('/project/node_modules/pkg/a.js'),
        p('/project/node_modules/pkg/package.json'),
      ]);
    });

    test('recursive, no follow', () => {
      expect(
        Array.from(
          tfs.matchFiles({
            filter: new RegExp(/.*/),
            follow: false,
            recursive: true,
            rootDir: p('/project'),
          }),
        ),
      ).toEqual([
        p('/project/foo/another.js'),
        p('/project/foo/link-to-bar.js'),
        p('/project/foo/link-to-another.js'),
        p('/project/bar.js'),
        p('/project/node_modules/pkg/a.js'),
        p('/project/node_modules/pkg/package.json'),
      ]);
    });

    test('recursive with filter', () => {
      expect(
        Array.from(
          tfs.matchFiles({
            filter: new RegExp(/\/another\.js/),
            filterComparePosix: true,
            follow: true,
            recursive: true,
            rootDir: p('/project'),
          }),
        ),
      ).toEqual([
        p('/project/foo/another.js'),
        p('/project/foo/owndir/another.js'),
        p('/project/link-to-foo/another.js'),
        p('/project/link-to-foo/owndir/another.js'),
        p('/project/root/project/foo/another.js'),
        p('/project/root/project/foo/owndir/another.js'),
        p('/project/root/project/link-to-foo/another.js'),
        p('/project/root/project/link-to-foo/owndir/another.js'),
      ]);
    });

    test('outside root, null rootDir returns matches', () => {
      expect(
        Array.from(
          tfs.matchFiles({
            filter: new RegExp(/external/),
            follow: false,
            recursive: true,
            rootDir: null,
          }),
        ),
      ).toEqual([p('/outside/external.js')]);
    });

    test('outside root, rootDir set to root has no matches', () => {
      expect(
        Array.from(
          tfs.matchFiles({
            filter: new RegExp(/external/),
            follow: false,
            recursive: true,
            rootDir: '',
          }),
        ),
      ).toEqual([]);
    });
  });

  test('compare absolute', () => {
    expect(
      Array.from(
        tfs.matchFiles({
          filter: new RegExp(/project/),
          filterCompareAbsolute: true,
          follow: false,
          recursive: true,
          rootDir: null,
        }),
      ),
    ).toEqual([
      p('/project/foo/another.js'),
      p('/project/foo/link-to-bar.js'),
      p('/project/foo/link-to-another.js'),
      p('/project/bar.js'),
      p('/project/node_modules/pkg/a.js'),
      p('/project/node_modules/pkg/package.json'),
    ]);
  });

  describe('mutation', () => {
    describe('addOrModify', () => {
      test('accepts non-real and absolute paths', () => {
        tfs.addOrModify(p('link-to-foo/new.js'), ['', 0, 1, 0, '', '', 0]);
        tfs.addOrModify(p('/project/fileatroot.js'), ['', 0, 2, 0, '', '', 0]);
        expect(tfs.getAllFiles().sort()).toEqual([
          p('/outside/external.js'),
          p('/project/bar.js'),
          p('/project/fileatroot.js'),
          p('/project/foo/another.js'),
          p('/project/foo/new.js'),
          p('/project/node_modules/pkg/a.js'),
          p('/project/node_modules/pkg/package.json'),
        ]);
        expect(tfs.getSize(p('/project/link-to-foo/new.js'))).toEqual(1);
        expect(tfs.getSize(p('/project/fileatroot.js'))).toEqual(2);
      });
    });

    describe('bulkAddOrModify', () => {
      test('adds new files and modifies existing, new symlinks work', () => {
        tfs.bulkAddOrModify(
          new Map<CanonicalPath, FileMetadata>([
            [
              p('newdir/link-to-link-to-bar.js'),
              ['', 0, 0, 0, '', '', p('../foo/link-to-bar.js')],
            ],
            [p('foo/baz.js'), ['', 0, 0, 0, '', '', 0]],
            [p('bar.js'), ['', 999, 1, 0, '', '', 0]],
          ]),
        );

        expect(tfs.getAllFiles().sort()).toEqual([
          p('/outside/external.js'),
          p('/project/bar.js'),
          p('/project/foo/another.js'),
          p('/project/foo/baz.js'),
          p('/project/node_modules/pkg/a.js'),
          p('/project/node_modules/pkg/package.json'),
        ]);

        expect(
          tfs.lookup(p('/project/newdir/link-to-link-to-bar.js')).realPath,
        ).toEqual(p('/project/bar.js'));

        expect(tfs.linkStats('bar.js')).toEqual({
          modifiedTime: 999,
          fileType: 'f',
          size: 1,
        });
      });
    });

    describe('remove', () => {
      test.each([
        [p('bar.js')],
        [p('./bar.js')],
        [p('./link-to-foo/.././bar.js')],
        [p('/outside/../project/./bar.js')],
      ])('removes a file and returns its metadata: %s', mixedPath => {
        expect(tfs.linkStats(mixedPath)).not.toBeNull();
        expect(Array.isArray(tfs.remove(mixedPath))).toBe(true);
        expect(tfs.linkStats(mixedPath)).toBeNull();
      });

      test('deletes a symlink, not its target', () => {
        expect(tfs.linkStats(p('foo/link-to-bar.js'))).not.toBeNull();
        expect(tfs.linkStats(p('bar.js'))).not.toBeNull();
        expect(Array.isArray(tfs.remove(p('foo/link-to-bar.js')))).toBe(true);
        expect(tfs.linkStats(p('foo/link-to-bar.js'))).toBeNull();
        expect(tfs.linkStats(p('bar.js'))).not.toBeNull();
      });

      test('deletes empty ancestor directories', () => {
        // node_modules/pkg contains two files
        tfs.remove(p('node_modules/pkg/a.js'));
        // Still one file left, we expect the directory to remain
        expect(tfs.lookup(p('node_modules/pkg'))).toMatchObject({
          exists: true,
          type: 'd',
        });
        // Delete the remaining file
        tfs.remove(p('node_modules/pkg/package.json'));
        // Expect the directory to be deleted
        expect(tfs.lookup(p('node_modules/pkg')).exists).toBe(false);
        // And its parent, which is now empty
        expect(tfs.lookup(p('node_modules')).exists).toBe(false);
      });

      test('deleting all files leaves an empty map', () => {
        for (const {canonicalPath} of tfs.metadataIterator({
          includeSymlinks: true,
          includeNodeModules: true,
        })) {
          tfs.remove(canonicalPath);
        }
        expect(tfs.lookup(p('node_modules')).exists).toBe(false);
        expect(tfs.lookup(p('foo')).exists).toBe(false);
      });

      test('returns null for a non-existent file', () => {
        expect(tfs.remove('notexists.js')).toBeNull();
      });
    });
  });

  describe('metadataIterator', () => {
    test('iterates over all files with Haste names, skipping node_modules and symlinks', () => {
      expect([
        ...tfs.metadataIterator({
          includeSymlinks: false,
          includeNodeModules: false,
        }),
      ]).toEqual([
        {
          baseName: 'another.js',
          canonicalPath: p('foo/another.js'),
          metadata: ['another', 123, 2, 0, '', '', 0],
        },
        {
          baseName: 'external.js',
          canonicalPath: p('../outside/external.js'),
          metadata: ['', 0, 0, 0, '', '', 0],
        },
        {
          baseName: 'bar.js',
          canonicalPath: p('bar.js'),
          metadata: ['bar', 234, 3, 0, '', '', 0],
        },
      ]);
    });

    test('iterates over all files with Haste names, including node_modules, skipping symlinks', () => {
      expect([
        ...tfs.metadataIterator({
          includeSymlinks: false,
          includeNodeModules: true,
        }),
      ]).toEqual(
        expect.arrayContaining([
          {
            baseName: 'a.js',
            canonicalPath: p('node_modules/pkg/a.js'),
            metadata: ['a', 123, 0, 0, '', '', 0],
          },
        ]),
      );
    });

    test('iterates over all files with Haste names, including node_modules and symlinks', () => {
      expect([
        ...tfs.metadataIterator({
          includeSymlinks: true,
          includeNodeModules: false,
        }),
      ]).toEqual(
        expect.arrayContaining([
          {
            baseName: 'link-to-bar.js',
            canonicalPath: p('foo/link-to-bar.js'),
            metadata: ['', 0, 0, 0, '', '', p('../bar.js')],
          },
        ]),
      );
    });
  });

  describe('getOrComputeSha1', () => {
    const mockProcessFile = jest.fn();

    beforeEach(() => {
      tfs = new TreeFS({
        rootDir: p('/project'),
        files: new Map<CanonicalPath, FileMetadata>([
          [p('foo.js'), ['', 123, 0, 0, '', 'def456', 0]],
          [p('bar.js'), ['', 123, 0, 0, '', '', 0]],
          [p('link-to-bar'), ['', 456, 0, 0, '', '', p('./bar.js')]],
        ]),
        processFile: mockProcessFile,
      });
      mockProcessFile.mockImplementation((filePath, metadata) => {
        metadata[H.SHA1] = 'abc123';
        return;
      });
      mockProcessFile.mockClear();
    });

    test('returns the precomputed SHA-1 of a file if set', async () => {
      expect(await tfs.getOrComputeSha1(p('foo.js'))).toEqual({sha1: 'def456'});
      expect(mockProcessFile).not.toHaveBeenCalled();
    });

    test('calls processFile exactly once if SHA-1 not initially set', async () => {
      expect(await tfs.getOrComputeSha1(p('bar.js'))).toEqual({sha1: 'abc123'});
      expect(mockProcessFile).toHaveBeenCalledWith(
        p('/project/bar.js'),
        expect.any(Array),
        {computeSha1: true},
      );
      mockProcessFile.mockClear();
      expect(await tfs.getOrComputeSha1(p('bar.js'))).toEqual({sha1: 'abc123'});
      expect(mockProcessFile).not.toHaveBeenCalled();
    });

    test('returns file contents alongside SHA-1 if processFile provides it', async () => {
      mockProcessFile.mockImplementationOnce((filePath, metadata) => {
        metadata[H.SHA1] = 'bcd234';
        return Buffer.from('content');
      });
      expect(await tfs.getOrComputeSha1(p('bar.js'))).toEqual({
        sha1: 'bcd234',
        content: Buffer.from('content'),
      });
      expect(mockProcessFile).toHaveBeenCalledWith(
        p('/project/bar.js'),
        expect.any(Array),
        {computeSha1: true},
      );
      mockProcessFile.mockClear();
      expect(await tfs.getOrComputeSha1(p('bar.js'))).toEqual({
        sha1: 'bcd234',
        content: undefined,
      });
      expect(mockProcessFile).not.toHaveBeenCalled();
    });

    test('calls processFile on resolved symlink targets', async () => {
      expect(await tfs.getOrComputeSha1(p('link-to-bar'))).toEqual({
        sha1: 'abc123',
      });
      expect(mockProcessFile).toHaveBeenCalledWith(
        p('/project/bar.js'),
        expect.any(Array),
        {computeSha1: true},
      );
    });

    test('clears stored SHA-1 on modification', async () => {
      let resolve: (sha1: string) => void;
      const processPromise = new Promise(r => (resolve = r));
      mockProcessFile.mockImplementationOnce(async (filePath, metadata) => {
        metadata[H.SHA1] = await processPromise;
      });
      const getOrComputePromise = tfs.getOrComputeSha1(p('bar.js'));
      expect(mockProcessFile).toHaveBeenCalledWith(
        p('/project/bar.js'),
        expect.any(Array),
        {computeSha1: true},
      );
      // Simulate the file being modified while we're waiting for the SHA1.
      tfs.addOrModify(p('bar.js'), ['', 123, 0, 0, '', '', 0]);
      resolve?.('newsha1');
      expect(await getOrComputePromise).toEqual({sha1: 'newsha1'});
      // A second call re-computes
      expect(await tfs.getOrComputeSha1(p('bar.js'))).toEqual({sha1: 'abc123'});
      expect(mockProcessFile).toHaveBeenCalledTimes(2);
    });
  });
});
