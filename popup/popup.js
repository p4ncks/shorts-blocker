// Shared settings contract from SPEC.md:
// Key: 'settings'
// Value: { enabled: boolean, mode: "redirect" | "block" }
const DEFAULT_SETTINGS = {
  enabled: true,
  mode: "redirect"
};

const enabledToggle = document.getElementById("enabled-toggle");
const modeFieldset = document.getElementById("mode-fieldset");
const modeRadios = document.querySelectorAll('input[name="mode"]');

// Reads current settings from sync storage, falling back to defaults.
function loadSettings(callback) {
  if (!chrome?.storage?.sync) {
    callback(DEFAULT_SETTINGS);
    return;
  }

  chrome.storage.sync.get(["settings"], (result) => {
    if (chrome.runtime.lastError) {
      console.error("Shorts Blocker: could not load settings", chrome.runtime.lastError);
      callback(DEFAULT_SETTINGS);
      return;
    }

    const current = result && result.settings ? result.settings : {};
    const settings = {
      enabled: typeof current.enabled === "boolean" ? current.enabled : DEFAULT_SETTINGS.enabled,
      mode: current.mode === "block" ? "block" : DEFAULT_SETTINGS.mode
    };
    callback(settings);
  });
}

// Writes full settings object back to sync storage.
function saveSettings(settings) {
  if (!chrome?.storage?.sync) {
    return;
  }

  chrome.storage.sync.set({ settings }, () => {
    if (chrome.runtime.lastError) {
      console.error("Shorts Blocker: could not save settings", chrome.runtime.lastError);
    }
  });
}

// Updates UI controls to reflect a settings object.
function updateUI(settings) {
  enabledToggle.checked = Boolean(settings.enabled);

  for (const radio of modeRadios) {
    radio.checked = radio.value === settings.mode;
  }

  // Dim and disable mode options when blocker is turned off
  modeFieldset.disabled = !settings.enabled;
  modeFieldset.classList.toggle("disabled", !settings.enabled);
}

// Sets up user interactions and storage listeners.
function init() {
  loadSettings(updateUI);

  enabledToggle.addEventListener("change", () => {
    loadSettings((current) => {
      const updated = {
        ...current,
        enabled: enabledToggle.checked
      };
      updateUI(updated);
      saveSettings(updated);
    });
  });

  for (const radio of modeRadios) {
    radio.addEventListener("change", () => {
      if (!radio.checked) {
        return;
      }
      loadSettings((current) => {
        const updated = {
          ...current,
          mode: radio.value
        };
        updateUI(updated);
        saveSettings(updated);
      });
    });
  }

  // React to changes if updated elsewhere (e.g. background or another window)
  if (chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "sync" && changes.settings) {
        const next = changes.settings.newValue || DEFAULT_SETTINGS;
        const normalized = {
          enabled: typeof next.enabled === "boolean" ? next.enabled : DEFAULT_SETTINGS.enabled,
          mode: next.mode === "block" ? "block" : DEFAULT_SETTINGS.mode
        };
        updateUI(normalized);
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", init);
