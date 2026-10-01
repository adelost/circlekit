// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM test/wire-acme.ts
// Declaration SHA-256: fixture
package dev.acme.wire

import org.json.JSONArray
import org.json.JSONObject

/** A finite wire value: the declared string it is written as. */
interface GeneratedAcmeWireValue {
    val wire: String
}

/** One declared kind of wire value read from what org.json parsed; a refusal names the contract and the field. */
class GeneratedAcmeWireKind<T : Any>(private val problem: String, private val convert: (Any, String, String) -> T?) {
    fun read(value: Any, contract: String, path: String): T =
        convert(value, contract, path) ?: throw IllegalArgumentException("contract '$contract' field '$path' must $problem")
}

/** The kinds a wire contract declares. An integer is whole and within the range JavaScript reads exactly. */
object GeneratedAcmeWire {
    const val MAX_SAFE_INTEGER = 9_007_199_254_740_991L

    val string = GeneratedAcmeWireKind("be string") { value, _, _ -> value as? String }
    val boolean = GeneratedAcmeWireKind("be boolean") { value, _, _ -> value as? Boolean }
    val number = GeneratedAcmeWireKind("be number") { value, _, _ -> (value as? Number)?.toDouble()?.takeIf { it.isFinite() } }
    val integer = GeneratedAcmeWireKind("be integer") { value, _, _ -> whole(value)?.takeIf { it in -MAX_SAFE_INTEGER..MAX_SAFE_INTEGER } }

    fun <E : GeneratedAcmeWireValue> finite(id: String, entries: List<E>) =
        GeneratedAcmeWireKind("belong to finite '$id'") { value, _, _ -> entries.firstOrNull { it.wire == value } }

    fun <T : Any> record(id: String, parse: (JSONObject) -> T) =
        GeneratedAcmeWireKind("be a '$id' record") { value, _, _ -> (value as? JSONObject)?.let(parse) }

    fun <T : Any> list(element: GeneratedAcmeWireKind<T>) = GeneratedAcmeWireKind("be a list") { value, contract, path ->
        (value as? JSONArray)?.let { array -> List(array.length()) { index -> element.read(array.get(index), contract, "$path[$index]") } }
    }

    fun <T : Any> set(element: GeneratedAcmeWireKind<T>) = GeneratedAcmeWireKind<Set<T>>("be a list") { value, contract, path ->
        (value as? JSONArray)?.let { array ->
            val members = LinkedHashSet<T>()
            for (index in 0 until array.length()) {
                val member = element.read(array.get(index), contract, "$path[$index]")
                require(members.add(member)) { "contract '$contract' field '$path' repeats ${quoted(member)}" }
            }
            members
        }
    }

    private fun whole(value: Any): Long? = when (value) {
        is Int -> value.toLong()
        is Long -> value
        is Number -> value.toDouble().takeIf { it.isFinite() && it == Math.rint(it) }?.toLong()
        else -> null
    }

    private fun quoted(value: Any): String = when (value) {
        is GeneratedAcmeWireValue -> "'${value.wire}'"
        is String -> "'$value'"
        else -> value.toString()
    }
}

/** Reads one wire contract's keys: missing and null are refused unless the field says otherwise. */
class GeneratedAcmeWireReader(private val json: JSONObject, private val contract: String, fields: Set<String>, ignoreUnknown: Boolean) {
    init {
        if (!ignoreUnknown) for (key in json.keys()) require(key in fields) { "contract '$contract' has undeclared field '$key'" }
    }

    fun <T : Any> required(name: String, kind: GeneratedAcmeWireKind<T>): T {
        require(json.has(name)) { "contract '$contract' is missing field '$name'" }
        return kind.read(json.get(name), contract, name)
    }

    /** A key that must be present; its value may be null. */
    fun <T : Any> nullable(name: String, kind: GeneratedAcmeWireKind<T>): T? {
        require(json.has(name)) { "contract '$contract' is missing field '$name'" }
        val value = json.get(name)
        return if (value == JSONObject.NULL) null else kind.read(value, contract, name)
    }

