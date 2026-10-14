// SnapLoad Options Script

document.addEventListener('DOMContentLoaded', () => {
  const themeSelect = document.getElementById('themeSelect');
  const delaySelect = document.getElementById('delaySelect');
  const saveBtn = document.getElementById('saveBtn');
  const statusEl = document.getElementById('status');

  // Load saved settings
  chrome.storage.sync.get(['theme', 'hideDelay'], (result) => {
    if (result.theme) themeSelect.value = result.theme;
    if (result.hideDelay) delaySelect.value = result.hideDelay;
  });

  // Save settings
  saveBtn.addEventListener('click', () => {
    const theme = themeSelect.value;
    const hideDelay = parseInt(delaySelect.value, 10);

    chrome.storage.sync.set({ theme, hideDelay }, () => {
      statusEl.textContent = 'Settings saved successfully!';

      // Notify active tabs of setting changes
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, {
            action: 'settingsUpdate',
            theme,
            hideDelay
          }).catch(() => {}); // Ignore errors for tabs without content script
        });
      });

      setTimeout(() => {
        statusEl.textContent = '';
      }, 2500);
    });
  });
});
