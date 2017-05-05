/* global Galaxy */

(function () {
  /**
   *
   * @returns {Galaxy.GalaxyView.ReactiveBehavior}
   */
  Galaxy.GalaxyView.ReactiveBehavior = ReactiveBehavior;

  function ReactiveBehavior (node, schema, scopeData, matches) {
    this.node = node;
    this.schema = schema;
    this.scopeData = scopeData;
    this.matches = matches;
  }
});
