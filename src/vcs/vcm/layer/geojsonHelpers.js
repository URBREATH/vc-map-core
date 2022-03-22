import GeoJSON from 'ol/format/GeoJSON.js';
import Polygon from 'ol/geom/Polygon.js';
import MultiPolygon from 'ol/geom/MultiPolygon.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import Circle from 'ol/geom/Circle.js';

import { getDistance as haversineDistance } from 'ol/sphere.js';
import { getLogger as getLoggerByName } from '@vcsuite/logger';
import Projection, { mercatorProjection, wgs84Projection } from '../util/projection.js';
import VectorStyleItem, { defaultVectorStyle, vectorStyleSymbol } from '../util/style/vectorStyleItem.js';
import { parseColor } from '../util/style/styleHelpers.js';
import Vector from './vector.js';
import { featureStoreStateSymbol } from './featureStoreState.js';
import { StyleType } from '../util/style/styleItem.js';
import { embedIconsInStyle } from '../util/style/writeStyle.js';
import DeclarativeStyleItem from '../util/style/declarativeStyleItem.js';
import { vcsMetaVersion } from './layer.js';
import Extent3D from '../util/featureconverter/extent3D.js';
import { styleCollection } from '../globalCollections.js';
import { circleFromCenterRadius, enforceEndingVertex, removeEndingVertexFromGeometry } from '../util/geometryHelpers.js';

const featureProjection = 'EPSG:3857';

/**
 * @type {import("ol/format/GeoJSON").default}
 * @private
 */
let format;

/**
 * @returns {import("ol/format/GeoJSON").default}
 */
function getFormat() {
  if (!format) {
    format = new GeoJSON();
  }
  return format;
}

/**
 * @returns {import("@vcsuite/logger").Logger}
 */
function getLogger() {
  return getLoggerByName('vcs.vcm.layer.GeoJSONHelper');
}

/**
 * @typedef {Object} GeoJSONData
 * @property {Array<import("ol").Feature<import("ol/geom/Geometry").default>>} features
 * @property {import("@vcmap/core").StyleItem|undefined} style
 * @property {VcsMeta|undefined} vcsMeta
 * @api
 */

/**
 * @typedef {GeoJSONreadOptions} GeoJSONinternalReadOptions
 * @property {import("ol/format/Feature").ReadOptions|undefined} formatOptions
 * @property {Array<string>|undefined} embeddedIcons
 */

/**
 * @typedef {Object} GeoJSONreadOptions
 * @property {Projection|undefined} targetProjection - projection of the output features, if undefined Mercator will be used
 * @property {Projection|undefined} dataProjection - projection of the input dataset if undefined WGS84 will be assumed
 * @property {boolean} [dynamicStyle=false]
 * @property {boolean} [readLegacyStyleOptions=false]
 * @property {boolean} [dontReadStyle=false]
 * @property {VectorStyleItem|undefined} defaultStyle
 */

/**
 * @typedef {Object} GeoJSONwriteOptions
 * @property {boolean} [asObject=false] - whether to write an object or a string
 * @property {boolean} [writeStyle=false] - whether to include vcsStyle options
 * @property {boolean} [writeDefaultStyle=false] - whether to output the default style. if the style of a layer is the default layer it is not written.
 * @property {boolean} [embedIcons=false] - whether to embed custom icons when writing styles, otherwise no style is written for custom icons
 * @property {boolean} [prettyPrint=false] - pretty print the json, if not asObject
 * @property {boolean} [writeId=false] - whether to output the feature ID
 * @api
 */


/**
 * @param {Object} geojson
 * @returns {string|null}
 * @export
 */
export function getEPSGCodeFromGeojson(geojson) {
  const { crs } = geojson;
  if (crs) {
    if (crs.type === 'name') {
      return crs.properties.name;
    } else if (crs.type === 'EPSG') {
      // 'EPSG' is not part of the GeoJSON specification, but is generated by
      // GeoServer.
      // TODO: remove this when http://jira.codehaus.org/browse/GEOS-5996
      // is fixed and widely deployed.
      return `EPSG:${crs.properties.code}`;
    }
  }
  return null;
}

