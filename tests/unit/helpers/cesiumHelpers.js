import BoundingSphere from 'cesium/Source/Core/BoundingSphere.js';
import Entity from 'cesium/Source/DataSources/Entity.js';
import Camera from 'cesium/Source/Scene/Camera.js';
import WebMercatorProjection from 'cesium/Source/Core/WebMercatorProjection.js';
import TweenCollection from 'cesium/Source/Scene/TweenCollection.js';
import PrimitiveCollection from 'cesium/Source/Scene/PrimitiveCollection.js';
import Globe from 'cesium/Source/Scene/Globe.js';
import CesiumEvent from 'cesium/Source/Core/Event.js';
import SceneMode from 'cesium/Source/Scene/SceneMode.js';
import ImageryLayerCollection from 'cesium/Source/Scene/ImageryLayerCollection.js';
import Clock from 'cesium/Source/Core/Clock.js';
import DataSourceCollection from 'cesium/Source/DataSources/DataSourceCollection.js';
import ScreenSpaceEventHandler from 'cesium/Source/Core/ScreenSpaceEventHandler.js';
import ContextLimits from 'cesium/Source/Renderer/ContextLimits.js';
import Color from 'cesium/Source/Core/Color.js';
import Cesium3DTileFeature from 'cesium/Source/Scene/Cesium3DTileFeature.js';

import defaultTileset from '../../../examples/data/buildings/tileset.json';
import CesiumTilesetLayer from '../../../src/vcs/vcm/layer/cesiumTileset.js';
import DataSource from '../../../src/vcs/vcm/layer/dataSource.js';
import CesiumMap from '../../../src/vcs/vcm/maps/cesium.js';

defaultTileset.root.children = [];
defaultTileset.properties = {};

export const tilesetJSON = defaultTileset;

/**
 * @param {Sinon.SinonSandbox} sandbox
 * @param {string=} url
 * @returns {*|Sinon.SinonFakeServer|null}
 */
export function createTilesetServer(sandbox, url) {
  const server = sandbox ? sandbox.useFakeServer() : sinon.createFakeServer();
  server.autoRespond = true;
  server.respondImmediately = true;
  server.respondWith(
    url || 'http://test.com/tileset.json',
    [200, { 'Content-Type': 'application/json' }, JSON.stringify(tilesetJSON)],
  );
  server.respond();
  return server;
}

/**
 * @param {Sinon.SinonSandbox} sandbox
 * @param {vcs.vcm.maps.CesiumMap=} cesiumMap
 * @param {string=} name
 * @returns {Promise<vcs.vcm.layer.CesiumTileset>}
 */
export async function createInitializedTilesetLayer(sandbox, cesiumMap, name) {
  createTilesetServer(sandbox);
  const tilesetLayer = new CesiumTilesetLayer({
    url: 'http://test.com/tileset.json',
    name,
  });

  await tilesetLayer.initialize();
  if (cesiumMap) {
    cesiumMap.layerCollection.add(tilesetLayer);
    const impls = tilesetLayer.getImplementationsForMap(cesiumMap);
    await Promise.all(impls.map(async (impl) => {
      await impl.initialize();
      Object.defineProperty(impl.cesium3DTileset, 'boundingSphere', {
        get() {
          return new BoundingSphere();
        },
      });
    }));
  }

  return tilesetLayer;
}

export function createEntities(numberOfEntities = 1) {
  const layer = new DataSource({});

  const entities = new Array(numberOfEntities);
  for (let i = 0; i < numberOfEntities; i++) {
    entities[i] = new Entity({
      model: {},
    });
    layer.addEntity(entities[i]);
  }

  return {
    layer,
    entities,
  };
}

/**
 * @param {sinon.sandbox} sandbox
 * @param {Cesium/Event} event
 * @returns {sinon.spy}
 */
export function getCesiumEventSpy(sandbox, event) {
  const spy = sandbox.spy();
  const listener = event.addEventListener(function callback() {
    listener();
    // eslint-disable-next-line prefer-rest-params
    spy(...arguments);
  });
  return spy;
}

