"use strict";

const storageKey = "middlemaniac.canonical-registry.v1";
const sampleMappings = [
  {
    id: "sample-taxable", name: "Taxable", model: "Taxable", category: "Taxation", status: "Active",
    inboundMappings: [{ id: "taxable-sap", system: "SAP" }, { id: "taxable-ebs", system: "EBS" }, { id: "taxable-peoplesoft", system: "PeopleSoft" }],
    outboundMappings: [{ id: "taxable-onesource", system: "OneSource" }, { id: "taxable-ceretax", system: "CereTax" }, { id: "taxable-sovos", system: "Sovos" }]
  },
  {
    id: "sample-shipable", name: "Shipable", model: "Shipable", category: "Shipment", status: "Active",
    inboundMappings: [{ id: "shipable-sap", system: "SAP" }],
    outboundMappings: [{ id: "shipable-fedex", system: "Fedex" }, { id: "shipable-dhl", system: "DHL" }]
  },
  {
    id: "sample-payble", name: "Payble", model: "Payble", category: "Payment", status: "Active",
    inboundMappings: [{ id: "payble-sap", system: "SAP" }],
    outboundMappings: [{ id: "payble-card", system: "Credit Card" }, { id: "payble-upi", system: "UPI" }]
  }
];
const state = { records: loadRecords(), selectedId: null, toastTimer: 0, inlineMappingKind: null, exportRecordId: null };
const ui = {
  detail: document.querySelector("#detail-pane"), file: document.querySelector("#canonical-file"),
  sampleDialog: document.querySelector("#sample-dialog"),
  exportDialog: document.querySelector("#canonical-export-dialog"),
  exportPreview: document.querySelector("#canonical-export-preview"),
  toast: document.querySelector("#toast")
};

function loadRecords() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (Array.isArray(saved)) return groupRecords(saved.map(normalizeRecord).filter(Boolean));
  } catch (error) {
    console.warn("Could not restore the integration registry.", error);
  }
  return [];
}

function normalizeRecord(record) {
  if (!record || typeof record.id !== "string" || typeof record.model !== "string" ||
      !["Taxation", "Shipment", "Payment"].includes(record.category) ||
      !["Draft", "In progress", "Active"].includes(record.status)) return null;
  const normalizeMappings = (items, legacyItems, legacyName, kind) => {
    const entries = Array.isArray(items) ? items : Array.isArray(legacyItems) ? legacyItems : typeof legacyName === "string" ? [legacyName] : [];
    const usedIds = new Set();
    return entries.map((entry, index) => {
      const name = typeof entry === "string" ? entry.trim() : String(entry?.system || entry?.name || "").trim();
      let id = typeof entry === "object" && typeof entry.id === "string" && entry.id ? entry.id : `${kind}-${index + 1}`;
      while (usedIds.has(id)) id = `${id}-${index + 1}`;
      usedIds.add(id);
      return { id, system: name };
    }).filter((mapping) => mapping.system);
  };
  const { sources, targets, source, target, combinations, sourceMappings, targetMappings, ...canonicalData } = record;
  return {
    ...canonicalData,
    name: record.name || record.model,
    inboundMappings: normalizeMappings(record.inboundMappings, sources, source, "inbound"),
    outboundMappings: normalizeMappings(record.outboundMappings, targets, target, "outbound")
  };
}

function groupRecords(records) {
  const grouped = new Map();
  for (const record of records) {
    const key = record.model.trim().toLocaleLowerCase();
    let canonical = grouped.get(key);
    if (!canonical) {
      canonical = { ...record, name: record.model, inboundMappings: [], outboundMappings: [] };
      grouped.set(key, canonical);
    }
    for (const kind of ["inbound", "outbound"]) {
      const property = `${kind}Mappings`;
      for (const mapping of record[property]) {
        const duplicate = canonical[property].some((item) => item.system.toLocaleLowerCase() === mapping.system.toLocaleLowerCase());
        if (!duplicate) canonical[property].push({ ...mapping });
      }
    }
  }
  return [...grouped.values()];
}

