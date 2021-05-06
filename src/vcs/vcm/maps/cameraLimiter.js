import Cartographic from '@vcmap/cesium/Source/Core/Cartographic.js';
import Ellipsoid from '@vcmap/cesium/Source/Core/Ellipsoid.js';
import { checkMaybe } from '@vcsuite/check';
import { parseInteger, parseNumber, parseEnumValue } from '@vcsuite/parsers';
import { sampleCesiumTerrain, sampleCesiumTerrainMostDetailed, getTerrainProviderForUrl } from '../layer/terrainHelpers.js';

/**
 * @typedef {Object} vcs.vcm.maps.CameraLimiter.Options
 * @property {string|undefined} terrainUrl - required if mode is distance.
 * @property {string|undefined} [mode="height"] - either "height" or "distance".
 * @property {number} [limit=200]
 * @property {number|null} [level=12] - the level at which to request terrain data. setting this to null will request most detailed
 * @api
 */

/**
 * @enum {string}
 * @property {string} HEIGHT
 * @property {string} DISTANCE
 * @memberOf vcs.vcm.maps.CameraLimiter
 */
export const Mode = {
  HEIGHT: 'height',
  DISTANCE: 'distance',
};

/**
 * Can limit a Cesium.Cameras position based on absolute height or distance to a given terrain
 * @class
 * @memberOf vcs.vcm.maps
 * @export
 * @api
 */
class CameraLimiter {
  static get className() { return 'vcs.vcm.maps.CameraLimiter'; }

  /**
   * @returns {vcs.vcm.maps.CameraLimiter.Options}
   */
  static getDefaultOptions() {
    return {
      mode: Mode.HEIGHT,
      terrainUrl: undefined,
      limit: 200,
      level: 12,
    };
  }

  /**
   * @param {vcs.vcm.maps.CameraLimiter.Options} options
   */
  constructor(options) {
    const defaultOptions = CameraLimiter.getDefaultOptions();
    /**
     * The mode to use. When using DISTANCE mode, be sure to have a terrainProvider set.
     * @type {vcs.vcm.maps.CameraLimiter.Mode}
     * @api
     */
    this.mode = parseEnumValue(options.mode, Mode, defaultOptions.mode);
    /**
     * @type {string|null}
     * @private
     */
    this._terrainUrl = options.terrainUrl || defaultOptions.terrainUrl;
    /**
     * @type {Cesium/CesiumTerrainProvider|null}
     * @private
     */
    this._terrainProvider = this._terrainUrl ? getTerrainProviderForUrl({ url: this._terrainUrl }) : null;
    /**
     * The minimum height/distance to the terrain the camera must maintain
     * @type {number}
     * @api
     */
    this.limit = parseNumber(options.limit, defaultOptions.limit);
    /**
     * The level to request terrain data at
     * @type {number|null}
     * @api
     */
    this.level = options.level === null ? null : parseInteger(options.level, defaultOptions.level);
  }

  /**
   * The url of the terrain to use. Required for mode DISTANCE
   * @type {string|null}
   * @api
   */
  get terrainUrl() {
    return this._terrainUrl;
  }

  /**
   * @param {string|null} url
   */
  set terrainUrl(url) {
    checkMaybe(url, String);

    if (this._terrainUrl !== url) {
      this._terrainUrl = url;
      this._terrainProvider = this._terrainUrl ? getTerrainProviderForUrl({ url: this._terrainUrl }) : null;
    }
  }

  /**
   * @param {Cesium/Cartographic} cameraCartographic
   * @returns {Promise<Array<Cesium/Cartographic>>}
   * @private
   */
  _limitWithLevel(cameraCartographic) {
    return sampleCesiumTerrain(this._terrainProvider, this.level, [cameraCartographic]);
  }

  /**
   * @param {Cesium/Cartographic} cameraCartographic
   * @returns {Promise<Array<Cesium/Cartographic>>}
   * @private
   */
  _limitMostDetailed(cameraCartographic) {
    return sampleCesiumTerrainMostDetailed(this._terrainProvider, [cameraCartographic]);
  }

  /**
   * Limits the given camera based on this limiters specs.
   * @param {Cesium/Camera} camera
   * @returns {Promise<void>}
   * @api
   */
  async limitCamera(camera) {
    const cameraCartographic = Cartographic.fromCartesian(camera.position);
    if (cameraCartographic) {
      if (this.mode === Mode.DISTANCE && this._terrainProvider) {
        const cameraHeight = cameraCartographic.height;
        const [updatedPosition] = this.level != null ?
          await this._limitWithLevel(cameraCartographic) :
          await this._limitMostDetailed(cameraCartographic);

        if ((cameraHeight - updatedPosition.height) < this.limit) {
          updatedPosition.height += this.limit;
          Cartographic.toCartesian(
            updatedPosition,
            Ellipsoid.WGS84,
            camera.position,
          );
        }
      } else if (cameraCartographic.height < this.limit) {
        cameraCartographic.height = this.limit;
        Cartographic.toCartesian(
          cameraCartographic,
          Ellipsoid.WGS84,
          camera.position,
        );
      }
    }
  }

  /**
   * @returns {vcs.vcm.maps.CameraLimiter.Options}
   */
  getConfigObject() {
    const config = {};
    const defaultOptions = CameraLimiter.getDefaultOptions();
    if (this.terrainUrl) {
      config.terrainUrl = this.terrainUrl;
    }

    if (this.limit !== defaultOptions.limit) {
      config.limit = this.limit;
    }

    if (this.mode !== defaultOptions.mode) {
      config.mode = this.mode;
    }

    if (this.level !== defaultOptions.level) {
      config.level = this.level;
    }
    return config;
  }
}

export default CameraLimiter;
