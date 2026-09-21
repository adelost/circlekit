// The adapter packages existing compiled data. It is not another compiler or runtime.
export { createInspectionBundle, validateInspectionBundle, compatibilityReport } from './lib/inspection.mjs';
export { prepareInspection, writeInspectionBundle } from './lib/exporter.mjs';
export { entityKey } from './lib/architecture.mjs';
export { createTraceRecorder } from './lib/trace.mjs';
