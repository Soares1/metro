/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 * @oncall react_native
 */

import type {HandleFunction, Server} from 'connect';
import type {CacheStore, MetroCache} from 'metro-cache';
import type {CustomResolver} from 'metro-resolver';
import type {JsTransformerConfig} from 'metro-transform-worker';
import type {
  DeltaResult,
  Module,
  ReadOnlyGraph,
  SerializerOptions,
  TransformResult,
} from 'metro/private/DeltaBundler/types';
import type {Reporter} from 'metro/private/lib/reporting';
import type MetroServer from 'metro/private/Server';

export interface ExtraTransformOptions {
  readonly preloadedModules: Readonly<{[path: string]: true}> | false;
  readonly ramGroups: ReadonlyArray<string>;
  readonly transform: Readonly<{
    experimentalImportSupport: boolean;
    inlineRequires:
      | Readonly<{blockList: Readonly<{[path: string]: true}>}>
      | boolean;
    nonInlinedRequires?: ReadonlyArray<string>;
    unstable_disableES6Transforms?: boolean;
    unstable_memoizeInlineRequires?: boolean;
  }>;
}

export interface GetTransformOptionsOpts {
  dev: boolean;
  hot: boolean;
  platform?: string;
}

export type GetTransformOptions = (
  entryPoints: ReadonlyArray<string>,
  options: GetTransformOptionsOpts,
  getDependenciesOf: (filePath: string) => Promise<string[]>,
) => Promise<Partial<ExtraTransformOptions>>;

export type Middleware = HandleFunction;

export type PerfAnnotations = Partial<{
  string: {[key: string]: string};
  int: {[key: string]: number};
  double: {[key: string]: number};
  bool: {[key: string]: boolean};
  string_array: {[key: string]: string[]};
  int_array: {[key: string]: number[]};
  double_array: {[key: string]: number[]};
  bool_array: {[key: string]: boolean[]};
}>;

export type PerfLoggerPointOptions = Readonly<{
  /**
   * The time this event point occurred, if it differs from the time the point was logged.
   */
  timestamp?: number;
}>;

export interface PerfLogger {
  point(name: string, opts?: PerfLoggerPointOptions): void;
  annotate(annotations: PerfAnnotations): void;
  subSpan(label: string): PerfLogger;
}

export interface RootPerfLogger extends PerfLogger {
  start(opts?: PerfLoggerPointOptions): void;
  end(
    status: 'SUCCESS' | 'FAIL' | 'CANCEL',
    opts?: PerfLoggerPointOptions,
  ): void;
}

export type PerfLoggerFactoryOptions = Readonly<{
  key?: number;
}>;

export type PerfLoggerFactory = (
  type: 'START_UP' | 'BUNDLING_REQUEST' | 'HMR',
  opts?: PerfLoggerFactoryOptions,
) => RootPerfLogger;

export interface ResolverConfigT {
  assetExts: ReadonlyArray<string>;
  assetResolutions: ReadonlyArray<string>;
  blacklistRE?: RegExp | RegExp[];
  blockList: RegExp | RegExp[];
  dependencyExtractor?: string;
  disableHierarchicalLookup: boolean;
  extraNodeModules: {[name: string]: string};
  emptyModulePath: string;
  enableGlobalPackages: boolean;
  hasteImplModulePath?: string;
  nodeModulesPaths: ReadonlyArray<string>;
  platforms: ReadonlyArray<string>;
  resolveRequest?: CustomResolver;
  resolverMainFields: ReadonlyArray<string>;
  sourceExts: ReadonlyArray<string>;
  unstable_conditionNames: ReadonlyArray<string>;
  unstable_conditionsByPlatform: Readonly<{
    [platform: string]: ReadonlyArray<string>;
  }>;
  unstable_enablePackageExports: boolean;
  useWatchman: boolean;
  requireCycleIgnorePatterns: ReadonlyArray<RegExp>;
}

export interface SerializerConfigT {
  createModuleIdFactory: () => (path: string) => number;
  customSerializer:
    | ((
        entryPoint: string,
        preModules: ReadonlyArray<Module>,
        graph: ReadOnlyGraph,
        options: SerializerOptions,
      ) => Promise<string | {code: string; map: string}>)
    | null;
  experimentalSerializerHook: (
    graph: ReadOnlyGraph,
    delta: DeltaResult,
  ) => unknown;
  getModulesRunBeforeMainModule: (entryFilePath: string) => string[];
  getPolyfills: (options: {platform: string | null}) => ReadonlyArray<string>;
  getRunModuleStatement: (moduleId: number | string) => string;
  polyfillModuleNames: ReadonlyArray<string>;
  processModuleFilter: (modules: Module) => boolean;
  isThirdPartyModule: (module: {readonly path: string}) => boolean;
}