    /** A key that may be absent, read as null; when present it is not null. */
    fun <T : Any> optional(name: String, kind: GeneratedAcmeWireKind<T>): T? =
        if (json.has(name)) kind.read(json.get(name), contract, name) else null
}

/** Finite `shop.size`, as written on the wire. */
enum class GeneratedAcmeShopSize(override val wire: String) : GeneratedAcmeWireValue {
    S("S"),
    M("M"),
    L("L"),
}

/** Finite `shop.topping`, as written on the wire. */
enum class GeneratedAcmeShopTopping(override val wire: String) : GeneratedAcmeWireValue {
    CHEESE("cheese"),
    BASIL("basil"),
    OLIVE_BLACK("olive:black"),
}

/** Wire contract `shop.order`; an unknown key is refused. */
data class GeneratedAcmeShopOrder(
    val size: GeneratedAcmeShopSize,
    val toppings: Set<GeneratedAcmeShopTopping>,
    val notes: List<String>? = null,
    val deliverTo: GeneratedAcmeShopAddress,
    val tipPercent: Double?,
    val sequence: Long,
    val express: Boolean,
    val coupon: String? = null,
) {
    init {
        require(tipPercent == null || tipPercent >= 0.0 && tipPercent <= 100.0) { "contract 'shop.order' field 'tipPercent'=${tipPercent} violates 0..100" }
        require(sequence >= 0L) { "contract 'shop.order' field 'sequence'=${sequence} violates 0..∞" }
    }

    fun toJson(): JSONObject {
        val json = JSONObject()
        json.put("size", size.wire)
        json.put("toppings", JSONArray(toppings.map { it.wire }))
        if (notes != null) json.put("notes", JSONArray(notes))
        json.put("deliverTo", deliverTo.toJson())
        json.put("tipPercent", tipPercent ?: JSONObject.NULL)
        json.put("sequence", sequence)
        json.put("express", express)
        if (coupon != null) json.put("coupon", coupon)
        return json
    }

    companion object {
        const val CONTRACT = "shop.order"
        private val FIELDS = setOf("size", "toppings", "notes", "deliverTo", "tipPercent", "sequence", "express", "coupon")

        fun parse(json: JSONObject): GeneratedAcmeShopOrder {
            val read = GeneratedAcmeWireReader(json, CONTRACT, FIELDS, ignoreUnknown = false)
            return GeneratedAcmeShopOrder(
                size = read.required("size", GeneratedAcmeWire.finite("shop.size", GeneratedAcmeShopSize.entries)),
                toppings = read.required("toppings", GeneratedAcmeWire.set(GeneratedAcmeWire.finite("shop.topping", GeneratedAcmeShopTopping.entries))),
                notes = read.optional("notes", GeneratedAcmeWire.list(GeneratedAcmeWire.string)),
                deliverTo = read.required("deliverTo", GeneratedAcmeWire.record("shop.address") { GeneratedAcmeShopAddress.parse(it) }),
                tipPercent = read.nullable("tipPercent", GeneratedAcmeWire.number),
                sequence = read.required("sequence", GeneratedAcmeWire.integer),
                express = read.required("express", GeneratedAcmeWire.boolean),
                coupon = read.optional("coupon", GeneratedAcmeWire.string),
            )
        }
    }
}

/** Wire contract `shop.address`; an unknown key is refused. */
data class GeneratedAcmeShopAddress(
    val street: String,
    val floor: Long?,
) {
    init {
        require(floor == null || floor >= 0L && floor <= 200L) { "contract 'shop.address' field 'floor'=${floor} violates 0..200" }
    }

    fun toJson(): JSONObject {
        val json = JSONObject()
        json.put("street", street)
        json.put("floor", floor ?: JSONObject.NULL)
        return json
    }

    companion object {
        const val CONTRACT = "shop.address"
        private val FIELDS = setOf("street", "floor")

        fun parse(json: JSONObject): GeneratedAcmeShopAddress {
            val read = GeneratedAcmeWireReader(json, CONTRACT, FIELDS, ignoreUnknown = false)
            return GeneratedAcmeShopAddress(
                street = read.required("street", GeneratedAcmeWire.string),
                floor = read.nullable("floor", GeneratedAcmeWire.integer),
            )
        }
    }
}

