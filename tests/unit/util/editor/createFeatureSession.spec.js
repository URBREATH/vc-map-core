import { Feature } from 'ol';
import startCreateFeatureSession from '../../../../src/util/editor/createFeatureSession.js';
import { GeometryType } from '../../../../src/util/editor/editorSessionHelpers.js';
import VcsApp from '../../../../src/vcsApp.js';
import VectorLayer from '../../../../src/layer/vectorLayer.js';
import InteractionChain from '../../../../src/interaction/interactionChain.js';
import {
  EventType,
  ModificationKeyType,
  PointerKeyType,
} from '../../../../src/interaction/interactionType.js';
import { createSync } from '../../../../src/layer/vectorSymbols.js';
import { ObliqueMap, OpenlayersMap } from '../../../../index.js';

describe('create feature session', () => {
  let app;
  let layer;
  let defaultMap;

  before(async () => {
    defaultMap = new OpenlayersMap({});
    app = new VcsApp();
    app.maps.add(defaultMap);
    await app.maps.setActiveMap(defaultMap.name);
    layer = new VectorLayer({});
    app.layers.add(layer);
  });

  after(() => {
    app.destroy();
  });

  describe('starting a session', () => {
    let session;

    beforeEach(() => {
      session = startCreateFeatureSession(app, layer, GeometryType.LineString);
    });

    afterEach(() => {
      session.stop();
    });

    it('should add a an exclusive listener to the event handler', () => {
      expect(app.maps.eventHandler.interactions[3]).to.be.an.instanceof(
        InteractionChain,
      );
    });

    it('should trigger feature created, if a feature is created', async () => {
      const spy = sinon.spy();
      session.featureCreated.addEventListener(spy);
      await app.maps.eventHandler.interactions[3].pipe({
        type: EventType.CLICK,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
        position: [1, 2, 0],
        positionOrPixel: [1, 2, 3],
      });
      expect(spy).to.have.been.calledOnce;
    });

    it('should add created features to the layer', async () => {
      let feature;
      session.featureCreated.addEventListener((f) => {
        feature = f;
      });
      await app.maps.eventHandler.interactions[3].pipe({
        type: EventType.CLICK,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
        position: [1, 2, 0],
        positionOrPixel: [1, 2, 3],
      });
      expect(layer.getFeatures()).to.include(feature);
    });

    it('should set a created feature to createSync', async () => {
      let feature;
      session.featureCreated.addEventListener((f) => {
        feature = f;
      });
      await app.maps.eventHandler.interactions[3].pipe({
        type: EventType.CLICK,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
        position: [1, 2, 0],
        positionOrPixel: [1, 2, 3],
      });
      expect(feature).to.have.property(createSync, true);
    });

    it('should remove createSync, once the feature is finished', async () => {
      let feature;
      session.featureCreated.addEventListener((f) => {
        feature = f;
      });
      await app.maps.eventHandler.interactions[3].pipe({
        type: EventType.CLICK,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
        position: [1, 2, 0],
        positionOrPixel: [1, 2, 3],
      });
      await app.maps.eventHandler.interactions[3].pipe({
        type: EventType.CLICK,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
        position: [1, 2, 0],
        positionOrPixel: [2, 2, 3],
      });
      session.finish();
      expect(feature).to.not.have.property(createSync);
    });

    it('should remove features, if they are not valid after finishing', async () => {
      let feature;
      session.featureCreated.addEventListener((f) => {
        feature = f;
      });
      await app.maps.eventHandler.interactions[3].pipe({
        type: EventType.CLICK,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
        position: [1, 2, 0],
        positionOrPixel: [1, 2, 3],
      });
      session.finish();
      expect(layer.getFeatures()).to.not.include(feature);
    });

    it('should continue creating features, after a feature is created', async () => {
      const spy = sinon.spy();
      session.featureCreated.addEventListener(spy);
      await app.maps.eventHandler.interactions[3].pipe({
        type: EventType.CLICK,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
        position: [1, 2, 0],
        positionOrPixel: [1, 2, 3],
      });
      session.finish();
      await app.maps.eventHandler.interactions[3].pipe({
        type: EventType.CLICK,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
        position: [1, 2, 0],
        positionOrPixel: [1, 2, 3],
      });
      expect(spy).to.have.been.calledTwice;
    });

    it('should trigger finish on finish, passing null if the feature is not valid', async () => {
      const spy = sinon.spy();
      session.creationFinished.addEventListener(spy);
      await app.maps.eventHandler.interactions[3].pipe({
        type: EventType.CLICK,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
        position: [1, 2, 0],
        positionOrPixel: [1, 2, 3],
      });
      session.finish();
      expect(spy).to.have.been.calledWith(null);
    });

    it('should trigger finish on finish, passing the feature if the feature is valid', async () => {
      const spy = sinon.spy();
      session.creationFinished.addEventListener(spy);
      await app.maps.eventHandler.interactions[3].pipe({
        type: EventType.CLICK,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
        position: [1, 2, 0],
        positionOrPixel: [1, 2, 3],
      });
      await app.maps.eventHandler.interactions[3].pipe({
        type: EventType.CLICK,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
        position: [2, 2, 0],
        positionOrPixel: [2, 2, 3],
      });
      session.finish();
      expect(spy).to.have.been.called;
      expect(spy.getCall(0).args[0]).to.be.an.instanceof(Feature);
    });
  });

  describe('stopping a session', () => {
    let session;

    beforeEach(() => {
      session = startCreateFeatureSession(app, layer, GeometryType.LineString);
    });

    it('should remove the interaction', () => {
      const interaction = app.maps.eventHandler.interactions[3];
      session.stop();
      expect(app.maps.eventHandler.interactions).to.not.include(interaction);
    });

    it('should call stopped', () => {
      const spy = sinon.spy();
      session.stopped.addEventListener(spy);
      session.stop();
      expect(spy).to.have.been.called;
    });

    it('should finish the current interaction', () => {
      const spy = sinon.spy();
      session.creationFinished.addEventListener(spy);
      session.stop();
      expect(spy).to.have.been.called;
    });
  });

  describe('changing the active map', () => {
    let session;
    let otherMap;

    before(() => {
      otherMap = new OpenlayersMap({});
      app.maps.add(otherMap);
    });

    beforeEach(() => {
      session = startCreateFeatureSession(app, layer, GeometryType.LineString);
    });

    afterEach(() => {
      session.stop();
      app.maps.setActiveMap(defaultMap.name);
      app.maps.remove(otherMap);
      otherMap.destroy();
    });

    it('should finish the current interaction', async () => {
      const spy = sinon.spy();
      session.creationFinished.addEventListener(spy);
      await app.maps.setActiveMap(otherMap.name);
      expect(spy).to.have.been.calledOnce;
    });

    it('should continue on the new map', async () => {
      const spy = sinon.spy();
      session.featureCreated.addEventListener(spy);
      await app.maps.setActiveMap(otherMap.name);
      await app.maps.eventHandler.interactions[3].pipe({
        type: EventType.CLICK,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
        position: [1, 2, 0],
        positionOrPixel: [1, 2, 3],
      });
      expect(spy).to.have.been.calledOnce;
    });
  });

  describe('changing the active map to an oblique map', () => {
    let session;
    let otherMap;

    before(() => {
      otherMap = new ObliqueMap({});
      app.maps.add(otherMap);
    });

    beforeEach(() => {
      session = startCreateFeatureSession(app, layer, GeometryType.LineString);
    });

    afterEach(() => {
      session.stop();
      app.maps.setActiveMap(defaultMap.name);
    });

    after(() => {
      app.maps.remove(otherMap);
      otherMap.destroy();
    });

    it('should finish the current interaction', async () => {
      const spy = sinon.spy();
      session.creationFinished.addEventListener(spy);
      await app.maps.setActiveMap(otherMap.name);
      expect(spy).to.have.been.calledOnce;
    });

    it('should continue on the new map', async () => {
      const spy = sinon.spy();
      session.featureCreated.addEventListener(spy);
      await app.maps.setActiveMap(otherMap.name);
      await app.maps.eventHandler.interactions[3].pipe({
        type: EventType.CLICK,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
        position: [1, 2, 0],
        positionOrPixel: [1, 2, 3],
      });
      expect(spy).to.have.been.calledOnce;
    });

    describe('image changed listener', async () => {
      beforeEach(async () => {
        await app.maps.setActiveMap(otherMap.name);
      });

      it('should finish the current interaction', async () => {
        const spy = sinon.spy();
        session.creationFinished.addEventListener(spy);
        otherMap.imageChanged.raiseEvent();
        expect(spy).to.have.been.calledOnce;
      });

      it('should continue on new image', async () => {
        const spy = sinon.spy();
        session.featureCreated.addEventListener(spy);
        otherMap.imageChanged.raiseEvent();
        await app.maps.eventHandler.interactions[3].pipe({
          type: EventType.CLICK,
          pointer: PointerKeyType.LEFT,
          key: ModificationKeyType.NONE,
          position: [1, 2, 0],
          positionOrPixel: [1, 2, 3],
        });
        expect(spy).to.have.been.calledOnce;
      });
    });
  });

  describe('changing the active map from an oblique map', () => {
    let session;
    let obliqueMap;

    before(async () => {
      obliqueMap = new ObliqueMap({});
      app.maps.add(obliqueMap);
      await app.maps.setActiveMap(obliqueMap.name);
      session = startCreateFeatureSession(app, layer, GeometryType.LineString);
      await app.maps.setActiveMap(defaultMap.name);
    });

    after(() => {
      session.stop();
      app.maps.remove(obliqueMap);
      obliqueMap.destroy();
    });

    it('should no longer listen to image changed', async () => {
      const spy = sinon.spy();
      session.creationFinished.addEventListener(spy);
      obliqueMap.imageChanged.raiseEvent();
      expect(spy).to.not.have.been.called;
    });
  });

  describe('stopping the session in the finished callback', () => {
    let session;

    beforeEach(() => {
      session = startCreateFeatureSession(app, layer, GeometryType.Point);
    });

    it('should not recreate the creation interaction', async () => {
      const interactionChain = app.maps.eventHandler.interactions[3];
      session.creationFinished.addEventListener(session.stop);
      await interactionChain.pipe({
        type: EventType.CLICK,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
        position: [1, 2, 0],
        positionOrPixel: [1, 2, 3],
      });
      expect(app.maps.eventHandler).to.not.include(interactionChain);
      expect(interactionChain.chain).to.be.empty;
    });

    it('should not call finished twice', async () => {
      const spy = sinon.spy();
      session.creationFinished.addEventListener(spy);
      session.creationFinished.addEventListener(session.stop);
      await app.maps.eventHandler.interactions[3].pipe({
        type: EventType.CLICK,
        pointer: PointerKeyType.LEFT,
        key: ModificationKeyType.NONE,
        position: [1, 2, 0],
        positionOrPixel: [1, 2, 3],
      });
      expect(spy).to.have.been.calledOnce;
    });
  });

  describe('forcefully removing a session', () => {
    let session;

    beforeEach(() => {
      session = startCreateFeatureSession(app, layer, GeometryType.LineString);
    });

    it('should stop the session', () => {
      const spy = sinon.spy();
      session.stopped.addEventListener(spy);
      app.maps.eventHandler.removeExclusive();
      expect(spy).to.have.been.called;
    });
  });
});
