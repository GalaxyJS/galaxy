export default function (scope) {
  const view = scope.useView();

  console.log(scope);
  console.log(view);

  view.blueprint({
    tag: 'div',
    children: [
      {
        tag: 'h1',
        text: 'Hello World'
      },
      {
        tag: 'p',
        text: 'This is a paragraph'
      }
    ]
  });
}
