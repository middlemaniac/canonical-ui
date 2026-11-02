import { createCanonicalStore } from "./state.js";
import { createCanonicalView } from "./ui.js";

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

const store = createCanonicalStore({ normalizeRecord, groupRecords });
const state = store.state;
const view = createCanonicalView({
  getState: () => state,
  onClear: () => {
    store.clear();
    view.closeClearDialog();
    refresh();
    view.showToast("Canonical mappings cleared.");
  },
  onLoadSample: (model) => {
    if (!store.loadSample(model)) return;
    view.closeSampleDialog();
    refresh();
    view.showToast(`${model} mappings loaded.`);
  },
  onBeginMapping: (direction) => {
    store.ensureDefaultCanonical();
    store.setInlineMappingKind(direction);
    refresh();
    view.focusInlineMapping();
  },
  onCancelMapping: () => {
    store.setInlineMappingKind(null);
    refresh();
  },
  onRemoveMapping: ({ direction, mappingId }) => {
    const record = state.records.find((item) => item.id === state.selectedId);
    if (!record) return;
    store.removeMapping(record, direction, mappingId);
    refresh();
  },
  onSaveMapping: ({ direction, name: rawName }) => {
    const name = rawName.trim();
    if (!name) return;
    const record = store.ensureDefaultCanonical();
    const mappings = record[`${direction}Mappings`];
    if (mappings.some((mapping) => mapping.system.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      view.showToast(`${name} mapping already exists.`);
      return;
    }
    store.addMapping(record, direction, { id: `${direction}-${Date.now().toString(36)}`, system: name });
    refresh();
  },
  onImportFile: ({ text, filename }) => {
    try {
      const record = normalizeRecord(JSON.parse(text));
      if (!record) throw new Error("The file does not contain valid canonical mappings.");
      if (state.records.some((item) => item.id === record.id)) record.id = `${record.id}-${Date.now().toString(36)}`;
      store.importRecord(record);
      refresh();
      view.showToast("Canonical mappings imported.");
    } catch (error) {
      view.showToast(error instanceof SyntaxError ? "Could not read the JSON file." : error.message || "Could not import these mappings.");
    }
  },
  onExportRequested: () => {
    const record = state.records.find((item) => item.id === state.selectedId);
    if (!record) return null;
    return { filename: `${record.id}.json`, content: `${JSON.stringify(record, null, 2)}\n` };
  }
});

function refresh() {
  view.renderAll(state);
  const warning = store.persist();
  if (warning) view.showToast(warning);
}

if (!state.records.some((record) => record.id === state.selectedId)) store.select(state.records[0]?.id || null);
refresh();