// eslint-disable-next-line import/no-unresolved
import * as core from '@vcmap/core';

const layer = new core.Layer({});
layer.destroy();
const map = new core.VcsMap({});
map.destroy();
