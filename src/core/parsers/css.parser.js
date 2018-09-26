(function () {
  Galaxy.Module.Content.registerParser('text/css', parser);

  function parser(content) {
    console.info('css parser has been skipped');
    return {
      imports: [],
      source: ''
    };
  }
})();
