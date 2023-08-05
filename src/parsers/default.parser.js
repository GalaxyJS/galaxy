(function (_galaxy) {
  _galaxy.FETCH_CONTENT_PARSERS['default'] = parser;

  function parser(content) {
    return {
      imports: [],
      source: async function as_text(scope) {
        scope.export = content;
      }
    };
  }
})(Galaxy);
