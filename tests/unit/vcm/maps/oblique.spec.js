import OLMap from 'ol/Map.js';
import { getObliqueCollection, mercatorCoordinates } from '../../helpers/obliqueHelpers.js';
import Oblique from '../../../../src/vcs/vcm/maps/oblique.js';
import ViewPoint from '../../../../src/vcs/vcm/util/viewpoint.js';
import Projection from '../../../../src/vcs/vcm/util/projection.js';
import { getCesiumEventSpy } from '../../helpers/cesiumHelpers.js';
import resetFramework from '../../helpers/resetFramework.js';
import { obliqueCollectionCollection } from '../../../../src/vcs/vcm/globalCollections.js';
import ObliqueImage from '../../../../src/vcs/vcm/oblique/ObliqueImage.js';

describe('vcs.vcm.maps.Oblique', () => {
  let sandbox;
  let obliqueCollection1;
  let obliqueCollection2;

  before(() => {
    sandbox = sinon.createSandbox();
    obliqueCollection1 = getObliqueCollection();
    obliqueCollection2 = getObliqueCollection();
    obliqueCollection2.name = 'obliqueCollection2';
    obliqueCollectionCollection.add(obliqueCollection1);
    obliqueCollectionCollection.add(obliqueCollection2);
  });

  afterEach(() => {
    sandbox.restore();
  });

  after(() => {
    resetFramework();
  });

  describe('initializing an oblique map', () => {
    /** @type {vcs.vcm.maps.Oblique} */
    let map;

    before(async () => {
      map = new Oblique({});
      await map.initialize();
    });

    after(() => {
      map.destroy();
    });

    it('should set the first collection, if there is no default collection name', () => {
      expect(map.collection).to.equal(obliqueCollection1);
    });

    it('should set the named collection, if there is a default collection name', async () => {
      const namedCollection = new Oblique({ defaultCollectionName: obliqueCollection2.name });
      await namedCollection.initialize();
      expect(namedCollection.collection).to.equal(obliqueCollection2);
      namedCollection.destroy();
    });

    it('should create an olMap', () => {
      expect(map.olMap).to.be.an.instanceOf(OLMap);
    });

    it('should set initializedPromise', () => {
      expect(map).to.have.property('initializedPromise').and.to.be.a('promise');
    });

    it('should set the map initialized', () => {
      expect(map.initialized).to.be.true;
    });
  });

  describe('checking data availability for a viewpoint', () => {
    /** @type {vcs.vcm.maps.Oblique} */
    let map;
    let vp;

    beforeEach(() => {
      vp = new ViewPoint({
        groundPosition: Projection.mercatorToWgs84(mercatorCoordinates),
      });
      map = new Oblique({});
    });

    afterEach(() => {
      map.destroy();
    });

    it('should initialize the map', async () => {
      await map.canShowViewpoint(vp);
      expect(map.initialized).to.be.true;
    });

    it('should return true, if the collection has an image at the given coordinate', async () => {
      const canShow = await map.canShowViewpoint(vp);
      expect(canShow).to.be.true;
    });

    it('should return false, if the collection cant show the given vp', async () => {
      vp.groundPosition = [0, 0, 0];
      const canShow = await map.canShowViewpoint(vp);
      expect(canShow).to.be.false;
    });
  });

  describe('determining visibility of a coordinate', () => {
    let visiblePoint;

    before(() => {
      visiblePoint = Projection.mercatorToWgs84(mercatorCoordinates);
    });

    describe('without an image', () => {
      it('should return false', () => {
        const map = new Oblique({});
        expect(map.pointIsVisible(visiblePoint)).to.be.false;
      });
    });

    describe('with an inactive map', () => {
      it('should return false', async () => {
        const map = new Oblique({});
        await map.initialize();
        expect(map.pointIsVisible(visiblePoint)).to.be.false;
      });
    });

    describe('with an active map', () => {
      /** @type {vcs.vcm.maps.Oblique} */
      let map;

      before(async () => {
        map = new Oblique({});
        await map.activate();
        sandbox.stub(map.olMap.getViewport(), 'offsetHeight').get(() => 1000);
        sandbox.stub(map.olMap.getViewport(), 'offsetWidth').get(() => 1000);
        await map.gotoViewPoint(new ViewPoint({
          groundPosition: visiblePoint,
          distance: 200,
        }));
        map.olMap.setSize(map.currentImage.meta.size);
      });

      after(() => {
        map.destroy();
      });

      it('should return true for a point within the bounds of the image', () => {
        // TODO getZoom in map.gotoViewpoint() seems to return wrong value
        // works in loaded map, fails only in this test (RUH, 2021-03-25)
        expect(map.pointIsVisible(visiblePoint)).to.be.true;
      });

      it('should return false for a point outside of the bound of the image', () => {
        expect(map.pointIsVisible([0, 0, 0])).to.be.false;
      });
    });
  });

  describe('activating the map', () => {
    describe('without viewpoint for the first time', () => {
      /** @type {vcs.vcm.maps.Oblique} */
      let map;

      before(async () => {
        map = new Oblique({});
        await map.activate();
      });

      after(() => {
        map.destroy();
      });

      it('should initialize the map', () => {
        expect(map.initialized).to.be.true;
      });

      it('should set the active property', () => {
        expect(map.active).to.be.true;
      });
    });

    describe('without a viewpoint, with a set current image', () => {
      let map;

      before(async () => {
        map = new Oblique({});
        await map.initialize();
        await map.setImageByName('036_064_116005331');
        await map.activate();
      });

      after(() => {
        map.destroy();
      });

      it('should reset the current images layer on the olMap', () => {
        expect(map.olMap.getLayers().getArray()).to.have.length(1);
      });
    });

    describe('with a viewpoint', () => {
      /** @type {vcs.vcm.maps.Oblique} */
      let map;

      before(async () => {
        map = new Oblique({});
        await map.activate();
        await map.gotoViewPoint(new ViewPoint({
          groundPosition: Projection.mercatorToWgs84(mercatorCoordinates),
        }));
      });

      after(() => {
        map.destroy();
      });

      it('should set the viewpoint, activating the closest image', () => {
        expect(map.currentImage).to.be.an.instanceOf(ObliqueImage);
        expect(map.currentImage.name).to.equal('036_064_116005331');
      });

      it('should set the current images layer on the olMap', () => {
        expect(map.olMap.getLayers().getArray()).to.have.length(1);
      });
    });
  });

  describe('deactivating the map', () => {
    let map;

    before(async () => {
      map = new Oblique({});
      await map.activate();
      map.deactivate();
    });

    after(() => {
      map.destroy();
    });

    it('should set the map to inactive', () => {
      expect(map.active).to.be.false;
    });

    it('should remove any layers from the olMap', () => {
      expect(map.olMap.getLayers().getArray()).to.be.empty;
    });
  });

  describe('setting a collection', () => {
    /** @type {vcs.vcm.maps.Oblique} */
    let map;

    before(async () => {
      map = new Oblique({});
      await map.activate();
      await map.gotoViewPoint(new ViewPoint({
        groundPosition: Projection.mercatorToWgs84(mercatorCoordinates),
      }));
    });

    after(() => {
      map.destroy();
    });

    it('set a new collection', async () => {
      await map.setCollection(obliqueCollection2);
      expect(map.collection).to.equal(obliqueCollection2);
    });

    it('should load the collection', async () => {
      const collection = getObliqueCollection();
      await map.setCollection(collection);
      expect(collection.loaded).to.be.true;
      collection.destroy();
    });

    it('should raise the collectionChanged event', async () => {
      const spy = getCesiumEventSpy(sandbox, map.collectionChanged);
      await map.setCollection(obliqueCollection1);
      expect(spy).to.have.been.calledOnceWith(obliqueCollection1);
    });

    it('should maintain the current view', async () => {
      await map.setCollection(obliqueCollection2);
      expect(map.currentImage).to.be.an.instanceOf(ObliqueImage);
      expect(map.currentImage.name).to.equal('036_064_116005331');
    });

    it('should load the last collection if loading in parallel', async () => {
      const collection = getObliqueCollection();
      const p1 = map.setCollection(obliqueCollection1);
      const p2 = map.setCollection(collection);
      await Promise.all([p1, p2]);
      expect(map.collection).to.equal(collection);
      collection.destroy();
    });

    describe('while the map is not initialized', () => {
      it('should set the collection after initialization', async () => {
        const newMap = new Oblique({});
        await newMap.setCollection(obliqueCollection2);
        await newMap.initialize();
        expect(newMap.collection).to.equal(obliqueCollection2);
        newMap.destroy();
      });
    });

    describe('while the map is initializing', () => {
      it('should set the collection after initialization', async () => {
        const newMap = new Oblique({});
        newMap.initialize();
        await newMap.setCollection(obliqueCollection2);
        expect(newMap.initialized).to.be.true;
        expect(newMap.collection).to.equal(obliqueCollection2);
        newMap.destroy();
      });
    });
  });

  describe('setting an image', () => {
    /** @type {vcs.vcm.maps.Oblique} */
    let map;

    before(async () => {
      map = new Oblique({});
      await map.activate();
    });

    after(() => {
      map.destroy();
    });

    it('should raise the imageChanged event', async () => {
      const spy = getCesiumEventSpy(sandbox, map.imageChanged);
      await map.setImageByName('034_070_110005034');
      expect(spy).to.have.been.called;
    });

    it('should set the image as the currentImage', async () => {
      await map.setImageByName('034_070_110005034');
      expect(map.currentImage).to.equal(obliqueCollection1.getImageByName('034_070_110005034'));
    });

    describe('with an invalid image name', () => {
      it('should not raise the imageChanged event', async () => {
        const spy = getCesiumEventSpy(sandbox, map.imageChanged);
        await map.setImageByName('doesNotExist');
        expect(spy).to.not.have.been.called;
      });

      it('should not set a new image', async () => {
        const { currentImage } = map;
        await map.setImageByName('doesNotExist');
        expect(map.currentImage).to.equal(currentImage);
      });
    });

    describe('without a view center', () => {
      it('should set the viewpoint to be the center of the image', async () => {
        await map.setImageByName('036_064_116005331');
        const groundPosition = Projection.mercatorToWgs84(mercatorCoordinates);
        const vp = await map.getViewPoint();
        const [x, y] = vp.groundPosition;
        expect(x).to.be.closeTo(groundPosition[0], 0.001);
        expect(y).to.be.closeTo(groundPosition[1], 0.001);
      });
    });

    describe('with a view center', () => {
      it('should set the current viewpoint to said view center', async () => {
        const coordinate = [mercatorCoordinates[0] + 50, mercatorCoordinates[1] + 50];
        const groundPosition = Projection.mercatorToWgs84(coordinate);
        await map.setImageByName('036_064_116005331', coordinate);
        const vp = await map.getViewPoint();
        const [x, y] = vp.groundPosition;
        expect(x).to.be.closeTo(groundPosition[0], 0.00001);
        expect(y).to.be.closeTo(groundPosition[1], 0.00001);
      });
    });

    describe('while initializing the map', () => {
      it('should wait on initialization and set them image', async () => {
        const newMap = new Oblique({});
        newMap.initialize();
        await newMap.setImageByName('034_070_110005034');
        expect(newMap.initialized).to.be.true;
        expect(newMap.currentImage).to.equal(obliqueCollection1.getImageByName('034_070_110005034'));
        newMap.destroy();
      });
    });
  });

  describe('getting a viewpoint', () => {
    describe('without a current image', () => {
      it('should return null', () => {
        const map = new Oblique({});
        expect(map.getViewPointSync()).to.be.null;
        map.destroy();
      });
    });

    describe('with a set image', () => {
      let map;
      let vp;
      let groundPosition;

      before(async () => {
        groundPosition = Projection.mercatorToWgs84(mercatorCoordinates);
        map = new Oblique({});
        await map.activate();
        await map.gotoViewPoint(new ViewPoint({
          heading: 94,
          groundPosition,
          distance: 0.308,
        }));
        vp = map.getViewPointSync();
      });

      after(() => {
        map.destroy();
      });

      it('should return the current views center as the ground position', () => {
        const [x, y] = vp.groundPosition;
        expect(x).to.be.closeTo(groundPosition[0], 0.00001);
        expect(y).to.be.closeTo(groundPosition[1], 0.00001);
      });

      it('should set the heading based on the current images direction', () => {
        expect(vp.heading).to.equal(90);
      });

      it('should calculate the distance', () => {
        expect(vp.distance).to.be.closeTo(0.308, 0.001);
      });
    });
  });

  describe('setting a viewpoint', () => {
    describe('without a current image set', () => {
      let map;

      before(async () => {
        map = new Oblique({});
        await map.activate();
        await map.gotoViewPoint(new ViewPoint({
          heading: 94,
          groundPosition: Projection.mercatorToWgs84(mercatorCoordinates),
          distance: 0.308,
        }));
      });

      after(() => {
        map.destroy();
      });

      it('should set the closest image at the given coordinate and direction', () => {
        expect(map.currentImage.name).to.equal('033_067_111004896');
      });

      it('should calculate the zoom based on the viewpoint distance', () => {
        expect(map.olMap.getView().getZoom()).to.be.closeTo(2.0, 0.001);
      });
    });

    describe('with a current image set', () => {
      let map;

      before(async () => {
        map = new Oblique({});
        const groundPosition = Projection.mercatorToWgs84(mercatorCoordinates);
        const cameraPosition = [groundPosition[0], groundPosition[1], 2];
        await map.activate();
        await map.gotoViewPoint(new ViewPoint({
          heading: 0,
          groundPosition,
        }));
        await map.gotoViewPoint(new ViewPoint({
          heading: 94,
          groundPosition,
          cameraPosition,
        }));
      });

      after(() => {
        map.destroy();
      });
      it('should set the closest image at the given coordinate and direction', () => {
        expect(map.currentImage.name).to.equal('033_067_111004896');
      });

      it('should calculate the zoom based on the camera positions height', () => {
        expect(map.olMap.getView().getZoom()).to.be.closeTo(0.65, 0.001);
      });
    });
  });

  describe('disabling movement', () => {
    /** @type {vcs.vcm.maps.Oblique} */
    let map;
    let currentImage;

    before(async () => {
      map = new Oblique({});
      await map.activate();
      await map.gotoViewPoint(new ViewPoint({
        groundPosition: Projection.mercatorToWgs84(mercatorCoordinates),
      }));
      map.disableMovement(true);
      ({ currentImage } = map);
    });

    after(() => {
      map.destroy();
    });

    it('should not set a new viewpoint', async () => {
      await map.gotoViewPoint(new ViewPoint({
        heading: 90,
        groundPosition: Projection.mercatorToWgs84(mercatorCoordinates),
      }));
      expect(map.currentImage).to.equal(currentImage);
    });

    it('should not set a new image', async () => {
      await map.setImageByName('033_067_111004896');
      expect(map.currentImage).to.equal(currentImage);
    });

    it('should not set a new collection', async () => {
      await map.setCollection(obliqueCollection2);
      expect(map.collection).to.equal(obliqueCollection1);
    });
  });
});
