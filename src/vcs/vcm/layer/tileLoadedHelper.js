import CesiumTilesetCesium from './cesium/cesiumTilesetCesium.js';

/**
 * @param {CesiumTilesetCesium} impl
 * @param {number=} timeout
 * @returns {Promise<void>}
 */
function waitForImplTilesLoaded(impl, timeout) {
  return new Promise((resolve) => {
    let timeoutNr;
    const remover = impl.cesium3DTileset.allTilesLoaded.addEventListener(() => {
      if (timeoutNr) {
        clearTimeout(timeoutNr);
      }
      remover();
      resolve();
    });

    if (timeout != null) {
      timeoutNr = setTimeout(() => {
        remover();
        resolve();
      }, timeout);
    }
  });
}

/**
 * @param {import("@vcmap/core").CesiumTileset|import("@vcmap/core").FeatureStore} layer
 * @param {number=} timeout
 * @returns {Promise<void>}
 */
export async function tiledLayerLoaded(layer, timeout) {
  const impls = /** @type {Array<CesiumTilesetCesium>} */
    (layer.getImplementations().filter(i => i instanceof CesiumTilesetCesium));
  if (!layer.active || impls.every(i => i.cesium3DTileset.tilesLoaded)) {
    return;
  }

  await Promise.all(impls.map(i => waitForImplTilesLoaded(i, timeout)));
}

/**
 * @param {import("@vcmap/cesium").Globe} globe
 * @param {number=} timeout
 * @returns {Promise<void>}
 */
export function globeLoaded(globe, timeout) {
  if (globe.tilesLoaded) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let timeoutNr;
    const remover = globe.tileLoadProgressEvent.addEventListener((count) => {
      if (count < 1) {
        if (timeoutNr) {
          clearTimeout(timeoutNr);
        }
        remover();
        resolve();
      }
    });

    if (timeout != null) {
      timeoutNr = setTimeout(() => {
        remover();
        resolve();
      }, timeout);
    }
  });
}
