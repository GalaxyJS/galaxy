(function (_galaxy) {
  _galaxy.FETCH_CONTENT_PARSERS['function'] = parser;

  function parser(content, metaData) {
    const unique = [];
    let imports = metaData.imports ? metaData.imports.slice(0) : [];
    imports = imports.map(function (item) {
      if (unique.indexOf(item) !== -1) {
        return null;
      }

      unique.push(item);
      return { path: item };
    }).filter(Boolean);

    return {
      imports: imports,
      source: content
    };
  }
})(Galaxy);
