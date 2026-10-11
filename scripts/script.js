;(() => {
  "use strict"

  document.addEventListener("DOMContentLoaded", () => {
    const audio = window.synthesizer
    const powerButton = document.getElementById("startButton")
    const globalVolume = document.getElementById("global-volume")
    const grid = document.getElementById("instruments-grid")
    const statusText = document.getElementById("status-text")
    const statusDot = document.getElementById("status-dot")

    if (!audio || !powerButton || !globalVolume || !grid) {
      console.error("Не найдены необходимые элементы интерфейса.")
      return
    }

    let initialized = false

    function setStatus(message, on) {
      if (statusText) statusText.textContent = message
      if (statusDot) statusDot.classList.toggle("is-on", on)
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

    powerButton.addEventListener("click", async () => {
      if (!initialized) {
        powerButton.disabled = true
        powerButton.textContent = "Запуск аудио..."

        try {
          await audio.start()
          initialized = true
          powerButton.textContent = "Выключить звук"
          powerButton.classList.add("is-active")
          setStatus("Система запущена", true)
        } catch (error) {
          console.error("Не удалось запустить аудио:", error)
          powerButton.textContent = "Повторить запуск"
          setStatus("Ошибка запуска аудио", false)
        } finally {
          powerButton.disabled = false
        }

        return
      }

      const muted = audio.toggleMasterMute()

      powerButton.textContent = muted ? "Включить звук" : "Выключить звук"

      powerButton.classList.toggle("is-active", !muted)
      setStatus(muted ? "Звук отключён" : "Система запущена", !muted)
    })

    globalVolume.addEventListener("input", (event) => {
      audio.setVolume(Number(event.target.value))
    })

    grid.querySelectorAll(".instrument-card").forEach((card) => {
      const pad = card.querySelector(".square-object[data-id]")
      if (!pad) return

      const id = pad.dataset.id

      card.querySelectorAll("[data-control]").forEach((input) => {
        updateOutput(input)

        input.addEventListener("input", () => {
          const value = Number(input.value)
          updateOutput(input)

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
        })

        // Передаём начальные значения движку.
        const initial = Number(input.value)

        if (input.dataset.control === "volume") {
          audio.setVoiceVolume(id, initial)
        } else if (input.dataset.control === "frequency") {
          audio.setVoiceFrequency(id, initial)
        } else if (input.dataset.control === "speed") {
          audio.setVoiceSpeed(id, initial)
        }
      })

      pad.addEventListener("click", () => {
        if (!initialized) {
          setStatus("Сначала включи систему", false)
          powerButton.focus()
          return
        }

        const active = audio.toggleVoice(id)
        pad.classList.toggle("is-active", active)
        pad.setAttribute("aria-pressed", String(active))
      })
    })
  })
})()
