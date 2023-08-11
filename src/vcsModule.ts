import { v4 as uuidv4 } from 'uuid';
import Projection, { type ProjectionOptions } from './util/projection.js';
import type { VcsMapOptions } from './map/vcsMap.js';
import type { LayerOptions } from './layer/layer.js';
import type { StyleItemOptions } from './style/styleItem.js';
import type { ViewpointOptions } from './util/viewpoint.js';
import type { ObliqueCollectionOptions } from './oblique/obliqueCollection.js';
import type VcsApp from './vcsApp.js';
import { moduleIdSymbol } from './moduleIdSymbol.js';

export type VcsModuleConfig = {
  _id?: string | undefined;
  name?: string | undefined;
  description?: string | undefined;
  properties?: Record<string, unknown>;
  layers?: LayerOptions[];
  maps?: VcsMapOptions[];
  styles?: StyleItemOptions[];
  viewpoints?: ViewpointOptions[];
  startingViewpointName?: string;
  startingMapName?: string;
  startingObliqueCollectionName?: string;
  projection?: ProjectionOptions;
  obliqueCollections?: ObliqueCollectionOptions[];
  categories?: { name: string; items: object[] }[];
};

/**
 * The id of the volatile module. Objects with this id shall never be serialized.
 */
export const volatileModuleId = uuidv4();

/**
 * This marks an object as "volatile". This ensures, that an object added to the {@link VcsApp}
 * will never be serialized into a module, regardless of the current dynamic module. Typical use case is a scratch layer
 * which represents temporary features.
 * @param  object - the object to mark as volatile
 */
export function markVolatile(
  object: object & { [moduleIdSymbol]?: string },
): void {
  object[moduleIdSymbol] = volatileModuleId;
}

/**
 * @group Application
 */
class VcsModule {
  private _uuid: string;

  name: string;

  description: string | undefined;

  properties: Record<string, unknown> | undefined;

  startingViewpointName: string | undefined;

  startingMapName: string | undefined;

  startingObliqueCollectionName: string | undefined;

  projection: Projection | undefined;

  private _config: VcsModuleConfig;

  /**
   * @param  config
   */
  constructor(config: VcsModuleConfig) {
    this._uuid = config._id || uuidv4();
    this.name = config.name ?? this._uuid;
    this.description = config.description;
    this.properties = config.properties;
    this.startingViewpointName = config.startingViewpointName;
    this.startingMapName = config.startingMapName;
    this.startingObliqueCollectionName = config.startingObliqueCollectionName;
    this.projection = config.projection
      ? new Projection(config.projection)
      : undefined;
    this._config = config;
  }

  get _id(): string {
    return this._uuid;
  }

  get config(): VcsModuleConfig {
    return JSON.parse(JSON.stringify(this._config)) as VcsModuleConfig;
  }

  /**
   * Sets the config object by serializing all runtime objects of the current app.
   * @param  app
   */
  setConfigFromApp(app: VcsApp): void {
    this._config = app.serializeModule(this._uuid);
  }

  toJSON(): VcsModuleConfig {
    const config: VcsModuleConfig = {};
    if (this._config._id) {
      config._id = this._config._id;
    }
    if (this.name) {
      config.name = this.name;
    }
    if (this.description != null) {
      config.description = this.description;
    }
    if (this.startingViewpointName != null) {
      config.startingViewpointName = this.startingViewpointName;
    }
    if (this.startingMapName != null) {
      config.startingMapName = this.startingMapName;
    }
    if (this.startingObliqueCollectionName != null) {
      config.startingObliqueCollectionName = this.startingObliqueCollectionName;
    }
    if (this.projection != null) {
      config.projection = this.projection?.toJSON();
    }
    return config;
  }
}

export default VcsModule;
