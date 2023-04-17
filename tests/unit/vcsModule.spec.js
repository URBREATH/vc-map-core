import VcsModule from '../../src/vcsModule.js';
import VcsApp from '../../src/vcsApp.js';
import VectorLayer from '../../src/layer/vectorLayer.js';
import Viewpoint from '../../src/util/viewpoint.js';
import OpenlayersMap from '../../src/map/openlayersMap.js';
import CesiumMap from '../../src/map/cesiumMap.js';

describe('Module', () => {
  let app;
  let module;
  let startingVp;

  before(async () => {
    app = new VcsApp();
    startingVp = new Viewpoint({
      name: 'foo',
      groundPosition: [13, 52],
      distance: 200,
    });
    module = new VcsModule({
      name: 'module',
      description: 'description',
      layers: [
        new VectorLayer({ name: 'foo' }).toJSON(),
        new VectorLayer({ name: 'bar', activeOnStartup: true }).toJSON(),
      ],
      viewpoints: [new Viewpoint({}).toJSON(), startingVp.toJSON()],
      maps: [new OpenlayersMap({ name: 'foo' }).toJSON()],
      startingViewpointName: 'foo',
      startingMapName: 'foo',
    });
    await app.addModule(module);
  });

  describe('getting a config', () => {
    let config;

    before(() => {
      config = module.toJSON();
    });

    it('should add the name', () => {
      expect(config).to.have.property('name', 'module');
    });
    it('should add the description', () => {
      expect(config).to.have.property('description', 'description');
    });
    it('should add the startingViewpointName', () => {
      expect(config).to.have.property('startingViewpointName', 'foo');
    });
    it('should add the startingMapName', () => {
      expect(config).to.have.property('startingMapName', 'foo');
    });
  });

  describe('setting a config', () => {
    it('should serialize the current runtime objects for the dynamic module', () => {
      app.setDynamicModule(module);
      app.layers.getByKey('foo').name = 'fooBar';
      app.viewpoints.remove(startingVp);
      app.maps.add(new CesiumMap({ name: 'cesium' }));
      module.setConfigFromApp(app);
      const { config } = module;
      expect(config.layers).to.have.lengthOf(2);
      expect(!!config.layers.find((l) => l.name === 'fooBar')).to.be.true;
      expect(config.viewpoints).to.have.lengthOf(1);
      expect(config.maps).to.have.lengthOf(2);
    });
  });
});