export function getMockScene() {
  const scene = {
    screenSpaceCameraController: {
      enableInputs: true,
    },
    globe: new Globe(),
    mode: SceneMode.SCENE3D,
    tweens: new TweenCollection(),
    primitives: new PrimitiveCollection(),
    groundPrimitives: new PrimitiveCollection(),
    imageryLayers: new ImageryLayerCollection(),
    drawingBufferHeight: 100,
    drawingBufferWidth: 100,
    postRender: new CesiumEvent(),
    preUpdate: new CesiumEvent(),
    mapProjection: new WebMercatorProjection(),
    shadowMap: { enabled: false },
    canvas: document.createElement('canvas'),
    terrainProvider: {
      readyPromise: Promise.resolve(),
    },
    frameState: {
      mode: undefined,
      context: {
        depthTexture: true,
        stencilBuffer: true,
      },
      lineWidth: 1,
    },
    context: {
      depthTexture: true,
      stencilBuffer: true,
    },
    render() {},
    pick() {},
    pickPosition() {},
    destroy() {
      this.primitives.destroy();
      this.groundPrimitives.destroy();
      this.imageryLayers.destroy();
      this.globe.destroy();
      this.canvas = null;
    },
  };
  const camera = new Camera(scene);
  const originalFlyTo = camera.flyTo;

  camera.flyTo = function flyTo(options) {
    options.duration = 0;
    originalFlyTo.bind(camera)(options);
  };

  scene.camera = camera;
  return scene;
}

export function getCesiumMap(mapOptions) {
  const map = new CesiumMap(mapOptions || {});
  const scene = getMockScene();
  map._cesiumWidget = {
    scene,
    camera: scene.camera,
    render: scene.render,
    resolutionScale: 1,
    clock: new Clock({}),
    destroy() {
      this.scene.destroy();
      this.scene = null;
      this.camera = null;
    },
    resize() {},
  };

  map.screenSpaceEventHandler = new ScreenSpaceEventHandler(map._cesiumWidget.scene.canvas);
  map.dataSourceDisplay = {
    dataSources: new DataSourceCollection(),
    isDestroyed() {
      return false;
    },
    destroy() {
      this.dataSources.destroy();
    },
  };
  map.initialized = true;

  return map;
}

/**
 * @param {vcs.vcm.Framework} framework
 * @returns {Promise<vcs.vcm.maps.CesiumMap>}
 */
export async function setCesiumMap(framework) {
  const map = getCesiumMap({ layerCollection: framework.layerCollection, target: framework.getMapContainer() });
  framework.addMap(map);
  await framework.activateMap(map.name);
  return map;
}

/**
 * creates usable default ContextLimits, copy pasted from chrome
 */
export function setupCesiumContextLimits() {
  ContextLimits._highpFloatSupported = true;
  ContextLimits._highpIntSupported = true;
  ContextLimits._maximumAliasedLineWidth = 1;
  ContextLimits._maximumAliasedPointSize = 1024;
  ContextLimits._maximumColorAttachments = 8;
  ContextLimits._maximumCombinedTextureImageUnits = 32;
  ContextLimits._maximumCubeMapSize = 16384;
  ContextLimits._maximumDrawBuffers = 8;
  ContextLimits._maximumFragmentUniformVectors = 1024;
  ContextLimits._maximumRenderbufferSize = 16384;
  ContextLimits._maximumTextureFilterAnisotropy = 16;
  ContextLimits._maximumTextureImageUnits = 16;
  ContextLimits._maximumTextureSize = 16384;
  ContextLimits._maximumVaryingVectors = 30;
  ContextLimits._maximumVertexAttributes = 16;
  ContextLimits._maximumVertexTextureImageUnits = 16;
  ContextLimits._maximumVertexUniformVectors = 4095;
  ContextLimits._maximumViewportHeight = 32767;
  ContextLimits._maximumViewportWidth = 32767;
  ContextLimits._minimumAliasedLineWidth = 1;
  ContextLimits._minimumAliasedPointSize = 1;
}

class BatchTable {
  constructor(properties) {
    this.properties = properties;
    this.color = new Color();
    this.show = true;
    this.destroyed = false;
  }

  getPropertyNames() { return Object.keys(this.properties); }

  getProperty(id, prop) { return this.properties[prop]; }

  getColor() { return this.color; }

  setColor(id, color) { this.color = color; }

  getShow() { return this.show; }

  setShow(id, show) { this.show = show; }

  isDestroyed() { return this.destroyed; }
}

/**
 * @param {Object} properties
 * @param {Object=} tileset
 * @returns {Cesium.Cesium3DTileFeature}
 */
export function createDummyCesium3DTileFeature(properties = {}, tileset) {
  const dummy = new Cesium3DTileFeature();
  const content = { batchTable: new BatchTable(properties), isDestroyed() { return false; } };
  if (tileset) {
    content.tileset = tileset;
  }
  dummy._content = content;
  return dummy;
}
