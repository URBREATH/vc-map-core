import '../src/ol/geom/circle.js';
import '../src/ol/geom/geometryCollection.js';
import '../src/ol/feature.js';
import '../src/cesium/wallpaperMaterial.js';
import '../src/cesium/cesium3DTilePointFeature.js';
import '../src/cesium/cesium3DTileFeature.js';
import '../src/cesium/cesiumVcsCameraPrimitive.js';

import { setLogLevel } from '@vcs/logger';
import { getFramework } from './unit/helpers/framework.js';
import { mercatorProjection, setDefaultProjectionOptions } from '../src/vcs/vcm/util/projection.js';
import { setupCesiumContextLimits } from './unit/helpers/cesiumHelpers.js';

setLogLevel(false);
const balloonContainer = document.createElement('div');
balloonContainer.id = 'balloonContainer';
const mapContainer = document.createElement('div');
mapContainer.id = 'mapContainer';
const overviewMapDiv = document.createElement('div');
overviewMapDiv.id = 'vcm_overviewmap_container';
const body = document.getElementsByTagName('body')[0];
body.appendChild(balloonContainer);
body.appendChild(mapContainer);
body.appendChild(overviewMapDiv);
setDefaultProjectionOptions(mercatorProjection.getConfigObject());
setupCesiumContextLimits();

before(() => {
  getFramework().mapcontainer = mapContainer;
});

// afterEach(function globalAfterEach() {
//   console.log(getFramework().pubsub.getCount());
// });

