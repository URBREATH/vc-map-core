import { v4 } from 'uuid';
import { Feature } from 'ol';
import { IntersectionTests } from '@vcmap/cesium';
import {
  createTransformationHandler,
  handlerSymbol,
  mercatorProjection,
  SelectMultiFeatureInteraction,
  VcsApp,
  VectorLayer,
} from '../../../../../index.js';

/**
 * @typedef {Object} TransformationSetup
 * @property {TransformationHandler} transformationHandler
 * @property {VcsApp} app
 * @property {VectorLayer} layer
 * @property {VectorLayer} scratchLayer
 * @property {SelectMultiFeatureInteraction} featureSelection
 * @property {function():void} destroy
 */

/**
 * @param {VcsMap} map
 * @param {TransformationMode} mode
 * @returns {Promise<TransformationSetup>}
 */
export async function setupTransformationHandler(map, mode) {
  const app = new VcsApp();
  app.maps.add(map);
  const scratchLayer = new VectorLayer({
    projection: mercatorProjection.toJSON(),
  });
  const layer = new VectorLayer({
    projection: mercatorProjection.toJSON(),
  });
  app.layers.add(scratchLayer);
  app.layers.add(layer);

  await app.maps.setActiveMap(map.name);
  await layer.activate();
  await scratchLayer.activate();

  const featureSelection = new SelectMultiFeatureInteraction(layer);
  const transformationHandler = createTransformationHandler(map, layer, featureSelection, scratchLayer, mode);
  return {
    transformationHandler,
    app,
    layer,
    scratchLayer,
    featureSelection,
    destroy() {
      featureSelection.destroy();
      transformationHandler.destroy();
      app.destroy();
    },
  };
}

/**
 * @param {AXIS_AND_PLANES} axis
 * @returns {Feature<import("ol/geom").Geometry>}
 */
export function createHandlerFeature(axis) {
  const feature = new Feature();
  feature[handlerSymbol] = axis;
  return feature;
}

/**
 * @param {Array<import("@vcmap/cesium").Cartesian3>} calls
 * @param {import("sinon").default} [sandbox]
 * @returns {(function(): void)|*}
 */
export function patchPickRay(calls, sandbox) {
  const stub = (sandbox ?? sinon).stub(IntersectionTests, 'rayPlane');
  calls.forEach((value, index) => {
    stub.onCall(index).returns(value);
  });
  return () => {
    stub.restore();
  };
}

/**
 * @param {Point|Object} propsOrProps
 * @returns {Feature<Point>}
 */
export function createFeatureWithId(propsOrProps) {
  const feature = new Feature(propsOrProps);
  feature.setId(v4());
  return feature;
}
