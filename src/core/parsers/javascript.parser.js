(function () {
  Galaxy.Module.Content.registerParser('application/javascript', parser);

  function parser(content) {
    const imports = [];
    const unique = [];
    const parsedContent = content.replace(/Scope\.import\(['|"](.*)['|"]\);/gm, function (match, path) {
      let query = path.match(/([\S]+)/gm);
      let url = query[query.length - 1];
      if (unique.indexOf(url) !== -1) {
        return 'Scope.import(\'' + url + '\')';
      }

      unique.push(url);
      imports.push({
        url: url,
        fresh: query.indexOf('new') !== -1
      });

      return 'Scope.import(\'' + url + '\')';
    });

    return {
      imports: imports,
      source: parsedContent
    };
  }
})();