export interface TransformerConfigT extends JsTransformerConfig {
  getTransformOptions: GetTransformOptions;
  transformVariants: Readonly<{[name: string]: unknown}>;
  publicPath: string;
}

export interface MetalConfigT {
  cacheStores: ReadonlyArray<CacheStore<TransformResult>>;
  cacheVersion: string;
  fileMapCacheDirectory?: string;
  /** Deprecated, alias of fileMapCacheDirectory */
  hasteMapCacheDirectory?: string;
  maxWorkers: number;
  unstable_perfLoggerFactory?: PerfLoggerFactory | null;
  projectRoot: string;
  stickyWorkers: boolean;
  transformerPath: string;
  reporter: Reporter;
  resetCache: boolean;
  watchFolders: ReadonlyArray<string>;
}

export interface ServerConfigT {
  /** @deprecated */
  enhanceMiddleware: (
    metroMiddleware: Middleware,
    metroServer: MetroServer,
  ) => Middleware | Server;
  forwardClientLogs: boolean;
  port: number;
  rewriteRequestUrl: (url: string) => string;
  unstable_serverRoot: string | null;
  useGlobalHotkey: boolean;
  verifyConnections: boolean;
}

export interface SymbolicatorConfigT {
  customizeFrame: (frame: {
    readonly file?: string;
    readonly lineNumber?: number;
    readonly column?: number;
    readonly methodName?: string;
  }) =>
    | {readonly collapse?: boolean}
    | undefined
    | Promise<{readonly collapse?: boolean}>
    | Promise<undefined>;
}

export interface WatcherConfigT {
  additionalExts: ReadonlyArray<string>;
  watchman: {
    deferStates: ReadonlyArray<string>;
  };
  healthCheck: {
    enabled: boolean;
    interval: number;
    timeout: number;
    filePrefix: string;
  };
  unstable_autoSaveCache: {
    enabled: boolean;
    debounceMs?: number;
  };
}

export interface WatcherInputConfigT
  extends Partial<
    Omit<WatcherConfigT, 'healthCheck' | 'unstable_autoSaveCache'>
  > {
  healthCheck?: Partial<WatcherConfigT['healthCheck']>;
  unstable_autoSaveCache?: Partial<WatcherConfigT['unstable_autoSaveCache']>;
}

export interface InputConfigT
  extends Partial<Omit<MetalConfigT, 'cacheStores'>> {
  readonly cacheStores?:
    | ReadonlyArray<CacheStore<TransformResult>>
    | ((metroCache: MetroCache) => ReadonlyArray<CacheStore<TransformResult>>);
  readonly resolver?: Partial<ResolverConfigT>;
  readonly server?: Partial<ServerConfigT>;
  readonly serializer?: Partial<SerializerConfigT>;
  readonly symbolicator?: Partial<SymbolicatorConfigT>;
  readonly transformer?: Partial<TransformerConfigT>;
  readonly watcher?: Partial<WatcherInputConfigT>;
}

export type MetroConfig = InputConfigT;

export interface IntermediateConfigT extends MetalConfigT {
  resolver: ResolverConfigT;
  server: ServerConfigT;
  serializer: SerializerConfigT;
  symbolicator: SymbolicatorConfigT;
  transformer: TransformerConfigT;
  watcher: WatcherConfigT;
}

export interface ConfigT extends Readonly<MetalConfigT> {
  readonly resolver: Readonly<ResolverConfigT>;
  readonly server: Readonly<ServerConfigT>;
  readonly serializer: Readonly<SerializerConfigT>;
  readonly symbolicator: Readonly<SymbolicatorConfigT>;
  readonly transformer: Readonly<TransformerConfigT>;
  readonly watcher: Readonly<WatcherConfigT>;
}

export interface YargArguments {
  config?: string;
  cwd?: string;
  port?: string | number;
  host?: string;
  projectRoot?: string;
  watchFolders?: string[];
  assetExts?: string[];
  sourceExts?: string[];
  platforms?: string[];
  'max-workers'?: string | number;
  maxWorkers?: string | number;
  transformer?: string;
  'reset-cache'?: boolean;
  resetCache?: boolean;
  verbose?: boolean;
}
