const BPM = 88
const STEPS = 16
const STEP_MS = (60 / BPM / 4) * 1000

const PATTERNS = {
  kick: [
    1,
    null,
    null,
    null,
    null,
    null,
    1,
    null,
    1,
    null,
    null,
    null,
    null,
    1,
    null,
    null
  ],

  bass: [
    33,
    null,
    null,
    null,
    33,
    null,
    null,
    null,
    36,
    null,
    null,
    33,
    null,
    null,
    31,
    null
  ],

  synth: [
    57,
    null,
    null,
    60,
    null,
    null,
    57,
    null,
    null,
    64,
    null,
    null,
    60,
    null,
    null,
    null
  ],

  clap: [
    null,
    null,
    null,
    null,
    1,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    1,
    null,
    null,
    null
  ],

  hat: [
    1,
    null,
    null,
    1,
    null,
    null,
    1,
    null,
    1,
    null,
    null,
    1,
    null,
    1,
    null,
    null
  ],

  pluck: [
    null,
    null,
    69,
    null,
    null,
    null,
    null,
    null,
    null,
    67,
    null,
    null,
    null,
    null,
    64,
    null
  ]
}

const DEFAULT_SETTINGS = {
  kick: { volume: 0.75, frequency: 0, speed: 1 },
  bass: { volume: 0.58, frequency: 0, speed: 1 },
  synth: { volume: 0.28, frequency: 0, speed: 1 },
  clap: { volume: 0.3, frequency: 0, speed: 1 },
  hat: { volume: 0.13, frequency: 0, speed: 1 },
  pluck: { volume: 0.2, frequency: 0, speed: 1 }
}

class Synthesizer {
  constructor() {
    this.context = null
    this.masterGain = null
    this.scheduler = null
    this.step = -1
    this.isMuted = false
    this.masterVolume = 0.8

    this.voices = new Map()

    this.settings = new Map(
      Object.entries(DEFAULT_SETTINGS).map(([id, values]) => [
        id,
        { ...values }
      ])
    )
  }

  get isInitialized() {
    return this.context !== null
  }

  async start() {
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext

      if (!AudioContextClass) {
        throw new Error("Web Audio API не поддерживается браузером.")
      }

      this.context = new AudioContextClass()
      this.masterGain = this.context.createGain()
      this.masterGain.gain.value = this.masterVolume
      this.masterGain.connect(this.context.destination)
    }

    if (this.context.state === "suspended") {
      await this.context.resume()
    }

    if (!this.scheduler) {
      this.scheduler = window.setInterval(() => this.tick(), STEP_MS)
    }
  }

  tick() {
    if (!this.context || this.context.state !== "running") return

    this.step = (this.step + 1) % STEPS

    for (const [id, voice] of this.voices) {
      if (!voice.enabled) continue

      const settings = this.settings.get(id)
      const pattern = PATTERNS[id]
      if (!settings || !pattern) continue

      const index = Math.floor(this.step * settings.speed) % STEPS
      const note = pattern[index]

      if (note === null || note === undefined) continue

      if (id === "kick") this.playKick(settings)
      else if (id === "clap") this.playNoise(settings, "clap")
      else if (id === "hat") this.playNoise(settings, "hat")
      else this.playNote(id, note, settings)
    }
  }

  toggleVoice(id) {
    if (!PATTERNS[id]) return false

    const enabled = !(this.voices.get(id)?.enabled ?? false)
    this.voices.set(id, { enabled })
    return enabled
  }

  setVoiceVolume(id, value) {
    const settings = this.settings.get(id)
    if (settings) settings.volume = this.clamp(value, 0, 1)
  }

  setVoiceFrequency(id, value) {
    const settings = this.settings.get(id)
    if (settings) settings.frequency = this.clamp(value, -12, 12)
  }

  setVoiceSpeed(id, value) {
    const settings = this.settings.get(id)
    if (settings) settings.speed = this.clamp(value, 0.5, 2)
  }

  setMasterVolume(value) {
    this.masterVolume = this.clamp(value, 0, 1)

    if (this.masterGain && this.context) {
      this.masterGain.gain.setTargetAtTime(
        this.isMuted ? 0 : this.masterVolume,
        this.context.currentTime,
        0.02
      )
    }
  }

  toggleMasterMute() {
    this.isMuted = !this.isMuted

    if (this.masterGain && this.context) {
      this.masterGain.gain.setTargetAtTime(
        this.isMuted ? 0 : this.masterVolume,
        this.context.currentTime,
        0.02
      )
    }

    return this.isMuted
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value)))
  }

  midiToHz(note, settings) {
    return 440 * Math.pow(2, (note + settings.frequency - 69) / 12)
  }

  playNote(id, note, settings) {
    const now = this.context.currentTime
    const osc = this.context.createOscillator()
    const gain = this.context.createGain()

    const hz = this.midiToHz(note, settings)
    const duration = id === "bass" ? 0.22 : id === "synth" ? 0.18 : 0.12

    if (id === "bass") {
      osc.type = "triangle"
      osc.frequency.setValueAtTime(hz, now)
    } else if (id === "synth") {
      osc.type = "sawtooth"
      osc.frequency.setValueAtTime(hz, now)
    } else {
      osc.type = "triangle"
      osc.frequency.setValueAtTime(hz, now)
    }

    // Приглушаем верх, чтобы звук был более сухим и тёмным.
    const filter = this.context.createBiquadFilter()
    filter.type = "lowpass"
    filter.frequency.value = id === "bass" ? 220 : id === "synth" ? 1300 : 1900

    const peak =
      id === "bass"
        ? settings.volume * 0.42
        : id === "synth"
          ? settings.volume * 0.22
          : settings.volume * 0.26

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.linearRampToValueAtTime(Math.max(0.0001, peak), now + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)

    osc.start(now)
    osc.stop(now + duration + 0.02)
  }

  playKick(settings) {
    const now = this.context.currentTime
    const osc = this.context.createOscillator()
    const gain = this.context.createGain()

    const base = this.midiToHz(36, settings)

    osc.type = "sine"
    osc.frequency.setValueAtTime(base * 2.4, now)
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(32, base * 0.75),
      now + 0.13
    )

    gain.gain.setValueAtTime(Math.max(0.0001, settings.volume * 0.72), now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)

    osc.connect(gain)
    gain.connect(this.masterGain)

    osc.start(now)
    osc.stop(now + 0.22)
  }

  playNoise(settings, type) {
    const now = this.context.currentTime
    const duration = type === "clap" ? 0.13 : 0.045
    const length = Math.floor(this.context.sampleRate * duration)
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate)

    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1
    }

    const source = this.context.createBufferSource()
    const filter = this.context.createBiquadFilter()
    const gain = this.context.createGain()

    source.buffer = buffer

    const cutoff =
      (type === "hat" ? 6500 : 1600) * Math.pow(2, settings.frequency / 12)

    filter.type = type === "hat" ? "highpass" : "bandpass"
    filter.frequency.value = this.clamp(
      cutoff,
      type === "hat" ? 2500 : 500,
      type === "hat" ? 12000 : 7000
    )

    gain.gain.setValueAtTime(
      Math.max(0.0001, settings.volume * (type === "hat" ? 0.28 : 0.42)),
      now
    )
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)

    source.start(now)
    source.stop(now + duration)
  }
}

window.synthesizer = new Synthesizer()
