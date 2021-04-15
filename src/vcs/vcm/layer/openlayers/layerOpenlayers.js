import { vcsLayerName } from '../layerSymbols.js';
import LayerImplementation from '../layerImplementation.js';

/**
 * Layer implementation for {@link vcs.vcm.maps.CesiumMap}.
 * @class
 * @export
 * @extends {vcs.vcm.layer.LayerImplementation<vcs.vcm.maps.Openlayers>}
 * @memberOf vcs.vcm.layer.openlayers
 */
class LayerOpenlayers extends LayerImplementation {
  static get className() { return 'vcs.vcm.layer.openlayers.LayerOpenlayers'; }

  /**
   * @param {vcs.vcm.maps.Openlayers} map
   * @param {vcs.vcm.layer.Layer.ImplementationOptions} options
   */
  constructor(map, options) {
    super(map, options);
    /**
     * @type {ol/layer/Layer|null}
     */
    this.olLayer = null;
  }

  /**
   * @inheritDoc
   * @returns {Promise<void>}
   */
  initialize() {
    if (!this.initialized) {
      this.olLayer = this.getOLLayer();
      this.olLayer[vcsLayerName] = this.name;
      this.map.addOLLayer(this.olLayer);
    }
    return super.initialize();
  }

  /**
   * @inheritDoc
   * @returns {Promise<void>}
   */
  async activate() {
    await super.activate();
    if (this.active) {
      this.olLayer.setVisible(true);
    }
  }

  /**
   * @inheritDoc
   */
  deactivate() {
    super.deactivate();
    if (this.olLayer) {
      this.olLayer.setVisible(false);
    }
  }

  // eslint-disable-next-line jsdoc/require-returns-check
  /**
   * returns the ol Layer
   * @returns {ol/layer/Layer}
   */
  // eslint-disable-next-line class-methods-use-this
  getOLLayer() { throw new Error(); }

  /**
   * @inheritDoc
   */
  destroy() {
    if (this.olLayer) {
      this.map.removeOLLayer(this.olLayer);
    }
    this.olLayer = null;
    super.destroy();
  }
}

export default LayerOpenlayers;
