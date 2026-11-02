# MM Canonical

MM Canonical is a Canonical Data Model builder tool for defining canonical mapping around a shared model.

## Workflow

1. Create or select a canonical model.
2. Add inbound source-to-canonical mappings and outbound canonical-to-target mappings independently.
3. Open each mapping in mapper-ui to define its field-level transformation. Each edge has its own saved mapper workspace.
4. The visualization shows only defined mapping edges through the canonical model; it does not create source-to-target use cases.
5. Choose one of the Taxable, Shipable, or Payble examples from the sample button, or import/export canonical mappings as JSON.

Previously saved route-level records are grouped by canonical model. Legacy `sources`/`targets` arrays and singular `source`/`target` properties migrate to inbound/outbound mapping definitions. Old source-target combinations are ignored because each source and target mapping is reusable independently.

## Code structure

- `index.js` owns record normalization, grouping rules, and application orchestration.
- `state.js` owns initial state, sample fixtures, state transitions, and browser persistence.
- `ui.js` owns DOM rendering, event interpretation, dialogs, file reads, downloads, focus, toasts, and flow layout measurements.

The UI passes plain values to the controller, including file text and filename. The controller coordinates domain decisions with the store and asks the view to render or show feedback.