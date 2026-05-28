use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use crate::error::AudioError;

const SAMPLE_RATE: u32 = 44100;
const CHANNELS: u32 = 1;
const TONE_FREQ1: f32 = 440.0;
const TONE_FREQ2: f32 = 480.0;
const TONE_DURATION_MS: u32 = 1000;
const SILENCE_DURATION_MS: u32 = 3000;

pub struct RingtonePlayer {
    playing: Arc<AtomicBool>,
}

impl RingtonePlayer {
    pub fn new() -> Self {
        Self {
            playing: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn play(&self) -> Result<(), AudioError> {
        if self.playing.load(Ordering::SeqCst) {
            return Ok(());
        }
        self.playing.store(true, Ordering::SeqCst);

        let playing = self.playing.clone();
        std::thread::spawn(move || {
            if let Err(e) = Self::ringtone_loop(playing) {
                tracing::error!("Ringtone playback error: {}", e);
            }
        });

        Ok(())
    }

    pub fn stop(&self) {
        self.playing.store(false, Ordering::SeqCst);
    }

    pub fn play_test_tone(device: &str) -> Result<(), AudioError> {
        use alsa::pcm::{Access, Format, HwParams, PCM};
        use alsa::ValueOr;

        let pcm = PCM::new(device, alsa::Direction::Playback, false)?;
        let hw_params = HwParams::any(&pcm)?;

        hw_params.set_channels(1)?;
        hw_params.set_rate(SAMPLE_RATE, ValueOr::Nearest)?;
        hw_params.set_format(Format::s16())?;
        hw_params.set_access(Access::RWInterleaved)?;
        pcm.hw_params(&hw_params)?;

        let io = pcm.io_i16()?;

        let samples = (SAMPLE_RATE * 400 / 1000) as usize;
        let mut buf: Vec<i16> = Vec::with_capacity(samples);
        for i in 0..samples {
            let t = i as f32 / SAMPLE_RATE as f32;
            let envelope = if i < samples / 10 {
                i as f32 / (samples as f32 / 10.0)
            } else if i > samples - samples / 10 {
                (samples - i) as f32 / (samples as f32 / 10.0)
            } else {
                1.0
            };
            let s = (t * 1000.0 * 2.0 * std::f32::consts::PI).sin();
            buf.push((s * envelope * i16::MAX as f32 * 0.5) as i16);
        }

        io.writei(&buf)?;
        drop(io);
        drop(hw_params);
        drop(pcm);
        Ok(())
    }

    fn ringtone_loop(playing: Arc<AtomicBool>) -> Result<(), AudioError> {
        use alsa::pcm::{Access, Format, HwParams, PCM};
        use alsa::ValueOr;

        let pcm = PCM::new("default", alsa::Direction::Playback, false)?;
        let hw_params = HwParams::any(&pcm)?;

        hw_params.set_channels(CHANNELS)?;
        hw_params.set_rate(SAMPLE_RATE, ValueOr::Nearest)?;
        hw_params.set_format(Format::s16())?;
        hw_params.set_access(Access::RWInterleaved)?;
        pcm.hw_params(&hw_params)?;

        let io = pcm.io_i16()?;

        let tone_samples = (SAMPLE_RATE * TONE_DURATION_MS / 1000) as usize;
        let silence_samples = (SAMPLE_RATE * SILENCE_DURATION_MS / 1000) as usize;

        let mut tone_buf: Vec<i16> = Vec::with_capacity(tone_samples);
        for i in 0..tone_samples {
            let t = i as f32 / SAMPLE_RATE as f32;
            let s1 = (t * TONE_FREQ1 * 2.0 * std::f32::consts::PI).sin();
            let s2 = (t * TONE_FREQ2 * 2.0 * std::f32::consts::PI).sin();
            let sample = (s1 + s2) * 0.5;
            tone_buf.push((sample * i16::MAX as f32) as i16);
        }

        let silence_buf = vec![0i16; silence_samples];

        while playing.load(Ordering::SeqCst) {
            if let Err(e) = io.writei(&tone_buf) {
                tracing::warn!("Ringtone write error: {}", e);
                break;
            }
            if let Err(e) = io.writei(&silence_buf) {
                tracing::warn!("Ringtone silence error: {}", e);
                break;
            }
        }

        drop(io);
        drop(hw_params);
        drop(pcm);
        Ok(())
    }
}

impl Default for RingtonePlayer {
    fn default() -> Self {
        Self::new()
    }
}
