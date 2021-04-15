import CesiumTerrainProvider from 'cesium/Source/Core/CesiumTerrainProvider.js';
import Cartographic from 'cesium/Source/Core/Cartographic.js';
import sampleTerrainMostDetailed from 'cesium/Source/Core/sampleTerrainMostDetailed.js';
import sampleTerrain from 'cesium/Source/Core/sampleTerrain.js';

import Projection, { wgs84Projection } from '../util/projection.js';

/**
 * @typedef {Object} vcs.vcm.layer.TerrainProvider.Options
 * @property {!string} url
 * @property {boolean|undefined} requestVertexNormals
 * @property {boolean|undefined} requestWaterMask
 * @api
 */

/**
 * @type {Object<string, Cesium/CesiumTerrainProvider>}
 */
const terrainProviders = {};

/**
 * @param {vcs.vcm.layer.TerrainProvider.Options} options
 * @returns {Cesium/CesiumTerrainProvider}
 */
export function getTerrainProviderForUrl(options) {
  if (!terrainProviders[options.url]) {
    terrainProviders[options.url] = new CesiumTerrainProvider(options);
    return terrainProviders[options.url];
  }
  let terrainProvider = terrainProviders[options.url];
  if ((options.requestVertexNormals !== undefined &&
    terrainProvider.requestVertexNormals !== options.requestVertexNormals) ||
    (options.requestWaterMask !== undefined &&
      terrainProvider.requestWaterMask !== options.requestWaterMask)) {
    terrainProviders[options.url] = new CesiumTerrainProvider(options);
    terrainProvider = terrainProviders[options.url];
  }
  return terrainProvider;
}

/**
 * @param {Cesium/CesiumTerrainProvider} terrainProvider
 * @param {Array<Cesium/Cartographic>} positions
 * @returns {Promise<Array<Cesium/Cartographic>>}
 */
export function sampleCesiumTerrainMostDetailed(terrainProvider, positions) {
  return new Promise((resolve, reject) => {
    sampleTerrainMostDetailed(terrainProvider, positions)
      .then((updatedPositions) => {
        resolve(updatedPositions);
      }, reject);
  });
}

/**
 * @param {Cesium/CesiumTerrainProvider} terrainProvider
 * @param {number} level
 * @param {Array<Cesium/Cartographic>} positions
 * @returns {Promise<Array<Cesium/Cartographic>>}
 */
export function sampleCesiumTerrain(terrainProvider, level, positions) {
  return new Promise((resolve, reject) => {
    sampleTerrain(terrainProvider, level, positions)
      .then((updatedPositions) => {
        resolve(updatedPositions);
      }, reject);
  });
}

/**
 * changes input coordinate Array in place, new height can also be accessed by coordinates[x][2]
 * @param {Cesium/CesiumTerrainProvider} terrainProvider
 * @param {Array<ol/Coordinate>} coordinates
 * @param {vcs.vcm.util.Projection=} optSourceProjection - if input is not WGS84
 * @returns {Promise<Array<ol/Coordinate>>}
 */
export function getHeightFromTerrainProvider(terrainProvider, coordinates, optSourceProjection) {
  const sourceTransformer = optSourceProjection ?
    Projection.getTransformer(wgs84Projection, optSourceProjection) :
    null;

  const positions = coordinates.map((coord) => {
    const wgs84 = sourceTransformer ?
      sourceTransformer(coord, coord.slice(), coord.length) :
      coord;
    return Cartographic.fromDegrees(wgs84[0], wgs84[1]);
  });

  return sampleTerrainMostDetailed(terrainProvider, positions)
    .then((updatedPositions) => {
      updatedPositions.forEach((position, index) => {
        coordinates[index][2] = position.height || 0;
      });
      return coordinates;
    });
}
