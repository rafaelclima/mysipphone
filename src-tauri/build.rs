fn main() {
    // RUNPATH: binary finds libpjsua.so.2 and libpj.so.2 in $ORIGIN/../lib/mysipphone
    // Transitive deps resolved via RPATH=$ORIGIN on each .so file (set by install/build scripts)
    println!("cargo:rustc-link-arg=-Wl,-rpath,$ORIGIN/../lib/mysipphone");
    tauri_build::build()
}
