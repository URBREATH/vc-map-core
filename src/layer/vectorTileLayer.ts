import Style, { type StyleFunction } from 'ol/style/Style.js';
import type { Feature } from 'ol/index.js';
import type { Size } from 'ol/size.js';

import { parseInteger } from '@vcsuite/parsers';
import CesiumMap from '../map/cesiumMap.js';
import VectorRasterTileCesiumImpl from './cesium/vectorRasterTileCesiumImpl.js';
import OpenlayersMap from '../map/openlayersMap.js';
import VectorTileOpenlayersImpl from './openlayers/vectorTileOpenlayersImpl.js';
import FeatureLayer, {
  FeatureLayerImplementation,
  FeatureLayerImplementationOptions,
  FeatureLayerOptions,
} from './featureLayer.js';
import VectorStyleItem, {
  defaultVectorStyle,
  VectorStyleItemOptions,
} from '../style/vectorStyleItem.js';
import VectorProperties, {
  VectorPropertiesOptions,
} from './vectorProperties.js';
import DeclarativeStyleItem, {
  DeclarativeStyleItemOptions,
} from '../style/declarativeStyleItem.js';
import FeatureVisibility, {
  FeatureVisibilityAction,
  globalHidden,
  hidden,
  highlighted,
} from './featureVisibility.js';
import { getStylesArray } from '../util/featureconverter/convert.js';
import { vcsLayerName } from './layerSymbols.js';
import TileProviderFeatureProvider from '../featureProvider/tileProviderFeatureProvider.js';
import {
  getObjectFromClassRegistry,
  layerClassRegistry,
  tileProviderClassRegistry,
} from '../classRegistry.js';
import TileProvider, {
  TileLoadedEvent,
  type TileProviderOptions,
  TileProviderRtree,
} from './tileProvider/tileProvider.js';
import GlobalHider from './globalHider.js';
import Extent from '../util/extent.js';
import VcsMap from '../map/vcsMap.js';
import StyleItem from '../style/styleItem.js';

/**
 * synchronizes featureVisibility Symbols on the feature;
 */
function synchronizeFeatureVisibility(
  featureVisibility: FeatureVisibility,
  globalHider: GlobalHider | undefined,
  feature: Feature,
): void {
  const featureId = feature.getId() as string | number;
  if (featureVisibility.hiddenObjects[featureId]) {
    feature[hidden] = true;
  } else if (feature[hidden]) {
    delete feature[hidden];
  }
  if (featureVisibility.highlightedObjects[featureId]) {
    feature[highlighted] =
      featureVisibility.highlightedObjects[featureId].style;
  } else if (feature[highlighted]) {
    delete feature[highlighted];
  }
  if (globalHider?.hiddenObjects[featureId]) {
    feature[globalHidden] = true;
  } else if (feature[globalHidden]) {
    delete feature[globalHidden];
  }
}

export type VectorTileOptions = FeatureLayerOptions & {
  tileProvider?: TileProviderOptions | TileProvider;
  highlightStyle?: VectorStyleItemOptions | VectorStyleItem;
  vectorProperties?: VectorPropertiesOptions;
  /**
   * used to restrict the zoom level visibility (minlevel does not allow rendering above tileProvider baseLevel)
   */
  minLevel?: number;
  /**
   * used to restrict the zoom level visibility
   */
  maxLevel?: number;
};

export type VectorTileImplementationOptions =
  FeatureLayerImplementationOptions & {
    tileProvider: TileProvider;
    tileSize: Size;
    minLevel: number;
    maxLevel: number;
    extent?: Extent;
  };

export interface VectorTileImplementation extends FeatureLayerImplementation {
  updateTiles(tiles: string[]): void;
}

/**
 * VectorTileLayer Layer for tiled vector Data. Can be connected to data with a TileProvider
 * @group Layer
 */
class VectorTileLayer extends FeatureLayer<
  VectorTileOpenlayersImpl | VectorRasterTileCesiumImpl
