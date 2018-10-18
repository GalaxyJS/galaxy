/* global Galaxy */
'use strict';

Galaxy.GalaxyURI = /** @class */ (function () {
  /**
   *
   * @param {string} url
   * @constructor
   */
  function GalaxyURI(url) {
    let urlParser = document.createElement('a');
    urlParser.href = url;
    let myRegexp = /([^\t\n]+)\//g;
    let match = myRegexp.exec(urlParser.pathname);

    this.parsedURL = urlParser.href;
    this.path = match ? match[0] : '/';
    this.base = window.location.pathname;
    this.protocol = urlParser.protocol;
  }

  return GalaxyURI;
})();
