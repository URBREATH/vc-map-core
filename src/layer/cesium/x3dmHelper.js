/**
 * @param {import("@vcmap-cesium/engine").Cesium3DTileFeature|import("@vcmap-cesium/engine").Cesium3DTilePointFeature} feature
 * @returns {Object}
 */
export default function getJSONObjectFromObject(feature) {
  const properties = feature.getPropertyIds();
  const JSONObject = {};
  for (let i = 0; i < properties.length; i++) {
    JSONObject[properties[i]] = feature.getProperty(properties[i]);
  }
  if (JSONObject.id == null) {
    JSONObject.id = `${feature.content.url}${feature._batchId}`;
  }
  if (JSONObject.attributes) {
    JSONObject.attributes.gmlId = JSONObject.id;
  } else if (JSONObject.gmlId == null) {
    JSONObject.gmlId = JSONObject.id;
  }
  // @ts-ignore
  JSONObject.clickedPosition = feature.clickedPosition
    ? // @ts-ignore
      feature.clickedPosition
    : {};
  return JSONObject;
}