> {
  static get className(): string {
    return 'VectorTileLayer';
  }

  static getDefaultOptions(): VectorTileOptions {
    return {
      ...FeatureLayer.getDefaultOptions(),
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      tileProvider: undefined,
      highlightStyle: undefined,
      vectorProperties: {},
      minLevel: undefined,
      maxLevel: undefined,
    };
  }

  highlightStyle: VectorStyleItem | undefined;

  private _tileSize: Size = [256, 256];

  /**
   * at the moment only used for allowPicking, triggers a reload on change
   */
  vectorProperties: VectorProperties;

  tileProvider: TileProvider;

  private _maxLevel: number;

  private _minLevel: number;

  private _featureVisibilityListeners: (() => void)[] = [];

  // eslint-disable-next-line class-methods-use-this
  private _tileLoadEventListener: () => void = () => {};

  // eslint-disable-next-line class-methods-use-this
  private _vectorPropertiesChangedListener: () => void = () => {};

  /**
   * zIndex for features with featureStyle // Do we maybe need a global counter ?
   */
  private _styleZIndex = 0;

  /**
   * @param  options
   */
  constructor(options: VectorTileOptions) {
    super(options);

    this._supportedMaps = [CesiumMap.className, OpenlayersMap.className];

    const defaultOptions = VectorTileLayer.getDefaultOptions();

    this.highlightStyle = undefined;
    if (options.highlightStyle) {
      this.highlightStyle =
        options.highlightStyle instanceof VectorStyleItem
          ? options.highlightStyle
          : new VectorStyleItem(options.highlightStyle);
    }

    this.vectorProperties = new VectorProperties({
      allowPicking: this.allowPicking,
      ...options.vectorProperties,
    });

    this.tileProvider =
      options.tileProvider instanceof TileProvider // XXX this now throws if not passing in a tileProvider.
        ? options.tileProvider
        : (getObjectFromClassRegistry(
            tileProviderClassRegistry,
            options.tileProvider ?? { type: TileProvider.className },
          ) as TileProvider);
    if (this.tileProvider) {
      this.tileProvider.locale = this.locale;
    }

    this._maxLevel = parseInteger(options.maxLevel, defaultOptions.maxLevel);
    this._minLevel = parseInteger(options.minLevel, defaultOptions.minLevel);
  }

  /**
   * returns the currently set locale. Can be used to provide locale specific URLs.
   */
  get locale(): string {
    return super.locale;
  }

  set locale(value: string) {
    if (this.tileProvider) {
      this.tileProvider.locale = super.locale;
    }
    super.locale = value;
  }

  async initialize(): Promise<void> {
    if (!this.initialized) {
      this._tileLoadEventListener =
        this.tileProvider.tileLoadedEvent.addEventListener((event) =>
          this._handleTileLoaded(event),
        );
      this._vectorPropertiesChangedListener =
        this.vectorProperties.propertyChanged.addEventListener(() => {
          // eslint-disable-next-line no-void
          void this.reload();
        });
      this.featureProvider = new TileProviderFeatureProvider(this.name, {
        // XXX this overwrites
        style: this.style,
        tileProvider: this.tileProvider,
        vectorProperties: this.vectorProperties,
      });
    }
    await super.initialize();
  }

  private _getNextStyleZIndex(): number {
    this._styleZIndex += 1;
    return this._styleZIndex;
  }

  private _handleTileLoaded({ rtree }: TileLoadedEvent): void {
    rtree
      .all()
      .map((item) => item.value)
      .forEach((feature) => {
        const featureStyle = feature.getStyle();
        if (featureStyle && featureStyle instanceof Style) {
          featureStyle.setZIndex(this._getNextStyleZIndex());
        }
        feature[vcsLayerName] = this.name;
        feature.getStyleFunction = (): StyleFunction => {
          return this._featureStyle.bind(this) as StyleFunction;
        };
        if (this.tileProvider.trackFeaturesToTiles && this.globalHider) {
          synchronizeFeatureVisibility(
            this.featureVisibility,
            this.globalHider,
            feature,
          );
        }
      });
  }

  setGlobalHider(globalHider: GlobalHider): void {
    super.setGlobalHider(globalHider);
    this._setupFeatureVisibilityHandlers();
  }

  /**
   * Sets up listeners for featureVisibility and global hider
   */
  private _setupFeatureVisibilityHandlers(): void {
    if (!this.tileProvider.trackFeaturesToTiles) {
      return;
    }
    this._featureVisibilityListeners.forEach((cb) => {
      cb();
    });

    this._featureVisibilityListeners = [
      this.featureVisibility.changed.addEventListener(({ action, ids }) => {
        const tileIdsChanged: Set<string> = new Set();
        ids.forEach((id) => {
          const tileIds = this.tileProvider.featureIdToTileIds.get(
            id as string,
          );
          if (tileIds) {
            tileIds.forEach((tileId) => {
              const rtree = this.tileProvider.rtreeCache.get(
                tileId,
              ) as TileProviderRtree;
              const tileProviderRTreeEntry = rtree
                .all()
                .find((item) => item.value.getId() === id);
              if (tileProviderRTreeEntry) {
                const feature = tileProviderRTreeEntry.value;
                tileIdsChanged.add(tileId);
                if (action === FeatureVisibilityAction.HIGHLIGHT) {
                  feature[highlighted] =
                    this.featureVisibility.highlightedObjects[id].style;
                } else if (action === FeatureVisibilityAction.UNHIGHLIGHT) {
                  delete feature[highlighted];
                } else if (action === FeatureVisibilityAction.HIDE) {
                  feature[hidden] = true;
                } else if (action === FeatureVisibilityAction.SHOW) {
                  delete feature[hidden];
                }
              }
            });
          }
        });
        this.updateTiles([...tileIdsChanged]);
      }),
    ];

    if (this.globalHider) {
      this._featureVisibilityListeners.push(
        this.globalHider.changed.addEventListener(({ action, ids }) => {
          const tileIdsChanged: Set<string> = new Set();
          ids.forEach((id) => {
            const tileIds = this.tileProvider.featureIdToTileIds.get(
              id as string,
            );
            if (tileIds) {
              tileIds.forEach((tileId) => {
                const rtree = this.tileProvider.rtreeCache.get(
                  tileId,
                ) as TileProviderRtree;
                const tileProviderRTreeEntry = rtree
                  .all()
                  .find((item) => item.value.getId() === id);
                if (tileProviderRTreeEntry) {
                  const feature = tileProviderRTreeEntry.value;
                  tileIdsChanged.add(tileId);
                  if (action === FeatureVisibilityAction.HIDE) {
                    feature[globalHidden] = true;
                  } else if (action === FeatureVisibilityAction.SHOW) {
                    delete feature[globalHidden];
                  }
                }
              });
            }
          });
          this.updateTiles([...tileIdsChanged]);
        }),
      );
    }
  }

  /**
   * rerenders the specified tiles
   * rendering happens async
   */
  updateTiles(tileIds: string[]): void {
    this.getImplementations().forEach((impl) => {
      impl.updateTiles(tileIds);
    });
  }

  /**
   * calculates the style the feature has to be rendered
   */
  private _featureStyle(feature: Feature, resolution: number): Style[] {
    let style;
    if (feature[hidden] || feature[globalHidden]) {
      return [];
    }
    if (feature[highlighted]) {
      // priority highlighted features
      ({ style } = feature[highlighted]);
    } else if (this.style instanceof DeclarativeStyleItem) {
      // if declarative use layerStyle
      ({ style } = this.style);
    } else {
      // if vectorStyle use featureStyle
      style = feature.getStyle() || this.style.style;
    }
    return getStylesArray(style, feature, resolution);
  }

  getImplementationOptions(): VectorTileImplementationOptions {
    return {
      ...super.getImplementationOptions(),
      tileProvider: this.tileProvider,
      tileSize: this._tileSize,
      minLevel: this._minLevel,
      maxLevel: this._maxLevel,
      extent: this.extent ?? new Extent(),
    };
  }

  createImplementationsForMap(
    map: VcsMap,
  ): (VectorRasterTileCesiumImpl | VectorTileOpenlayersImpl)[] {
    if (map instanceof CesiumMap) {
      return [
        new VectorRasterTileCesiumImpl(map, this.getImplementationOptions()),
      ];
    }

    if (map instanceof OpenlayersMap) {
      return [
        new VectorTileOpenlayersImpl(map, this.getImplementationOptions()),
      ];
    }

    return [];
  }

  getStyleOrDefaultStyle(
    styleOptions?:
      | DeclarativeStyleItemOptions
      | VectorStyleItemOptions
      | StyleItem,
    defaultStyle?: VectorStyleItem,
  ): StyleItem {
    return super.getStyleOrDefaultStyle(
      styleOptions,
      defaultStyle || defaultVectorStyle.clone(),
    );
  }

  async activate(): Promise<void> {
    await super.activate();
    this._setupFeatureVisibilityHandlers();
    if (this.tileProvider.trackFeaturesToTiles) {
      this.tileProvider.forEachFeature((feature) => {
        synchronizeFeatureVisibility(
          this.featureVisibility,
          this.globalHider,
          feature,
        );
      });
    }
  }

  deactivate(): void {
    super.deactivate();
    this._featureVisibilityListeners.forEach((cb) => {
      cb();
    });
  }

  destroy(): void {
    this._featureVisibilityListeners.forEach((cb) => {
      cb();
    });
    super.destroy();
    this._tileLoadEventListener();
    if (this.featureProvider) {
      this.featureProvider.destroy();
    }
    if (this.tileProvider) {
      this.tileProvider.destroy();
    }
    this._vectorPropertiesChangedListener();
    if (this.vectorProperties) {
      this.vectorProperties.destroy();
    }
  }

  toJSON(): VectorTileOptions {
    const config: VectorTileOptions = super.toJSON();
    const defaultOptions = VectorTileLayer.getDefaultOptions();

    if (this._maxLevel !== defaultOptions.maxLevel) {
      config.maxLevel = this._maxLevel;
    }

    if (this._minLevel !== defaultOptions.minLevel) {
      config.minLevel = this._minLevel;
    }

    const vectorPropertiesConfig = this.vectorProperties.getVcsMeta();
    if (Object.keys(vectorPropertiesConfig).length > 0) {
      config.vectorProperties = vectorPropertiesConfig;
    }

    if (this.tileProvider) {
      config.tileProvider = this.tileProvider.toJSON();
    }

    return config;
  }
}

layerClassRegistry.registerClass(VectorTileLayer.className, VectorTileLayer);
export default VectorTileLayer;
