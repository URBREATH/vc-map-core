import CesiumEvent from '@vcmap/cesium/Source/Core/Event.js';
import Cesium3DTileColorBlendMode from '@vcmap/cesium/Source/Scene/Cesium3DTileColorBlendMode.js';
import BoundingSphere from '@vcmap/cesium/Source/Core/BoundingSphere.js';
import Matrix4 from '@vcmap/cesium/Source/Core/Matrix4.js';
import ClippingPlaneCollection from '@vcmap/cesium/Source/Scene/ClippingPlaneCollection.js';
import ActualCesium3DTileset from '@vcmap/cesium/Source/Scene/Cesium3DTileset.js';

class Cesium3DTileset {
  constructor() {
    this.ready = true;
    this.extras = {};
    this.readyPromise = Promise.resolve(this);
    this.colorBlendMode = Cesium3DTileColorBlendMode.HIGHLIGHT;
    this.tileVisible = new CesiumEvent();
    this.tileUnload = new CesiumEvent();
    this.loadProgress = new CesiumEvent();
    this.clippingPlanes = new ClippingPlaneCollection();
    this.clippingPlanesOriginMatrix = Matrix4.IDENTITY;
    this.boundingSphere = new BoundingSphere(undefined, 1);
    this.style = null;
    this.root = {
      transform: Matrix4.clone(Matrix4.IDENTITY),
      boundingVolume: {},
      boundingSphere: {},
    };
  }

  destroy() {
    this.clippingPlanes = null;
    this.tileVisible = null;
    this.tileUnload = null;
    this.loadProgress = null;
  }
}

/**
 * @returns {Cesium/Cesium3DTileset}
 */
function getDummyCesium3DTileset() {
  const dummy = new Cesium3DTileset();
  // eslint-disable-next-line no-proto
  dummy.__proto__ = ActualCesium3DTileset.prototype; // proto hack to fool instanceof checks
  return dummy;
}

export default getDummyCesium3DTileset;
