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

/** A wire payload that breaks its contract: `contractId` is the contract that was read, `field` the dotted path from its root. */
class GeneratedAcmeWireException(val contractId: String, val field: String, message: String) : IllegalArgumentException(message)

/** Where a record sits in a read: the contract the read started from and the dotted path to the record. */
class GeneratedAcmeWirePlace(val root: String, val path: String) {
    fun below(name: String) = if (path.isEmpty()) name else "$path.$name"
}

/** One value being read: its root and path for the exception, its own contract and name for the message. */
class GeneratedAcmeWireField(val root: String, val path: String, val contract: String, val name: String) {
    fun refuse(problem: String): Nothing = throw GeneratedAcmeWireException(root, path, "contract '$contract' field '$name'$problem")
    fun element(index: Int) = GeneratedAcmeWireField(root, "$path[$index]", contract, "$name[$index]")
}

/** One declared kind of wire value, read from what org.json parsed. */
class GeneratedAcmeWireKind<T : Any>(private val problem: String, private val convert: (Any, GeneratedAcmeWireField) -> T?) {
    fun read(value: Any, field: GeneratedAcmeWireField): T = convert(value, field) ?: field.refuse(" must $problem")

    /** The same kind with a number's declared bounds, refused as soon as the value is read. */
    fun within(min: Double?, max: Double?, bounds: String) = GeneratedAcmeWireKind<T>(problem) { value, field ->
        convert(value, field)?.also {
            val number = (it as Number).toDouble()
            if (min != null && number < min || max != null && number > max) field.refuse("=${GeneratedAcmeWire.js(number)} violates $bounds")
        }
    }
}

/** The kinds a wire contract declares. An integer is whole and within the range JavaScript reads exactly. */
object GeneratedAcmeWire {
    const val MAX_SAFE_INTEGER = 9_007_199_254_740_991L

    val string = GeneratedAcmeWireKind("be string") { value, _ -> value as? String }
    val boolean = GeneratedAcmeWireKind("be boolean") { value, _ -> value as? Boolean }
    /** A finite double; -0.0 reads as 0.0, one value as in JavaScript, so a distinct list holds it once. */
    val number = GeneratedAcmeWireKind("be number") { value, _ -> (value as? Number)?.toDouble()?.takeIf { it.isFinite() }?.plus(0.0) }
    val integer = GeneratedAcmeWireKind("be integer") { value, _ -> whole(value)?.takeIf { it in -MAX_SAFE_INTEGER..MAX_SAFE_INTEGER } }

    fun <E : GeneratedAcmeWireValue> finite(id: String, entries: List<E>) =
        GeneratedAcmeWireKind("belong to finite '$id'") { value, _ -> entries.firstOrNull { it.wire == value } }

    fun <T : Any> record(id: String, parse: (JSONObject, GeneratedAcmeWirePlace) -> T) =
        GeneratedAcmeWireKind("be a '$id' record") { value, field -> (value as? JSONObject)?.let { parse(it, GeneratedAcmeWirePlace(field.root, field.path)) } }

    fun <T : Any> list(element: GeneratedAcmeWireKind<T>) = GeneratedAcmeWireKind("be a list") { value, field ->
        (value as? JSONArray)?.let { array -> List(array.length()) { index -> element.read(array.get(index), field.element(index)) } }
    }

    fun <T : Any> set(element: GeneratedAcmeWireKind<T>) = GeneratedAcmeWireKind<Set<T>>("be a list") { value, field ->
        (value as? JSONArray)?.let { array ->
            val members = LinkedHashSet<T>()
            for (index in 0 until array.length()) {
                val member = element.read(array.get(index), field.element(index))
                if (!members.add(member)) field.refuse(" repeats ${quoted(member)}")
            }
            members
        }
    }

    /** A number as JavaScript writes it in a message: a whole number has no ".0". */
    fun js(number: Double): String = if (number == Math.rint(number) && Math.abs(number) < 1e15) number.toLong().toString() else number.toString()

    private fun whole(value: Any): Long? = when (value) {
        is Int -> value.toLong()
        is Long -> value
        is Number -> value.toDouble().takeIf { it.isFinite() && it == Math.rint(it) }?.toLong()
        else -> null
    }

    private fun quoted(value: Any): String = when (value) {
        is GeneratedAcmeWireValue -> "'${value.wire}'"
        is String -> "'$value'"
        is Double -> js(value)
        else -> value.toString()
    }
}

