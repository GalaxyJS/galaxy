(function (GMC) {
  GMC.registerParser('application/javascript', parser);

  function parser(content) {
    const imports = [];
    const unique = [];
    let parsedContent = content.replace(/Scope\.import\(['"](.*)['"]\)/gm, function (match, path) {
      let query = path.match(/([\S]+)/gm);
      let pathURL = query[query.length - 1];
      if (unique.indexOf(pathURL) !== -1) {
        return 'Scope.import(\'' + pathURL + '\')';
      }

      unique.push(pathURL);
      imports.push({
        path: pathURL,
        fresh: query.indexOf('new') === 0,
        contentType: null
      });

      return 'Scope.import(\'' + pathURL + '\')';
    });

    parsedContent = parsedContent.replace(/Scope\.importAsText\(['"](.*)['"]\)/gm, function (match, path) {
      let query = path.match(/([\S]+)/gm);
      let pathURL = query[query.length - 1] + '#text';
      if (unique.indexOf(pathURL) !== -1) {
        return 'Scope.import(\'' + pathURL + '\')';
      }

      unique.push(pathURL);
      imports.push({
        path: pathURL,
        fresh: true,
        contentType: 'text/plain'
      });

      return 'Scope.import(\'' + pathURL + '\')';
    });

    parsedContent = parsedContent.replace(/Scope\.kill\(.*\)/gm, 'return');

    return {
      imports: imports,
      source: parsedContent
    };
  }
})(Galaxy.Module.Content);
