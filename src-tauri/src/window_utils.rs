pub fn set_corner_radius(radius: f64) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        use gtk::prelude::*;

        let provider = gtk::CssProvider::new();
        let css = format!("window {{ border-radius: {}px; }}", radius.round() as i32);
        provider
            .load_from_data(css.as_bytes())
            .map_err(|e| format!("CSS err: {e}"))?;
        if let Some(screen) = gtk::gdk::Screen::default() {
            gtk::StyleContext::add_provider_for_screen(
                &screen,
                &provider,
                gtk::STYLE_PROVIDER_PRIORITY_APPLICATION,
            );
        }
    }

    let _ = radius;

    Ok(())
}
