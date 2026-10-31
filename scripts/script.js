"use strict"

document.addEventListener("DOMContentLoaded", () => {
  const audio = window.synthesizer
  const powerButton = document.getElementById("startButton")
  const globalVolume = document.getElementById("global-volume")
  const grid = document.getElementById("instruments-grid")
  const statusText = document.getElementById("status-text")
  const statusDot = document.getElementById("status-dot")

  if (!audio || !powerButton || !globalVolume || !grid) {
    console.error(
      "Не найдены необходимые элементы интерфейса или synth.js не загрузился."
    )
    return
  }

  let initialized = false
  let starting = false
  const instrumentIds = ["kick", "bass", "synth", "clap", "hat", "pluck"]

  function setStatus(message, active) {
    if (statusText) statusText.textContent = message
    if (statusDot) statusDot.classList.toggle("is-on", active)
  }

  function updatePowerButton(muted) {
    powerButton.textContent = muted ? "ВКЛЮЧИТЬ ЗВУК" : "ВЫКЛЮЧИТЬ ЗВУК"
    powerButton.classList.toggle("is-active", !muted)
    powerButton.setAttribute("aria-pressed", String(!muted))
  }

  function updatePad(id, active) {
    const pad = grid.querySelector(`.square-object[data-id="${id}"]`)
    if (!pad) return
    pad.classList.toggle("is-active", active)
    pad.setAttribute("aria-pressed", String(active))
    pad.setAttribute("aria-label", `${active ? "Выключить" : "Включить"} ${id}`)
  }

  function updateOutput(input) {
    const output = input.closest(".control")?.querySelector("output")
    if (!output) return
    const value = Number(input.value)
    switch (input.dataset.control) {
      case "volume":
        output.textContent = `${Math.round(value * 100)}%`
        break
      case "frequency":
        output.textContent = `${value > 0 ? "+" : ""}${value} st`
        break
      case "speed":
        output.textContent = `${value.toFixed(2)}×`
        break
    }
  }

  function enableAllInstruments() {
    instrumentIds.forEach((id) => {
      const voice = audio.voices.get(id)
      if (voice && !voice.enabled) audio.toggleVoice(id)
      updatePad(id, true)
    })
  }

  audio.setMasterVolume(Number(globalVolume.value))
  globalVolume.addEventListener("input", (event) => {
    audio.setMasterVolume(Number(event.target.value))
  })

  powerButton.addEventListener("click", async () => {
    if (starting) return

    if (!initialized) {
      starting = true
      powerButton.disabled = true
      powerButton.textContent = "ЗАПУСК..."
      try {
        await audio.start()
        initialized = true
        audio.setMasterVolume(Number(globalVolume.value))
        enableAllInstruments()
        updatePowerButton(false)
        setStatus("Система запущена", true)
      } catch (error) {
        console.error("Ошибка запуска аудио:", error)
        powerButton.textContent = "ПОВТОРИТЬ ЗАПУСК"
        setStatus("Ошибка запуска аудио", false)
      } finally {
        starting = false
        powerButton.disabled = false
      }
      return
    }

    const muted = audio.toggleMasterMute()
    updatePowerButton(muted)
    setStatus(muted ? "Звук отключён" : "Система запущена", !muted)
  })

  grid.querySelectorAll(".instrument-card").forEach((card) => {
    const pad = card.querySelector(".square-object[data-id]")
    if (!pad) return
    const id = pad.dataset.id

    card.querySelectorAll("[data-control]").forEach((input) => {
      updateOutput(input)
      const value = Number(input.value)
      switch (input.dataset.control) {
        case "volume":
          audio.setVoiceVolume(id, value)
          break
        case "frequency":
          audio.setVoiceFrequency(id, value)
          break
        case "speed":
          audio.setVoiceSpeed(id, value)
          break
      }

      input.addEventListener("input", () => {
        const nextValue = Number(input.value)
        updateOutput(input)
        switch (input.dataset.control) {
          case "volume":
            audio.setVoiceVolume(id, nextValue)
            break
          case "frequency":
            audio.setVoiceFrequency(id, nextValue)
            break
          case "speed":
            audio.setVoiceSpeed(id, nextValue)
            break
        }
      })
    })

    pad.addEventListener("click", () => {
      if (!initialized) {
        setStatus("Сначала включи систему", false)
        powerButton.focus()
        return
      }
      const active = audio.toggleVoice(id)
      updatePad(id, active)
    })
    pad.setAttribute("aria-pressed", "false")
  })

  updatePowerButton(true)
  setStatus("Система выключена", false)
})