/** Wire contract `shop.receipt`; an unknown key is ignored. */
data class GeneratedAcmeShopReceipt(
    val schemaVersion: Long,
    val orderId: String,
    val lines: List<GeneratedAcmeShopReceiptLine>,
    val totalCents: Long,
    val paidCents: Long,
    val deliverTo: GeneratedAcmeShopAddress?,
    val size: GeneratedAcmeShopSize,
) {
    init {
        require(schemaVersion >= 1L && schemaVersion <= 1L) { "contract 'shop.receipt' field 'schemaVersion'=${schemaVersion} violates 1..1" }
        require(totalCents >= 0L) { "contract 'shop.receipt' field 'totalCents'=${totalCents} violates 0..∞" }
        require(paidCents >= totalCents) { "contract 'shop.receipt' field 'paidCents'=${paidCents} must be >= 'totalCents'=${totalCents}" }
    }

    fun toJson(): JSONObject {
        val json = JSONObject()
        json.put("schemaVersion", schemaVersion)
        json.put("orderId", orderId)
        json.put("lines", JSONArray(lines.map { it.toJson() }))
        json.put("totalCents", totalCents)
        json.put("paidCents", paidCents)
        json.put("deliverTo", deliverTo?.toJson() ?: JSONObject.NULL)
        json.put("size", size.wire)
        return json
    }

    companion object {
        const val CONTRACT = "shop.receipt"
        private val FIELDS = setOf("schemaVersion", "orderId", "lines", "totalCents", "paidCents", "deliverTo", "size")

        fun parse(json: JSONObject): GeneratedAcmeShopReceipt {
            val read = GeneratedAcmeWireReader(json, CONTRACT, FIELDS, ignoreUnknown = true)
            return GeneratedAcmeShopReceipt(
                schemaVersion = read.required("schemaVersion", GeneratedAcmeWire.integer),
                orderId = read.required("orderId", GeneratedAcmeWire.string),
                lines = read.required("lines", GeneratedAcmeWire.list(GeneratedAcmeWire.record("shop.receipt-line") { GeneratedAcmeShopReceiptLine.parse(it) })),
                totalCents = read.required("totalCents", GeneratedAcmeWire.integer),
                paidCents = read.required("paidCents", GeneratedAcmeWire.integer),
                deliverTo = read.nullable("deliverTo", GeneratedAcmeWire.record("shop.address") { GeneratedAcmeShopAddress.parse(it) }),
                size = read.required("size", GeneratedAcmeWire.finite("shop.size", GeneratedAcmeShopSize.entries)),
            )
        }
    }
}

/** Wire contract `shop.receipt-line`; an unknown key is ignored. */
data class GeneratedAcmeShopReceiptLine(
    val name: String,
    val cents: Long,
) {
    init {
        require(cents >= 0L) { "contract 'shop.receipt-line' field 'cents'=${cents} violates 0..∞" }
    }

    fun toJson(): JSONObject {
        val json = JSONObject()
        json.put("name", name)
        json.put("cents", cents)
        return json
    }

    companion object {
        const val CONTRACT = "shop.receipt-line"
        private val FIELDS = setOf("name", "cents")

        fun parse(json: JSONObject): GeneratedAcmeShopReceiptLine {
            val read = GeneratedAcmeWireReader(json, CONTRACT, FIELDS, ignoreUnknown = true)
            return GeneratedAcmeShopReceiptLine(
                name = read.required("name", GeneratedAcmeWire.string),
                cents = read.required("cents", GeneratedAcmeWire.integer),
            )
        }
    }
}
