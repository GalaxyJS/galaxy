const MODULE_FETCH_RESPONSE_MAP = {};

/**
 *
 * @param {ModuleMetaData} moduleMetaData
 * @return {Promise<ModuleMetaData>}
 */
export function prepare_module_meta_data(moduleMetaData) {
  if (!moduleMetaData) {
    throw new Error("Module meta data or constructor is missing");
  }

  return new Promise(function(resolve, reject) {
    if (
      moduleMetaData.hasOwnProperty("constructor") &&
      typeof moduleMetaData.constructor === "function"
    ) {
      moduleMetaData.path = moduleMetaData.id =
        "internal/" +
        new Date().valueOf() +
        "-" +
        Math.round(performance.now());
      moduleMetaData.source = moduleMetaData.constructor;

      return resolve(moduleMetaData);
    }

    moduleMetaData.path =
      moduleMetaData.path.indexOf("/") === 0
        ? moduleMetaData.path.substring(1)
        : moduleMetaData.path;

    if (!moduleMetaData.id) {
      moduleMetaData.id = moduleMetaData.parentScope
        ? moduleMetaData.parentScope.moduleId + "/" + moduleMetaData.path
        : moduleMetaData.path;
    }

    let url = moduleMetaData.path; /*+ '?' + _this.convertToURIString(module.params || {})*/
    // contentFetcher makes sure that any module gets downloaded from network only once
    let contentFetcher = MODULE_FETCH_RESPONSE_MAP[url];
    if (!contentFetcher) {
      MODULE_FETCH_RESPONSE_MAP[url] = contentFetcher = fetch(url)
        .then((response) => {
          if (!response.ok) {
            console.error(response.statusText, url);
            return reject(response.statusText);
          }

          return response;
        }).catch(reject);
    }

    contentFetcher.then((response) => {
      return response.clone().text();
    }).then(() => {
      return moduleMetaData;
    })
      .then(resolve)
      .catch(reject);
  });
}
