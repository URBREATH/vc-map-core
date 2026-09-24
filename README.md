# VC Map Core (`@vcmap/core`)

**Provided by:** VC Map Project (virtualcitySYSTEMS)

## Description

VC Map Core is a thin abstraction layer around OpenLayers and Cesium. It provides a common API for data and feature management and synchronizes data and user actions across 2D, oblique, and 3D views. Applications can build map functions and tools against the core API for use across those views, rather than implementing them separately for different technologies.

## Installation Prerequisites

- Node.js and npm. The provided documentation does not specify minimum versions.
- OpenLayers and Cesium are used by the core. Their integration is provided through the VC Map Core API.

## Installation Instructions

1. Clone the VC Map Core repository.
2. Navigate to the repository directory.
3. Install dependencies:

   ```bash
   npm install
   ```

The provided documentation does not include deployment or production packaging instructions.

## Built Image Registry

Not specified in the provided documentation.

## License

This project is licensed under the MIT License.

Copyright (c) 2023 virtualcitySYSTEMS

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## External technical resources

- [VC Map Project](https://github.com/virtualcitySYSTEMS/map-ui)
- [CZML Guide](https://github.com/AnalyticalGraphicsInc/czml-writer/wiki/CZML-Guide)
- [Quantized-Mesh terrain format](https://github.com/CesiumGS/quantized-mesh)

## User Guide References

The source mentions API documentation but does not include a link. No separate user guide or FAQ links were provided.

## Additional Information

### Maps

The core supports three map types:

- **2D map:** OpenLayers.
- **3D map:** CesiumJS.
- **Oblique map:** OpenLayers.

The same core API can be used across the supported views.

### `VcsApp`

`VcsApp` is the main class for managing items such as maps, layers, viewpoints, and styles. It provides APIs to add, get, and list items in different collections. For example:

```js
const layer = vcsApp.layers.getByKey('myLayerName');
```

`VcsApp` also provides APIs for parsing and serializing modules. Items can be added by parsing a module or directly through the API.

### Layers

Some layers are map-specific and, for example, work only in 3D. Layers can be created through the API or loaded into `VcsApp` from a module.

**3D only**

- `CesiumTilesetLayer` — 3D Tiles OGC Community Standard.
- `CzmlLayer` — Cesium CZML.
- `PointCloudLayer` — uses `CesiumTilesetLayer`.
- `TerrainLayer` — Cesium Quantized-Mesh terrain.

**Supported in 2D and 3D**

- WMS layer.
- WMTS layer.
- TMS layer.
- `SingleImageryLayer`.
- Vector tile layer.
- OpenStreetMap layer.

**Supported in 2D, 3D, and oblique views**

- WFS layer.
- GeoJSON layer.
- Vector layer, which allows features to be added through the API, for example:

  ```js
  layer.addFeature(new Feature({ geometry: new Polygon({...}) }));
  ```

Feature-providing layers—including `VectorLayer`, `WFSLayer`, `GeoJSONLayer`, and `CesiumTilesetLayer`—share an API for hiding, highlighting, styling, and accessing features.

### Styles

The core supports two style item types:

- **`DeclarativeStyleItem`** uses the Cesium 3D Tiles Styling language. It can style dataset features using attribute values or rules based on attributes.
- **`VectorStyleItem`** is based on OpenLayers styling and is suited to static styling of a complete dataset.

Both style item types can be serialized to JSON and work with `VectorLayer`, `GeoJSONLayer`, `CesiumTilesetLayer`, and `VectorTileLayer`.

### Configuration management

Items such as maps, layers, viewpoints, and styles can be managed in modules. Modules are customizable, can be serialized to JSON, and can be loaded or unloaded by `VcsApp`.

### Interactions API

The Interactions API abstracts map events, such as clicks, so applications can be developed for 2D, 3D, and oblique views.

### Feature Editor API

Built on the Interactions API, the Feature Editor provides functionality to create, select, and transform features.

### Parametrized Features API

Vector features can be displayed in a `VectorLayer` or `GeoJSONLayer`. GeoJSON features are 2D and render directly in a 2D map. In 3D, a feature’s appearance can depend on the vector layer settings or the feature’s properties.

Features can be:

- Rendered as solids using an extrusion parameter.
- Rendered as GLTF models when they are point features.
- Rendered as classification primitives to classify other content.

See `VectorProperties` for further options.

### Categories

Categories provide a way to serialize and parse arbitrary JSON objects from a module.

### OpenLayers and CesiumJS access

The full capabilities of OpenLayers and CesiumJS are available. For example, a 3D map provides an accessor for its corresponding Cesium `Scene`.

### Extensibility

The `ClassRegistry` concept and API allow custom item types to be registered with the framework. For example:

```js
app.layerClassRegistry.registerClass('myLayer', MyLayerClass);
```

A custom layer can implement the Layer interface and use the module serialization and parsing system.

### Coding conventions

Export variables, functions, classes, and other symbols from a module when they are required by the public API. Add public library exports to the module’s `index.ts` file manually.

Use names that are meaningful outside their module. For example, a function named `extend` that operates on 3D extents should use a more specific name such as `extend3DExtent`.
