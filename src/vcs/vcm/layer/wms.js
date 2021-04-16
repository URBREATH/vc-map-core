import { check } from '@vcsuite/check';
import { parseBoolean } from '@vcsuite/parsers';
import RasterLayer from './rasterLayer.js';
import WMSFeatureProvider from '../util/featureProvider/wmsFeatureProvider.js';
import CesiumMap from '../maps/cesium.js';
import WMSCesium from './cesium/wmsCesium.js';
import Openlayers from '../maps/openlayers.js';
import WMSOpenlayers from './openlayers/wmsOpenlayers.js';
import Extent from '../util/extent.js';

/**
 * @typedef {vcs.vcm.layer.RasterLayer.ImplementationOptions} vcs.vcm.layer.WMS.ImplementationOptions
 * @property {Object<string, *>} parameters
 * @property {boolean} highResolution
 * @property {ol/Size} tileSize
 * @property {string} version
 * @api
 */

/**
 * @typedef {vcs.vcm.layer.RasterLayer.Options} vcs.vcm.layer.WMS.Options
 * @property {string|undefined} layers -  string with comma separated names of the layers to display
 * @property {string} [version='1.1.1'] - WMS version (either 1.1.1 (default) or 1.3.0)
 * @property {Object<string, *>|string|undefined} parameters - key value pair of additional WMS parameters, url query notation possible
 * @property {vcs.vcm.util.featureProvider.WMSFeatureProvider.Options|undefined} featureInfo -  whether this layer should send getFeatureInfo requests to the service when objects are clicked.
 * @property {ol/Size} [tileSize=[256,256]]
 * @property {boolean} [highResolution=false] - use higher resolution images (sofar only in 3D)
 * @api
 */

/**
 * WMS layer for Cesium and Openlayers
 * @class
 * @export
 * @extends {vcs.vcm.layer.RasterLayer}
 * @api stable
 * @memberOf vcs.vcm.layer
 */
class WMS extends RasterLayer {
  static get className() { return 'vcs.vcm.layer.WMS'; }

  /**
   * @returns {vcs.vcm.layer.WMS.Options}
   */
  static getDefaultOptions() {
    return {
      ...RasterLayer.getDefaultOptions(),
      version: '1.1.1',
      parameters: undefined,
      featureInfo: undefined,
      tileSize: /** @type {ol/Size} */ ([256, 256]),
      highResolution: false,
      layers: '',
    };
  }

  /**
   * @param {vcs.vcm.layer.WMS.Options} options
   */
  constructor(options) {
    super(options);
    const defaultOptions = WMS.getDefaultOptions();

    /** @type {string} */
    this.version = options.version || defaultOptions.version;

    /** @type {Object<string, *>} */
    this.parameters = {};
    if (options.parameters) {
      let parsedParameters;
      if (typeof options.parameters === 'string') {
        parsedParameters = Object.fromEntries(new URLSearchParams(options.parameters));
      } else if (options.parameters instanceof Object) {
        parsedParameters = options.parameters;
      }
      Object.keys(parsedParameters).forEach((key) => {
        this.parameters[key.toUpperCase()] = parsedParameters[key];
      });
    }

    if (this.parameters.TRANSPARENT == null) {
      this.parameters.TRANSPARENT = false;
    }
    if (this.version) {
      this.parameters.VERSION = this.version;
    }
    this.parameters.LAYERS = options.layers || defaultOptions.layers;

    /** @type {ol/Size} */
    this.tileSize = options.tileSize || defaultOptions.tileSize;
    /** @type {boolean} */
    this.highResolution = parseBoolean(options.highResolution, defaultOptions.highResolution);
    /**
     * @type {vcs.vcm.util.featureProvider.WMSFeatureProvider.Options}
     * @private
     */
    this._featureInfoOptions = options.featureInfo || defaultOptions.featureInfo;
    this._supportedMaps = [
      CesiumMap.className,
      Openlayers.className,
    ];
  }

  /**
   * @inheritDoc
   * @returns {Promise<void>}
   */
  initialize() {
    if (!this.initialized) {
      this._setFeatureProvider();
    }
    return super.initialize();
  }

  /**
   * Sets a FeatureProvider if provided with featureInfo options
   * @private
   */
  _setFeatureProvider() {
    if (this._featureInfoOptions) {
      const options = {
        url: this.url,
        tilingSchema: this.tilingSchema,
        maxLevel: this.maxLevel,
        minLevel: this.minLevel,
        tileSize: this.tileSize,
        extent: this.extent,
        parameters: this.parameters,
        version: this.version,
        ...this._featureInfoOptions,
      };
      this.featureProvider = new WMSFeatureProvider(this.name, options);
    }
  }