function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state.records));
  } catch (error) {
    showToast("Could not save changes in this browser.");
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function renderDetail() {
  const record = state.records.find((item) => item.id === state.selectedId);
  if (!record) {
    const placeholder = { id: "", model: "Canonical", inboundMappings: [], outboundMappings: [] };
    ui.detail.innerHTML = `<div class="empty-canonical-view"><div class="integration-mappings">${renderMappingGroup(placeholder, "inbound")}${renderMappingGroup(placeholder, "outbound")}</div>${renderCanonicalFlow(null)}</div>`;
    drawCanonicalFlow();
    return;
  }
  ui.detail.innerHTML = `
    <div class="current-use-case">
      <div class="canonical-heading"><div><span class="canonical-category">${escapeHtml(record.category)}</span><h2>${escapeHtml(record.model)}</h2></div></div>
      <div class="integration-mappings">
        ${renderMappingGroup(record, "inbound")}
        ${renderMappingGroup(record, "outbound")}
      </div>
      ${renderCanonicalFlow(record)}
    </div>`;
  drawCanonicalFlow();
}

function renderCanonicalFlow(record) {
  const inboundMappings = record?.inboundMappings || [];
  const outboundMappings = record?.outboundMappings || [];
  const model = record?.model || "Canonical";
  const sourceNodes = inboundMappings.length
    ? inboundMappings.map((mapping) => `<div class="flow-system" data-flow-inbound="${escapeHtml(mapping.id)}">${escapeHtml(mapping.system)}</div>`).join("")
    : `<div class="flow-system is-placeholder">Source</div>`;
  const targetNodes = outboundMappings.length
    ? outboundMappings.map((mapping) => `<div class="flow-system" data-flow-outbound="${escapeHtml(mapping.id)}">${escapeHtml(mapping.system)}</div>`).join("")
    : `<div class="flow-system is-placeholder">Target</div>`;
  return `<section class="canonical-visualization" aria-label="Mapping flow"><div class="flow-column"><span class="flow-column-label">Inbound mappings</span><div class="flow-system-list">${sourceNodes}</div></div><svg class="flow-connectors" aria-hidden="true"></svg><div class="flow-canonical" data-flow-canonical>${escapeHtml(model)}</div><div class="flow-column"><span class="flow-column-label">Outbound mappings</span><div class="flow-system-list">${targetNodes}</div></div></section>`;
}

function drawCanonicalFlow() {
  const flow = document.querySelector(".canonical-visualization");
  if (!flow) return;
  const record = state.records.find((item) => item.id === state.selectedId);
  const svg = flow.querySelector(".flow-connectors");
  const bounds = flow.getBoundingClientRect();
  svg.replaceChildren();
  svg.setAttribute("viewBox", `0 0 ${bounds.width} ${bounds.height}`);
  svg.setAttribute("width", bounds.width);
  svg.setAttribute("height", bounds.height);
  if (!record || (!record.inboundMappings.length && !record.outboundMappings.length) || !bounds.width || !bounds.height) return;

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  marker.setAttribute("id", "flow-arrowhead");
  marker.setAttribute("viewBox", "0 0 8 8");
  marker.setAttribute("refX", "7");
  marker.setAttribute("refY", "4");
  marker.setAttribute("markerWidth", "6");
  marker.setAttribute("markerHeight", "6");
  marker.setAttribute("orient", "auto-start-reverse");
  const arrow = document.createElementNS("http://www.w3.org/2000/svg", "path");
  arrow.setAttribute("d", "M0 0 8 4 0 8Z");
  arrow.setAttribute("fill", "#91aa98");
  marker.append(arrow);
  defs.append(marker);
  svg.append(defs);

  const center = (element, side) => {
    const rect = element.getBoundingClientRect();
    return {
      x: (side === "right" ? rect.right : rect.left) - bounds.left,
      y: rect.top + rect.height / 2 - bounds.top
    };
  };
  const canonical = flow.querySelector("[data-flow-canonical]");
  const canonicalBounds = canonical.getBoundingClientRect();
  const canonicalLeft = canonicalBounds.left - bounds.left;
  const canonicalRight = canonicalBounds.right - bounds.left;
  const canonicalCenterY = canonicalBounds.top + canonicalBounds.height / 2 - bounds.top;
  const inboundSpacing = Math.min(7, canonicalBounds.height / (record.inboundMappings.length + 1));
  for (const [index, mapping] of record.inboundMappings.entries()) {
    const source = flow.querySelector(`[data-flow-inbound="${CSS.escape(mapping.id)}"]`);
    if (!source) continue;
    const sourcePoint = center(source, "right");
    const portY = canonicalCenterY + (index - (record.inboundMappings.length - 1) / 2) * inboundSpacing;
    const control = Math.max(18, (canonicalLeft - sourcePoint.x) * 0.55);
    const inbound = document.createElementNS("http://www.w3.org/2000/svg", "path");
    inbound.setAttribute("d", `M ${sourcePoint.x} ${sourcePoint.y} C ${sourcePoint.x + control} ${sourcePoint.y}, ${canonicalLeft - control} ${portY}, ${canonicalLeft - 1} ${portY}`);
    inbound.setAttribute("class", "flow-connector flow-connector-inbound");
    inbound.setAttribute("marker-end", "url(#flow-arrowhead)");
    svg.append(inbound);
  }
  const outboundSpacing = Math.min(7, canonicalBounds.height / (record.outboundMappings.length + 1));
  for (const [index, mapping] of record.outboundMappings.entries()) {
    const target = flow.querySelector(`[data-flow-outbound="${CSS.escape(mapping.id)}"]`);
    if (!target) continue;
    const targetPoint = center(target, "left");
    const portY = canonicalCenterY + (index - (record.outboundMappings.length - 1) / 2) * outboundSpacing;
    const control = Math.max(18, (targetPoint.x - canonicalRight) * 0.55);
    const outbound = document.createElementNS("http://www.w3.org/2000/svg", "path");
    outbound.setAttribute("d", `M ${canonicalRight + 1} ${portY} C ${canonicalRight + control} ${portY}, ${targetPoint.x - control} ${targetPoint.y}, ${targetPoint.x} ${targetPoint.y}`);
    outbound.setAttribute("class", "flow-connector flow-connector-outbound");
    outbound.setAttribute("marker-end", "url(#flow-arrowhead)");
    svg.append(outbound);
  }
  if (canonical) canonical.style.zIndex = "1";
}

function renderMappingGroup(record, direction) {
  const inbound = direction === "inbound";
  const mappings = record[`${direction}Mappings`];
  const title = inbound ? "Inbound mappings" : "Outbound mappings";
  const kind = inbound ? "source" : "target";
  const rows = mappings.map((mapping) => `
    <div class="mapping-entry"><span class="mapping-system-name">${escapeHtml(mapping.system)}</span><a class="mapping-open" href="${getMapperUrl(record, mapping, direction)}" target="_blank" rel="noopener noreferrer">Open mapping<span aria-hidden="true"> ↗</span></a><button class="icon-button system-delete" type="button" data-remove-mapping="${direction}" data-mapping-id="${escapeHtml(mapping.id)}" aria-label="Remove ${escapeHtml(mapping.system)} mapping" title="Remove mapping"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 6h11m-9.5 0 .7 10h7.6l.7-10M8 6V4h4v2m-3 3v4m2-4v4"/></svg></button></div>`
  ).join("");
  const addForm = state.inlineMappingKind === direction ? `<form class="inline-mapping-form" data-mapping-form="${direction}"><input id="inline-mapping-system" type="text" maxlength="80" aria-label="${inbound ? "Source" : "Target"} system" placeholder="${inbound ? "Source system" : "Target system"}" required><button class="icon-button" type="submit" aria-label="Add mapping" title="Add mapping"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 4 4 8-8"/></svg></button><button class="icon-button" type="button" data-action="cancel-mapping" aria-label="Cancel" title="Cancel"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg></button></form>` : "";
  return `<section class="mapping-group" aria-label="${title}"><div class="mapping-group-heading"><div><span class="eyebrow">${inbound ? "SOURCE → CANONICAL" : "CANONICAL → TARGET"}</span><h3>${title}</h3></div><div class="mapping-group-tools"><span class="mapping-total">${mappings.length}</span><button class="icon-button" type="button" data-action="add-${direction}-mapping" aria-label="Add ${kind} mapping" title="Add ${kind} mapping"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12"/></svg></button></div></div><div class="mapping-entry-list">${rows}</div>${addForm}</section>`;
}

function getMapperUrl(record, mapping, direction) {
  const inbound = direction === "inbound";
  const params = new URLSearchParams({
    type: inbound ? "S2C" : "C2T",
    from: inbound ? mapping.system : record.model,
    to: inbound ? record.model : mapping.system
  });
  return `../mapper-ui/index.html?${params.toString()}`;
}

function ensureDefaultCanonical() {
  let record = state.records.find((item) => item.id === state.selectedId);
  if (record) return record;
  record = {
    id: "canonical-taxable",
    name: "Taxable",
    model: "Taxable",
    category: "Taxation",
    status: "Draft",
    inboundMappings: [],
    outboundMappings: [],
    owner: "Unassigned",
    updatedAt: new Date().toISOString().slice(0, 10),
  };
  state.records.unshift(record);
  state.selectedId = record.id;
  return record;
}

function render() {
  renderDetail();
  document.querySelector("#export-canonical").disabled = !state.records.some((record) => record.id === state.selectedId);
  document.querySelector("#clear-canonical").disabled = !state.records.length;
  persist();
}

function openSamplePicker() {
  ui.sampleDialog.showModal();
}

function openCanonicalExport() {
  const record = state.records.find((item) => item.id === state.selectedId);
  if (!record) return;
  state.exportRecordId = record.id;
  ui.exportPreview.value = `${JSON.stringify(record, null, 2)}\n`;
  ui.exportDialog.showModal();
}

function downloadCanonicalExport() {
  const record = state.records.find((item) => item.id === state.exportRecordId);
  if (!record) return;
  const blob = new Blob([ui.exportPreview.value], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${record.id}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  ui.exportDialog.close();
  showToast("Canonical mappings exported.");
}

function loadSampleCanonical(model) {
  const sourceSample = sampleMappings.find((record) => record.model === model);
  if (!sourceSample) return;
  const sample = {
    ...sourceSample,
    inboundMappings: sourceSample.inboundMappings.map((mapping) => ({ ...mapping })),
    outboundMappings: sourceSample.outboundMappings.map((mapping) => ({ ...mapping }))
  };
  const existingIndex = state.records.findIndex((record) => record.model.toLocaleLowerCase() === model.toLocaleLowerCase());
  if (existingIndex < 0) state.records.unshift(sample);
  else state.records[existingIndex] = groupRecords([state.records[existingIndex], sample])[0];
  state.selectedId = existingIndex < 0 ? sample.id : state.records[existingIndex].id;
  ui.sampleDialog.close();
  render();
  showToast(`${model} mappings loaded.`);
}

function saveInlineMapping(direction) {
  const input = document.querySelector("#inline-mapping-system");
  const name = input?.value.trim();
  if (!name) return;
  const record = ensureDefaultCanonical();
  const mappings = record[`${direction}Mappings`];
  if (mappings.some((mapping) => mapping.system.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    showToast(`${name} mapping already exists.`);
    return;
  }
  mappings.push({ id: `${direction}-${Date.now().toString(36)}`, system: name });
  state.inlineMappingKind = null;
  render();
}

function showToast(message) {
  clearTimeout(state.toastTimer);
  ui.toast.textContent = message;
  ui.toast.classList.add("is-visible");
  state.toastTimer = window.setTimeout(() => ui.toast.classList.remove("is-visible"), 2400);
}

document.querySelector("#clear-canonical").addEventListener("click", () => {
  if (!state.records.length) return;
  if (!window.confirm("Clear all canonical mappings from this browser?")) return;
  state.records = [];
  state.selectedId = null;
  state.inlineMappingKind = null;
  render();
  showToast("Canonical mappings cleared.");
});
document.querySelector("#load-sample-mappings").addEventListener("click", openSamplePicker);
document.querySelector("#close-samples").addEventListener("click", () => ui.sampleDialog.close());
ui.sampleDialog.addEventListener("click", (event) => {
  const model = event.target.closest("[data-sample-model]")?.dataset.sampleModel;
  if (model) loadSampleCanonical(model);
});
ui.detail.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "add-inbound-mapping" || action === "add-outbound-mapping") {
    ensureDefaultCanonical();
    state.inlineMappingKind = action.startsWith("add-inbound") ? "inbound" : "outbound";
    render();
    document.querySelector("#inline-mapping-system")?.focus();
  }
  if (action === "cancel-mapping") {
    state.inlineMappingKind = null;
    render();
  }
  const mappingDirection = button.dataset.removeMapping;
  if (mappingDirection) {
    const record = state.records.find((item) => item.id === state.selectedId);
    const mappingId = button.dataset.mappingId;
    record[`${mappingDirection}Mappings`] = record[`${mappingDirection}Mappings`].filter((mapping) => mapping.id !== mappingId);
    render();
  }
});
ui.detail.addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.target.matches("[data-mapping-form]")) saveInlineMapping(event.target.dataset.mappingForm);
});
document.querySelector("#import-canonical").addEventListener("click", () => ui.file.click());
ui.file.addEventListener("change", async () => {
  const [file] = ui.file.files;
  if (!file) return;
  try {
    const imported = normalizeRecord(JSON.parse(await file.text()));
    if (!imported) throw new Error("The file does not contain valid canonical mappings.");
    const record = imported;
    if (state.records.some((item) => item.id === record.id)) record.id = `${record.id}-${Date.now().toString(36)}`;
    state.records = groupRecords([...state.records, record]);
    state.selectedId = state.records.find((item) => item.model.toLocaleLowerCase() === record.model.toLocaleLowerCase())?.id || record.id;
    render();
    showToast("Canonical mappings imported.");
  } catch (error) {
    showToast(error instanceof SyntaxError ? "Could not read the JSON file." : error.message || "Could not import these mappings.");
  } finally {
    ui.file.value = "";
  }
});
document.querySelector("#export-canonical").addEventListener("click", openCanonicalExport);
document.querySelector("#close-canonical-export").addEventListener("click", () => ui.exportDialog.close());
document.querySelector("#cancel-canonical-export").addEventListener("click", () => ui.exportDialog.close());
document.querySelector("#download-canonical-export").addEventListener("click", downloadCanonicalExport);

window.addEventListener("resize", () => window.requestAnimationFrame(drawCanonicalFlow));

if (!state.records.some((record) => record.id === state.selectedId)) state.selectedId = state.records[0]?.id || null;
render();