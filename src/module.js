class Module {
  /**
   *
   * @param {Scope} scope
   */
  constructor(scope) {
    this.id = scope.moduleId;
    this.source = typeof scope.source === "function" ? scope.source : null;
    this.path = scope.path || null;
    this.scope = scope;
    this.scope.source = "consumed";
  }

  init() {
    return new Promise(async (resolve, reject) => {
      const module = this;
      try {
        const source = module.source || (await import(/* @vite-ignore */"/" + module.path)).default;
        let moduleSource = source;

        if (typeof source !== "function") {
          moduleSource = function() {
            console.error("Can't find default function in %c" + module.path, "font-weight: bold;");
          };
        }

        const output = moduleSource.call(null, module.scope) || null;
        const proceed = () => {
          this.scope.trigger("module.init");
          return resolve(module);
        };

        // if the function is not async, output would be undefined
        if (output) {
          output.then(proceed);
        } else {
          proceed();
        }
      } catch (error) {
        console.error(error.message + ": " + module.path);
        // console.warn('Search for es6 features in your code and remove them if your browser does not support them, e.g. arrow function');
        console.trace(error);
        reject();
      }
    });
  }

  start() {
    this.scope.trigger("module.start");
  }

  destroy() {
    this.scope.trigger("module.destroy");
  }
}

export default Module;
