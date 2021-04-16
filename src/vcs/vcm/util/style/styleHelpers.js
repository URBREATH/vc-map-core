import { DEVICE_PIXEL_RATIO } from 'ol/has.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import OLText from 'ol/style/Text.js';
import Style from 'ol/style/Style.js';
import Color from 'cesium/Source/Core/Color.js';

import { getLogger as getLoggerByName } from '@vcsuite/logger';

/**
 * @returns {vcs-logger/Logger}
 */
function getLogger() {
  return getLoggerByName('vcs.vcm.util.style.StyleHelpers');
}

/**
 * @typedef {Object} vcs.vcm.util.style.FontObject
 * @property {string} fontStyle
 * @property {string} fontSize
 * @property {string} fontFamily
 * @property {string} fontWeight
 * @property {string} fontVariant
 * @property {string} lineHeight
 */

/**
 * @enum {number}
 * @const
 * @export
 * @memberOf vcs.vcm.util.style
 * @property {number} NWSE
 * @property {number} SWNE
 * @property {number} DIAGONALCROSS
 * @property {number} NS
 * @property {number} WE
 * @property {number} CROSS
 * @api
 */
export const PatternType = {
  NWSE: 1,
  SWNE: 2,
  DIAGONALCROSS: 3,
  NS: 4,
  WE: 5,
  CROSS: 6,
};

/**
 * Converts HEX colors to RGB
 * @param {string} h
 * @param {number=} opacity
 * @returns {ol/Color}
 * @memberOf vcs.vcm.util.style
 * @export
 */
export function hexToOlColor(h, opacity) {
  let hex = h.substring(1);
  if (hex.length === 3) {
    hex = hex.replace(/([\w\d])/g, '$1$1');
  }

  return [
    parseInt(hex.substring(0, 2), 16),
    parseInt(hex.substring(2, 4), 16),
    parseInt(hex.substring(4, 6), 16),
    opacity != null ? opacity : 1.0,
  ];
}

/**
 * @param {Cesium/Color} cesiumColor
 * @returns {ol/Color}
 */
export function cesiumColorToColor(cesiumColor) {
  const color = cesiumColor.toBytes();
  color[3] /= 255;
  return /** @type {ol/Color} */ (color);
}

/**
 * converts an openlayers color to a cesium Color
 * @param {ol/Color} olColor
 * @returns {Cesium/Color}
 * @memberOf vcs.vcm.util.style
 * @api
 * @export
 */
export function olColorToCesiumColor(olColor) {
  return Color.fromBytes(olColor[0], olColor[1], olColor[2], olColor[3] * 255);
}

/**
 * parses a color to an openlayers color
 * @param {ol/Color|ol/colorlike/ColorLike|Array<number>} color
 * @param {ol/Color=} defaultColor
 * @returns {ol/Color}
 * @memberOf vcs.vcm.util.style
 * @api
 * @export
 */
export function parseColor(color, defaultColor) {
  if (Array.isArray(color)) {
    if (color.length === 3) {
      color.push(1.0);
    }
    return /** @type {ol/Color} */ (color);
  }

  if (typeof color === 'string') {
    if (/^#/.test(color)) {
      return hexToOlColor(color);
    }
    if (/^rgba?\((\d+(,\s?)?){3}((0|1)(\.\d+)?)?\)/.test(color)) {
      const output = color
        .replace(/^rgba?\(([\s\S]+?)\)/, '$1')
        .replace(/\s/, '')
        .split(',')
        .map(n => Number(n));

      if (output.length === 3) {
        output.push(1.0);
      }
      return /** @type {ol/Color} */ (output);
    }
  }

  if (color instanceof CanvasPattern) {
    return [255, 255, 255, 0.4];
  }
  if (defaultColor) {
    return defaultColor;
  }
  throw new Error(`Cannot parse color ${color}`);
}

/**
 *
 * @param {ol/Color|ol/colorlike/ColorLike} color
 * @param {ol/Color} defaultColor
 * @returns {Cesium/Color}
 * @memberOf vcs.vcm.util.style
 * @export
 */
