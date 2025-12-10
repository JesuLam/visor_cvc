import { gruposElectricidad } from "./esriLayers.js";
import { addLayerToMap, removeLayerFromMap } from "./layerService.js";

export function construirPanelCapas(containerId) {
  const contenedor = document.getElementById(containerId);
  contenedor.innerHTML = ""; 

  gruposElectricidad.forEach((grupo, index) => {
    const grupoEl = document.createElement("details");
    grupoEl.classList.add("grupo-capa");
    grupoEl.open = false;

    const resumen = document.createElement("summary");
    resumen.innerHTML = `
      <input type="checkbox" class="check-grupo" data-group="${index}">
      <span>${grupo.nombre}</span>
    `;
    grupoEl.appendChild(resumen);

    grupo.subcapas.forEach(sub => {
      const subDiv = document.createElement("div");
      subDiv.classList.add("subcapa-item");

      subDiv.innerHTML = `
        <input type="checkbox" class="check-subcapa" data-id="${sub.id}">
        ${sub.nombre}
      `;

      grupoEl.appendChild(subDiv);

      // Evento correcto de subcapa
      subDiv.querySelector("input").addEventListener("change", e => {
        if (e.target.checked) {
          addLayerToMap(sub.id);
          enableAutoReload(sub.id);   // 🔥 Activar recarga x bbox si quieres
        } else {
          removeLayerFromMap(sub.id);
        }
      });
    });

    // Evento del grupo completo
    resumen.querySelector("input").addEventListener("change", e => {
      const activar = e.target.checked;
      grupoEl.querySelectorAll(".check-subcapa").forEach(ch => {
        ch.checked = activar;
        if (activar) addLayerToMap(ch.dataset.id);
        else removeLayerFromMap(ch.dataset.id);
      });
    });

    contenedor.appendChild(grupoEl);
  });
}


// Mostrar / ocultar panel de capas con botón de menú
document.getElementById("btn-capasy").addEventListener("click", () => {
  const panel = document.getElementById("panel-capas");
  panel.classList.toggle("visible");
});