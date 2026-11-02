export function createCanonicalView(handlers) {
  const elements = {
    detail: document.querySelector("#detail-pane"),
    file: document.querySelector("#canonical-file"),
    detailTemplate: document.querySelector("#canonical-detail-template"),
    mappingGroupTemplate: document.querySelector("#canonical-mapping-group-template"),
    mappingRowTemplate: document.querySelector("#canonical-mapping-row-template"),
    mappingFormTemplate: document.querySelector("#canonical-mapping-form-template"),
    flowTemplate: document.querySelector("#canonical-flow-template"),
    flowNodeTemplate: document.querySelector("#canonical-flow-node-template"),
    sampleDialog: document.querySelector("#sample-dialog"),
    exportDialog: document.querySelector("#canonical-export-dialog"),
    clearDialog: document.querySelector("#clear-dialog"),
    exportPreview: document.querySelector("#canonical-export-preview"),
    toast: document.querySelector("#toast"),
    exportButton: document.querySelector("#export-canonical"),
    clearButton: document.querySelector("#clear-canonical")
  };
  let toastTimer = 0;
  let exportContent = "";
  let exportFilename = "canonical.json";

  function showToast(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.remove("d-none");
    toastTimer = window.setTimeout(() => elements.toast.classList.add("d-none"), 2400);
  }

  function renderAll(state) {
    renderDetail(state);
    elements.exportButton.disabled = !state.records.some((record) => record.id === state.selectedId);
    elements.clearButton.disabled = !state.records.length;
  }

  function renderDetail(state) {
    const record = state.records.find((item) => item.id === state.selectedId);
    const displayRecord = record || { model: "Canonical", inboundMappings: [], outboundMappings: [] };
    const detail = elements.detailTemplate.content.firstElementChild.cloneNode(true);
    const heading = detail.querySelector("[data-detail-heading]");
    heading.classList.toggle("d-none", !record);
    if (record) {
      heading.querySelector("[data-record-category]").textContent = record.category;
      heading.querySelector("[data-record-model]").textContent = record.model;
    }
    const groups = detail.querySelector("[data-mapping-groups]");
    groups.append(renderMappingGroup(displayRecord, "inbound", state), renderMappingGroup(displayRecord, "outbound", state));
    detail.querySelector("[data-flow-slot]").append(renderCanonicalFlow(record));
    elements.detail.replaceChildren(detail);
    drawCanonicalFlow(state);
  }

  function renderCanonicalFlow(record) {
    const inboundMappings = record?.inboundMappings || [];
    const outboundMappings = record?.outboundMappings || [];
    const flow = elements.flowTemplate.content.firstElementChild.cloneNode(true);
    flow.querySelector("[data-flow-model]").textContent = record?.model || "Canonical";
    renderFlowNodes(flow.querySelector("[data-flow-inbound-list]"), inboundMappings, "inbound");
    renderFlowNodes(flow.querySelector("[data-flow-outbound-list]"), outboundMappings, "outbound");
    return flow;
  }

  function renderFlowNodes(container, mappings, direction) {
    if (mappings.length) {
      for (const mapping of mappings) {
        const node = elements.flowNodeTemplate.content.firstElementChild.cloneNode(true);
        node.textContent = mapping.system;
        node.dataset[`flow${direction === "inbound" ? "Inbound" : "Outbound"}`] = mapping.id;
        container.append(node);
      }
      return;
    }
    const placeholder = elements.flowNodeTemplate.content.firstElementChild.cloneNode(true);
    placeholder.classList.remove("bg-white");
    placeholder.classList.add("bg-body-tertiary", "text-body-secondary");
    placeholder.textContent = direction === "inbound" ? "Source" : "Target";
    container.append(placeholder);
  }

  function drawCanonicalFlow(state) {
    const flow = elements.detail.querySelector(".canonical-visualization");
    if (!flow) return;
    const record = state.records.find((item) => item.id === state.selectedId);
    const svg = flow.querySelector(".flow-connectors");
    flow.style.minHeight = "";
    const sides = [...flow.querySelectorAll(".canonical-flow-side")];
    const stackHeight = Math.max(...sides.map((side) => side.querySelector(".canonical-flow-nodes").getBoundingClientRect().height));
    const headerHeight = Math.max(...sides.map((side) => side.querySelector("span").getBoundingClientRect().height));
    const stackGap = Math.max(...sides.map((side) => parseFloat(getComputedStyle(side.querySelector(".canonical-flow-nodes")).rowGap) || 0));
    const flowStyle = getComputedStyle(flow);
    const verticalChrome = parseFloat(flowStyle.paddingTop) + parseFloat(flowStyle.paddingBottom)
      + parseFloat(flowStyle.borderTopWidth) + parseFloat(flowStyle.borderBottomWidth);
    const minimumHeight = parseFloat(flowStyle.minHeight) || 0;
    flow.style.minHeight = `${Math.max(minimumHeight, stackHeight + 2 * (headerHeight + stackGap) + verticalChrome)}px`;
    const bounds = flow.getBoundingClientRect();
    for (const connector of svg.querySelectorAll("[data-flow-connector]")) connector.remove();
    svg.setAttribute("viewBox", `0 0 ${bounds.width} ${bounds.height}`);
    svg.setAttribute("width", bounds.width);
    svg.setAttribute("height", bounds.height);
    if (!record || (!record.inboundMappings.length && !record.outboundMappings.length) || !bounds.width || !bounds.height) return;

    const center = (element, side) => {
      const rect = element.getBoundingClientRect();
      return {
        x: (side === "right" ? rect.right : rect.left) - bounds.left,
        y: rect.top + rect.height / 2 - bounds.top
      };
    };
    const canonical = flow.querySelector(".flow-canonical");
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
      inbound.setAttribute("fill", "none");
      inbound.setAttribute("stroke", "#91aa98");
      inbound.setAttribute("stroke-width", "1.5");
      inbound.setAttribute("opacity", "0.8");
      inbound.setAttribute("marker-end", "url(#flow-arrowhead)");
      inbound.dataset.flowConnector = "true";
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
      outbound.setAttribute("fill", "none");
      outbound.setAttribute("stroke", "#91aa98");
      outbound.setAttribute("stroke-width", "1.5");
      outbound.setAttribute("opacity", "0.8");
      outbound.setAttribute("marker-end", "url(#flow-arrowhead)");
      outbound.dataset.flowConnector = "true";
      svg.append(outbound);
    }
  }

  function renderMappingGroup(record, direction, state) {
    const inbound = direction === "inbound";
    const mappings = record[`${direction}Mappings`];
    const title = inbound ? "Inbound mappings" : "Outbound mappings";
    const kind = inbound ? "source" : "target";
    const group = elements.mappingGroupTemplate.content.firstElementChild.cloneNode(true);
    group.setAttribute("aria-label", title);
    group.querySelector("[data-mapping-direction-label]").textContent = inbound ? "SOURCE → CANONICAL" : "CANONICAL → TARGET";
    group.querySelector("[data-mapping-title]").textContent = title;
    group.querySelector("[data-mapping-count]").textContent = String(mappings.length);
    const addButton = group.querySelector('[data-action^="add-"]');
    addButton.dataset.action = `add-${direction}-mapping`;
    addButton.setAttribute("aria-label", `Add ${kind} mapping`);
    addButton.title = `Add ${kind} mapping`;
    const rows = group.querySelector("[data-mapping-rows]");
    for (const mapping of mappings) rows.append(renderMappingRow(record, mapping, direction));
    if (state.inlineMappingKind === direction) {
      const form = elements.mappingFormTemplate.content.firstElementChild.cloneNode(true);
      form.dataset.mappingForm = direction;
      const input = form.querySelector("[data-inline-mapping-system]");
      input.setAttribute("aria-label", `${inbound ? "Source" : "Target"} system`);
      input.placeholder = `${inbound ? "Source" : "Target"} system`;
      group.querySelector("[data-inline-form-slot]").append(form);
    }
    return group;
  }

  function renderMappingRow(record, mapping, direction) {
    const row = elements.mappingRowTemplate.content.firstElementChild.cloneNode(true);
    row.querySelector("[data-mapping-system]").textContent = mapping.system;
    row.querySelector("[data-mapping-open]").href = getMapperUrl(record, mapping, direction);
    const removeButton = row.querySelector("[data-remove-mapping]");
    removeButton.dataset.removeMapping = direction;
    removeButton.dataset.mappingId = mapping.id;
    removeButton.setAttribute("aria-label", `Remove ${mapping.system} mapping`);
    return row;
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

  function openExportPreview(data) {
    exportContent = data.content;
    exportFilename = data.filename;
    elements.exportPreview.value = exportContent;
    elements.exportDialog.showModal();
  }

  function downloadExport() {
    const blob = new Blob([exportContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exportFilename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    elements.exportDialog.close();
    showToast("Canonical mappings exported.");
  }

  for (const dialog of document.querySelectorAll("dialog")) {
    dialog.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      dialog.close();
    });
  }

  document.querySelector("#clear-canonical").addEventListener("click", () => elements.clearDialog.showModal());
  document.querySelector("#cancel-clear").addEventListener("click", () => elements.clearDialog.close());
  document.querySelector("#confirm-clear").addEventListener("click", handlers.onClear);
  document.querySelector("#load-sample-mappings").addEventListener("click", () => elements.sampleDialog.showModal());
  document.querySelector("#close-samples").addEventListener("click", () => elements.sampleDialog.close());
  elements.sampleDialog.addEventListener("click", (event) => {
    const model = event.target.closest("[data-sample-model]")?.dataset.sampleModel;
    if (model) handlers.onLoadSample(model);
  });
  elements.detail.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "add-inbound-mapping" || action === "add-outbound-mapping") {
      handlers.onBeginMapping(action.startsWith("add-inbound") ? "inbound" : "outbound");
    }
    if (action === "cancel-mapping") handlers.onCancelMapping();
    if (button.dataset.removeMapping) {
      handlers.onRemoveMapping({ direction: button.dataset.removeMapping, mappingId: button.dataset.mappingId });
    }
  });
  elements.detail.addEventListener("submit", (event) => {
    if (!event.target.matches("[data-mapping-form]")) return;
    event.preventDefault();
    const input = event.target.querySelector("[data-inline-mapping-system]");
    handlers.onSaveMapping({ direction: event.target.dataset.mappingForm, name: input.value });
  });
  document.querySelector("#import-canonical").addEventListener("click", () => elements.file.click());
  elements.file.addEventListener("change", async () => {
    const [file] = elements.file.files;
    if (!file) return;
    try {
      handlers.onImportFile({ text: await file.text(), filename: file.name });
    } catch (error) {
      showToast("Could not read the JSON file.");
    } finally {
      elements.file.value = "";
    }
  });
  document.querySelector("#export-canonical").addEventListener("click", () => {
    const data = handlers.onExportRequested();
    if (data) openExportPreview(data);
  });
  document.querySelector("#close-canonical-export").addEventListener("click", () => elements.exportDialog.close());
  document.querySelector("#cancel-canonical-export").addEventListener("click", () => elements.exportDialog.close());
  document.querySelector("#download-canonical-export").addEventListener("click", downloadExport);
  window.addEventListener("resize", () => window.requestAnimationFrame(() => drawCanonicalFlow(handlers.getState())));

  return {
    renderAll,
    showToast,
    openExportPreview,
    closeSampleDialog: () => elements.sampleDialog.close(),
    closeClearDialog: () => elements.clearDialog.close(),
    focusInlineMapping: () => elements.detail.querySelector("[data-inline-mapping-system]")?.focus()
  };
}