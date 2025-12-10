// --- Conexión a Supabase ---
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = 'https://rsqmytuwqbmiuxnxogcu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzcW15dHV3cWJtaXV4bnhvZ2N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5OTA1MjQsImV4cCI6MjA3NjU2NjUyNH0.SIOYziCJVSjeRXZxtNFNVnNYNwfAMNqgcUAzoDNf9Mg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ⭐ Variable global donde guardaremos el GeoJSON descargado
let GEOJSON_CONCESIONES = null;

// Token de Mapbox
const MAPBOX_TOKEN = "pk.eyJ1IjoianRvcnJlbCIsImEiOiJjbWg3cGFjOHUwdnJiMm1vbTBuZzd6bGxqIn0.fs0f0qp-LVOvL0ohH1G_Cw";



mapboxgl.accessToken = MAPBOX_TOKEN;

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/satellite-streets-v12",
  projection: "globe",
  center: [-74, -9],
  zoom: 4
});

map.on("style.load", () => {
  map.setFog({
    color: "rgb(186, 210, 235)",
    "high-color": "rgb(36, 92, 223)",
    "space-color": "rgb(11, 11, 25)",
    "horizon-blend": 0.02
  });
});


// ------------------------------------------
// 🗺️ Cargar capa de concesiones
// ------------------------------------------
async function cargarCapasPersonalizadas() {

  // 🚀 Consulta directa a Supabase (sin GeoServer)
  const { data, error } = await supabase
    .from("concesiones")
    .select("*, geom");

  if (error) {
    console.error("Error al cargar concesiones:", error);
    return;
  }

  const geojson = {
    type: "FeatureCollection",
    features: data.map(row => ({
      type: "Feature",
      geometry: row.geom,   // YA VIENE COMO GEOJSON
      properties: { ...row }
    }))
  };

  GEOJSON_CONCESIONES = geojson;

  // Fuente
  if (!map.getSource("concesiones")) {
    map.addSource("concesiones", { type: "geojson", data: geojson });
  } else {
    map.getSource("concesiones").setData(geojson);
  }

  // Capa
  if (!map.getLayer("concesiones-layer")) {
    map.addLayer({
      id: "concesiones-layer",
      type: "line",
      source: "concesiones",
      paint: {
        "line-color": "#2a37a5",
        "line-width": 3.5,
        "line-opacity": 1
      }
    });
  }

  // Panel
  const panel = document.getElementById("info-panel");
  const closeBtn = document.getElementById("close-panel");

  map.off("click", "concesiones-layer");
  closeBtn.onclick = null;

  map.on("click", "concesiones-layer", async (e) => {
    const props = e.features[0].properties;
    const codZona = props.cod_zona;
    const areaConcesion = props.area_ha || 0;

    await actualizarPanelPorCodZona(codZona, props, areaConcesion);
    panel.classList.add("visible");
  });

  closeBtn.onclick = () => panel.classList.remove("visible");

  map.on("mouseenter", "concesiones-layer", () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", "concesiones-layer", () => {
    map.getCanvas().style.cursor = "";
  });
}

map.on("load", cargarCapasPersonalizadas);


// ------------------------------------------
// ⭐ FUNCIÓN CENTRAL
// ------------------------------------------
async function actualizarPanelPorCodZona(codZona, props, areaConcesion) {

  // 1. Si viene desde el selector ⇒ buscar props en GeoJSON global
  if (!props) {
    const f = GEOJSON_CONCESIONES.features.find(ft => ft.properties.cod_zona === codZona);
    if (!f) return;

    props = f.properties;
    areaConcesion = props.area_ha || 0;
  }

  // 2. Traer cultivos desde Supabase
  const { data: cultivos, error } = await supabase
    .from("cultivos_concesiones")
    .select("*")
    .eq("cod_zona", codZona)
    .order("anio", { ascending: true });

  if (error) return console.error(error);

  // 3. Rellenar panel
  document.getElementById("info-nombre").textContent = props.nombre || "Sin dato";
  document.getElementById("info-area-total").textContent = `${areaConcesion.toFixed(2)} ha`;

  if (cultivos?.length) {
    const ultimo = cultivos[cultivos.length - 1];

    document.getElementById("info-area-cultivada").textContent = ultimo.area_total_ha || "–";
    document.getElementById("info-ano-inicio").textContent = cultivos[0].anio || "–";

    document.getElementById("totalCultivado").textContent = `${ultimo.area_total_ha} ha`;
    document.getElementById("mosaicoHa").textContent = `${ultimo.mosaico_agropecuario_ha || "–"} ha`;
    document.getElementById("otrosHa").textContent = `${ultimo.otros_cultivos_ha || "–"} ha`;

    generarGrafico(cultivos);
  }

  // 4. flyTo estable y garantizado usando el GeoJSON global
  const feature = GEOJSON_CONCESIONES.features.find(ft => ft.properties.cod_zona === codZona);

  if (feature) {
    const centro = turf.center(feature).geometry.coordinates;
    map.flyTo({ center: centro, zoom: 10, essential: true });
  }

  // 5. Mostrar panel
  document.getElementById("info-panel").classList.add("visible");
}



// ------------------------------------------
// ⭐ SELECTOR FUNCIONANDO SIEMPRE
// ------------------------------------------
document.getElementById("selector").addEventListener("change", async (e) => {

  const codZona = e.target.value;

  if (!codZona) return;

  await actualizarPanelPorCodZona(codZona);
});


// ------------------------------------------
// 🛰️ Cambio de basemap
// ------------------------------------------
const radios = document.getElementsByName("base");
radios.forEach((radio) => {
  radio.addEventListener("change", () => {

    const estilo = radio.value;
    const centro = map.getCenter();
    const zoom = map.getZoom();

    map.setStyle(estilo);

    map.once("style.load", async () => {
      map.setFog({
        color: "rgb(186, 210, 235)",
        "high-color": "rgb(36, 92, 223)",
        "space-color": "rgb(11, 11, 25)",
        "horizon-blend": 0.02
      });

      // 🔁 Recargar capa pero NO perder el GeoJSON
      await cargarCapasPersonalizadas();

      map.setCenter(centro);
      map.setZoom(zoom);
    });
  });
});


// ------------------------------------------
// 🗂️ Panel de capas
// ------------------------------------------
import { construirPanelCapas } from "./layerPanel.js";

window.onload = () => {
  construirPanelCapas("panel-capas");
};


// ------------------------------------------
// 📊 Chart.js
// ------------------------------------------
let grafico = null;

function generarGrafico(data) {

  const ctx = document.getElementById('graficoCultivos').getContext('2d');
  const labels = data.map(d => d.anio);
  const areaCultivada = data.map(d => d.area_total_ha);

  if (grafico) grafico.destroy();

  grafico = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Área cultivada (ha)',
          data: areaCultivada,
          backgroundColor: 'rgba(75,192,192,0.7)'
        }
      ]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } },
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });
}

// 👉 lista de basemaps
window.toggleLista = function () {
  const lista = document.getElementById("lista-bases");
  lista.classList.toggle("oculto");
};

export { map };