export function getCesiumColor(color, defaultColor) {
  const olColor = parseColor(color, defaultColor);
  return Color.fromBytes(olColor[0], olColor[1], olColor[2], olColor[3] * 255);
}

/**
 * @param {ol/Color|Array<number>|ol/colorlike/ColorLike} color
 * @returns {string}
 * @memberOf vcs.vcm.util.style
 * @export
 */
export function getStringColor(color) {
  return `rgba(${parseColor(color).join(',')})`;
}

/**
 * @param {vcs.vcm.util.style.VectorStyleItem.Fill} options
 * @param {HTMLCanvasElement=} optCanvas
 * @returns {CanvasPattern}
 * @memberOf vcs.vcm.util.style
 * @export
 */
export function createPattern(options, optCanvas) {
  const pixelRatio = DEVICE_PIXEL_RATIO;

  const canvas = optCanvas || document.createElement('canvas');
  if (!optCanvas || !canvas.width) {
    canvas.width = (options.pattern.size || 10) * pixelRatio;
    canvas.height = (options.pattern.size || 10) * pixelRatio;
  }
  const ctx = canvas.getContext('2d');
  const size = canvas.width;

  ctx.fillStyle = getStringColor(options.color);
  ctx.fillRect(0, 0, size, size);

  function drawLineOnCanvas(start, end) {
    ctx.strokeStyle = getStringColor(options.pattern.color);
    ctx.lineWidth = options.pattern.width;
    ctx.lineCap = 'square';
    ctx.beginPath();
    ctx.moveTo(start[0], start[1]);
    ctx.lineTo(end[0], end[1]);
    ctx.stroke();
  }

  switch (options.pattern.type) {
    case 1:
      drawLineOnCanvas([size / 2, size], [size, size / 2]);
      drawLineOnCanvas([0, size / 2], [size / 2, 0]);
      break;
    case 2:
      drawLineOnCanvas([size / 2, size], [0, size / 2]);
      drawLineOnCanvas([size, size / 2], [size / 2, 0]);
      break;
    case 3:
      drawLineOnCanvas([size / 2, size], [size, size / 2]);
      drawLineOnCanvas([0, size / 2], [size / 2, 0]);
      drawLineOnCanvas([size / 2, size], [0, size / 2]);
      drawLineOnCanvas([size, size / 2], [size / 2, 0]);
      break;
    case 4:
      drawLineOnCanvas([size / 2, 0], [size / 2, size]);
      break;
    case 5:
      drawLineOnCanvas([0, size / 2], [size, size / 2]);
      break;
    case 6:
      drawLineOnCanvas([size / 2, 0], [size / 2, size]);
      drawLineOnCanvas([0, size / 2], [size, size / 2]);
      break;
    default:
      return null;
  }
  return ctx.createPattern(canvas, 'repeat');
}

/**
 * @param {ol/Color} color
 * @returns {string}
 * @memberOf vcs.vcm.util.style
 * @export
 */
export function olColorToHex(color) {
  function componentHex(c) {
    const hex = c.toString(16);
    return hex.length === 1 ? `0${hex}` : hex;
  }
  return color
    .slice(0, 3)
    .reduce((prev, val) => `${prev}${componentHex(val)}`, '#');
}

/**
 * @param {string} colorValue
 * @returns {boolean}
 * @memberOf vcs.vcm.util.style
 * @export
 */
export function validateHexColor(colorValue) {
  return /^#[0-9a-f]{6}$/.test(colorValue);
}

/**
 * @param {string|vcs.vcm.util.style.FontObject} font
 * @returns {vcs.vcm.util.style.FontObject}
 * @memberOf vcs.vcm.util.style
 * @export
 */
