const storageKey = "middlemaniac.canonical-registry.v1";
const selectedStorageKey = `${storageKey}.selected`;

const samples = [
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

export function createCanonicalStore({ normalizeRecord, groupRecords }) {
  let records = [];
  let selectedId = null;
  let restoreWarning = null;
  let preserveSavedData = false;

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (Array.isArray(saved)) {
      const normalized = saved.map(normalizeRecord);
      if (normalized.some((record) => !record)) {
        restoreWarning = "Some saved canonical mappings could not be restored; original saved data was preserved.";
      }
      records = groupRecords(normalized.filter(Boolean));
    } else if (saved !== null) {
      restoreWarning = "Saved canonical mappings have an unsupported format; original saved data was preserved.";
    }
  } catch (error) {
    console.warn("Could not restore the integration registry.", error);
    restoreWarning = "Saved canonical mappings could not be restored; original saved data was preserved.";
  }
  preserveSavedData = Boolean(restoreWarning);

  try {
    selectedId = localStorage.getItem(selectedStorageKey);
  } catch (error) {
    console.warn("Could not restore the selected canonical model.", error);
  }

  const state = { records, selectedId, inlineMappingKind: null };

  function persist() {
    if (preserveSavedData) {
      preserveSavedData = false;
      return restoreWarning;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(state.records));
      if (state.selectedId) localStorage.setItem(selectedStorageKey, state.selectedId);
      else localStorage.removeItem(selectedStorageKey);
      return null;
    } catch (error) {
      console.warn("Could not save changes in this browser.", error);
      return "Could not save changes in this browser.";
    }
  }

  function setInlineMappingKind(direction) {
    state.inlineMappingKind = direction;
  }

  function select(id) {
    state.selectedId = id;
  }

  function ensureDefaultCanonical() {
    let record = state.records.find((item) => item.id === state.selectedId);
    if (record) return record;
    record = {
      id: "canonical",
      name: "Canonical",
      model: "Canonical",
      category: "Canonical",
      status: "Draft",
      inboundMappings: [],
      outboundMappings: [],
      owner: "Unassigned",
      updatedAt: new Date().toISOString().slice(0, 10)
    };
    state.records.unshift(record);
    state.selectedId = record.id;
    return record;
  }

  function loadSample(model) {
    const sourceSample = samples.find((record) => record.model === model);
    if (!sourceSample) return false;
    const sample = {
      ...sourceSample,
      inboundMappings: sourceSample.inboundMappings.map((mapping) => ({ ...mapping })),
      outboundMappings: sourceSample.outboundMappings.map((mapping) => ({ ...mapping }))
    };
    const existingIndex = state.records.findIndex((record) => record.model.toLocaleLowerCase() === model.toLocaleLowerCase());
    if (existingIndex < 0) state.records.unshift(sample);
    else state.records[existingIndex] = groupRecords([state.records[existingIndex], sample])[0];
    state.selectedId = existingIndex < 0 ? sample.id : state.records[existingIndex].id;
    state.inlineMappingKind = null;
    return true;
  }

  function clear() {
    state.records = [];
    state.selectedId = null;
    state.inlineMappingKind = null;
  }

  function addMapping(record, direction, mapping) {
    record[`${direction}Mappings`].push(mapping);
    state.inlineMappingKind = null;
  }

  function removeMapping(record, direction, mappingId) {
    const property = `${direction}Mappings`;
    record[property] = record[property].filter((mapping) => mapping.id !== mappingId);
  }

  function importRecord(record) {
    state.records = groupRecords([...state.records, record]);
    state.selectedId = state.records.find((item) => item.model.toLocaleLowerCase() === record.model.toLocaleLowerCase())?.id || record.id;
  }

  return { state, persist, setInlineMappingKind, select, ensureDefaultCanonical, loadSample, clear, addMapping, removeMapping, importRecord };
}