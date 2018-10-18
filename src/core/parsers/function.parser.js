(function () {
  Galaxy.Module.Content.registerParser('function', parser);

  function parser(content, metaData) {
    const unique = [];
    let imports = metaData.imports ? metaData.imports.slice(0) : [];
    imports = imports.map(function (item) {
      if (unique.indexOf(item) !== -1) {
        return null;
      }

      unique.push(item);
      return { url: item };
    }).filter(Boolean);

    return {
      imports: imports,
      source: content
    };
  }
})();
