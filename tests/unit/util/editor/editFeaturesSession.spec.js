import { expect } from 'chai';
import sinon from 'sinon';

import { Cartesian2, Math as CesiumMath } from '@vcmap-cesium/engine';
import { Point } from 'ol/geom.js';
import Feature from 'ol/Feature.js';
import { unByKey } from 'ol/Observable.js';

import {
  AxisAndPlanes,
  createSync,
  EventType,
  mercatorToCartesian,
  ModificationKeyType,
  ObliqueMap,
  OpenlayersMap,
  PointerEventType,
  PointerKeyType,
  startEditFeaturesSession,
  TransformationMode,
} from '../../../../index.js';
import VcsApp from '../../../../src/vcsApp.js';
import VectorLayer from '../../../../src/layer/vectorLayer.js';
import InteractionChain from '../../../../src/interaction/interactionChain.js';
import {
  createFeatureWithId,
  createHandlerFeature,
  patchPickRay,
} from './transformation/setupTransformationHandler.js';
import { getVcsEventSpy, getCesiumMap } from '../../helpers/cesiumHelpers.js';
import { timeout } from '../../helpers/helpers.js';

describe('startEditFeaturesSession', () => {
  let app;
  let layer;
  let defaultMap;
  let obliqueMap;
  let cesiumMap;
  const interactionId = 'edit_features_test';

  before(async () => {
    defaultMap = new OpenlayersMap({});
    app = new VcsApp();
    app.maps.add(defaultMap);
    obliqueMap = new ObliqueMap({});
    app.maps.add(obliqueMap);
    cesiumMap = getCesiumMap();
    app.maps.add(cesiumMap);
    await app.maps.setActiveMap(defaultMap.name);
    layer = new VectorLayer({});
    app.layers.add(layer);
  });

  after(() => {
    app.destroy();
  });

  describe('setting features', () => {
    /** @type {EditFeaturesSession} */
    let session;
    /** @type {import("ol").Feature} */
    let feature;

    before(() => {
      session = startEditFeaturesSession(app, layer);
      feature = createFeatureWithId(new Point([0, 0, 0]));
      session.setFeatures([feature]);
    });

    after(() => {
      session.stop();
    });

    it('should set the features', () => {
      expect(session.features).to.have.members([feature]);
    });

    it('should set allowPicking false', async () => {
      expect(feature.getProperties()).to.have.property(
        'olcs_allowPicking',
        false,
      );
    });

    it('should set createSync on the feature', async () => {
      expect(feature[createSync]).to.exist;
    });

    describe('changing features', () => {
      let newFeature;

      before(() => {
        newFeature = new Feature({ geometry: new Point([0, 0, 0]) });
        session.setFeatures([newFeature]);
      });

      it('should set the new features', () => {
        expect(session.features).to.have.members([newFeature]);
      });

      it('should clear allow picking for previous features', () => {
        expect(feature.getProperties()).to.not.have.property(
          'olcs_allowPicking',
        );
      });

      it('should clear createSync for previous features', () => {
        expect(feature[createSync]).to.not.exist;
      });
    });

    describe('removing all features', () => {
      before(() => {
        session.setFeatures([]);
      });

      it('should have an empty array as features', () => {
        expect(session.features).to.be.empty;
      });
    });
  });

  describe('removing features should restore original allowPicking and createSync values', () => {
    it('should maintain allowPicking', () => {
      const feature = createFeatureWithId(new Point([0, 0, 0]));
      feature.set('olcs_allowPicking', true);
      layer.addFeatures([feature]);

      const session = startEditFeaturesSession(app, layer);
      session.setFeatures([feature]);
      expect(feature.get('olcs_allowPicking')).to.be.false;
      session.setFeatures([]);
      expect(feature.get('olcs_allowPicking')).to.be.true;
    });

    it('should maintain createSync', () => {
      const feature = createFeatureWithId(new Point([0, 0, 0]));
      layer.addFeatures([feature]);

      feature[createSync] = true;
      const session = startEditFeaturesSession(app, layer);
      session.setFeatures([feature]);
      expect(feature[createSync]).to.exist;
      session.setFeatures([]);
      expect(feature[createSync]).to.exist;
    });
  });

  describe('right clicking a feature', () => {
    it('should allow picking during the event', async () => {
      const feature = createFeatureWithId(new Point([0, 0, 0]));
      layer.addFeatures([feature]);
      const session = startEditFeaturesSession(app, layer);
      session.setFeatures([feature]);

      const propertyChanged = sinon.spy();
      const listener = feature.on('propertychange', propertyChanged);

      app.maps.eventHandler.handleMapEvent({
        map: defaultMap,
        windowPosition: Cartesian2.ONE,
        pointerEvent: PointerEventType.DOWN,
        pointer: PointerKeyType.RIGHT,
        key: ModificationKeyType.NONE,
      });
      await timeout(20);
      app.maps.eventHandler.handleMapEvent({
        map: defaultMap,
        windowPosition: Cartesian2.ONE,
        pointerEvent: PointerEventType.UP,
        pointer: PointerKeyType.RIGHT,
        key: ModificationKeyType.NONE,
      });

      await timeout(20);
      unByKey(listener);
      expect(propertyChanged).to.have.been.calledTwice;
    });
  });

  describe('stopping an edit session', () => {
    let session;

    beforeEach(() => {
      session = startEditFeaturesSession(app, layer);
    });

    it('should remove the interaction', () => {
      const interaction = app.maps.eventHandler.interactions[4];
      session.stop();
      expect(app.maps.eventHandler.interactions).to.not.include(interaction);
    });

    it('should call stopped', () => {
      const spy = sinon.spy();
      session.stopped.addEventListener(spy);
      session.stop();
      expect(spy).to.have.been.called;
    });

    it('should unset allowPicking false', async () => {
      const feature = createFeatureWithId(new Point([0, 0, 0]));
      session.setFeatures([feature]);
      session.stop();
      expect(feature.getProperties()).to.not.have.property('olcs_allowPicking');
    });

    it('should unset createSync false', async () => {
      const feature = createFeatureWithId(new Point([0, 0, 0]));
      session.setFeatures([feature]);
      session.stop();
      expect(feature[createSync]).to.not.exist;
    });
  });

  describe('starting a TRANSLATE session', () => {
    /** @type {EditFeaturesSession} */
    let session;

    before(() => {
      session = startEditFeaturesSession(
        app,
        layer,
        interactionId,
        TransformationMode.TRANSLATE,
      );
    });

    after(() => {
      session.stop();
    });

    it('should set the mode on the session', () => {
      expect(session.mode).to.equal(TransformationMode.TRANSLATE);
    });

    it('should add a an exclusive listener to the event handler', () => {
      expect(app.maps.eventHandler.interactions[4]).to.be.an.instanceof(
        InteractionChain,
      );
    });

    it('should add the translate interaction', async () => {
      const point = new Point([1, 1, 1]);
      await session.setFeatures([createFeatureWithId(point)]);
      const feature = createHandlerFeature(AxisAndPlanes.X);
      await app.maps.eventHandler.interactions[4].pipe({
        map: app.maps.activeMap,
        feature,
        positionOrPixel: [2, 1, 1],
        type: EventType.DRAGSTART,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      await app.maps.eventHandler.interactions[4].pipe({
        map: app.maps.activeMap,
        feature,
        positionOrPixel: [3, 1, 1],
        type: EventType.DRAG,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      await app.maps.eventHandler.interactions[4].pipe({
        map: app.maps.activeMap,
        feature,
        positionOrPixel: [3, 1, 1],
        type: EventType.DRAGEND,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      expect(point.getCoordinates()).to.have.ordered.members([2, 1, 1]);
    });
  });

  describe('starting a ROTATE session', () => {
    /** @type {EditFeaturesSession} */
    let session;

    before(() => {
      session = startEditFeaturesSession(
        app,
        layer,
        interactionId,
        TransformationMode.ROTATE,
      );
    });

    after(() => {
      session.stop();
    });

    it('should set the mode on the session', () => {
      expect(session.mode).to.equal(TransformationMode.ROTATE);
    });

    it('should add a an exclusive listener to the event handler', () => {
      expect(app.maps.eventHandler.interactions[4]).to.be.an.instanceof(
        InteractionChain,
      );
    });

    it('should add the rotate interaction', async () => {
      const point1 = new Point([1, 1, 0]);
      const point2 = new Point([-1, -1, 0]);
      await session.setFeatures([
        createFeatureWithId(point1),
        createFeatureWithId(point2),
      ]);
      const feature = createHandlerFeature(AxisAndPlanes.X);
      await app.maps.eventHandler.interactions[4].pipe({
        map: app.maps.activeMap,
        feature,
        positionOrPixel: [0.5, 0.5, 1],
        type: EventType.DRAGSTART,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      await app.maps.eventHandler.interactions[4].pipe({
        map: app.maps.activeMap,
        feature,
        positionOrPixel: [-0.5, -0.5, 1],
        type: EventType.DRAG,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      await app.maps.eventHandler.interactions[4].pipe({
        map: app.maps.activeMap,
        feature,
        positionOrPixel: [-0.5, -0.5, 1],
        type: EventType.DRAGEND,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      expect(
        point1.getCoordinates().map((c) => Math.round(c)),
      ).to.have.ordered.members([-1, -1, 0]);
      expect(
        point2.getCoordinates().map((c) => Math.round(c)),
      ).to.have.ordered.members([1, 1, 0]);
    });
  });

  describe('starting a SCALE session', () => {
    /** @type {EditFeaturesSession} */
    let session;

    before(() => {
      session = startEditFeaturesSession(
        app,
        layer,
        interactionId,
        TransformationMode.SCALE,
      );
    });

    after(() => {
      session.stop();
    });

    it('should set the mode on the session', () => {
      expect(session.mode).to.equal(TransformationMode.SCALE);
    });

    it('should add a an exclusive listener to the event handler', () => {
      expect(app.maps.eventHandler.interactions[4]).to.be.an.instanceof(
        InteractionChain,
      );
    });

    it('should add the scale interaction', async () => {
      const point1 = new Point([1, 1, 0]);
      const point2 = new Point([-1, -1, 0]);
      await session.setFeatures([
        createFeatureWithId(point1),
        createFeatureWithId(point2),
      ]);
      const feature = createHandlerFeature(AxisAndPlanes.X);
      await app.maps.eventHandler.interactions[4].pipe({
        map: app.maps.activeMap,
        feature,
        positionOrPixel: [0.5, 0.5, 1],
        type: EventType.DRAGSTART,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      await app.maps.eventHandler.interactions[4].pipe({
        map: app.maps.activeMap,
        feature,
        positionOrPixel: [-0.5, -0.5, 1],
        type: EventType.DRAG,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      await app.maps.eventHandler.interactions[4].pipe({
        map: app.maps.activeMap,
        feature,
        positionOrPixel: [-0.5, -0.5, 1],
        type: EventType.DRAGEND,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
      });
      expect(
        point1.getCoordinates().map((c) => Math.round(c)),
      ).to.have.ordered.members([-1, 1, 0]);
      expect(
        point2.getCoordinates().map((c) => Math.round(c)),
      ).to.have.ordered.members([1, -1, 0]);
    });
  });

  describe('starting a EXTRUDE session', () => {
    /** @type {EditFeaturesSession} */
    let session;

    before(async () => {
      await app.maps.setActiveMap(cesiumMap.name);
      session = startEditFeaturesSession(
        app,
        layer,
        interactionId,
        TransformationMode.EXTRUDE,
      );
    });

    after(async () => {
      session.stop();
      await app.maps.setActiveMap(defaultMap.name);
    });

    it('should set the mode on the session', () => {
      expect(session.mode).to.equal(TransformationMode.EXTRUDE);
    });

    it('should add a an exclusive listener to the event handler', () => {
      expect(app.maps.eventHandler.interactions[4]).to.be.an.instanceof(
        InteractionChain,
      );
    });

    describe('extruding a feature', () => {
      let stub;
      let restorePick;
      let feature;

      before(async () => {
        restorePick = patchPickRay([
          mercatorToCartesian([1, 1, 1]),
          mercatorToCartesian([1, 1, 4]),
          mercatorToCartesian([1, 1, 4]),
        ]);
        stub = sinon
          .stub(cesiumMap, 'getHeightFromTerrain')
          .callsFake(async (coords) => {
            coords.forEach((c) => {
              c[2] = 1;
            });
            return coords;
          });

        feature = createFeatureWithId(new Point([1, 1, 0]));
        await session.setFeatures([feature]);
        const handlerFeature = createHandlerFeature(AxisAndPlanes.Z);

        await app.maps.eventHandler.interactions[4].pipe({
          map: app.maps.activeMap,
          feature: handlerFeature,
          positionOrPixel: [1, 1, 1],
          windowPosition: new Cartesian2(0, 0),
          type: EventType.DRAGSTART,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        await app.maps.eventHandler.interactions[4].pipe({
          map: app.maps.activeMap,
          feature: handlerFeature,
          positionOrPixel: [1, 1, 4],
          windowPosition: new Cartesian2(0, 0),
          type: EventType.DRAG,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
        await app.maps.eventHandler.interactions[4].pipe({
          map: app.maps.activeMap,
          feature: handlerFeature,
          positionOrPixel: [1, 1, 4],
          windowPosition: new Cartesian2(0, 0),
          type: EventType.DRAGEND,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
        });
      });

      after(() => {
        stub.restore();
        restorePick();
      });

      it('should add the extruded interaction', () => {
        expect(feature.get('olcs_extrudedHeight')).to.exist.and.to.be.closeTo(
          3,
          CesiumMath.EPSILON5,
        );
      });

      it('it should ensure the feature is absolute', () => {
        expect(feature.get('olcs_altitudeMode')).to.exist.and.equal('absolute');
      });

      it('should place the feature onto the terrain', () => {
        expect(feature.getGeometry().getCoordinates()).to.have.ordered.members([
          1, 1, 1,
        ]);
      });
    });
  });

  describe('setting olcs properties on a set feature', () => {
    /** @type {EditFeaturesSession} */
    let session;
    /** @type {import("ol").Feature[]} */
    let features;

    before(() => {
      session = startEditFeaturesSession(app, layer);
    });

    beforeEach(() => {
      features = [
        createFeatureWithId(new Point([0, 0, 0])),
        createFeatureWithId(new Point([1, 0, 0])),
      ];
      session.setFeatures(features);
    });

    after(() => {
      session.stop();
    });

    it('should recalculate the handlers, when changing altitude mode', () => {
      const scratchLayer = [...app.layers].pop();
      const scratchFeatures = scratchLayer.getFeatures();
      expect(scratchFeatures[0]).to.exist;
      const changed = sinon.spy();
      scratchFeatures[0].once('change', changed);
      features[0].set('olcs_altitudeMode', 'absolute');
      expect(changed).to.have.been.calledOnce;
    });

    it('should recalculate the handlers, when changing ground level', () => {
      const scratchLayer = [...app.layers].pop();
      const scratchFeatures = scratchLayer.getFeatures();
      expect(scratchFeatures[0]).to.exist;
      const changed = sinon.spy();
      scratchFeatures[0].once('change', changed);
      features[0].set('olcs_groundLevel', 2);
      expect(changed).to.have.been.calledOnce;
    });

    it('should recalculate the handlers, when changing height above ground', () => {
      const scratchLayer = [...app.layers].pop();
      const scratchFeatures = scratchLayer.getFeatures();
      expect(scratchFeatures[0]).to.exist;
      const changed = sinon.spy();
      scratchFeatures[0].once('change', changed);
      features[0].set('olcs_heightAboveGround', 20);
      expect(changed).to.have.been.calledOnce;
    });
  });

  describe('starting a EXTRUDE session without having an active cesium map', () => {
    /** @type {EditFeaturesSession} */
    let session;

    before(async () => {
      session = startEditFeaturesSession(
        app,
        layer,
        interactionId,
        TransformationMode.EXTRUDE,
      );
    });

    after(async () => {
      session.stop();
    });

    it('should set the mode to TRANSLATE instead', () => {
      expect(session.mode).to.equal(TransformationMode.TRANSLATE);
    });
  });

  describe('changing the mode', () => {
    /** @type {EditFeaturesSession} */
    let session;

    beforeEach(() => {
      session = startEditFeaturesSession(
        app,
        layer,
        TransformationMode.TRANSLATE,
      );
    });

    afterEach(() => {
      session.stop();
    });

    it('should change the mode', () => {
      session.setMode(TransformationMode.ROTATE);
      expect(session.mode).to.equal(TransformationMode.ROTATE);
    });

    it('should call mode changed', () => {
      const spy = getVcsEventSpy(session.modeChanged);
      session.setMode(TransformationMode.ROTATE);
      expect(spy).to.have.been.calledWith(TransformationMode.ROTATE);
    });

    it('should only call mode changed once', () => {
      const spy = getVcsEventSpy(session.modeChanged);
      session.setMode(TransformationMode.ROTATE);
      session.setMode(TransformationMode.ROTATE);
      expect(spy).to.have.been.calledOnce;
      expect(spy).to.have.been.calledWith(TransformationMode.ROTATE);
    });

    it('should not allow changing the mode to extrude, if the map is not a cesium map', () => {
      session.setMode(TransformationMode.EXTRUDE);
      expect(session.mode).to.equal(TransformationMode.TRANSLATE);
    });
  });

  describe('changing the active map from a cesium map with extrude mode on', () => {
    let session;

    beforeEach(async () => {
      await app.maps.setActiveMap(cesiumMap.name);
      session = startEditFeaturesSession(
        app,
        layer,
        interactionId,
        TransformationMode.EXTRUDE,
      );
    });

    afterEach(async () => {
      session.stop();
      await app.maps.setActiveMap(defaultMap.name);
    });

    it('should change the mode to TRANSLATE', async () => {
      await app.maps.setActiveMap(defaultMap.name);
      expect(session.mode).to.equal(TransformationMode.TRANSLATE);
    });

    it('should call modeChanged', async () => {
      const modeChangeListener = getVcsEventSpy(session.modeChanged);
      await app.maps.setActiveMap(defaultMap.name);
      expect(modeChangeListener).to.have.been.calledWithExactly(
        TransformationMode.TRANSLATE,
      );
    });
  });

  describe('forcefully removing a session', () => {
    let session;

    beforeEach(() => {
      session = startEditFeaturesSession(app, layer);
    });

    it('should stop the session', () => {
      const spy = sinon.spy();
      session.stopped.addEventListener(spy);
      app.maps.eventHandler.removeExclusive();
      expect(spy).to.have.been.called;
    });
  });
});
