/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 * @oncall react_native
 */

import type {
  Options as DeltaBundlerOptions,
  TransformInputOptions,
} from '../DeltaBundler/types';
import type {TransformProfile} from 'metro-babel-transformer';
import type {CustomResolverOptions} from 'metro-resolver';
import type {
  MetroSourceMapSegmentTuple,
  MixedSourceMap,
} from 'metro-source-map';
import type {
  CustomTransformOptions,
  MinifierOptions,
} from 'metro-transform-worker';

type MetroSourceMapOrMappings = MixedSourceMap | MetroSourceMapSegmentTuple[];

export interface BundleOptions {
  readonly customResolverOptions: CustomResolverOptions;
  customTransformOptions: CustomTransformOptions;
  dev: boolean;
  entryFile: string;
  readonly excludeSource: boolean;
  readonly hot: boolean;
  readonly inlineSourceMap: boolean;
  readonly lazy: boolean;
  minify: boolean;
  readonly modulesOnly: boolean;
  onProgress?: (doneCont: number, totalCount: number) => unknown;
  readonly platform?: string;
  readonly runModule: boolean;
  runtimeBytecodeVersion?: number;
  readonly shallow: boolean;
  sourceMapUrl?: string;
  sourceUrl?: string;
  createModuleIdFactory?: () => (path: string) => number;
  readonly unstable_transformProfile: TransformProfile;
}

export interface BuildOptions {
  readonly withAssets?: boolean;
}

export interface ResolverInputOptions {
  readonly customResolverOptions?: CustomResolverOptions;
}

export interface SerializerOptions {
  readonly sourceMapUrl: string | null;
  readonly sourceUrl: string | null;
  readonly runModule: boolean;
  readonly excludeSource: boolean;
  readonly inlineSourceMap: boolean;
  readonly modulesOnly: boolean;
}

export interface GraphOptions {
  readonly lazy: boolean;
  readonly shallow: boolean;
}

// Stricter representation of BundleOptions.
export interface SplitBundleOptions {
  readonly entryFile: string;
  readonly resolverOptions: ResolverInputOptions;
  readonly transformOptions: TransformInputOptions;
  readonly serializerOptions: SerializerOptions;
  readonly graphOptions: GraphOptions;
  readonly onProgress: DeltaBundlerOptions['onProgress'];
}

export interface ModuleGroups {
  groups: Map<number, Set<number>>;
  modulesById: Map<number, ModuleTransportLike>;
  modulesInGroups: Set<number>;
}

export interface ModuleTransportLike {
  readonly code: string;
  readonly id: number;
  readonly map: MetroSourceMapOrMappings | null;
  readonly name?: string;
  readonly sourcePath: string;
}

export interface ModuleTransportLikeStrict {
  readonly code: string;
  readonly id: number;
  readonly map: MetroSourceMapOrMappings | null;
  readonly name?: string;
  readonly sourcePath: string;
}

export interface RamModuleTransport extends ModuleTransportLikeStrict {
  readonly source: string;
  readonly type: string;
}

export interface OutputOptions {
  bundleOutput: string;
  bundleEncoding?: 'utf8' | 'utf16le' | 'ascii';
  dev?: boolean;
  indexedRamBundle?: boolean;
  platform: string;
  sourcemapOutput?: string;
  sourcemapSourcesRoot?: string;
  sourcemapUseAbsolutePath?: boolean;
}

export interface RequestOptions {
  entryFile: string;
  inlineSourceMap?: boolean;
  sourceMapUrl?: string;
  dev?: boolean;
  minify: boolean;
  platform: string;
  createModuleIdFactory?: () => (path: string) => number;
  onProgress?: (transformedFileCount: number, totalFileCount: number) => void;
}

export type {MinifierOptions};
