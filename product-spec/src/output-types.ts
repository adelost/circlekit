import type { ProductIr } from './product-model.js';

export interface OutputArtifact {
  readonly id:string;
  readonly path:string;
  readonly mediaType:string;
  readonly content:string;
}

export interface ProductEmitterPlugin {
  readonly id:string;
  emit(product:ProductIr):readonly OutputArtifact[];
}

export interface OutputManifest {
  readonly productId:string;
  readonly managedRoots:readonly string[];
  readonly artifacts:readonly OutputArtifact[];
}
