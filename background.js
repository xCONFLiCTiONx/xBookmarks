// background.js - xBookmarks Background Service Worker for Instant Dynamic Vector Theme Icon

const SVG_ICON_PATH = "M6 2h12v20l-6-4-6 4V2z";

let currentSystemIsDark = null;
let currentAppliedIsDark = null;

function createIconImageData(size, iconColor) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = iconColor;
  ctx.save();
  ctx.scale(size / 24, size / 24);
  const p = new Path2D(SVG_ICON_PATH);
  ctx.fill(p);
  ctx.restore();
  return ctx.getImageData(0, 0, size, size);
}

async function updateThemeIcon(isDarkMode) {
  try {
    currentAppliedIsDark = isDarkMode;
    try {
      chrome.storage.local.set({ last_known_is_dark: isDarkMode });
    } catch (_) {}

    // White for dark mode/background, Black for light mode/background
    const iconColor = isDarkMode ? '#FFFFFF' : '#000000';

    if (chrome.action && chrome.action.setIcon) {
      chrome.action.setIcon({
        imageData: {
          16: createIconImageData(16, iconColor),
          32: createIconImageData(32, iconColor),
          48: createIconImageData(48, iconColor),
          128: createIconImageData(128, iconColor)
        }
      });
    }
  } catch (err) {
    console.warn('xBookmarks: Error updating theme icon:', err);
  }
}

async function resolveThemeAndApply(forceDark) {
  try {
    const res = await chrome.storage.local.get(['theme', 'last_known_is_dark']);
    const userPref = res && res.theme; // 'system', 'light', 'dark'
    let isDark;

    if (userPref === 'dark') {
      isDark = true;
    } else if (userPref === 'light') {
      isDark = false;
    } else {
      // 'system' or undefined
      if (typeof forceDark === 'boolean') {
        isDark = forceDark;
      } else if (currentSystemIsDark !== null) {
        isDark = currentSystemIsDark;
      } else if (typeof res.last_known_is_dark === 'boolean') {
        isDark = res.last_known_is_dark;
      } else {
        return;
      }
    }

    await updateThemeIcon(isDark);
  } catch (err) {
    console.warn('xBookmarks: Error resolving theme:', err);
  }
}

let creatingOffscreenPromise = null;
async function setupOffscreenDocument() {
  try {
    if (!chrome.offscreen) return;
    if (chrome.offscreen.hasDocument) {
      if (await chrome.offscreen.hasDocument()) return;
    } else if (chrome.runtime.getContexts) {
      const contexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [chrome.runtime.getURL('offscreen.html')]
      });
      if (contexts && contexts.length > 0) return;
    }

    if (creatingOffscreenPromise) {
      await creatingOffscreenPromise;
      return;
    }

    creatingOffscreenPromise = chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['MATCH_MEDIA'],
      justification: 'Detect system dark or light mode to update toolbar icon'
    });
    await creatingOffscreenPromise;
  } catch (err) {
    if (!String(err).includes('already exists')) {
      console.warn('xBookmarks: Offscreen document error:', err);
    }
  } finally {
    creatingOffscreenPromise = null;
  }
}

// Load last known theme immediately on startup/wake-up
try {
  chrome.storage.local.get(['theme', 'last_known_is_dark'], (res) => {
    if (res) {
      if (typeof res.last_known_is_dark === 'boolean') {
        currentSystemIsDark = res.last_known_is_dark;
      }
      resolveThemeAndApply();
    }
    setupOffscreenDocument();
  });
} catch (_) {
  setupOffscreenDocument();
}

// Listen for settings changes (e.g. user toggles theme in settings page)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.theme) {
    resolveThemeAndApply();
  }
});

// Message listener from offscreen document, popup, home, or settings
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return;

  if (message.action === 'updateIcon' || message.type === 'THEME_CHANGED' || message.type === 'UPDATE_THEME_ICON') {
    if (typeof message.isDarkMode === 'boolean') {
      currentSystemIsDark = message.isDarkMode;
      resolveThemeAndApply(message.isDarkMode);
    }
    sendResponse({ success: true });
    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  setupOffscreenDocument();
});

chrome.runtime.onStartup.addListener(() => {
  setupOffscreenDocument();
});