/**
 * updates legacy features to the new olcesium namespaceing olcs_
 * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
 * @export
 */
export function updateLegacyFeature(feature) {
  // these changes can be done silently, because the features haven't been added to any layer
  if (feature.get('altitudeMode')) {
    feature.set('olcs_altitudeMode', feature.get('altitudeMode'), true);
    feature.unset('altitudeMode', true);
  }
  if (feature.get('extrudedHeight')) {
    if (feature.get('drawingType')) {
      feature.set('olcs_extrudedHeight', feature.get('extrudedHeight'), true);
    } else {
      const extent = Extent3D.fromGeometry(feature.getGeometry());
      const minHeight = Number.isFinite(extent.minZ) ? extent.minZ : 0;
      feature.set('olcs_extrudedHeight', feature.get('extrudedHeight') - minHeight, true);
    }
    feature.unset('extrudedHeight', true);
  }
  if (feature.get('skirt')) {
    feature.set('olcs_skirt', feature.get('skirt'), true);
    feature.unset('skirt', true);
  }

  if (feature.get('radius')) {
    feature.unset('radius', true);
  }
}

/**
 * @param {Object} geometryObj
 * @param {GeoJSONinternalReadOptions} options
 * @returns {import("ol").Feature<import("ol/geom/Geometry").default>}
 */
function readGeometry(geometryObj, options) {
  const geometry = getFormat().readGeometry(geometryObj, options.formatOptions);
  if (String(options.formatOptions.featureProjection) === 'EPSG:3857') {
    geometry[Vector.alreadyTransformedToMercator] = true;
  }
  removeEndingVertexFromGeometry(geometry);
  return new Feature({ geometry });
}

/**
 * @param {VectorStyleItemOptions} object
 * @param {GeoJSONinternalReadOptions} options
 * @returns {VectorStyleItemOptions}
 * @todo this could also be done for declarative styles image and conditions could be checked?
 */
function setEmbeddedIcons(object, options) {
  if (
    object.image &&
    object.image.src &&
    /^:\d+$/.test(object.image.src)
  ) {
    if (options.embeddedIcons) {
      object.image.src = options.embeddedIcons[object.image.src.substring(1)];
    } else {
      delete object.image.src;
    }
  }
  return object;
}

/**
 * @param {Object} properties
 * @param {string} geometryType
 * @returns {VectorStyleItemOptions|undefined}
 */
function parseLegacyStyleOptions(properties, geometryType) {
  const color = properties.color ? parseColor(properties.color) : false;
  const width = properties.width || 1.25;
  const radius = properties.pointRadius || 5;
  const opacity = properties.opacity || 0.8;

  delete properties.color;
  delete properties.width;
  delete properties.pointRadius;
  delete properties.opacity;

  if (geometryType === 'Polygon' || geometryType === 'Circle') {
    const fillColor = color ? color.slice() : [255, 255, 255, 0.4];
    fillColor[3] = opacity;
    return {
      fill: { color: /** @type {import("ol/color").Color} */ (fillColor) },
      stroke: {
        color: color || parseColor('#3399CC'),
        width,
      },
    };
  }
  if (geometryType === 'LineString') {
    return {
      stroke: {
        color: color || parseColor('#3399CC'),
        width,
      },
    };
  }
  if (geometryType === 'Point') {
    return {
      image: {
        fill: {
          color: [255, 255, 255, 0.4],
        },
        radius,
        stroke: {
          color: color || parseColor('#3399CC'),
          width: 1,
        },
      },
    };
  }
  return undefined;
}
/**
 * @param {Object} featureObj
 * @param {GeoJSONinternalReadOptions} options
 * @returns {import("ol").Feature<import("ol/geom/Geometry").default>|null}
 */
