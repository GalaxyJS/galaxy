(function (GMC) {
  GMC.registerParser('default', parser);

  function parser(content) {
    return {
      imports: [],
      source: async function as_text(scope) {
        scope.export = content;
      }
    };
  }
})(Galaxy.Module.Content);
