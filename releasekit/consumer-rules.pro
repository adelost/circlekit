# net.i2p EdDSA conditionally recognizes the JDK's internal X509Key when it is
# present. Android never supplies that class; the Android-safe raw-key path in
# DetachedEd25519Verifier does not call it. Tell consumer shrinkers that this
# optional desktop branch is intentionally absent.
-dontwarn sun.security.x509.X509Key
