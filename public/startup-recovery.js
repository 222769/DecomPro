(function () {
  var screen = document.getElementById('startup');
  var message = document.getElementById('startup-message');
  var retry = document.getElementById('startup-retry');
  retry.onclick = function () {
    var url = new URL(location.href);
    url.searchParams.set('app-refresh', Date.now().toString());
    location.replace(url.href);
  };
  var timer = setTimeout(function () {
    message.textContent = 'Loading is taking longer than expected. Check your connection or refresh the app. Your saved records will be kept.';
    retry.hidden = false;
  }, 15000);
  window.decomproStartup = {
    complete: function () {
      clearTimeout(timer);
      screen.hidden = true;
      document.getElementById('startup-style').remove();
    },
    fail: function (error) {
      clearTimeout(timer);
      document.getElementById('startup-title').textContent = 'Your workspace could not open';
      message.textContent = 'The app could not finish loading. Refresh to request the latest version. Your saved records have not been cleared.';
      retry.hidden = false;
      document.getElementById('startup-details').hidden = false;
      document.getElementById('startup-error').textContent = error.message || String(error);
    }
  };
  window.addEventListener('error', function (event) {
    if (event.target instanceof HTMLScriptElement && event.target.type === 'module') {
      window.decomproStartup.fail(new Error('The app component could not download. Check your connection and refresh.'));
    }
  }, true);
})();
