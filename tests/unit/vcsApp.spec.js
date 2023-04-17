import VectorLayer from '../../src/layer/vectorLayer.js';
import Viewpoint from '../../src/util/viewpoint.js';
import VcsModule from '../../src/vcsModule.js';
import OpenlayersMap from '../../src/map/openlayersMap.js';
import VcsApp from '../../src/vcsApp.js';

describe('vcsApp', () => {
  describe('adding of a module', () => {
    describe('normal', () => {
      let module;
      /** @type {VcsApp} */
      let app;
      /** @type {Viewpoint} */
      let startingVp;
      let added;

      before(async () => {
        startingVp = new Viewpoint({
          name: 'foo',
          groundPosition: [13, 52],
          distance: 200,
        });
        module = new VcsModule({
          layers: [
            new VectorLayer({ name: 'foo' }).toJSON(),
            new VectorLayer({ name: 'bar', activeOnStartup: true }).toJSON(),
          ],
          viewpoints: [new Viewpoint({}).toJSON(), startingVp.toJSON()],
          maps: [new OpenlayersMap({ name: 'foo' }).toJSON()],
          startingViewpointName: 'foo',
          startingMapName: 'foo',
        });
        app = new VcsApp();
        added = sinon.spy();
        app.moduleAdded.addEventListener(added);
        await app.addModule(module);
      });

      after(() => {
        app.destroy();
      });

      it('should add the module', () => {
        expect(app.getModuleById(module._id)).to.equal(module);
      });

      it('should raise the moduleAdded event', () => {
        expect(added).to.have.been.called;
      });

      it('should add the modules resources', () => {
        expect(app.layers.hasKey('foo')).to.be.true;
        expect(app.layers.hasKey('bar')).to.be.true;
        expect(app.maps.hasKey('foo')).to.be.true;
        expect(app.viewpoints.hasKey('foo')).to.be.true;
      });

      it('should load layers which are active on startup', () => {
        const layer = app.layers.getByKey('bar');
        expect(layer).to.be.an.instanceOf(VectorLayer);
        expect(layer.active || layer.loading).to.be.true; // we do not wait for layers. so all good _as long as its not inactive_
      });

      it('should activate the starting map', () => {
        expect(app.maps.activeMap).to.have.property('name', 'foo');
      });

      it('should activate the starting view point', () => {
        const vp = app.maps.activeMap.getViewpointSync();
        expect(vp.equals(startingVp, 10e-8)).to.be.true;
      });
    });

    describe('adding of a second module', () => {
      let module;
      /** @type {VcsApp} */
      let app;
      /** @type {Viewpoint} */
      let startingVp;
      let added;

      before(async () => {
        startingVp = new Viewpoint({
          name: 'foo',
          groundPosition: [13, 52],
          distance: 200,
        });
        const initialModule = new VcsModule({
          layers: [
            new VectorLayer({ name: 'foo' }).toJSON(),
            new VectorLayer({ name: 'bar', activeOnStartup: true }).toJSON(),
          ],
          viewpoints: [new Viewpoint({}).toJSON(), startingVp.toJSON()],
          maps: [new OpenlayersMap({ name: 'foo' }).toJSON()],
          startingViewpointName: 'foo',
          startingMapName: 'foo',
        });
        module = new VcsModule({
          layers: [
            new VectorLayer({ name: 'foo', activeOnStartup: true }).toJSON(),
            new VectorLayer({ name: 'baz', activeOnStartup: false }).toJSON(),
          ],
        });

        app = new VcsApp();
        added = sinon.spy();
        app.moduleAdded.addEventListener(added);
        await app.addModule(initialModule);
        app.layers.getByKey('bar').deactivate();
        await app.addModule(module);
      });

      after(() => {
        app.destroy();
      });

      it('should add the module', () => {
        expect(app.getModuleById(module._id)).to.equal(module);
      });

      it('should raise the moduleAdded event', () => {
        expect(added).to.have.been.calledTwice;
      });

      it('should add the modules resources', () => {
        expect(app.layers.hasKey('foo')).to.be.true;
        expect(app.layers.hasKey('baz')).to.be.true;
      });

      it('should load layers which are active on startup', () => {
        const layer = app.layers.getByKey('foo');
        expect(layer).to.be.an.instanceOf(VectorLayer);
        expect(layer.active || layer.loading).to.be.true; // we do not wait for layers. so all good _as long as its not inactive_
      });

      it('should not load layers which are active on startup and not in the current module', () => {
        const layer = app.layers.getByKey('bar');
        expect(layer).to.be.an.instanceOf(VectorLayer);
        expect(layer.active || layer.loading).to.be.false; // we do not wait for layers. so all good _as long as its not inactive_
      });
    });

    describe('without an active map name', () => {
      let module;
      /** @type {VcsApp} */
      let app;
      /** @type {Viewpoint} */
      let startingVp;

      before(async () => {
        startingVp = new Viewpoint({
          name: 'foo',
          groundPosition: [13, 52],
          distance: 200,
        });
        module = new VcsModule({
          layers: [
            new VectorLayer({ name: 'foo' }).toJSON(),
            new VectorLayer({ name: 'bar', activeOnStartup: true }).toJSON(),
          ],
          viewpoints: [new Viewpoint({}).toJSON(), startingVp.toJSON()],
          maps: [
            new OpenlayersMap({ name: 'foo' }).toJSON(),
            new OpenlayersMap({ name: 'bar' }).toJSON(),
          ],
          startingViewpointName: 'foo',
          startingMapName: 'foo',
        });
        app = new VcsApp();
        await app.addModule(module);
      });

      after(() => {
        app.destroy();
      });

      it('should activate the first map', () => {
        expect(app.maps.activeMap).to.have.property('name', 'foo');
      });
    });

    describe('if activating the same module twice', () => {
      let module;
      /** @type {VcsApp} */
      let app;
      /** @type {Viewpoint} */
      let startingVp;
      let added;

      before(async () => {
        startingVp = new Viewpoint({
          name: 'foo',
          groundPosition: [13, 52],
          distance: 200,
        });
        module = new VcsModule({
          layers: [
            new VectorLayer({ name: 'foo' }).toJSON(),
            new VectorLayer({ name: 'bar', activeOnStartup: true }).toJSON(),
          ],
          viewpoints: [new Viewpoint({}).toJSON(), startingVp.toJSON()],
          maps: [new OpenlayersMap({ name: 'foo' }).toJSON()],
          startingViewpointName: 'foo',
          startingMapName: 'foo',
        });
        app = new VcsApp();
        added = sinon.spy();
        app.moduleAdded.addEventListener(added);
        app.addModule(module);
        await app.addModule(module);
      });

      after(() => {
        app.destroy();
      });

      it('should add the module once', () => {
        expect(app.getModuleById(module._id)).to.equal(module);
      });

      it('should raise the moduleAdded event once', () => {
        expect(added).to.have.been.calledOnce;
      });

      it('should add the modules resources', () => {
        expect(app.layers.hasKey('foo')).to.be.true;
        expect(app.layers.hasKey('bar')).to.be.true;
        expect(app.maps.hasKey('foo')).to.be.true;
        expect(app.viewpoints.hasKey('foo')).to.be.true;
      });

      it('should load layers which are active on startup', () => {
        const layer = app.layers.getByKey('bar');
        expect(layer).to.be.an.instanceOf(VectorLayer);
        expect(layer.active || layer.loading).to.be.true; // we do not wait for layers. so all good _as long as its not inactive_
      });

      it('should activate the starting map', () => {
        expect(app.maps.activeMap).to.have.property('name', 'foo');
      });

      it('should activate the starting view point', () => {
        const vp = app.maps.activeMap.getViewpointSync();
        expect(vp.equals(startingVp, 10e-8)).to.be.true;
      });
    });
  });

  describe('removing a module', () => {
    describe('normal', () => {
      let module;
      /** @type {VcsApp} */
      let app;
      /** @type {Viewpoint} */
      let startingVp;
      let removed;

      before(async () => {
        startingVp = new Viewpoint({
          name: 'foo',
          groundPosition: [13, 52],
          distance: 200,
        });
        module = new VcsModule({
          layers: [
            new VectorLayer({ name: 'foo' }).toJSON(),
            new VectorLayer({ name: 'bar', activeOnStartup: true }).toJSON(),
          ],
          viewpoints: [new Viewpoint({}).toJSON(), startingVp.toJSON()],
          maps: [new OpenlayersMap({ name: 'foo' }).toJSON()],
          startingViewpointName: 'foo',
          startingMapName: 'foo',
        });
        app = new VcsApp();
        removed = sinon.spy();
        app.moduleRemoved.addEventListener(removed);
        await app.addModule(module);
        await app.removeModule(module._id);
      });

      after(() => {
        app.destroy();
      });

      it('should remove the module', () => {
        expect(app.getModuleById(module._id)).to.be.undefined;
      });

      it('should raise the moduleRemoved event', () => {
        expect(removed).to.have.been.called;
      });

      it('should remove the modules resources', () => {
        expect([...app.layers]).to.be.empty;
        expect([...app.maps]).to.be.empty;
        expect([...app.viewpoints]).to.be.empty;
      });
    });

    describe('if removing the same module twice', () => {
      let module;
      /** @type {VcsApp} */
      let app;
      /** @type {Viewpoint} */
      let startingVp;
      let removed;

      before(async () => {
        startingVp = new Viewpoint({
          name: 'foo',
          groundPosition: [13, 52],
          distance: 200,
        });
        module = new VcsModule({
          layers: [
            new VectorLayer({ name: 'foo' }).toJSON(),
            new VectorLayer({ name: 'bar', activeOnStartup: true }).toJSON(),
          ],
          viewpoints: [new Viewpoint({}).toJSON(), startingVp.toJSON()],
          maps: [new OpenlayersMap({ name: 'foo' }).toJSON()],
          startingViewpointName: 'foo',
          startingMapName: 'foo',
        });
        app = new VcsApp();
        removed = sinon.spy();
        app.moduleRemoved.addEventListener(removed);
        await app.addModule(module);
        await app.removeModule(module._id);
      });

      after(() => {
        app.destroy();
      });

      it('should remove the module', () => {
        expect(app.getModuleById(module._id)).to.be.undefined;
      });

      it('should raise the moduleRemoved event once', () => {
        expect(removed).to.have.been.calledOnce;
      });

      it('should remove the modules resources', () => {
        expect([...app.layers]).to.be.empty;
        expect([...app.maps]).to.be.empty;
        expect([...app.viewpoints]).to.be.empty;
      });
    });
  });

  describe('locale', () => {
    /** @type {VcsApp} */
    let app;

    before(() => {
      app = new VcsApp();
    });

    after(() => {
      app.destroy();
    });

    it('should synchronize the app.locale with the layerCollection locale', () => {
      expect(app.locale).to.be.equal(app.layers.locale);
    });

    it('should synchronize changes to the app.locale with the layerCollection', () => {
      app.locale = 'fr';
      expect(app.layers.locale).to.be.equal('fr');
    });

    it('should not change the locale if the locale is not valid', () => {
      app.locale = 'test';
      expect(app.locale).to.not.be.equal('test');
    });
  });
});