function readFeature(featureObj, options) {
  if (!featureObj.geometry) {
    return null;
  }
  const radius = featureObj.geometry.olcs_radius;
  let geometry = getFormat().readGeometry(featureObj.geometry, options.formatOptions);

  if (featureObj.radius && geometry instanceof Point) {
    const coordinates = geometry.getCoordinates();
    if (coordinates.length === 2) {
      coordinates.push(0);
    }
    geometry = new Circle(coordinates, featureObj.radius, 'XYZ');
  }
  if (radius && geometry instanceof Point) {
    const coordinates = geometry.getCoordinates();
    if (coordinates.length === 2) {
      coordinates.push(0);
    }
    geometry = circleFromCenterRadius(coordinates, radius);
  }
  if (String(options.formatOptions.featureProjection) === 'EPSG:3857') {
    geometry[Vector.alreadyTransformedToMercator] = true;
  }

  featureObj.vcsMeta = featureObj.vcsMeta || {};
  if (featureObj.vcsStyle) {
    featureObj.vcsMeta.style = featureObj.vcsMeta.style || featureObj.vcsStyle;
  }
  const { properties } = featureObj;
  if (options.readLegacyStyleOptions && !featureObj.vcsMeta.style) {
    featureObj.vcsMeta.style = parseLegacyStyleOptions(properties, geometry.getType());
  }
  removeEndingVertexFromGeometry(geometry);
  const feature = new Feature({ ...properties, geometry });
  if (featureObj.id) {
    feature.setId(featureObj.id);
  }

  if (featureObj.state) {
    feature[featureStoreStateSymbol] = featureObj.state;
  }

  if (featureObj.vcsMeta.style && !options.dontReadStyle) {
    featureObj.vcsMeta.style = setEmbeddedIcons(featureObj.vcsMeta.style, options);
    let styleItem;
    if (options.defaultStyle) {
      styleItem = options.defaultStyle
        .clone()
        .assign(new VectorStyleItem(featureObj.vcsMeta.style));
      if (styleItem.label != null) {
        geometry.set('_vcsGeomType', 'Label');
      }
    } else {
      styleItem = new VectorStyleItem(featureObj.vcsMeta.style);
    }
    feature[vectorStyleSymbol] = styleItem;
    feature.setStyle(styleItem.style);
  }
  updateLegacyFeature(feature);
  return feature;
}

/**
 * parses a string to GeoJSON
 * @param {string|Object} input
 * @param {GeoJSONreadOptions=} readOptions
 * @returns {GeoJSONData}
 * @throws SyntaxError
 * @export
 * @api
 */
export function parseGeoJSON(input, readOptions = {}) {
  const geoJSON = typeof input === 'string' ? JSON.parse(input) : input;

  const epsgCode = getEPSGCodeFromGeojson(geoJSON);
  const defaultDataProjection = epsgCode ? { epsg: epsgCode } : readOptions.dataProjection;
  /** @type {GeoJSONinternalReadOptions} */
  const options = {
    formatOptions: {
      dataProjection: defaultDataProjection ?
        defaultDataProjection.epsg :
        wgs84Projection.epsg,
      featureProjection: readOptions.targetProjection ?
        readOptions.targetProjection.epsg :
        mercatorProjection.epsg,
    },
    dontReadStyle: readOptions.dontReadStyle,
    readLegacyStyleOptions: readOptions.readLegacyStyleOptions,
    defaultStyle: readOptions.defaultStyle,
  };

  if (readOptions.dynamicStyle && !options.defaultStyle) {
    options.defaultStyle = defaultVectorStyle;
  }

  if (geoJSON.type === 'FeatureCollection') {
    geoJSON.vcsMeta = geoJSON.vcsMeta || {
      embeddedIcons: geoJSON.vcsEmbeddedIcons,
      style: geoJSON.vcsStyle,
    };

    let style;
    if (geoJSON.vcsMeta.embeddedIcons) {
      options.embeddedIcons = geoJSON.vcsMeta.embeddedIcons;
    }
    if (geoJSON.vcsMeta.style && readOptions.dynamicStyle) {
      if (geoJSON.vcsMeta.style.type === StyleType.REFERENCE) {
        style = styleCollection.getByKey(geoJSON.vcsMeta.style.name);
        if (!style) {
          getLogger().warning(`could not load referenced style ${geoJSON.vcsMeta.style.name}`);
        } else if (style instanceof VectorStyleItem) {
          options.defaultStyle = style;
        }
      } else if (geoJSON.vcsMeta.style.type === StyleType.DECLARATIVE) {
        style = new DeclarativeStyleItem(geoJSON.vcsMeta.style);
      } else {
        geoJSON.vcsMeta.style = setEmbeddedIcons(geoJSON.vcsMeta.style, options);
        options.defaultStyle = options.defaultStyle
          .clone()
          .assign(new VectorStyleItem(geoJSON.vcsMeta.style));
        style = options.defaultStyle;
      }
    }
    return {
      features: geoJSON.features.map(f => readFeature(f, options)).filter(f => f),
      style: geoJSON.vcsMeta.style ? style : undefined,
      vcsMeta: geoJSON.vcsMeta ? geoJSON.vcsMeta : undefined,
    };
  } else if (geoJSON.type === 'Feature') {
    const feature = readFeature(geoJSON, options);
    return { features: feature ? [feature] : [], vcsMeta: geoJSON.vcsMeta ? geoJSON.vcsMeta : undefined };
  } else if (geoJSON.type != null) {
    return { features: [readGeometry(geoJSON, options)] };
  }
  return { features: [] };
}

