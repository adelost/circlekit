package com.adelost.releasekit

import java.security.MessageDigest
import net.i2p.crypto.eddsa.EdDSAEngine
import net.i2p.crypto.eddsa.EdDSAPublicKey
import net.i2p.crypto.eddsa.spec.EdDSANamedCurveTable
import net.i2p.crypto.eddsa.spec.EdDSAPublicKeySpec

/** WHAT: Checks detached Ed25519 signatures with Android-safe cryptography. WHY: Keeps release verification independent of AndroidKeyStore provider quirks. */
object DetachedEd25519Verifier {
    fun verify(
        rawPublicKey: ByteArray,
        message: ByteArray,
        signature: ByteArray,
    ): Boolean {
        if (rawPublicKey.size != PUBLIC_KEY_BYTES || signature.size != SIGNATURE_BYTES) {
            return false
        }
        return runCatching {
            val parameters = EdDSANamedCurveTable.getByName("Ed25519")
            val publicKey = EdDSAPublicKey(EdDSAPublicKeySpec(rawPublicKey, parameters))
            EdDSAEngine(MessageDigest.getInstance(parameters.hashAlgorithm)).run {
                initVerify(publicKey)
                update(message)
                verify(signature)
            }
        }.getOrDefault(false)
    }

    private const val PUBLIC_KEY_BYTES = 32
    private const val SIGNATURE_BYTES = 64
}