/** Reads one wire record as readContractPayload does: an unknown key first, then each declared key in order. */
class GeneratedAcmeWireReader(
    private val json: JSONObject,
    private val contract: String,
    fields: Set<String>,
    ignoreUnknown: Boolean,
    private val place: GeneratedAcmeWirePlace,
) {
    init {
        if (!ignoreUnknown) for (key in json.keys()) if (key !in fields) refuse(key, "contract '$contract' has undeclared field '$key'")
    }

    private fun refuse(name: String, message: String): Nothing = throw GeneratedAcmeWireException(place.root, place.below(name), message)
    private fun field(name: String) = GeneratedAcmeWireField(place.root, place.below(name), contract, name)
    private fun present(name: String): Any = if (json.has(name)) json.get(name) else refuse(name, "contract '$contract' is missing field '$name'")

    fun <T : Any> required(name: String, kind: GeneratedAcmeWireKind<T>): T = kind.read(present(name), field(name))

    /** A key that must be present; its value may be null. */
    fun <T : Any> nullable(name: String, kind: GeneratedAcmeWireKind<T>): T? =
        present(name).let { value -> if (value == JSONObject.NULL) null else kind.read(value, field(name)) }

    /** A key that may be absent, read as null; when present it is not null. */
    fun <T : Any> optional(name: String, kind: GeneratedAcmeWireKind<T>): T? = if (json.has(name)) kind.read(json.get(name), field(name)) else null

    /** A sibling law, checked after every key is read. */
    fun atLeast(name: String, value: Number?, other: String, otherValue: Number?, unit: String) {
        if (value == null || otherValue == null || value.toDouble() >= otherValue.toDouble()) return
        field(name).refuse("=${GeneratedAcmeWire.js(value.toDouble())} must be >= '$other'=${GeneratedAcmeWire.js(otherValue.toDouble())}$unit")
    }
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
    val notes: List<String>?,
    val deliverTo: GeneratedAcmeShopAddress,
    val tipPercent: Double?,
    val sequence: Long,
    val express: Boolean,
    val coupon: String?,
) {
    fun toJson(): JSONObject {
        val json = JSONObject()
        json.put("size", this.size.wire)
        json.put("toppings", JSONArray(this.toppings.map { it.wire }))
        if (this.notes != null) json.put("notes", JSONArray(this.notes))
        json.put("deliverTo", this.deliverTo.toJson())
        json.put("tipPercent", this.tipPercent ?: JSONObject.NULL)
        json.put("sequence", this.sequence)
        json.put("express", this.express)
        if (this.coupon != null) json.put("coupon", this.coupon)
        return json
    }

    companion object {
        const val CONTRACT = "shop.order"
        private val FIELDS = setOf("size", "toppings", "notes", "deliverTo", "tipPercent", "sequence", "express", "coupon")

        fun parse(json: JSONObject): GeneratedAcmeShopOrder = parse(json, GeneratedAcmeWirePlace(CONTRACT, ""))

        internal fun parse(json: JSONObject, place: GeneratedAcmeWirePlace): GeneratedAcmeShopOrder {
            val read = GeneratedAcmeWireReader(json, CONTRACT, FIELDS, ignoreUnknown = false, place)
            return GeneratedAcmeShopOrder(
                size = read.required("size", GeneratedAcmeWire.finite("shop.size", GeneratedAcmeShopSize.entries)),
                toppings = read.required("toppings", GeneratedAcmeWire.set(GeneratedAcmeWire.finite("shop.topping", GeneratedAcmeShopTopping.entries))),
                notes = read.optional("notes", GeneratedAcmeWire.list(GeneratedAcmeWire.string)),
                deliverTo = read.required("deliverTo", GeneratedAcmeWire.record("shop.address") { record, at -> GeneratedAcmeShopAddress.parse(record, at) }),
                tipPercent = read.nullable("tipPercent", GeneratedAcmeWire.number.within(0.0, 100.0, "0..100")),
                sequence = read.required("sequence", GeneratedAcmeWire.integer.within(0.0, null, "0..∞")),
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
    fun toJson(): JSONObject {
        val json = JSONObject()
        json.put("street", this.street)
        json.put("floor", this.floor ?: JSONObject.NULL)
        return json
    }

    companion object {
        const val CONTRACT = "shop.address"
        private val FIELDS = setOf("street", "floor")

        fun parse(json: JSONObject): GeneratedAcmeShopAddress = parse(json, GeneratedAcmeWirePlace(CONTRACT, ""))

        internal fun parse(json: JSONObject, place: GeneratedAcmeWirePlace): GeneratedAcmeShopAddress {
            val read = GeneratedAcmeWireReader(json, CONTRACT, FIELDS, ignoreUnknown = false, place)
            return GeneratedAcmeShopAddress(
                street = read.required("street", GeneratedAcmeWire.string),
                floor = read.nullable("floor", GeneratedAcmeWire.integer.within(0.0, 200.0, "0..200")),
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
    fun toJson(): JSONObject {
        val json = JSONObject()
        json.put("schemaVersion", this.schemaVersion)
        json.put("orderId", this.orderId)
        json.put("lines", JSONArray(this.lines.map { it.toJson() }))
        json.put("totalCents", this.totalCents)
        json.put("paidCents", this.paidCents)
        json.put("deliverTo", this.deliverTo?.toJson() ?: JSONObject.NULL)
        json.put("size", this.size.wire)
        return json
    }

    companion object {
        const val CONTRACT = "shop.receipt"
        private val FIELDS = setOf("schemaVersion", "orderId", "lines", "totalCents", "paidCents", "deliverTo", "size")

        fun parse(json: JSONObject): GeneratedAcmeShopReceipt = parse(json, GeneratedAcmeWirePlace(CONTRACT, ""))

        internal fun parse(json: JSONObject, place: GeneratedAcmeWirePlace): GeneratedAcmeShopReceipt {
            val read = GeneratedAcmeWireReader(json, CONTRACT, FIELDS, ignoreUnknown = true, place)
            val parsed = GeneratedAcmeShopReceipt(
                schemaVersion = read.required("schemaVersion", GeneratedAcmeWire.integer.within(1.0, 1.0, "1..1")),
                orderId = read.required("orderId", GeneratedAcmeWire.string),
                lines = read.required("lines", GeneratedAcmeWire.list(GeneratedAcmeWire.record("shop.receipt-line") { record, at -> GeneratedAcmeShopReceiptLine.parse(record, at) })),
                totalCents = read.required("totalCents", GeneratedAcmeWire.integer.within(0.0, null, "0..∞")),
                paidCents = read.required("paidCents", GeneratedAcmeWire.integer),
                deliverTo = read.nullable("deliverTo", GeneratedAcmeWire.record("shop.address") { record, at -> GeneratedAcmeShopAddress.parse(record, at) }),
                size = read.required("size", GeneratedAcmeWire.finite("shop.size", GeneratedAcmeShopSize.entries)),
            )
            read.atLeast("paidCents", parsed.paidCents, "totalCents", parsed.totalCents, "")
            return parsed
        }
    }
}

/** Wire contract `shop.receipt-line`; an unknown key is ignored. */
data class GeneratedAcmeShopReceiptLine(
    val name: String,
    val cents: Long,
) {
    fun toJson(): JSONObject {
        val json = JSONObject()
        json.put("name", this.name)
        json.put("cents", this.cents)
        return json
    }

    companion object {
        const val CONTRACT = "shop.receipt-line"
        private val FIELDS = setOf("name", "cents")

        fun parse(json: JSONObject): GeneratedAcmeShopReceiptLine = parse(json, GeneratedAcmeWirePlace(CONTRACT, ""))

        internal fun parse(json: JSONObject, place: GeneratedAcmeWirePlace): GeneratedAcmeShopReceiptLine {
            val read = GeneratedAcmeWireReader(json, CONTRACT, FIELDS, ignoreUnknown = true, place)
            return GeneratedAcmeShopReceiptLine(
                name = read.required("name", GeneratedAcmeWire.string),
                cents = read.required("cents", GeneratedAcmeWire.integer.within(0.0, null, "0..∞")),
            )
        }
    }
}

/** Wire contract `shop.scale`; an unknown key is refused. */
data class GeneratedAcmeShopScale(
    val readings: Set<Double>,
    val tare: Double,
) {
    fun toJson(): JSONObject {
        val json = JSONObject()
        json.put("readings", JSONArray(this.readings))
        json.put("tare", this.tare)
        return json
    }

    companion object {
        const val CONTRACT = "shop.scale"
        private val FIELDS = setOf("readings", "tare")

        fun parse(json: JSONObject): GeneratedAcmeShopScale = parse(json, GeneratedAcmeWirePlace(CONTRACT, ""))

        internal fun parse(json: JSONObject, place: GeneratedAcmeWirePlace): GeneratedAcmeShopScale {
            val read = GeneratedAcmeWireReader(json, CONTRACT, FIELDS, ignoreUnknown = false, place)
            return GeneratedAcmeShopScale(
                readings = read.required("readings", GeneratedAcmeWire.set(GeneratedAcmeWire.number)),
                tare = read.required("tare", GeneratedAcmeWire.number),
            )
        }
    }
}

/** Wire contract `shop.blob`; an unknown key is refused. */
data class GeneratedAcmeShopBlob(
    val json: String,
    val read: String,
    val place: String,
    val it: String?,
    val out: String?,
) {
    fun toJson(): JSONObject {
        val json = JSONObject()
        json.put("json", this.json)
        json.put("read", this.read)
        json.put("place", this.place)
        json.put("it", this.it ?: JSONObject.NULL)
        if (this.out != null) json.put("out", this.out)
        return json
    }

    companion object {
        const val CONTRACT = "shop.blob"
        private val FIELDS = setOf("json", "read", "place", "it", "out")

        fun parse(json: JSONObject): GeneratedAcmeShopBlob = parse(json, GeneratedAcmeWirePlace(CONTRACT, ""))

        internal fun parse(json: JSONObject, place: GeneratedAcmeWirePlace): GeneratedAcmeShopBlob {
            val read = GeneratedAcmeWireReader(json, CONTRACT, FIELDS, ignoreUnknown = false, place)
            return GeneratedAcmeShopBlob(
                json = read.required("json", GeneratedAcmeWire.string),
                read = read.required("read", GeneratedAcmeWire.string),
                place = read.required("place", GeneratedAcmeWire.string),
                it = read.nullable("it", GeneratedAcmeWire.string),
                out = read.optional("out", GeneratedAcmeWire.string),
            )
        }
    }
}
