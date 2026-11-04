// The public page's visit counter. It loads nothing until the visitor agrees, and only the publish step adds it.
// Put the Google Analytics measurement ID (G-...) here to turn it on.
export const MEASUREMENT_ID = 'G-Z6DJ9Z3229';

export function withAnalytics(html, id = MEASUREMENT_ID) {
  if (!id) return html;
  if (!/^G-[A-Z0-9]+$/.test(id)) throw new Error('not a measurement ID: ' + id);
  const tag = `<script>
window.__analytics = (function () {
  var id = '${id}', loaded = false;
  return {
    start: function () {
      window['ga-disable-' + id] = false;
      if (loaded) { window.gtag('config', id); return; }
      loaded = true;
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', id);
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
      document.head.appendChild(s);
    },
    stop: function () {
      window['ga-disable-' + id] = true;
      document.cookie.split(';').forEach(function (c) {
        var n = c.split('=')[0].trim();
        if (!/^_ga/.test(n)) return;
        ['', '; domain=' + location.hostname, '; domain=.' + location.hostname].forEach(function (d) {
          document.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + d;
        });
      });
    },
  };
})();
</script>`;
  return html.replace('</head>', () => tag + '\n</head>');
}
