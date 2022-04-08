import { SplitDirection, GeographicTilingScheme } from '@vcmap/cesium';

import RasterLayer, { calculateMinLevel } from '../../../src/layer/rasterLayer.js';
import { getCesiumEventSpy } from '../helpers/cesiumHelpers.js';
import Extent from '../../../src/util/extent.js';
import { getOpenlayersMap } from '../helpers/openlayersHelpers.js';
import AbstractRasterLayerOL from '../../../src/layer/openlayers/rasterLayerOpenlayersImpl.js';
import { mercatorProjection, wgs84Projection } from '../../../src/util/projection.js';

describe('RasterLayer.calculateMinLevel', () => {
  describe('calculating min level', () => {
    describe('with an invalid extent', () => {
      it('should not alter min level', () => {
        const minLevel = calculateMinLevel(new Extent({
          coordinates: [],
          projection: wgs84Projection.toJSON(),
        }), new GeographicTilingScheme(), 18, 0);
        expect(minLevel).to.equal(0);
      });
    });

    describe('with a valid extent', () => {
      it('should reduce the min level to a reasonable size', () => {
        const minLevel = calculateMinLevel(new Extent({
          coordinates: [12, 51, 13, 53],
          projection: wgs84Projection.toJSON(),
        }), new GeographicTilingScheme(), 18, 0);
        expect(minLevel).to.equal(7);
      });
    });
  });
});

describe('RasterLayer', () => {
  let sandbox;
  /** @type {import("@vcmap/core").RasterLayer} */
  let ARL;

  before(() => {
    sandbox = sinon.createSandbox();
  });

  beforeEach(() => {
    ARL = new RasterLayer({});
  });

  afterEach(() => {
    ARL.destroy();
    sandbox.restore();
  });

  describe('splitDirection', () => {
    it('should return the split direction', () => {
      ARL.splitDirection = SplitDirection.LEFT;
      expect(ARL.splitDirection).to.equal(SplitDirection.LEFT);
    });

    it('should call the SPLIT_DIRECTION_CHANGED events', () => {
      const spy = getCesiumEventSpy(sandbox, ARL.splitDirectionChanged);
      ARL.splitDirection = SplitDirection.LEFT;
      expect(spy).to.have.been.calledWith(SplitDirection.LEFT);
    });

    it('should not publish the SPLIT_DIRECTION_CHANGED event, if it does not changed', () => {
      ARL.splitDirection = SplitDirection.LEFT;
      const spy = getCesiumEventSpy(sandbox, ARL.splitDirectionChanged);
      ARL.splitDirection = SplitDirection.LEFT;
      expect(spy).to.not.have.been.called;
    });

    it('should call updateSplitDirection on all implementations', () => {
      const updateSplitDirection = sandbox.spy();
      sandbox.stub(ARL, 'getImplementations').returns([{ updateSplitDirection, destroy() {} }]);
      ARL.splitDirection = SplitDirection.LEFT;
      expect(updateSplitDirection).to.have.been.called;
    });
  });

  describe('getting config objects', () => {
    describe('of a default object', () => {
      it('should return an object with type and name for default layers', () => {
        const config = ARL.toJSON();
        expect(config).to.have.all.keys('name', 'type');
      });
    });

    describe('of a configured layer', () => {
      let inputConfig;
      let outputConfig;
      let configuredLayer;

      before(() => {
        inputConfig = {
          minLevel: 1,
          maxLevel: 27,
          tilingSchema: 'mercator',
          opacity: 0.5,
          splitDirection: 'left',
          projection: mercatorProjection.toJSON(),
        };
        configuredLayer = new RasterLayer(inputConfig);
        outputConfig = configuredLayer.toJSON();
      });

      after(() => {
        configuredLayer.destroy();
      });

      it('should configure minLevel', () => {
        expect(outputConfig).to.have.property('minLevel', inputConfig.minLevel);
      });

      it('should configure maxLevel', () => {
        expect(outputConfig).to.have.property('maxLevel', inputConfig.maxLevel);
      });

      it('should configure tilingSchema', () => {
        expect(outputConfig).to.have.property('tilingSchema', inputConfig.tilingSchema);
      });

      it('should configure opacity', () => {
        expect(outputConfig).to.have.property('opacity', inputConfig.opacity);
      });

      it('should configure splitDirection', () => {
        expect(outputConfig).to.have.property('splitDirection', inputConfig.splitDirection);
      });
    });
  });

  describe('setting opacity', () => {
    it('should set a new opacity', () => {
      ARL.opacity = 0.5;
      expect(ARL.opacity).to.equal(0.5);
    });

    it('should clip opacity to 0 and 1', () => {
      ARL.opacity = 2;
      expect(ARL.opacity).to.equal(1);
      ARL.opacity = -2;
      expect(ARL.opacity).to.equal(0);
    });

    it('should update all implementations, if the opacity changes', async () => {
      const map = await getOpenlayersMap();
      const impl = new AbstractRasterLayerOL(map, ARL.toJSON());
      ARL._implementations.set(map, [impl]);
      const updateOpacity = sandbox.spy(impl, 'updateOpacity');
      ARL.opacity = 0.5;
      ARL.opacity = 0.5;
      expect(updateOpacity).to.have.been.calledOnceWith(0.5);
    });
  });
});
