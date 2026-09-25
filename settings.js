document.addEventListener('DOMContentLoaded', () => {
  chrome.bookmarks.getTree(tree => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      return;
    }
    const select = document.getElementById('popupRootFolder');
    if (select && tree) {
      populateFolderSelect(select, tree);
    }
    loadSettings();
  });
});

function applyThemeToSettingsPage(theme) {
  const themeSelect = document.getElementById('themeSelect');
  if (themeSelect) {
    themeSelect.value = theme || 'system';
  }
}

function populateFolderSelect(select, nodes, depth = 0) {
  const sortedNodes = [...(nodes || [])].sort((a, b) => (a.title || '').localeCompare(b.title || ''));

  sortedNodes.forEach(node => {
    if (!node.url) {
      const option = document.createElement('option');
      option.value = node.id;
      option.textContent = `${'— '.repeat(depth)}${node.title || 'Folder'}`;
      select.appendChild(option);

      if (node.children) {
        populateFolderSelect(select, node.children, depth + 1);
      }
    }
  });
}

function loadSettings() {
  chrome.storage.local.get({
    popupRootFolderId: '2',
    popupRootFolder: '2',
    theme: 'system',
    sortAlphabetically: false
  }, settings => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
    }

    const savedRootFolderId = (settings && (settings.popupRootFolderId || settings.popupRootFolder)) || '2';
    const folderSelect = document.getElementById('popupRootFolder');
    if (folderSelect) {
      folderSelect.value = savedRootFolderId;
    }

    const sortCheckbox = document.getElementById('sortAlphabetically');
    if (sortCheckbox) {
      sortCheckbox.checked = settings ? settings.sortAlphabetically : false;
    }

    applyThemeToSettingsPage(settings ? settings.theme : 'system');
    attachSaveHandlers();
    saveSettings();
  });
}

function attachSaveHandlers() {
  const folderSelect = document.getElementById('popupRootFolder');
  const themeSelect = document.getElementById('themeSelect');
  const sortCheckbox = document.getElementById('sortAlphabetically');

  if (folderSelect) folderSelect.addEventListener('change', saveSettings);
  if (themeSelect) themeSelect.addEventListener('change', saveSettings);
  if (sortCheckbox) sortCheckbox.addEventListener('change', saveSettings);
}

function saveSettings() {
  const folderSelect = document.getElementById('popupRootFolder');
  const themeSelect = document.getElementById('themeSelect');
  const sortCheckbox = document.getElementById('sortAlphabetically');

  const popupRootFolderId = String((folderSelect && folderSelect.value) || '2');
  const theme = (themeSelect && themeSelect.value) || 'system';
  const sortAlphabetically = sortCheckbox ? sortCheckbox.checked : false;

  chrome.storage.local.set({
    popupRootFolderId,
    popupRootFolder: popupRootFolderId,
    theme,
    sortAlphabetically
  });

  if (window.applyTheme) {
    window.applyTheme(theme);
  }
}
