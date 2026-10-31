"use strict"

class Synthesizer {
  constructor() {
    this.audioContext = null
    this.masterGain = null
    this.masterVolume = 0.7
    this.isRunning = false
    this.isMuted = true
    this.bpm = 110
    this.currentStep = 0
    this.nextStepTime = 0
    this.schedulerTimer = null
    this.scheduleAheadTime = 0.12
    this.schedulerInterval = 25

    this.patterns = {
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      bass: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
      synth: [1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1],
      clap: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
      hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
      pluck: [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0]
    }

    const defaults = {
      kick: { volume: 0.25, frequency: 0, speed: 1 },
      bass: { volume: 0.25, frequency: 0, speed: 1 },
      synth: { volume: 0.25, frequency: 0, speed: 1 },
      clap: { volume: 0.25, frequency: 0, speed: 1 },
      hat: { volume: 0.25, frequency: 0, speed: 1 },
      pluck: { volume: 0.25, frequency: 0, speed: 1 }
    }

    this.voices = new Map()
    Object.entries(defaults).forEach(([id, settings]) => {
      this.voices.set(id, { enabled: false, ...settings })
    })
  }

  async start() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass)
      throw new Error("Web Audio API не поддерживается браузером.")

    if (!this.audioContext) {
      this.audioContext = new AudioContextClass()
      this.masterGain = this.audioContext.createGain()
      this.masterGain.gain.value = 0
      this.masterGain.connect(this.audioContext.destination)
    }

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume()
    }

    this.isRunning = true
    this.isMuted = false
    this.masterGain.gain.setTargetAtTime(
      this.masterVolume,
      this.audioContext.currentTime,
      0.025
    )
    this.currentStep = 0
    this.nextStepTime = this.audioContext.currentTime + 0.05

    if (this.schedulerTimer) clearInterval(this.schedulerTimer)
    this.schedulerTimer = setInterval(
      () => this.scheduler(),
      this.schedulerInterval
    )
    this.scheduler()
  }

  scheduler() {
    if (!this.isRunning || !this.audioContext) return
    while (
      this.nextStepTime <
      this.audioContext.currentTime + this.scheduleAheadTime
    ) {
      this.scheduleStep(this.currentStep, this.nextStepTime)
      this.nextStepTime += 60 / this.bpm / 4
      this.currentStep = (this.currentStep + 1) % 16
    }
  }

  scheduleStep(step, time) {
    this.voices.forEach((voice, id) => {
      if (!voice.enabled || !this.patterns[id][step]) return
      const duration = 60 / this.bpm / 4 / voice.speed
      switch (id) {
        case "kick":
          this.playKick(time, voice.volume)
          break
        case "bass":
          this.playBass(time, voice, duration, step)
          break
        case "synth":
          this.playSynth(time, voice, duration, step)
          break
        case "clap":
          this.playClap(time, voice.volume)
          break
        case "hat":
          this.playNoise(time, voice.volume * 0.35, 0.045, 7000)
          break
        case "pluck":
          this.playPluck(time, voice, duration, step)
          break
      }
    })
  }

  toggleVoice(id) {
    const voice = this.voices.get(id)
    if (!voice) return false
    voice.enabled = !voice.enabled
    return voice.enabled
  }

  setVoiceVolume(id, value) {
    const voice = this.voices.get(id)
    if (voice) voice.volume = this.clamp(value, 0, 1)
  }

  setVoiceFrequency(id, value) {
    const voice = this.voices.get(id)
    if (voice) voice.frequency = this.clamp(value, -12, 12)
  }

  setVoiceSpeed(id, value) {
    const voice = this.voices.get(id)
    if (voice) voice.speed = this.clamp(value, 0.5, 2)
  }

  setMasterVolume(value) {
    this.masterVolume = this.clamp(value, 0, 1)
    if (this.masterGain && this.audioContext && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(
        this.masterVolume,
        this.audioContext.currentTime,
        0.025
      )
    }
  }

  toggleMasterMute() {
    if (!this.audioContext || !this.masterGain) return true
    this.isMuted = !this.isMuted
    const target = this.isMuted ? 0 : this.masterVolume
    this.masterGain.gain.setTargetAtTime(
      target,
      this.audioContext.currentTime,
      0.025
    )
    return this.isMuted
  }

  playKick(time, volume) {
    const osc = this.audioContext.createOscillator()
    const gain = this.audioContext.createGain()
    osc.type = "sine"
    osc.frequency.setValueAtTime(150, time)
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.16)
    gain.gain.setValueAtTime(Math.max(volume, 0.001), time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2)
    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(time)
    osc.stop(time + 0.21)
  }

  playBass(time, voice, duration, step) {
    const osc = this.audioContext.createOscillator()
    const gain = this.audioContext.createGain()
    const notes = [0, 0, 7, 0, 3, 0, 7, 0]
    osc.type = "sawtooth"
    osc.frequency.setValueAtTime(
      55 * Math.pow(2, (notes[step % 8] + voice.frequency) / 12),
      time
    )
    gain.gain.setValueAtTime(0.001, time)
    gain.gain.linearRampToValueAtTime(voice.volume * 0.35, time + 0.015)
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      time + Math.max(0.08, duration * 0.85)
    )
    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(time)
    osc.stop(time + duration)
  }

  playSynth(time, voice, duration, step) {
    const osc = this.audioContext.createOscillator()
    const filter = this.audioContext.createBiquadFilter()
    const gain = this.audioContext.createGain()
    const notes = [0, 7, 12, 7, 3, 10, 12, 7]
    osc.type = "triangle"
    osc.frequency.setValueAtTime(
      220 * Math.pow(2, (notes[step % 8] + voice.frequency) / 12),
      time
    )
    filter.type = "lowpass"
    filter.frequency.value = 1800
    gain.gain.setValueAtTime(0.001, time)
    gain.gain.linearRampToValueAtTime(voice.volume * 0.22, time + 0.025)
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.9)
    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)
    osc.start(time)
    osc.stop(time + duration)
  }

  playClap(time, volume) {
    this.playNoise(time, volume * 0.55, 0.12, 1400)
    this.playNoise(time + 0.025, volume * 0.35, 0.1, 1700)
    this.playNoise(time + 0.05, volume * 0.2, 0.08, 2000)
  }

  playNoise(time, volume, duration, frequency) {
    const length = Math.max(
      1,
      Math.floor(this.audioContext.sampleRate * duration)
    )
    const buffer = this.audioContext.createBuffer(
      1,
      length,
      this.audioContext.sampleRate
    )
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1

    const source = this.audioContext.createBufferSource()
    const filter = this.audioContext.createBiquadFilter()
    const gain = this.audioContext.createGain()
    source.buffer = buffer
    filter.type = "highpass"
    filter.frequency.value = frequency
    gain.gain.setValueAtTime(Math.max(volume, 0.001), time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)
    source.start(time)
    source.stop(time + duration)
  }

  playPluck(time, voice, duration, step) {
    const osc = this.audioContext.createOscillator()
    const gain = this.audioContext.createGain()
    const notes = [0, 12, 7, 15, 12, 7, 3, 10]
    osc.type = "triangle"
    osc.frequency.setValueAtTime(
      330 * Math.pow(2, (notes[step % 8] + voice.frequency) / 12),
      time
    )
    gain.gain.setValueAtTime(Math.max(voice.volume * 0.3, 0.001), time)
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      time + Math.min(0.35, duration * 0.9)
    )
    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(time)
    osc.stop(time + Math.min(0.36, duration))
  }

  clamp(value, min, max) {
    const number = Number(value)
    return Math.min(max, Math.max(min, Number.isFinite(number) ? number : min))
  }
}

window.synthesizer = new Synthesizer()
