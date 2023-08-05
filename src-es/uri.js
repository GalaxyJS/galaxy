/**
 *
 * @param {string} url
 * @constructor
 */
function URI(url) {
  let urlParser = document.createElement('a');
  urlParser.href = url;
  let myRegexp = /\/([^\t\n]+\/)/g;
  let match = myRegexp.exec(urlParser.pathname);

  this.parsedURL = urlParser.href;
  this.path = match ? match[1] : '/';
  this.base = window.location.pathname;
  this.protocol = urlParser.protocol;
}

export default URI;
