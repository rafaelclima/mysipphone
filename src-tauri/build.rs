fn main() {
    // RPATH (--disable-new-dtags) so transitive deps of bundled .so files also resolve via $ORIGIN
    // RUNPATH is NOT inherited by transitive deps in glibc — each .so would need its own RPATH
    println!("cargo:rustc-link-arg=-Wl,-rpath,$ORIGIN/../lib/mysipphone");
    println!("cargo:rustc-link-arg=-Wl,--disable-new-dtags");
    tauri_build::build()
}