/**
 * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
 * @param {GeoJSONwriteOptions=} options
 * @param {Array=} embeddedIcons
 * @returns {Object}
 */
export function writeGeoJSONFeature(feature, options = {}, embeddedIcons) {
  const featureObject = {
    type: 'Feature',
    properties: feature.getProperties(),
  };

  if (options.writeId) {
    featureObject.id = feature.getId();
  }

  delete featureObject.properties[feature.getGeometryName()];
  delete featureObject.properties.style;
  delete featureObject.properties.olcs_allowPicking;

  let geometry = feature.getGeometry();
  let radius = null;
  if (geometry instanceof Circle) {
    const coordinates = geometry.getCoordinates();
    radius = haversineDistance(
      Projection.mercatorToWgs84(coordinates[0], true),
      Projection.mercatorToWgs84(coordinates[1], true),
    );
    geometry = new Point(geometry.getCenter());
  } else if (geometry instanceof Polygon) {
    const coordinates = geometry.getCoordinates();
    coordinates.forEach((ring) => { enforceEndingVertex(ring); });
    geometry.setCoordinates(coordinates);
  } else if (geometry instanceof MultiPolygon) {
    const coordinates = geometry.getCoordinates();
    coordinates.forEach((poly) => {
      poly.forEach((ring) => { enforceEndingVertex(ring); });
    });
    geometry.setCoordinates(coordinates);
  }

  featureObject.geometry = getFormat().writeGeometryObject(geometry, {
    featureProjection,
    rightHanded: true,
  });

  if (radius) {
    featureObject.geometry.olcs_radius = radius;
  }

  featureObject.vcsMeta = {};

  if (options.writeStyle && feature[vectorStyleSymbol]) {
    featureObject.vcsMeta.style = embedIconsInStyle(
      feature[vectorStyleSymbol].getOptionsForFeature(feature),
      embeddedIcons,
    );
  }

  return featureObject;
}

/**
 * Writes all the features of the current layer to GeoJSON
 * @param {GeoJSONData} data
 * @param {GeoJSONwriteOptions=} options
 * @returns {string|Object}
 * @export
 */
export function writeGeoJSON(data, options = {}) { // how to handel embedded icons when they are not set on the vcsMeta but options is true?
  const vcsMeta = data.vcsMeta || {};
  vcsMeta.version = vcsMetaVersion;
  const featureObjs = data.features.map(feature => writeGeoJSONFeature(feature, options, vcsMeta.embeddedIcons));
  const obj = {
    type: 'FeatureCollection',
    features: featureObjs,
    vcsMeta,
  };

  return options.asObject ? obj : JSON.stringify(obj, null, options.prettyPrint ? 2 : null);
}