export function parseFont(font) {
  if (typeof font !== 'string') {
    return font;
  }
  let fontFamily = null;
  let fontSize = null;
  let fontStyle = 'normal';
  let fontWeight = 'normal';
  let fontVariant = 'normal';
  let lineHeight = 'normal';

  font.split(/\s+/).forEach((element) => {
    switch (element) {
      case 'normal':
        break;

      case 'italic':
      case 'oblique':
        fontStyle = element;
        break;

      case 'small-caps':
        fontVariant = element;
        break;

      case 'bold':
      case 'bolder':
      case 'lighter':
      case '100':
      case '200':
      case '300':
      case '400':
      case '500':
      case '600':
      case '700':
      case '800':
      case '900':
        fontWeight = element;
        break;

      default:
        if (!fontSize) {
          const parts = element.split('/');
          fontSize = parts[0];
          if (parts.length > 1) lineHeight = parts[1];
          break;
        }
        if (!fontFamily) {
          fontFamily = element;
        } else {
          fontFamily = `${fontFamily} ${element}`;
        }
        break;
    }
  });

  return {
    fontStyle,
    fontVariant,
    fontWeight,
    fontSize,
    lineHeight,
    fontFamily,
  };
}

/**
 * @param {vcs.vcm.util.style.FontObject} fontObject
 * @returns {string}
 * @memberOf vcs.vcm.util.style
 * @export
 */
export function combineFont(fontObject) {
  const order = [
    'fontStyle',
    'fontVariant',
    'fontWeight',
    'fontSize',
    'fontFamily',
  ];
  let font = null;
  Object.entries(fontObject)
    .filter(e => e[1] !== 'normal' && e[0] !== 'lineWeight')
    .sort((a, b) => {
      const indexA = order.indexOf(a[0]);
      const indexB = order.indexOf(b[0]);
      if (indexA < indexB) {
        return -1;
      }
      if (indexA > indexB) {
        return 1;
      }

      return 0;
    })
    .forEach((e) => {
      if (!font) {
        font = e[1];
      } else {
        font = `${font} ${e[1]}`;
      }
    });

  return font || '';
}

/**
 * tints the given canvas to the specified color
 * @param {CanvasRenderingContext2D} canvasContext
 * @param {ol/Color} color
 * @param {ol/Size} size
 * @param {ol/Size} [optOrigin=[0, 0]]
 */
export function colorInCanvas(canvasContext, color, size, optOrigin) {
  const origin = optOrigin || [0, 0];
  const imgData = canvasContext.getImageData(origin[0], origin[1], size[0], size[1]);
  const { data } = imgData;
  const [r, g, b] = color;
  const ii = data.length;

  for (let i = 0; i < ii; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }

  canvasContext.putImageData(imgData, origin[0], origin[1]);
}

/**
 * @param {ol/style/Text|ol/style/RegularShape} item
 * @returns {ol/style/FillOptions|undefined} // XXX FillOptions?
 */
export function getFillOptions(item) {
  if (item.getFill()) {
    let color = item.getFill().getColor();
    try {
      color = /** @type {ol/Color} */ (parseColor(color).slice());
    } catch (e) {
      getLogger().warning(e.message);
    }
    return { color };
  }
  return undefined;
}

/**
 * @param {ol/style/Stroke} stroke
 * @returns {ol/style/StrokeOptions}
 */
export function getStrokeOptions(stroke) {
  let color = stroke.getColor();
  if (color) {
    try {
      color = /** @type {ol/Color} */ (parseColor(color).slice());
    } catch (e) {
      getLogger().warning(e.message);
    }
  }
  return {
    color,
    width: stroke.getWidth(),
    lineDash: stroke.getLineDash(),
  };
}

/**
 * @param {ol/style/Text} text
 * @returns {vcs.vcm.util.style.VectorStyleItem.Text}
 */
export function getTextOptions(text) {
  return {
    font: text.getFont(),
    fill: getFillOptions(text),
    stroke: text.getStroke() ? getStrokeOptions(text.getStroke()) : undefined,
    textBaseline: text.getTextBaseline(),
    offsetY: text.getOffsetY(),
    offsetX: text.getOffsetX(),
  };
}

/**
 * @param {vcs.vcm.util.style.VectorStyleItem.Text} options
 * @returns {ol/style/Text}
 */