  async reload() {
    if (this.featureProvider && this._featureInfoOptions) {
      this.featureProvider.destroy();
      this._setFeatureProvider();
    }
    return super.reload();
  }

  /**
   * @returns {vcs.vcm.layer.WMS.ImplementationOptions}
   */
  getImplementationOptions() {
    return {
      ...super.getImplementationOptions(),
      version: this.version,
      parameters: this.parameters,
      highResolution: this.highResolution,
      tileSize: this.tileSize,
    };
  }

  /**
   * @param {vcs.vcm.maps.VcsMap} map
   * @returns {Array<vcs.vcm.layer.cesium.WMSCesium|vcs.vcm.layer.openlayers.WMSOpenlayers>}
   */
  createImplementationsForMap(map) {
    if (map instanceof CesiumMap) {
      return [new WMSCesium(map, this.getImplementationOptions())];
    } else if (map instanceof Openlayers) {
      return [new WMSOpenlayers(map, this.getImplementationOptions())];
    }
    return [];
  }

  /**
   * Sets the layers to request from the WMS
   * @param {string|Array<string>} layers - a layer name or an array of layer names
   * @returns {Promise<void>}
   * @api stable
   */
  async setLayers(layers) {
    check(layers, [String, [String]]);
    const layersArray = Array.isArray(layers) ? layers : [layers];
    this.parameters.LAYERS = layersArray.join(',');
    await this.forceRedraw();
  }

  /**
   * Returns the currently active layers
   * @returns {Array<string>}
   * @api
   */
  getLayers() {
    return this.parameters.LAYERS ? this.parameters.LAYERS.split(',') : [];
  }

  /**
   * @returns {vcs.vcm.layer.WMS.Options}
   */
  getConfigObject() {
    const config = /** @type {vcs.vcm.layer.WMS.Options} */ (super.getConfigObject());
    const defaultOptions = WMS.getDefaultOptions();

    if (this.parameters.LAYERS) {
      config.layers = this.parameters.LAYERS;
    }

    if (this.version !== defaultOptions.version) {
      config.version = this.version;
    }

    const parameters = { ...this.parameters };
    delete parameters.VERSION;
    delete parameters.LAYERS;

    if (parameters.TRANSPARENT === false) {
      delete parameters.TRANSPARENT;
    }

    if (Object.keys(parameters).length > 0) {
      config.parameters = parameters;
    }

    if (this.version !== defaultOptions.version) {
      config.version = this.version;
    }

    if (this.highResolution !== defaultOptions.highResolution) {
      config.highResolution = this.highResolution;
    }

    if (this.tileSize[0] !== defaultOptions.tileSize[0] || this.tileSize[1] !== defaultOptions.tileSize[1]) {
      config.tileSize = /** @type {ol/Size} */ (this.tileSize.slice());
    }

    if (this.featureProvider && this.featureProvider instanceof WMSFeatureProvider) {
      const featureInfoConfig = this.featureProvider.getConfigObject();
      if (this.tileSize[0] === featureInfoConfig.tileSize[0] || this.tileSize[1] === featureInfoConfig.tileSize[1]) {
        delete featureInfoConfig.tileSize;
      }
      if (Object.entries(this.parameters).every(([key, value]) => featureInfoConfig.parameters[key] === value)) {
        delete featureInfoConfig.parameters;
      }
      if (
        featureInfoConfig.extent &&
        new Extent(/** @type {vcs.vcm.util.Extent.Options} */ (featureInfoConfig.extent)).equals(this.extent)
      ) {
        delete featureInfoConfig.extent;
      }
      if (this.url === featureInfoConfig.url) {
        delete featureInfoConfig.url;
      }
      if (this.tilingSchema === featureInfoConfig.tilingSchema) {
        delete featureInfoConfig.tilingSchema;
      }
      if (this.version === featureInfoConfig.version) {
        delete featureInfoConfig.version;
      }
      if (this.minLevel === featureInfoConfig.minLevel) {
        delete featureInfoConfig.minLevel;
      }
      if (this.maxLevel === featureInfoConfig.maxLevel) {
        delete featureInfoConfig.maxLevel;
      }
      config.featureInfo = featureInfoConfig;
    } else if (this._featureInfoOptions) {
      config.featureInfo = this._featureInfoOptions;
    }

    return config;
  }
}

export default WMS;
