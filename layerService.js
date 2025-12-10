import { map } from "./app.js";

const activeLayers = new Set();
let hoveredFeatureId = null;

// 👉 Crear highlight global una sola vez
function ensureHighlightLayer() {
  if (!map.getSource("highlightSource")) {
    map.addSource("highlightSource", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] }
    });

    map.addLayer({
      id: "highlightLayer",
      type: "line",
      source: "highlightSource",
      paint: {
        "line-width": 4,
        "line-color": "#00ffff"
      }
    });
  }
}

export function addLayerToMap(layerId) {
  ensureHighlightLayer();

  const bounds = map.getBounds();
  const sourceId = `src_${layerId}`;
  const layerName = `lyr_${layerId}`;
  const hitLayerId = `hit_${layerId}`;

  const baseUrl = `https://gisem.osinergmin.gob.pe/serverosih/rest/services/Electricidad/ELECTRICIDAD_TOTAL/MapServer/${layerId}/query?where=1%3D1&returnGeometry=true&outFields=*&geometryType=esriGeometryEnvelope&inSR=4326&outSR=4326&f=geojson`;
  const buildUrl = (b) =>
    `${baseUrl}&geometry=${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`;

  fetch(buildUrl(bounds))
    .then(r => r.json())
    .then(data => {

      if (!data.features || data.features.length === 0) return;

      const geomType = data.features[0].geometry.type;

      // Si existe solo actualizar
      if (map.getSource(sourceId)) {
        map.getSource(sourceId).setData(data);
        map.setLayoutProperty(layerName, "visibility", "visible");
        map.setLayoutProperty(hitLayerId, "visibility", "visible");
        return;
      }

      // Crear fuente
      map.addSource(sourceId, { type: "geojson", data });

      // --> Capa visible según tipo
      if (geomType.includes("Point")) {
        map.addLayer({
          id: layerName,
          type: "circle",
          source: sourceId,
          layout: { visibility: "visible" },
          paint: {
            "circle-radius": 6,
            "circle-color": "#ff0000",
            "circle-stroke-width": 1,
            "circle-stroke-color": "#ffffff"
          }
        });

        map.addLayer({
          id: hitLayerId,
          type: "circle",
          source: sourceId,
          layout: { visibility: "visible" },
          paint: {
            "circle-radius": 15,
            "circle-color": "rgba(0,0,0,0)"
          }
        });

      } else if (geomType.includes("Polygon")) {
        map.addLayer({
          id: layerName,
          type: "fill",
          source: sourceId,
          layout: { visibility: "visible" },
          paint: {
            "fill-color": "#ff0000",
            "fill-opacity": 0.4,
            "fill-outline-color": "#000000"
          }
        });

        map.addLayer({
          id: hitLayerId,
          type: "fill",
          source: sourceId,
          layout: { visibility: "visible" },
          paint: {
            "fill-color": "rgba(0,0,0,0)"
          }
        });

      } else {
        map.addLayer({
          id: layerName,
          type: "line",
          source: sourceId,
          layout: { visibility: "visible" },
          paint: { "line-width": 1.5, "line-color": "#ff0000" }
        });

        map.addLayer({
          id: hitLayerId,
          type: "line",
          source: sourceId,
          layout: { visibility: "visible" },
          paint: { "line-width": 15, "line-color": "rgba(0,0,0,0)" }
        });
      }

      // Hover con highlight
      map.on("mousemove", hitLayerId, (e) => {
        map.getCanvas().style.cursor = "pointer";
        map.getSource("highlightSource").setData({
          type: "FeatureCollection",
          features: [e.features[0]]
        });
      });

      map.on("mouseleave", hitLayerId, () => {
        map.getCanvas().style.cursor = "";
        map.getSource("highlightSource").setData({
          type: "FeatureCollection",
          features: []
        });
      });

      // Popup full info
      map.on("click", hitLayerId, (e) => {
        const props = e.features[0].properties;
        const html = Object.keys(props)
          .map(k => `<b>${k}:</b> ${props[k]}`)
          .join("<br>");

        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(html)
          .addTo(map);
      });

      // Update al mover/zoom
      if (!activeLayers.has(layerId)) {
        map.on("moveend", async () => {
          if (map.getLayoutProperty(layerName, "visibility") === "none") return;
          const newBounds = map.getBounds();
          const response = await fetch(buildUrl(newBounds));
          const updated = await response.json();
          map.getSource(sourceId).setData(updated);
        });

        activeLayers.add(layerId);
      }
    });
}

// 🧽 Ocultar sin eliminar
export function removeLayerFromMap(layerId) {
  const layerName = `lyr_${layerId}`;
  const hitLayerId = `hit_${layerId}`;

  if (map.getLayer(layerName)) map.setLayoutProperty(layerName, "visibility", "none");
  if (map.getLayer(hitLayerId)) map.setLayoutProperty(hitLayerId, "visibility", "none");

  if (map.getSource("highlightSource")) {
    map.getSource("highlightSource").setData({
      type: "FeatureCollection",
      features: []
    });
  }
}