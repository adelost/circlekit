import {storeCatalog,type StoreServiceSpec} from '@v1d/product-spec';
import type {SourcedKotlinEmissionOptions} from './emission-options.js';
import {kotlinEnumToken,kotlinStringLiteral} from './kotlin-syntax.js';

/** A typed Android policy projection. The actual bytes and atomic commit stay with one native owner. */
export function emitStoreServicesKotlin(stores:readonly StoreServiceSpec[],options:SourcedKotlinEmissionOptions):string {
  const catalog=storeCatalog(stores);
  const generated=`Generated${options.symbolPrefix}`;
  const refs=catalog.map(store=>kotlinEnumToken(store.id));
  if(new Set(refs).size!==refs.length)throw new Error('store ids collide as Kotlin enum tokens');
  const rows=catalog.map((store,index)=>{
    const effects=`setOf(${store.effectIds.map(kotlinStringLiteral).join(', ')})`;
    return `        ${generated}StoreRef.${refs[index]} to ${generated}StorePolicy(`+
      `${kotlinStringLiteral(store.id)}, ${generated}StoreBackend.${kotlinEnumToken(store.backend)}, `+
      `${kotlinStringLiteral(store.codec.id)}, ${store.codec.version}, ${kotlinStringLiteral(store.identity)}, `+
      `${generated}StoreDurability.${kotlinEnumToken(store.durability)}, `+
      `${generated}StoreFailure.${kotlinEnumToken(store.failure)}, `+
      `${generated}StoreMigration.${kotlinEnumToken(store.migration)}, ${effects}),`;
  }).join('\n');
  return `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ${options.sourceFile}
// Generator SHA-256: ${options.sourceSha}
package ${options.packageName}

enum class ${generated}StoreRef { ${refs.join(', ')} }
enum class ${generated}StoreBackend { FILE, PREFERENCES }
enum class ${generated}StoreDurability { FSYNC_ATOMIC_REPLACE, COMMIT }
enum class ${generated}StoreFailure { REJECT, BEST_EFFORT }
enum class ${generated}StoreMigration { VERSIONED, NONE }

data class ${generated}StorePolicy(
    val id: String,
    val backend: ${generated}StoreBackend,
    val codecId: String,
    val codecVersion: Int,
    val identity: String,
    val durability: ${generated}StoreDurability,
    val failure: ${generated}StoreFailure,
    val migration: ${generated}StoreMigration,
    val effectIds: Set<String>,
)

object ${generated}Stores {
    val policies: Map<${generated}StoreRef, ${generated}StorePolicy> = mapOf(
${rows}
    )
    fun policy(ref: ${generated}StoreRef): ${generated}StorePolicy = policies.getValue(ref)
}
`;
}
