fn main() {
    let lib = pkg_config::Config::new()
        .print_system_libs(false)
        .probe("libpjproject")
        .expect("pjsip (libpjproject) not found. Run ./scripts/setup-pjsip.sh first");

    for link_path in &lib.link_paths {
        println!("cargo:rustc-link-search={}", link_path.display());
    }

    for lib_name in &lib.libs {
        println!("cargo:rustc-link-lib={}", lib_name);
    }

    // Compile C helper for safe pjsua_acc_config setup
    let mut build = cc::Build::new();
    build.file("src/helpers.c");

    for inc_path in &lib.include_paths {
        build.include(inc_path);
    }

    build.compile("mysip_helpers");

    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=src/helpers.c");
}