export function getTextFromOptions(options) {
  const textOptions = { ...options };
  if (textOptions.fill && !(textOptions.fill instanceof Fill)) {
    textOptions.fill = new Fill(textOptions.fill);
  }
  if (textOptions.stroke && !(textOptions.stroke instanceof Stroke)) {
    textOptions.stroke = new Stroke(textOptions.stroke);
  }
  if (textOptions.font && typeof textOptions.font !== 'string') {
    textOptions.font = combineFont(textOptions.font);
  }
  return new OLText(/** @type {ol/style/TextOptions} */ (textOptions));
}

/**
 * @param {ol/style/Text} textStyle
 * @returns {{font: string, textShadow: string|undefined, color: string|undefined}}
 */
export function getCssStyleFromTextStyle(textStyle) {
  const style = {
    font: textStyle.getFont(),
  };
  if (textStyle.getStroke()) {
    let width = textStyle.getStroke().getWidth();
    width = width > 1 ? 1 : width;
    const color = olColorToHex(parseColor(textStyle.getStroke().getColor()));
    style.textShadow = `-${width}px ${width}px 0 ${color},${width}px ${width}px 0 ${color},${width}px -${width}px 0 ${color},-${width}px -${width}px 0 ${color}`;
  }
  if (textStyle.getFill()) {
    style.color = olColorToHex(parseColor(textStyle.getFill().getColor()));
  }
  return style;
}

/** @type {ol/style/Style} */
export const emptyStyle = new Style({});

/**
 * @type {ol/Color}
 */
export const emptyColor = [0, 0, 0, 0];

/**
 * @type {ol/Color}
 */
export const whiteColor = [255, 255, 255, 1];

/**
 * @type {ol/Color}
 */
export const blackColor = [0, 0, 0, 1];

/**
 * @returns {vcs.vcm.util.style.VectorStyleItem.Options}
 */
export function getDefaultVectorStyleItemOptions() {
  return {
    image: {
      fill: {
        color: [255, 255, 255, 0.4],
      },
      stroke: {
        color: blackColor,
        width: 1,
      },
      radius: 5,
    },
    stroke: {
      color: [51, 153, 204, 1],
      width: 1.25,
    },
    fill: {
      color: [255, 255, 255, 0.4],
    },
    text: {
      font: 'bold 18px sans-serif',
      textBaseline: 'bottom',
      offsetY: -15,
      offsetX: 0,
    },
  };
}


/**
 * default Values @see https://github.com/AnalyticalGraphicsInc/3d-tiles/tree/3d-tiles-next/Styling
 * @type {Object<string,string>}
 */
const default3DTileStyleValues = {
  olcs_color: getStringColor(whiteColor),
  olcs_scale: '1.0',
  olcs_outlineWidth: '0.0',
  olcs_outlineColor: getStringColor(blackColor),
  olcs_pointSize: '8.0',
  olcs_image: undefined,
  olcs_font: `'${getDefaultVectorStyleItemOptions().text.font}'`,
  olcs_fontColor: getStringColor(blackColor),
  olcs_fontOutlineWidth: '1.0',
  olcs_fontOutlineColor: getStringColor(whiteColor),
  olcs_labelText: undefined,
  olcs_anchorLineColor: getStringColor(whiteColor),
};


/**
 * returns the cesium3DTilesetStyle Condition with the value as the given Attribute
 * The condition checks for undefined and null
 * @param {string} attribute
 * @param {boolean=} isColor
 * @returns {Array<Array<string>>}
 */
export function getDefaultCondition(attribute, isColor) {
  const condition = `Boolean(\${${attribute}})===true`;
  const value = isColor ? `color(\${${attribute}})` : `\${${attribute}}`;
  return [
    [condition, value],
    ['true', default3DTileStyleValues[attribute]],
  ];
}

/**
 * @type {string}
 */
export const defaultExtrudedHeightCondition =
  // eslint-disable-next-line no-template-curly-in-string
  '${attributes} !== undefined && ${attributes} !== null && ${attributes.olcs_extrudedHeight} !== undefined && ${attributes.olcs_extrudedHeight}!==null';
